"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const toggleSchema = z.object({ material_id: z.string().uuid() });

async function sessionUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user.id;
}

/** Toggle bookmark milik sendiri (idempoten). */
export async function toggleBookmark(formData: FormData): Promise<void> {
  const parsed = toggleSchema.safeParse({
    material_id: formData.get("material_id"),
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");
  const userId = await sessionUserId();
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("material_bookmarks")
    .select("material_id")
    .eq("user_id", userId)
    .eq("material_id", parsed.data.material_id)
    .single();
  if (existing) {
    const { error } = await supabase
      .from("material_bookmarks")
      .delete()
      .eq("user_id", userId)
      .eq("material_id", parsed.data.material_id);
    if (error) throw new Error(`Gagal menghapus bookmark: ${error.message}`);
  } else {
    const { error } = await supabase.from("material_bookmarks").insert({
      user_id: userId,
      material_id: parsed.data.material_id,
    });
    if (error) throw new Error(`Gagal menambah bookmark: ${error.message}`);
  }
  revalidatePath(`/materials/${parsed.data.material_id}`);
  revalidatePath("/learning/bookmarks");
}
