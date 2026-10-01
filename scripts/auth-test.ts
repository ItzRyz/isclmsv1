#!/usr/bin/env bun
/**
 * auth-test.ts — P0-1303: uji session, reset password, deaktifasi
 * terhadap Supabase Auth staging (GoTrue).
 *
 * Dijalankan: bun run test:auth (butuh NEXT_PUBLIC_SUPABASE_URL,
 * PUBLISHABLE key, SUPABASE_SECRET_KEY). TIDAK menampilkan kredensial.
 * User uji dibuat lalu dihapus di akhir (cleanup selalu jalan).
 *
 * Catatan app-side (diuji unit terpisah di src/lib/auth/status.test.ts):
 * gerbang status profil di proxy + can()/requirePermission() menolak
 * profil nonaktif meski sesi auth masih valid.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const publishable = process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
const secret = process.env["SUPABASE_SECRET_KEY"];
if (!url || !publishable || !secret) {
  console.error("AUTH-TEST FAILED: variabel Supabase kosong di .env");
  process.exit(1);
}

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(url, publishable, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let pass = 0;
let fail = 0;
function ok(label: string): void {
  pass += 1;
  console.log(`  [PASS] ${label}`);
}
function bad(label: string, detail: string): void {
  fail += 1;
  console.log(`  [FAIL] ${label} — ${detail}`);
}

const runId = Math.random().toString(36).slice(2, 8);
const email = `auth-test-${runId}@test.local`;
const password1 = `TestPass-${runId}-A1`;
const password2 = `TestPass-${runId}-B2`;
let userId = "";

type ErrorResult = { error: { message: string } | null };

/** supabase-js tidak melempar untuk error API — cek properti error. */
async function expectFails(
  label: string,
  p: Promise<ErrorResult>,
): Promise<void> {
  try {
    const { error } = await p;
    if (error) ok(label);
    else bad(label, "ternyata berhasil, seharusnya gagal");
  } catch (err) {
    bad(
      label,
      `exception tak terduga: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

try {
  // ---------- setup ----------
  const created = await admin.auth.admin.createUser({
    email,
    password: password1,
    email_confirm: true,
    user_metadata: { full_name: "Auth Test" },
  });
  if (created.error || !created.data.user) {
    throw new Error(`gagal membuat user uji: ${created.error?.message}`);
  }
  userId = created.data.user.id;
  console.log("session:");
  {
    const signIn = await anon.auth.signInWithPassword({
      email,
      password: password1,
    });
    if (signIn.error || !signIn.data.session) {
      throw new Error(`sign-in gagal: ${signIn.error?.message}`);
    }
    const token = signIn.data.session.access_token;
    const { data: who, error: whoErr } = await anon.auth.getUser(token);
    if (whoErr || who.user?.id !== userId) {
      bad("getUser dengan access token cocok", whoErr?.message ?? "id beda");
    } else {
      ok("getUser dengan access token cocok");
    }

    const before = token;
    const { data: refreshed, error: refreshErr } =
      await anon.auth.refreshSession();
    if (refreshErr || !refreshed.session) {
      bad(
        "refresh session menghasilkan token baru",
        refreshErr?.message ?? "tanpa session",
      );
    } else if (refreshed.session.access_token === before) {
      bad("refresh session menghasilkan token baru", "token identik");
    } else {
      ok("refresh session menghasilkan token baru");
    }

    await expectFails(
      "password salah ditolak",
      anon.auth.signInWithPassword({ email, password: "salah-banget" }),
    );
  }

  // ---------- deactivation ----------
  console.log("deactivation:");
  {
    const { error: pErr } = await admin
      .from("profiles")
      .update({ status: "SUSPENDED" })
      .eq("id", userId);
    if (pErr) throw new Error(`update profil gagal: ${pErr.message}`);
    const { error: banErr } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: "8760h",
    });
    if (banErr) throw new Error(`ban gagal: ${banErr.message}`);

    await expectFails(
      "akun suspended tidak bisa sign-in",
      anon.auth.signInWithPassword({ email, password: password1 }),
    );

    const { error: unbanErr } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: "none",
    });
    if (unbanErr) throw new Error(`unban gagal: ${unbanErr.message}`);
    const { error: restoreErr } = await admin
      .from("profiles")
      .update({ status: "ACTIVE" })
      .eq("id", userId);
    if (restoreErr)
      throw new Error(`aktifkan ulang gagal: ${restoreErr.message}`);

    const back = await anon.auth.signInWithPassword({
      email,
      password: password1,
    });
    if (back.error) bad("aktifkan ulang -> sign-in OK", back.error.message);
    else ok("aktifkan ulang -> sign-in OK");
    if (back.data.session) await anon.auth.signOut();
  }

  // ---------- reset password ----------
  console.log("reset password:");
  {
    const link = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    if (link.error || !link.data.properties.email_otp) {
      throw new Error(`generateLink recovery gagal: ${link.error?.message}`);
    }
    const { data: otpSession, error: otpErr } = await anon.auth.verifyOtp({
      email,
      token: link.data.properties.email_otp,
      type: "recovery",
    });
    if (otpErr || !otpSession.session) {
      bad(
        "verifyOtp recovery menghasilkan sesi",
        otpErr?.message ?? "tanpa sesi",
      );
    } else {
      ok("verifyOtp recovery menghasilkan sesi");
      const { error: updErr } = await anon.auth.updateUser({
        password: password2,
      });
      if (updErr) bad("updateUser password baru", updErr.message);
      else ok("updateUser password baru");
      await anon.auth.signOut();
    }

    const oldTry = await anon.auth.signInWithPassword({
      email,
      password: password1,
    });
    if (oldTry.error) ok("password lama ditolak setelah reset");
    else bad("password lama ditolak setelah reset", "masih bisa masuk");

    const newTry = await anon.auth.signInWithPassword({
      email,
      password: password2,
    });
    if (newTry.error) bad("password baru bisa masuk", newTry.error.message);
    else ok("password baru bisa masuk");
    if (newTry.data.session) await anon.auth.signOut();
  }
} catch (err) {
  fail += 1;
  console.error(`[FATAL] ${err instanceof Error ? err.message : String(err)}`);
} finally {
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error)
      console.error(`  [cleanup] gagal menghapus user uji: ${error.message}`);
  }
}

console.log(
  `\nAUTH-TEST ${fail > 0 ? "FAILED" : "OK"} — ${pass} pass, ${fail} fail`,
);
process.exit(fail > 0 ? 1 : 0);
