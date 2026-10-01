"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { profileEditSchema, roleChangeSchema, statusSchema } from "./schemas";

type Supa = Awaited<ReturnType<typeof createClient>>;

async function audit(
  supa: Supa,
  actor: string,
  action: string,
  entityId: string,
  oldV: unknown,
  newV: unknown,
): Promise<void> {
  await supa.from("audit_logs").insert({
    actor_id: actor,
    action,
    entity_type: "profiles",
    entity_id: entityId,
    old_values: oldV as Record<string, unknown>,
    new_values: newV as Record<string, unknown>,
  });
}

export async function updateUserProfile(formData: FormData): Promise<void> {
  const parsed = profileEditSchema.safeParse({
    user_id: formData.get("user_id"),
    full_name: formData.get("full_name") || null,
    username: formData.get("username") || null,
    phone: formData.get("phone") || null,
    student_number: formData.get("student_number") || null,
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data profil tidak valid");

  const { userId } = await requirePermission("user.update");
  const supabase = await createClient();
  const { data: old } = await supabase
    .from("profiles")
    .select("full_name, username, phone, student_number")
    .eq("id", parsed.data.user_id)
    .single();
  const { user_id, ...rest } = parsed.data;
  const { error } = await supabase
    .from("profiles")
    .update(rest)
    .eq("id", user_id);
  if (error) {
    if (error.code === "23505")
      throw new Error("CONFLICT: username/NIM sudah dipakai");
    throw new Error(`Gagal mengubah profil: ${error.message}`);
  }
  await audit(supabase, userId, "user.update", user_id, old, rest);
  revalidatePath(`/admin/users/${user_id}`);
}

export async function setUserStatus(formData: FormData): Promise<void> {
  const parsed = statusSchema.safeParse({
    user_id: formData.get("user_id"),
    status: formData.get("status"),
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");
  const { userId } = await requirePermission("user.update");
  if (parsed.data.user_id === userId && parsed.data.status !== "ACTIVE") {
    throw new Error("VALIDATION_ERROR: tidak bisa menonaktifkan diri sendiri");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.user_id);
  if (error) throw new Error(`Gagal mengubah status: ${error.message}`);

  // Deaktifasi berlapis: blokir sign-in di Supabase Auth (ban) — sesi lama
  // sudah ditutup app-side oleh gerbang status profil (proxy + can()).
  const banned = parsed.data.status !== "ACTIVE";
  const { error: banError } =
    await createAdminClient().auth.admin.updateUserById(
      parsed.data.user_id,
      banned ? { ban_duration: "8760h" } : { ban_duration: "none" },
    );
  if (banError) {
    throw new Error(
      `Status profil berubah tapi blokir auth gagal: ${banError.message}`,
    );
  }

  await audit(
    supabase,
    userId,
    "user.status",
    parsed.data.user_id,
    {},
    {
      status: parsed.data.status,
    },
  );
  revalidatePath(`/admin/users/${parsed.data.user_id}`);
}

async function lastSuperAdmin(supa: Supa, userId: string): Promise<boolean> {
  const { data: roles } = await supa
    .from("user_roles")
    .select("role_id, roles(code)")
    .eq("user_id", userId);
  const codes = (
    (roles ?? []) as unknown as {
      role_id: string;
      roles: { code: string } | { code: string }[] | null;
    }[]
  ).map((r) => (Array.isArray(r.roles) ? r.roles[0]?.code : r.roles?.code));
  if (!codes.includes("SUPER_ADMIN")) return false;
  const { data: others } = await supa
    .from("user_roles")
    .select("user_id, roles!inner(code)")
    .eq("roles.code", "SUPER_ADMIN")
    .neq("user_id", userId)
    .limit(1);
  return (others ?? []).length === 0;
}

export async function assignUserRole(formData: FormData): Promise<void> {
  const parsed = roleChangeSchema.safeParse({
    user_id: formData.get("user_id"),
    role_id: formData.get("role_id"),
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");
  const { userId } = await requirePermission("user.assign_role");
  const supabase = await createClient();
  const { error } = await supabase.from("user_roles").insert({
    user_id: parsed.data.user_id,
    role_id: parsed.data.role_id,
    assigned_by: userId,
  });
  if (error) {
    if (error.code === "23505")
      throw new Error("CONFLICT: peran sudah dimiliki");
    throw new Error(`Gagal assign peran: ${error.message}`);
  }
  revalidatePath(`/admin/users/${parsed.data.user_id}`);
}

export async function revokeUserRole(formData: FormData): Promise<void> {
  const parsed = roleChangeSchema.safeParse({
    user_id: formData.get("user_id"),
    role_id: formData.get("role_id"),
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");
  await requirePermission("user.assign_role");
  const supabase = await createClient();
  const { data: role } = await supabase
    .from("roles")
    .select("code")
    .eq("id", parsed.data.role_id)
    .single();
  if ((role as { code: string } | null)?.code === "SUPER_ADMIN") {
    if (await lastSuperAdmin(supabase, parsed.data.user_id)) {
      throw new Error("FORBIDDEN: super-admin terakhir tidak boleh dicabut");
    }
  }
  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", parsed.data.user_id)
    .eq("role_id", parsed.data.role_id);
  if (error) throw new Error(`Gagal revoke peran: ${error.message}`);
  revalidatePath(`/admin/users/${parsed.data.user_id}`);
}
