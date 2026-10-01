"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * P1-804: tandai jawaban diterima. Boleh: pembuat thread atau moderator.
 * Post harus dalam thread yang sama (FK accepted_post dijaga DB).
 */
export async function acceptAnswer(formData: FormData): Promise<void> {
  const threadId = String(formData.get("thread_id") ?? "");
  const postId = String(formData.get("post_id") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");

  const { data: thread } = await supabase
    .from("forum_threads")
    .select("id, created_by")
    .eq("id", threadId)
    .single();
  if (!thread) throw new Error("NOT_FOUND");
  const { data: post } = await supabase
    .from("forum_posts")
    .select("id, thread_id")
    .eq("id", postId)
    .single();
  if (!post || (post as { thread_id: string }).thread_id !== threadId) {
    throw new Error("VALIDATION_ERROR: jawaban bukan dari thread ini");
  }

  const { error } = await supabase.rpc("accept_answer", {
    p_thread_id: threadId,
    p_post_id: postId,
  });
  if (error) throw new Error(`Gagal menandai jawaban: ${error.message}`);
  revalidatePath(`/forum/${threadId}`);
}
