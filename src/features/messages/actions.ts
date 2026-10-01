"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const startSchema = z.object({ other_user_id: z.string().uuid() });
const sendSchema = z.object({
  conversation_id: z.string().uuid(),
  body: z.string().trim().min(1).max(5000),
});

async function sessionUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user.id;
}

/** Mulai/gunakan kembali DM 1-lawan-1 dengan user lain. */
export async function startConversation(formData: FormData): Promise<void> {
  const parsed = startSchema.safeParse({
    other_user_id: formData.get("other_user_id"),
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");
  const userId = await sessionUserId();
  if (parsed.data.other_user_id === userId) {
    throw new Error("VALIDATION_ERROR: tidak bisa DM diri sendiri");
  }
  const supabase = await createClient();
  // Cari DM yang anggotanya tepat 2 orang ini.
  const { data: mine } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId);
  const myIds = ((mine ?? []) as { conversation_id: string }[]).map(
    (m) => m.conversation_id,
  );
  let existing: string | null = null;
  if (myIds.length > 0) {
    const { data: other } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", parsed.data.other_user_id)
      .in("conversation_id", myIds);
    const otherIds = new Set(
      ((other ?? []) as { conversation_id: string }[]).map(
        (m) => m.conversation_id,
      ),
    );
    for (const cid of myIds) {
      const { count } = await supabase
        .from("conversation_members")
        .select("user_id", { count: "exact", head: true })
        .eq("conversation_id", cid);
      if (otherIds.has(cid) && count === 2) {
        existing = cid;
        break;
      }
    }
  }
  if (!existing) {
    const { data: convo, error } = await supabase
      .from("conversations")
      .insert({ type: "DIRECT" })
      .select("id")
      .single();
    if (error || !convo)
      throw new Error(`Gagal membuat percakapan: ${error?.message}`);
    const cid = (convo as { id: string }).id;
    const { error: mError } = await supabase
      .from("conversation_members")
      .insert([
        { conversation_id: cid, user_id: userId },
        { conversation_id: cid, user_id: parsed.data.other_user_id },
      ]);
    if (mError) throw new Error(`Gagal menambah anggota: ${mError.message}`);
    existing = cid;
  }
  revalidatePath("/messages");
}

export async function sendMessage(formData: FormData): Promise<void> {
  const parsed = sendSchema.safeParse({
    conversation_id: formData.get("conversation_id"),
    body: formData.get("body"),
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");
  const userId = await sessionUserId();
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("conversation_id", parsed.data.conversation_id)
    .eq("user_id", userId)
    .single();
  if (!member) throw new Error("FORBIDDEN: bukan anggota percakapan");
  const { error } = await supabase.from("messages").insert({
    conversation_id: parsed.data.conversation_id,
    sender_id: userId,
    body: parsed.data.body,
  });
  if (error) throw new Error(`Gagal mengirim: ${error.message}`);
  revalidatePath(`/messages/${parsed.data.conversation_id}`);
}

export async function markConversationRead(
  conversationId: string,
): Promise<void> {
  const userId = await sessionUserId();
  const supabase = await createClient();
  await supabase
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
}
