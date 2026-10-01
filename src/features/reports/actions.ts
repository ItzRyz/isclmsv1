"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { letterFor, weightedTotal } from "@/features/grades/calc";
import { resolveWeights } from "@/features/grades/weights";

const generateSchema = z.object({
  user_id: z.string().uuid(),
  academic_period_id: z.string().uuid(),
});

/**
 * Generate rapor: agregat nilai per komponen -> total berbobot ->
 * huruf via skala org. Idempoten (upsert per user+periode + ganti items).
 */
export async function generateReportCard(formData: FormData): Promise<void> {
  const parsed = generateSchema.safeParse({
    user_id: formData.get("user_id"),
    academic_period_id: formData.get("academic_period_id"),
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");

  const { userId } = await requirePermission("grade.publish");
  const supabase = await createClient();

  const { data: grades } = await supabase
    .from("grades")
    .select("grade_component_id, normalized_score")
    .eq("user_id", parsed.data.user_id)
    .eq("academic_period_id", parsed.data.academic_period_id);
  const byComp = new Map<string, number[]>();
  for (const g of (grades ?? []) as {
    grade_component_id: string;
    normalized_score: number;
  }[]) {
    byComp.set(g.grade_component_id, [
      ...(byComp.get(g.grade_component_id) ?? []),
      Number(g.normalized_score),
    ]);
  }
  if (byComp.size === 0)
    throw new Error("VALIDATION_ERROR: belum ada nilai periode ini");

  const weights = await resolveWeights({
    academic_period_id: parsed.data.academic_period_id,
  });
  const parts = [...byComp.entries()].map(([componentId, scores]) => ({
    componentId,
    raw: scores.reduce((s, x) => s + x, 0) / scores.length,
    max: 100,
    weight: weights.get(componentId) ?? 0,
  }));
  const { total, parts: detailed } = weightedTotal(parts);

  const { data: scales } = await supabase
    .from("grade_scales")
    .select("letter, min_score, max_score, is_passing");
  const { letter } = letterFor(
    (
      (scales ?? []) as {
        letter: string;
        min_score: number;
        max_score: number;
        is_passing: boolean;
      }[]
    ).map((s) => ({
      ...s,
      min_score: Number(s.min_score),
      max_score: Number(s.max_score),
    })),
    total,
  );

  const { data: report, error } = await supabase
    .from("report_cards")
    .upsert(
      {
        user_id: parsed.data.user_id,
        academic_period_id: parsed.data.academic_period_id,
        total_score: total,
        grade_letter: letter,
      },
      { onConflict: "user_id,academic_period_id" },
    )
    .select("id")
    .single();
  if (error || !report)
    throw new Error(`Gagal menyimpan rapor: ${error?.message}`);
  const reportId = (report as { id: string }).id;
  await supabase
    .from("report_card_items")
    .delete()
    .eq("report_card_id", reportId);
  const { error: itemError } = await supabase.from("report_card_items").insert(
    detailed.map((p) => ({
      report_card_id: reportId,
      grade_component_id: p.componentId,
      score: p.normalized,
      weight: p.weight,
      weighted_score: p.weighted,
    })),
  );
  if (itemError)
    throw new Error(`Gagal menyimpan item rapor: ${itemError.message}`);

  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action: "report.generate",
    entity_type: "report_cards",
    entity_id: reportId,
    new_values: { total, letter },
  });

  revalidatePath("/reports");
  redirect(
    `/reports?user=${parsed.data.user_id}&period=${parsed.data.academic_period_id}`,
  );
}
