"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createEventSchema, updateEventSchema } from "./schemas";

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

export async function createEvent(formData: FormData): Promise<void> {
  const parsed = createEventSchema.safeParse({
    division_id: formData.get("division_id") || null,
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || null,
    type: formData.get("type"),
    starts_at: formData.get("starts_at"),
    ends_at: formData.get("ends_at"),
    location: formData.get("location") || null,
    capacity: formData.get("capacity") || null,
    status: formData.get("status"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data event tidak valid");

  const { userId } = await requirePermission("event.create");
  const supabase = await createClient();
  const { error } = await supabase.from("events").insert({
    ...parsed.data,
    organization_id: await orgId(),
    created_by: userId,
  });
  if (error) throw new Error(`Gagal membuat event: ${error.message}`);
  revalidatePath("/events");
}

export async function updateEvent(formData: FormData): Promise<void> {
  const parsed = updateEventSchema.safeParse({
    event_id: formData.get("event_id"),
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || null,
    type: formData.get("type"),
    starts_at: formData.get("starts_at"),
    ends_at: formData.get("ends_at"),
    location: formData.get("location") || null,
    capacity: formData.get("capacity") || null,
    status: formData.get("status"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data event tidak valid");

  await requirePermission("event.update");
  const supabase = await createClient();
  const { event_id, ...rest } = parsed.data;
  const { error } = await supabase
    .from("events")
    .update(rest)
    .eq("id", event_id);
  if (error) throw new Error(`Gagal mengubah event: ${error.message}`);
  revalidatePath(`/events/${event_id}`);
}

export async function deleteEvent(formData: FormData): Promise<void> {
  await requirePermission("event.delete");
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", String(formData.get("event_id") ?? ""));
  if (error) throw new Error(`Gagal menghapus event: ${error.message}`);
  revalidatePath("/events");
}

/** Daftar mandiri (kapasitas dijaga server, duplikat ditolak). */
export async function registerEvent(formData: FormData): Promise<void> {
  const eventId = String(formData.get("event_id") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  const { data: event } = await supabase
    .from("events")
    .select("id, status, capacity")
    .eq("id", eventId)
    .single();
  if (!event || (event as { status: string }).status !== "PUBLISHED") {
    throw new Error("NOT_OPEN: event belum dibuka");
  }
  const cap = (event as { capacity: number | null }).capacity;
  if (cap !== null) {
    const { count } = await supabase
      .from("event_participants")
      .select("user_id", { count: "exact", head: true })
      .eq("event_id", eventId);
    if ((count ?? 0) >= cap) throw new Error("FULL: kapasitas penuh");
  }
  const { error } = await supabase.from("event_participants").insert({
    event_id: eventId,
    user_id: user.id,
    status: "REGISTERED",
  });
  if (error) {
    if (error.code === "23505") throw new Error("CONFLICT: sudah terdaftar");
    throw new Error(`Gagal mendaftar: ${error.message}`);
  }
  revalidatePath(`/events/${eventId}`);
}

/** Tandai hadir peserta (staf absensi). */
export async function markEventAttendance(formData: FormData): Promise<void> {
  const eventId = String(formData.get("event_id") ?? "");
  const targetId = String(formData.get("user_id") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  const { data: allowed } = await supabase.rpc("has_permission", {
    p_user_id: user.id,
    p_permission_code: "attendance.correct",
  });
  if (!allowed) throw new Error("FORBIDDEN: butuh attendance.correct");
  const { error } = await supabase.from("event_attendance").upsert(
    {
      event_id: eventId,
      user_id: targetId,
      status: "PRESENT",
      checked_in_at: new Date().toISOString(),
    },
    { onConflict: "event_id,user_id" },
  );
  if (error) throw new Error(`Gagal mencatat hadir: ${error.message}`);
  revalidatePath(`/events/${eventId}`);
}
