import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Admin client server-only (secret key, bypass RLS).
 * Hanya untuk operasi auth admin (ban/unban, create/delete user).
 * JANGAN pernah dipanggil dari Client Component atau diekspor ke browser.
 */
export function createAdminClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const secret = process.env["SUPABASE_SECRET_KEY"];
  if (!url || !secret) {
    throw new Error("SUPABASE_SECRET_KEY belum diatur di server");
  }
  cached = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
