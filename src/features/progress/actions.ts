"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/features/activity/log";

const markSchema = z.object({ material_id: z.string().uuid() });

async function sessionUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user.id;
}

/** Tandai materi selesai (100%) milik sendiri, idempoten. */
export async function completeMaterial(formData: FormData): Promise<void> {
  const parsed = markSchema.safeParse({
    material_id: formData.get("material_id"),
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");
  const userId = await sessionUserId();
  const supabase = await createClient();
  const { error } = await supabase.from("material_progress").upsert(
    {
      user_id: userId,
      material_id: parsed.data.material_id,
      completed_at: new Date().toISOString(),
      progress_percent: 100,
    },
    { onConflict: "user_id,material_id" },
  );
  if (error) throw new Error(`Gagal menandai selesai: ${error.message}`);
  await logActivity(supabase, {
    userId,
    type: "material.complete",
    entityType: "material",
    entityId: parsed.data.material_id,
  });
  revalidatePath(`/materials/${parsed.data.material_id}`);
}

/** Batalkan tanda selesai (kembali 0%). */
export async function uncompleteMaterial(formData: FormData): Promise<void> {
  const parsed = markSchema.safeParse({
    material_id: formData.get("material_id"),
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");
  const userId = await sessionUserId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("material_progress")
    .update({ completed_at: null, progress_percent: 0 })
    .eq("user_id", userId)
    .eq("material_id", parsed.data.material_id);
  if (error) throw new Error(`Gagal membatalkan: ${error.message}`);
  await logActivity(supabase, {
    userId,
    type: "material.uncomplete",
    entityType: "material",
    entityId: parsed.data.material_id,
  });
  revalidatePath(`/materials/${parsed.data.material_id}`);
}
