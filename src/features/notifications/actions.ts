"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function sessionUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user.id;
}

export async function markRead(formData: FormData): Promise<void> {
  const userId = await sessionUserId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", String(formData.get("notification_id") ?? ""))
    .eq("recipient_id", userId);
  if (error) throw new Error(`Gagal menandai dibaca: ${error.message}`);
  revalidatePath("/notifications");
}

export async function markAllRead(): Promise<void> {
  const userId = await sessionUserId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", userId)
    .is("read_at", null);
  if (error) throw new Error(`Gagal menandai semua: ${error.message}`);
  revalidatePath("/notifications");
}
