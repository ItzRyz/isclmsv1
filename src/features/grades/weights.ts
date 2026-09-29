import { createClient } from "@/lib/supabase/server";

/**
 * Resolusi bobot: cocok spesifik (period+course/division) dulu,
 * lalu period-only, terakhir default_weight komponen.
 */
export async function resolveWeights(input: {
  academic_period_id: string;
  course_id?: string | null;
  division_id?: string | null;
}): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data: components } = await supabase
    .from("grade_components")
    .select("id, default_weight");
  const weights = new Map<string, number>(
    ((components ?? []) as { id: string; default_weight: number }[]).map(
      (c) => [c.id, Number(c.default_weight)],
    ),
  );
  const { data: rows } = await supabase
    .from("grade_weights")
    .select("grade_component_id, course_id, division_id, weight")
    .eq("academic_period_id", input.academic_period_id);
  const list = (rows ?? []) as {
    grade_component_id: string;
    course_id: string | null;
    division_id: string | null;
    weight: number;
  }[];
  const pick = (course: string | null, division: string | null) =>
    list.find(
      (r) =>
        (r.course_id ?? null) === course &&
        (r.division_id ?? null) === division,
    );
  for (const id of weights.keys()) {
    const specific =
      pick(input.course_id ?? null, input.division_id ?? null) ??
      pick(null, input.division_id ?? null) ??
      pick(input.course_id ?? null, null) ??
      pick(null, null);
    if (specific) weights.set(id, Number(specific.weight));
  }
  return weights;
}
