"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { postSchema, threadSchema } from "./schemas";

async function sessionUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user.id;
}

export async function createThread(formData: FormData): Promise<void> {
  const parsed = threadSchema.safeParse({
    category_id: formData.get("category_id"),
    course_id: formData.get("course_id") || null,
    class_id: formData.get("class_id") || null,
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data thread tidak valid");

  const userId = await sessionUserId();
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("has_permission", {
    p_user_id: userId,
    p_permission_code: "forum.create",
  });
  if (!allowed) throw new Error("FORBIDDEN: butuh forum.create");
  const { data: thread, error } = await supabase
    .from("forum_threads")
    .insert({
      category_id: parsed.data.category_id,
      course_id: parsed.data.course_id,
      class_id: parsed.data.class_id,
      title: parsed.data.title,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !thread)
    throw new Error(`Gagal membuat thread: ${error?.message}`);
  const threadId = (thread as { id: string }).id;
  const { error: postError } = await supabase.from("forum_posts").insert({
    thread_id: threadId,
    author_id: userId,
    body: parsed.data.body,
  });
  if (postError) {
    await supabase.from("forum_threads").delete().eq("id", threadId);
    throw new Error(`Gagal menyimpan postingan awal: ${postError.message}`);
  }
  revalidatePath("/forum");
}

export async function replyThread(formData: FormData): Promise<void> {
  const parsed = postSchema.safeParse({
    thread_id: formData.get("thread_id"),
    body: formData.get("body"),
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");
  const userId = await sessionUserId();
  const supabase = await createClient();
  const { data: thread } = await supabase
    .from("forum_threads")
    .select("id, locked_at")
    .eq("id", parsed.data.thread_id)
    .single();
  if (!thread) throw new Error("NOT_FOUND");
  if ((thread as { locked_at: string | null }).locked_at) {
    const { data: mod } = await supabase.rpc("has_permission", {
      p_user_id: userId,
      p_permission_code: "forum.moderate",
    });
    if (!mod) throw new Error("FORBIDDEN: thread dikunci");
  }
  const { error } = await supabase.from("forum_posts").insert({
    thread_id: parsed.data.thread_id,
    author_id: userId,
    body: parsed.data.body,
  });
  if (error) throw new Error(`Gagal membalas: ${error.message}`);
  revalidatePath(`/forum/${parsed.data.thread_id}`);
}

export async function editPost(formData: FormData): Promise<void> {
  const body = String(formData.get("body") ?? "").trim();
  if (body.length < 1 || body.length > 10000)
    throw new Error("VALIDATION_ERROR");
  const userId = await sessionUserId();
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("forum_posts")
    .select("id, author_id, thread_id")
    .eq("id", String(formData.get("post_id") ?? ""))
    .single();
  if (!post) throw new Error("NOT_FOUND");
  const p = post as { author_id: string; thread_id: string };
  if (p.author_id !== userId) {
    const { data: mod } = await supabase.rpc("has_permission", {
      p_user_id: userId,
      p_permission_code: "forum.moderate",
    });
    if (!mod) throw new Error("FORBIDDEN: bukan postinganmu");
  }
  const { error } = await supabase
    .from("forum_posts")
    .update({ body })
    .eq("id", String(formData.get("post_id") ?? ""));
  if (error) throw new Error(`Gagal mengubah: ${error.message}`);
  revalidatePath(`/forum/${p.thread_id}`);
}

export async function softDeletePost(formData: FormData): Promise<void> {
  const userId = await sessionUserId();
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("forum_posts")
    .select("id, author_id, thread_id")
    .eq("id", String(formData.get("post_id") ?? ""))
    .single();
  if (!post) throw new Error("NOT_FOUND");
  const p = post as { author_id: string; thread_id: string };
  const own = p.author_id === userId;
  if (!own) {
    const { data: mod } = await supabase.rpc("has_permission", {
      p_user_id: userId,
      p_permission_code: "forum.moderate",
    });
    if (!mod) throw new Error("FORBIDDEN");
  }
  if (own) {
    const { error } = await supabase
      .from("forum_posts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", String(formData.get("post_id") ?? ""));
    if (error) throw new Error(`Gagal menghapus: ${error.message}`);
  } else {
    const { error } = await supabase
      .from("forum_posts")
      .delete()
      .eq("id", String(formData.get("post_id") ?? ""));
    if (error) throw new Error(`Gagal menghapus: ${error.message}`);
  }
  revalidatePath(`/forum/${p.thread_id}`);
}

export async function lockThread(formData: FormData): Promise<void> {
  await requirePermission("forum.moderate");
  const supabase = await createClient();
  const threadId = String(formData.get("thread_id") ?? "");
  const locked = formData.get("locked") === "on";
  const { error } = await supabase
    .from("forum_threads")
    .update({ locked_at: locked ? new Date().toISOString() : null })
    .eq("id", threadId);
  if (error) throw new Error(`Gagal mengunci: ${error.message}`);
  revalidatePath(`/forum/${threadId}`);
}

export async function deleteThread(formData: FormData): Promise<void> {
  await requirePermission("forum.moderate");
  const supabase = await createClient();
  const { error } = await supabase
    .from("forum_threads")
    .delete()
    .eq("id", String(formData.get("thread_id") ?? ""));
  if (error) throw new Error(`Gagal menghapus thread: ${error.message}`);
  revalidatePath("/forum");
}
