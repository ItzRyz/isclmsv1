"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Evaluasi ulang achievement milik sendiri (idempoten). */
export async function checkMyAchievements(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("check_achievements");
  if (error) throw new Error(`Gagal memeriksa: ${error.message}`);
  revalidatePath("/achievements");
}
