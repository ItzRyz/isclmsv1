"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const commentSchema = z.object({
  material_id: z.string().uuid(),
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

export async function addComment(formData: FormData): Promise<void> {
  const parsed = commentSchema.safeParse({
    material_id: formData.get("material_id"),
    body: formData.get("body"),
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");
  const userId = await sessionUserId();
  const supabase = await createClient();
  const { error } = await supabase.from("material_comments").insert({
    material_id: parsed.data.material_id,
    author_id: userId,
    body: parsed.data.body,
  });
  if (error) throw new Error(`Gagal berkomentar: ${error.message}`);
  revalidatePath(`/materials/${parsed.data.material_id}`);
}

export async function deleteComment(formData: FormData): Promise<void> {
  const userId = await sessionUserId();
  const supabase = await createClient();
  const commentId = String(formData.get("comment_id") ?? "");
  const materialId = String(formData.get("material_id") ?? "");
  const { data: comment } = await supabase
    .from("material_comments")
    .select("id, author_id")
    .eq("id", commentId)
    .single();
  if (!comment) throw new Error("NOT_FOUND");
  const own = (comment as { author_id: string }).author_id === userId;
  if (own) {
    const { error } = await supabase
      .from("material_comments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", commentId);
    if (error) throw new Error(`Gagal menghapus: ${error.message}`);
  } else {
    const { data: mod } = await supabase.rpc("has_permission", {
      p_user_id: userId,
      p_permission_code: "forum.moderate",
    });
    if (!mod) throw new Error("FORBIDDEN");
    const { error } = await supabase
      .from("material_comments")
      .delete()
      .eq("id", commentId);
    if (error) throw new Error(`Gagal menghapus: ${error.message}`);
  }
  revalidatePath(`/materials/${materialId}`);
}
