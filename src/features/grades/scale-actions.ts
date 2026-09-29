"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { scaleSchema } from "./scale-schemas";

async function orgId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "study-club")
    .single();
  if (!data) throw new Error("Organisasi belum ada.");
  return data.id as string;
}

export async function upsertScale(formData: FormData): Promise<void> {
  const parsed = scaleSchema.safeParse({
    code: formData.get("code"),
    letter: formData.get("letter"),
    min_score: formData.get("min_score"),
    max_score: formData.get("max_score"),
    is_passing: formData.get("is_passing") === "on",
    remark: formData.get("remark") || null,
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data skala tidak valid");

  await requirePermission("grade.update");
  const supabase = await createClient();
  const { error } = await supabase
    .from("grade_scales")
    .upsert(
      { ...parsed.data, organization_id: await orgId() },
      { onConflict: "organization_id,code" },
    );
  if (error) throw new Error(`Gagal menyimpan skala: ${error.message}`);
  revalidatePath("/grades/scales");
}

export async function deleteScale(formData: FormData): Promise<void> {
  await requirePermission("grade.update");
  const supabase = await createClient();
  const { error } = await supabase
    .from("grade_scales")
    .delete()
    .eq("id", String(formData.get("scale_id") ?? ""));
  if (error) throw new Error(`Gagal menghapus skala: ${error.message}`);
  revalidatePath("/grades/scales");
}
