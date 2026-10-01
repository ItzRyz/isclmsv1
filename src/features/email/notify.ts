import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "./client";

/**
 * Kirim email ke pemilik bila: alamat ada + preferensi email event menyala.
 * Best-effort: kegagalan tidak menggagalkan aksi pemanggil.
 */
export async function emailOwners(
  supabase: SupabaseClient,
  ownerIds: string[],
  eventType: string,
  make: (name: string) => { subject: string; text: string },
): Promise<{ sent: number; skipped: number }> {
  const unique = [...new Set(ownerIds)];
  if (unique.length === 0) return { sent: 0, skipped: 0 };
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", unique)
    .not("email", "is", null);
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("user_id")
    .in("user_id", unique)
    .eq("event_type", eventType)
    .eq("email_enabled", false);
  const off = new Set(
    ((prefs ?? []) as { user_id: string }[]).map((p) => p.user_id),
  );
  let sent = 0;
  let skipped = 0;
  for (const p of (profiles ?? []) as {
    id: string;
    full_name: string | null;
    email: string | null;
  }[]) {
    if (!p.email || off.has(p.id)) {
      skipped += 1;
      continue;
    }
    const tpl = make(p.full_name ?? "Peserta");
    const res = await sendEmail({
      to: p.email,
      ...(p.full_name ? { name: p.full_name } : {}),
      ...tpl,
    }).catch(() => ({
      ok: false as const,
      skipped: false as const,
      error: "exception",
    }));
    if (res.ok && !res.skipped) sent += 1;
    else skipped += 1;
  }
  return { sent, skipped };
}
