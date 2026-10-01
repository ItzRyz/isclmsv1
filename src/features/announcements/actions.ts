"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { announcementSchema } from "./schemas";

export async function createAnnouncement(formData: FormData): Promise<void> {
  const parsed = announcementSchema.safeParse({
    scope: formData.get("scope"),
    title: formData.get("title"),
    body: formData.get("body"),
    priority: formData.get("priority"),
    published_at: formData.get("published_at") || null,
    expires_at: formData.get("expires_at") || null,
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data pengumuman tidak valid");

  const { userId } = await requirePermission("announcement.create");
  const supabase = await createClient();
  const [kind, scopeId] = parsed.data.scope.includes(":")
    ? (parsed.data.scope.split(":") as ["division" | "class", string])
    : (["organization", ""] as const);
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "study-club")
    .single();
  const { error } = await supabase.from("announcements").insert({
    organization_id: org ? (org.id as string) : null,
    division_id: kind === "division" ? scopeId : null,
    class_id: kind === "class" ? scopeId : null,
    title: parsed.data.title,
    body: parsed.data.body,
    priority: parsed.data.priority,
    published_at: parsed.data.published_at ?? new Date().toISOString(),
    expires_at: parsed.data.expires_at,
    created_by: userId,
  });
  if (error) throw new Error(`Gagal membuat pengumuman: ${error.message}`);
  revalidatePath("/announcements");
}

export async function updateAnnouncement(formData: FormData): Promise<void> {
  const parsed = announcementSchema.safeParse({
    scope: formData.get("scope"),
    title: formData.get("title"),
    body: formData.get("body"),
    priority: formData.get("priority"),
    published_at: formData.get("published_at") || null,
    expires_at: formData.get("expires_at") || null,
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data pengumuman tidak valid");
  const announcementId = String(formData.get("announcement_id") ?? "");

  await requirePermission("announcement.update");
  const supabase = await createClient();
  const [kind, scopeId] = parsed.data.scope.includes(":")
    ? (parsed.data.scope.split(":") as ["division" | "class", string])
    : (["organization", ""] as const);
  const { error } = await supabase
    .from("announcements")
    .update({
      division_id: kind === "division" ? scopeId : null,
      class_id: kind === "class" ? scopeId : null,
      title: parsed.data.title,
      body: parsed.data.body,
      priority: parsed.data.priority,
      published_at: parsed.data.published_at,
      expires_at: parsed.data.expires_at,
    })
    .eq("id", announcementId);
  if (error) throw new Error(`Gagal mengubah pengumuman: ${error.message}`);
  revalidatePath("/announcements");
}

export async function deleteAnnouncement(formData: FormData): Promise<void> {
  await requirePermission("announcement.delete");
  const supabase = await createClient();
  const { error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", String(formData.get("announcement_id") ?? ""));
  if (error) throw new Error(`Gagal menghapus pengumuman: ${error.message}`);
  revalidatePath("/announcements");
}
