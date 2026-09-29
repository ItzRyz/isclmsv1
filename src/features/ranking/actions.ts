"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createPeriodSchema } from "./schemas";

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

export async function createRankingPeriod(formData: FormData): Promise<void> {
  const parsed = createPeriodSchema.safeParse({
    academic_period_id: formData.get("academic_period_id") || null,
    type: formData.get("type"),
    name: formData.get("name"),
    start_date: formData.get("start_date") || null,
    end_date: formData.get("end_date") || null,
    metric: formData.get("metric"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data periode tidak valid");

  await requirePermission("ranking.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("ranking_periods").insert({
    ...parsed.data,
    organization_id: await orgId(),
    status: "DRAFT",
  });
  if (error) throw new Error(`Gagal membuat periode ranking: ${error.message}`);
  revalidatePath("/ranking");
}

/**
 * Hitung ulang entri: agregat per user sesuai metrik periode, urut desc.
 * POINTS = jumlah poin jendela; GRADES = rata-rata normalized; MIXED = poin + rata-rata.
 * Idempoten: hapus entri lama periode ini lalu tulis baru.
 */
export async function computeRanking(
  periodId: string,
): Promise<{ count: number }> {
  await requirePermission("ranking.manage");
  const supabase = await createClient();
  const { data: period } = await supabase
    .from("ranking_periods")
    .select("id, academic_period_id, start_date, end_date, metric")
    .eq("id", periodId)
    .single();
  if (!period) throw new Error("NOT_FOUND");

  const start = (period.start_date as string | null) ?? "1970-01-01";
  const end = (period.end_date as string | null) ?? "2100-01-01";
  const metric = period.metric as string;
  const totals = new Map<string, { points: number; grades: number[] }>();

  if (metric === "POINTS" || metric === "MIXED") {
    const { data: pts } = await supabase
      .from("point_transactions")
      .select("user_id, amount, created_at")
      .gte("created_at", `${start}T00:00:00`)
      .lte("created_at", `${end}T23:59:59`)
      .limit(5000);
    for (const t of (pts ?? []) as { user_id: string; amount: number }[]) {
      const e = totals.get(t.user_id) ?? { points: 0, grades: [] };
      e.points += Number(t.amount);
      totals.set(t.user_id, e);
    }
  }
  if (metric === "GRADES" || metric === "MIXED") {
    let q = supabase
      .from("grades")
      .select("user_id, normalized_score")
      .limit(5000);
    if (period.academic_period_id) {
      q = q.eq("academic_period_id", period.academic_period_id as string);
    }
    const { data: grades } = await q;
    for (const g of (grades ?? []) as {
      user_id: string;
      normalized_score: number;
    }[]) {
      const e = totals.get(g.user_id) ?? { points: 0, grades: [] };
      e.grades.push(Number(g.normalized_score));
      totals.set(g.user_id, e);
    }
  }

  const scored = [...totals.entries()].map(([userId, v]) => {
    const avg = v.grades.length
      ? v.grades.reduce((s, x) => s + x, 0) / v.grades.length
      : 0;
    const score =
      metric === "POINTS"
        ? v.points
        : metric === "GRADES"
          ? avg
          : v.points + avg;
    return { userId, score: Math.round(score * 100) / 100, points: v.points };
  });
  scored.sort((a, b) => b.score - a.score);

  await supabase
    .from("ranking_entries")
    .delete()
    .eq("ranking_period_id", periodId);
  if (scored.length > 0) {
    const { error } = await supabase.from("ranking_entries").insert(
      scored.map((s, i) => ({
        ranking_period_id: periodId,
        user_id: s.userId,
        rank: i + 1,
        score: s.score,
        points: s.points,
      })),
    );
    if (error) throw new Error(`Gagal menyimpan entri: ${error.message}`);
  }
  revalidatePath("/ranking");
  return { count: scored.length };
}

export async function computeRankingForm(formData: FormData): Promise<void> {
  await computeRanking(String(formData.get("period_id") ?? ""));
}

export async function deleteRankingPeriod(formData: FormData): Promise<void> {
  await requirePermission("ranking.manage");
  const supabase = await createClient();
  const { error } = await supabase
    .from("ranking_periods")
    .delete()
    .eq("id", String(formData.get("period_id") ?? ""));
  if (error) throw new Error(`Gagal menghapus periode: ${error.message}`);
  revalidatePath("/ranking");
}
