"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireAssignRole() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");

  const { data: allowed, error } = await supabase.rpc("has_permission", {
    p_user_id: user.id,
    p_permission_code: "user.assign_role",
  });
  if (error || !allowed) throw new Error("FORBIDDEN: user.assign_role");
  return { supabase, actorId: user.id };
}

export async function assignRole(formData: FormData): Promise<void> {
  const userId = String(formData.get("user_id") ?? "").trim();
  const roleId = String(formData.get("role_id") ?? "").trim();
  if (!UUID_RE.test(userId) || !UUID_RE.test(roleId)) {
    throw new Error("VALIDATION_ERROR: user_id/role_id harus UUID");
  }
  const { supabase, actorId } = await requireAssignRole();
  const { error } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role_id: roleId, assigned_by: actorId });
  if (error) throw new Error(`Gagal assign role: ${error.message}`);
  revalidatePath("/admin/roles");
}

export async function revokeRole(formData: FormData): Promise<void> {
  const userId = String(formData.get("user_id") ?? "").trim();
  const roleId = String(formData.get("role_id") ?? "").trim();
  if (!UUID_RE.test(userId) || !UUID_RE.test(roleId)) {
    throw new Error("VALIDATION_ERROR: user_id/role_id harus UUID");
  }
  const { supabase } = await requireAssignRole();
  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role_id", roleId);
  if (error) throw new Error(`Gagal revoke role: ${error.message}`);
  revalidatePath("/admin/roles");
}
