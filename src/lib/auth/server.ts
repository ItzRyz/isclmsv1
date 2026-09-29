import { createClient } from "@/lib/supabase/server";
import {
  AuthorizationError,
  evaluateAccess,
  type Memberships,
  type PermissionAssignment,
  type ResourceContext,
} from "./authorization";

type RoleRow = {
  roles: {
    code: string;
    role_permissions: {
      scope: string;
      permissions: { code: string } | { code: string }[] | null;
    }[];
  } | null;
};

/** Muat assignment + membership user dari RLS (difilter ke baris miliknya). */
export async function loadAccess(userId: string): Promise<{
  assignments: PermissionAssignment[];
  memberships: Memberships;
}> {
  const supabase = await createClient();

  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("roles(code, role_permissions(scope, permissions(code)))")
    .eq("user_id", userId);
  if (roleError) {
    throw new Error(`Gagal memuat peran: ${roleError.message}`);
  }

  const assignments: PermissionAssignment[] = [];
  for (const row of (roleRows ?? []) as unknown as RoleRow[]) {
    const perms = row.roles?.role_permissions ?? [];
    for (const rp of perms) {
      const p = rp.permissions;
      const code = Array.isArray(p) ? p[0]?.code : p?.code;
      if (code) {
        assignments.push({
          permission: code,
          scope: rp.scope as PermissionAssignment["scope"],
        });
      }
    }
  }

  const { data: divRows, error: divError } = await supabase
    .from("user_divisions")
    .select("division_id")
    .eq("user_id", userId)
    .is("ended_at", null);
  if (divError) throw new Error(`Gagal memuat divisi: ${divError.message}`);

  const { data: classRows, error: classError } = await supabase
    .from("class_members")
    .select("class_id")
    .eq("user_id", userId)
    .is("left_at", null)
    .eq("status", "ACTIVE");
  if (classError) throw new Error(`Gagal memuat kelas: ${classError.message}`);

  return {
    assignments,
    memberships: {
      userId,
      divisionIds: (divRows ?? []).map(
        (r: { division_id: string }) => r.division_id,
      ),
      classIds: (classRows ?? []).map((r: { class_id: string }) => r.class_id),
    },
  };
}

async function getSessionUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Boolean check; false bila tanpa sesi atau tidak memenuhi scope. */
export async function can(
  permission: string,
  context: ResourceContext = {},
): Promise<boolean> {
  const userId = await getSessionUserId();
  if (!userId) return false;
  const { assignments, memberships } = await loadAccess(userId);
  return evaluateAccess(assignments, memberships, permission, context);
}

/**
 * Wajib lolos; throw AuthorizationError(UNAUTHENTICATED/FORBIDDEN).
 * Pakai ini di setiap server action / route sensitif.
 */
export async function requirePermission(
  permission: string,
  context: ResourceContext = {},
): Promise<{ userId: string }> {
  const userId = await getSessionUserId();
  if (!userId) {
    throw new AuthorizationError("UNAUTHENTICATED", "Masuk dulu.", permission);
  }
  const { assignments, memberships } = await loadAccess(userId);
  if (!evaluateAccess(assignments, memberships, permission, context)) {
    throw new AuthorizationError(
      "FORBIDDEN",
      `Butuh permission ${permission}.`,
      permission,
    );
  }
  return { userId };
}
