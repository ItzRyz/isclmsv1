"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { updateOrganizationSchema } from "./schemas";

export async function getOrganization() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, description, logo_path, created_at, updated_at")
    .eq("slug", "study-club")
    .single();
  if (error) throw new Error(`Gagal memuat organisasi: ${error.message}`);
  return data;
}

export async function updateOrganization(formData: FormData): Promise<void> {
  const parsed = updateOrganizationSchema.safeParse({
    organization_id: formData.get("organization_id"),
    name: formData.get("name"),
    description: formData.get("description") || null,
    logo_path: formData.get("logo_path") || null,
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data organisasi tidak valid");

  const { userId } = await requirePermission("settings.manage");
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      description: parsed.data.description,
      logo_path: parsed.data.logo_path,
    })
    .eq("id", parsed.data.organization_id);
  if (error) throw new Error(`Gagal menyimpan organisasi: ${error.message}`);

  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action: "organization.update",
    entity_type: "organizations",
    entity_id: parsed.data.organization_id,
    new_values: { name: parsed.data.name },
  });
  revalidatePath("/org");
}
