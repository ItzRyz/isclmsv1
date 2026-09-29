import { createClient } from "@/lib/supabase/server";

export type NotifyInput = {
  type: string;
  title: string;
  body?: string;
  entity_type?: string;
  entity_id?: string;
};

type Supa = Awaited<ReturnType<typeof createClient>>;

/**
 * Buat notifikasi in-app, hormati preferensi user per event.
 * Dipanggil dari server actions yang sudah lolos permission.
 */
export async function notifyMany(
  supabase: Supa,
  recipientIds: string[],
  input: NotifyInput,
): Promise<void> {
  const unique = [...new Set(recipientIds)];
  if (unique.length === 0) return;
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("user_id")
    .in("user_id", unique)
    .eq("event_type", input.type)
    .eq("in_app_enabled", false);
  const off = new Set(
    ((prefs ?? []) as { user_id: string }[]).map((p) => p.user_id),
  );
  const rows = unique
    .filter((id) => !off.has(id))
    .map((recipient_id) => ({
      recipient_id,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      entity_type: input.entity_type ?? null,
      entity_id: input.entity_id ?? null,
    }));
  if (rows.length === 0) return;
  const { error } = await supabase.from("notifications").insert(rows);
  if (error) throw new Error(`Gagal membuat notifikasi: ${error.message}`);
}

/** Anggota divisi (aktif) untuk broadcast scope divisi. */
export async function divisionMemberIds(
  supabase: Supa,
  divisionId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("user_divisions")
    .select("user_id")
    .eq("division_id", divisionId)
    .is("ended_at", null);
  return ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
}
