"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createCompetitionSchema, resultSchema } from "./schemas";

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

export async function createCompetition(formData: FormData): Promise<void> {
  const parsed = createCompetitionSchema.safeParse({
    division_id: formData.get("division_id") || null,
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || null,
    starts_at: formData.get("starts_at") || null,
    ends_at: formData.get("ends_at") || null,
    status: formData.get("status"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data kompetisi tidak valid");

  const { userId } = await requirePermission("event.create");
  const supabase = await createClient();
  const { error } = await supabase.from("competitions").insert({
    ...parsed.data,
    organization_id: await orgId(),
    created_by: userId,
  });
  if (error) throw new Error(`Gagal membuat kompetisi: ${error.message}`);
  revalidatePath("/competitions");
}

export async function deleteCompetition(formData: FormData): Promise<void> {
  await requirePermission("event.delete");
  const supabase = await createClient();
  const { error } = await supabase
    .from("competitions")
    .delete()
    .eq("id", String(formData.get("competition_id") ?? ""));
  if (error) throw new Error(`Gagal menghapus kompetisi: ${error.message}`);
  revalidatePath("/competitions");
}

export async function addParticipant(formData: FormData): Promise<void> {
  const competitionId = String(formData.get("competition_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  await requirePermission("event.update");
  const supabase = await createClient();
  const { error } = await supabase.from("competition_participants").insert({
    competition_id: competitionId,
    user_id: userId,
    status: "REGISTERED",
  });
  if (error) {
    if (error.code === "23505") throw new Error("CONFLICT: sudah terdaftar");
    throw new Error(`Gagal menambah peserta: ${error.message}`);
  }
  revalidatePath(`/competitions/${competitionId}`);
}

/**
 * Catat hasil + beri poin (transaksi ledger, idempoten per nilai poin:
 * selisih dari points_awarded sebelumnya dibukukan sebagai koreksi).
 */
export async function recordResult(formData: FormData): Promise<void> {
  const parsed = resultSchema.safeParse({
    competition_id: formData.get("competition_id"),
    user_id: formData.get("user_id"),
    rank: formData.get("rank"),
    score: formData.get("score"),
    points: formData.get("points"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data hasil tidak valid");

  const { userId } = await requirePermission("event.update");
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("competition_participants")
    .select("points_awarded")
    .eq("competition_id", parsed.data.competition_id)
    .eq("user_id", parsed.data.user_id)
    .single();
  if (!existing) throw new Error("NOT_FOUND: peserta belum terdaftar");

  const prev = Number(
    (existing as { points_awarded: number }).points_awarded ?? 0,
  );
  const { error } = await supabase
    .from("competition_participants")
    .update({
      rank: parsed.data.rank,
      score: parsed.data.score,
      points_awarded: parsed.data.points,
      status: "RANKED",
    })
    .eq("competition_id", parsed.data.competition_id)
    .eq("user_id", parsed.data.user_id);
  if (error) throw new Error(`Gagal mencatat hasil: ${error.message}`);

  const delta = parsed.data.points - prev;
  if (delta !== 0) {
    const { data: canAward } = await supabase.rpc("has_permission", {
      p_user_id: userId,
      p_permission_code: "point.manage",
    });
    if (!canAward)
      throw new Error("FORBIDDEN: butuh point.manage untuk beri poin");
    const { error: ptError } = await supabase
      .from("point_transactions")
      .insert({
        user_id: parsed.data.user_id,
        amount: delta,
        point_type: "COMPETITION",
        source_type: "COMPETITION",
        source_id: parsed.data.competition_id,
        description: `Kompetisi (peringkat ${parsed.data.rank})`,
        created_by: userId,
      });
    if (ptError) throw new Error(`Gagal memberi poin: ${ptError.message}`);
  }
  revalidatePath(`/competitions/${parsed.data.competition_id}`);
}
