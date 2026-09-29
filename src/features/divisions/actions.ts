"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  DIVISION_COORDINATOR_ROLE,
  coordinatorAssignSchema,
  createDivisionSchema,
  divisionMemberSchema,
  updateDivisionSchema,
} from "./schemas";

async function audit(
  userId: string,
  action: string,
  entity: string,
  entityId: string,
  values: unknown,
) {
  const supabase = await createClient();
  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action,
    entity_type: entity,
    entity_id: entityId,
    new_values: values as Record<string, unknown>,
  });
}

export async function createDivision(formData: FormData): Promise<void> {
  const parsed = createDivisionSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    slug: formData.get("slug"),
    description: formData.get("description") || null,
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data divisi tidak valid");

  const { userId } = await requirePermission("division.create");
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "study-club")
    .single();
  if (!org) throw new Error("Organisasi belum ada.");
  const { data, error } = await supabase
    .from("divisions")
    .insert({ ...parsed.data, organization_id: org.id })
    .select("id")
    .single();
  if (error) throw new Error(`Gagal membuat divisi: ${error.message}`);
  await audit(userId, "division.create", "divisions", data.id, parsed.data);
  revalidatePath("/divisions");
}

export async function updateDivision(formData: FormData): Promise<void> {
  const parsed = updateDivisionSchema.safeParse({
    division_id: formData.get("division_id"),
    name: formData.get("name"),
    code: formData.get("code"),
    slug: formData.get("slug"),
    description: formData.get("description") || null,
    status: formData.get("status"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data divisi tidak valid");

  const { userId } = await requirePermission("division.update");
  const supabase = await createClient();
  const { error } = await supabase
    .from("divisions")
    .update({
      name: parsed.data.name,
      code: parsed.data.code,
      slug: parsed.data.slug,
      description: parsed.data.description,
      status: parsed.data.status,
    })
    .eq("id", parsed.data.division_id);
  if (error) throw new Error(`Gagal mengubah divisi: ${error.message}`);
  await audit(userId, "division.update", "divisions", parsed.data.division_id, {
    name: parsed.data.name,
  });
  revalidatePath("/divisions");
}

export async function deleteDivision(formData: FormData): Promise<void> {
  const divisionId = String(formData.get("division_id") ?? "");
  const { userId } = await requirePermission("division.delete");
  const supabase = await createClient();
  const { error } = await supabase
    .from("divisions")
    .delete()
    .eq("id", divisionId);
  if (error) throw new Error(`Gagal menghapus divisi: ${error.message}`);
  await audit(userId, "division.delete", "divisions", divisionId, {});
  revalidatePath("/divisions");
}

export async function addDivisionMember(formData: FormData): Promise<void> {
  const parsed = divisionMemberSchema.safeParse({
    division_id: formData.get("division_id"),
    user_id: formData.get("user_id"),
    membership_type: formData.get("membership_type"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data anggota tidak valid");

  const { userId } = await requirePermission("member.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("user_divisions").upsert(
    {
      user_id: parsed.data.user_id,
      division_id: parsed.data.division_id,
      membership_type: parsed.data.membership_type,
      ended_at: null,
    },
    { onConflict: "user_id,division_id" },
  );
  if (error) throw new Error(`Gagal menambah anggota: ${error.message}`);
  await audit(
    userId,
    "division.member_add",
    "user_divisions",
    parsed.data.user_id,
    parsed.data,
  );
  revalidatePath(`/divisions/${parsed.data.division_id}`);
}

export async function assignCoordinator(formData: FormData): Promise<void> {
  const parsed = coordinatorAssignSchema.safeParse({
    division_id: formData.get("division_id"),
    user_id: formData.get("user_id"),
    role_id: formData.get("role_id"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data koordinator tidak valid");

  const { userId } = await requirePermission("member.manage");
  const supabase = await createClient();

  const { data: division } = await supabase
    .from("divisions")
    .select("code")
    .eq("id", parsed.data.division_id)
    .single();
  const { data: role } = await supabase
    .from("roles")
    .select("code")
    .eq("id", parsed.data.role_id)
    .single();
  const expected = division
    ? DIVISION_COORDINATOR_ROLE[division.code]
    : undefined;
  if (!expected || role?.code !== expected) {
    throw new Error(
      "VALIDATION_ERROR: peran koordinator tidak sesuai divisinya",
    );
  }

  const { error: roleError } = await supabase.from("user_roles").upsert(
    {
      user_id: parsed.data.user_id,
      role_id: parsed.data.role_id,
      assigned_by: userId,
    },
    { onConflict: "user_id,role_id" },
  );
  if (roleError) throw new Error(`Gagal assign peran: ${roleError.message}`);
  const { error: memberError } = await supabase.from("user_divisions").upsert(
    {
      user_id: parsed.data.user_id,
      division_id: parsed.data.division_id,
      membership_type: "COORDINATOR",
      ended_at: null,
    },
    { onConflict: "user_id,division_id" },
  );
  if (memberError)
    throw new Error(`Gagal menambah keanggotaan: ${memberError.message}`);
  await audit(
    userId,
    "division.coordinator_assign",
    "divisions",
    parsed.data.division_id,
    {
      user_id: parsed.data.user_id,
      role: role.code,
    },
  );
  revalidatePath(`/divisions/${parsed.data.division_id}`);
}
