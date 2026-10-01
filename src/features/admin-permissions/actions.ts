"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/server";

/** Kontrol sistem yang tidak boleh dicabut dari SUPER_ADMIN. */
const PROTECTED: [string, string][] = [
  ["SUPER_ADMIN", "user.assign_role"],
  ["SUPER_ADMIN", "permission.manage"],
  ["SUPER_ADMIN", "role.create"],
  ["SUPER_ADMIN", "role.update"],
  ["SUPER_ADMIN", "role.delete"],
];

const toggleSchema = z.object({
  role_code: z.string().min(2).max(40),
  permission_code: z.string().regex(/^[a-z_]+\.[a-z_]+$/),
  scope: z.enum([
    "GLOBAL",
    "ORGANIZATION",
    "DIVISION",
    "CLASS",
    "COURSE",
    "OWN",
  ]),
  grant: z.enum(["on", "off"]),
});

export async function togglePermission(formData: FormData): Promise<void> {
  const parsed = toggleSchema.safeParse({
    role_code: formData.get("role_code"),
    permission_code: formData.get("permission_code"),
    scope: formData.get("scope"),
    grant: formData.get("grant"),
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");

  const { userId } = await requirePermission("permission.manage");
  const supabase = await createClient();
  if (
    parsed.data.grant === "off" &&
    PROTECTED.some(
      ([r, p]) =>
        r === parsed.data.role_code && p === parsed.data.permission_code,
    )
  ) {
    throw new Error("FORBIDDEN: kontrol sistem SUPER_ADMIN dilindungi");
  }

  const { data: role } = await supabase
    .from("roles")
    .select("id")
    .eq("code", parsed.data.role_code)
    .single();
  const { data: perm } = await supabase
    .from("permissions")
    .select("id")
    .eq("code", parsed.data.permission_code)
    .single();
  if (!role || !perm) throw new Error("NOT_FOUND");
  const roleId = (role as { id: string }).id;
  const permId = (perm as { id: string }).id;

  if (parsed.data.grant === "on") {
    const { error } = await supabase.from("role_permissions").insert({
      role_id: roleId,
      permission_id: permId,
      scope: parsed.data.scope,
    });
    if (error && error.code !== "23505") {
      throw new Error(`Gagal memberi permission: ${error.message}`);
    }
  } else {
    const { error } = await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId)
      .eq("permission_id", permId)
      .eq("scope", parsed.data.scope);
    if (error) throw new Error(`Gagal mencabut permission: ${error.message}`);
  }
  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action:
      parsed.data.grant === "on" ? "permission.grant" : "permission.revoke",
    entity_type: "role_permissions",
    entity_id: `${parsed.data.role_code}:${parsed.data.permission_code}:${parsed.data.scope}`,
    new_values: parsed.data,
  });
  revalidatePath("/admin/permissions");
}
