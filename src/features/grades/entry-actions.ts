"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { normalize } from "./calc";
import { entrySchema } from "./entry-schemas";
import { resolveWeights } from "./weights";

export async function enterGrade(formData: FormData): Promise<void> {
  const parsed = entrySchema.safeParse({
    user_id: formData.get("user_id"),
    academic_period_id: formData.get("academic_period_id"),
    course_id: formData.get("course_id") || null,
    grade_component_id: formData.get("grade_component_id"),
    source_type: formData.get("source_type"),
    source_id: formData.get("source_id") || null,
    raw_score: formData.get("raw_score"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data nilai tidak valid");

  const { userId } = await requirePermission("grade.create");
  const supabase = await createClient();
  const { data: comp } = await supabase
    .from("grade_components")
    .select("id, max_score")
    .eq("id", parsed.data.grade_component_id)
    .single();
  if (!comp) throw new Error("NOT_FOUND: komponen tidak ada");
  if (parsed.data.raw_score > Number(comp.max_score)) {
    throw new Error(`VALIDATION_ERROR: skor melebihi maks ${comp.max_score}`);
  }
  const weights = await resolveWeights({
    academic_period_id: parsed.data.academic_period_id,
    course_id: parsed.data.course_id ?? null,
    division_id: null,
  });
  const weight = weights.get(parsed.data.grade_component_id) ?? 0;
  const normalized = normalize(parsed.data.raw_score, Number(comp.max_score));

  const { data, error } = await supabase
    .from("grades")
    .insert({
      user_id: parsed.data.user_id,
      academic_period_id: parsed.data.academic_period_id,
      course_id: parsed.data.course_id ?? null,
      grade_component_id: parsed.data.grade_component_id,
      source_type: parsed.data.source_type,
      source_id: parsed.data.source_id,
      raw_score: parsed.data.raw_score,
      normalized_score: normalized,
      weight_applied: weight,
      weighted_score: (normalized * weight) / 100,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !data)
    throw new Error(`Gagal menyimpan nilai: ${error?.message}`);
  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action: "grade.create",
    entity_type: "grades",
    entity_id: (data as { id: string }).id,
    new_values: { raw: parsed.data.raw_score, normalized, weight },
  });
  revalidatePath("/grades/entry");
}

export async function updateGrade(formData: FormData): Promise<void> {
  const parsed = entrySchema.safeParse({
    user_id: formData.get("user_id"),
    academic_period_id: formData.get("academic_period_id"),
    course_id: formData.get("course_id") || null,
    grade_component_id: formData.get("grade_component_id"),
    source_type: formData.get("source_type"),
    source_id: formData.get("source_id") || null,
    raw_score: formData.get("raw_score"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data nilai tidak valid");
  const gradeId = String(formData.get("grade_id") ?? "");

  const { userId } = await requirePermission("grade.update");
  const supabase = await createClient();
  const { data: old } = await supabase
    .from("grades")
    .select("id, raw_score, grade_components(max_score)")
    .eq("id", gradeId)
    .single();
  if (!old) throw new Error("NOT_FOUND");
  const compsRaw = (
    old as unknown as {
      grade_components: { max_score: number } | { max_score: number }[] | null;
    }
  ).grade_components;
  const comps = Array.isArray(compsRaw) ? compsRaw[0] : compsRaw;
  const maxScore = Number(comps?.max_score ?? 100);
  if (parsed.data.raw_score > maxScore) {
    throw new Error(`VALIDATION_ERROR: skor melebihi maks ${maxScore}`);
  }
  const weights = await resolveWeights({
    academic_period_id: parsed.data.academic_period_id,
    course_id: parsed.data.course_id ?? null,
    division_id: null,
  });
  const weight = weights.get(parsed.data.grade_component_id) ?? 0;
  const normalized = normalize(parsed.data.raw_score, maxScore);

  const { error } = await supabase
    .from("grades")
    .update({
      raw_score: parsed.data.raw_score,
      normalized_score: normalized,
      weight_applied: weight,
      weighted_score: (normalized * weight) / 100,
      updated_by: userId,
    })
    .eq("id", gradeId);
  if (error) throw new Error(`Gagal mengubah nilai: ${error.message}`);
  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action: "grade.update",
    entity_type: "grades",
    entity_id: gradeId,
    old_values: { raw: (old as { raw_score: number }).raw_score },
    new_values: { raw: parsed.data.raw_score, normalized, weight },
  });
  revalidatePath("/grades/entry");
}
