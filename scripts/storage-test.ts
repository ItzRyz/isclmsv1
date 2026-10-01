#!/usr/bin/env bun
/**
 * storage-test.ts — P0-1304: uji akses bucket privat + signed URL di
 * staging (storage API nyata, bukan mock).
 *
 * Dijalankan: bun run test:storage (butuh var Supabase di .env).
 * User uji + object dibuat lalu dihapus di akhir (cleanup selalu jalan).
 *
 * Cakupan (testing.md §11):
 * - unauthorized download ditolak (bukan pemilik / tanpa permission)
 * - authorized signed URL bekerja (pemilik, penilai, staf)
 * - ownership enforced (insert milik sendiri saja)
 * - materi tetap terbaca member (material.view)
 * - laporan tertutup untuk member (regresi hardening scope OWN)
 * - anon ditolak
 * Validasi mime/ukuran diuji unit: src/features/storage/schemas.test.ts
 */
import "dotenv/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const publishable = process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
const secret = process.env["SUPABASE_SECRET_KEY"];
if (!url || !publishable || !secret) {
  console.error("STORAGE-TEST FAILED: variabel Supabase kosong di .env");
  process.exit(1);
}
const SU_URL: string = url;
const SU_KEY: string = publishable;
const SU_SECRET: string = secret;

function makeClient(): SupabaseClient {
  return createClient(SU_URL, SU_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
const admin = createClient(SU_URL, SU_SECRET, {
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
const PDF = new Blob([new Uint8Array([37, 80, 68, 70])], {
  type: "application/pdf",
});

const createdUsers: string[] = [];
const cleanupPaths: { bucket: string; path: string }[] = [];

async function makeUser(
  name: string,
  roleCode: string,
): Promise<SupabaseClient> {
  const email = `storage-${name}-${runId}@test.local`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: `StorageTest-${runId}-A1`,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error || !created.user)
    throw new Error(`gagal membuat ${name}: ${error?.message}`);
  createdUsers.push(created.user.id);
  const { data: role } = await admin
    .from("roles")
    .select("id")
    .eq("code", roleCode)
    .single();
  if (!role) throw new Error(`role ${roleCode} tidak ada`);
  const { error: roleErr } = await admin.from("user_roles").insert({
    user_id: created.user.id,
    role_id: (role as { id: string }).id,
    assigned_by: null,
  });
  if (roleErr)
    throw new Error(`gagal assign role ${roleCode}: ${roleErr.message}`);

  const client = makeClient();
  const { error: signInErr } = await client.auth.signInWithPassword({
    email,
    password: `StorageTest-${runId}-A1`,
  });
  if (signInErr) throw new Error(`sign-in ${name} gagal: ${signInErr.message}`);
  return client;
}

async function uploadAs(
  client: SupabaseClient,
  bucket: string,
  path: string,
): Promise<{ allowed: boolean; detail: string }> {
  const { error } = await client.storage.from(bucket).upload(path, PDF, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (!error) cleanupPaths.push({ bucket, path });
  return { allowed: !error, detail: error?.message ?? "" };
}

async function signAs(
  client: SupabaseClient,
  bucket: string,
  path: string,
): Promise<{ allowed: boolean; detail: string }> {
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, 300);
  if (!error && data?.signedUrl) return { allowed: true, detail: "" };
  return { allowed: false, detail: error?.message ?? "tanpa url" };
}

function check(
  label: string,
  got: { allowed: boolean; detail: string },
  want: boolean,
): void {
  if (got.allowed === want) ok(label);
  else
    bad(
      label,
      `dapat ${got.allowed ? "izinkan" : "tolak"} (${got.detail}), harap ${want ? "izinkan" : "tolak"}`,
    );
}

try {
  const memberA = await makeUser("A", "MEMBER");
  const memberB = await makeUser("B", "MEMBER");
  const staff = await makeUser("C", "SUPER_ADMIN");
  const anon = makeClient();

  console.log("access control (insert):");
  const subPathA = `${runId}/a-tugas.pdf`;
  const subPathB = `${runId}/b-tugas.pdf`;
  const matPath = `${runId}/materi.pdf`;
  const reportPath = `${runId}/laporan.pdf`;

  check(
    "member B upload ke materials-private DITOLAK (tanpa material.create)",
    await uploadAs(memberB, "materials-private", `${runId}/b-materi.pdf`),
    false,
  );
  cleanupPaths.push({
    bucket: "materials-private",
    path: `${runId}/b-materi.pdf`,
  });
  check(
    "member A upload submission sendiri diizinkan (owner)",
    await uploadAs(memberA, "assignment-submissions", subPathA),
    true,
  );
  check(
    "member B upload submission sendiri diizinkan (owner)",
    await uploadAs(memberB, "assignment-submissions", subPathB),
    true,
  );
  check(
    "staff upload materi diizinkan (material.create)",
    await uploadAs(staff, "materials-private", matPath),
    true,
  );
  {
    const { error } = await admin.storage
      .from("reports")
      .upload(reportPath, PDF, {
        contentType: "application/pdf",
      });
    if (error) throw new Error(`upload laporan gagal: ${error.message}`);
    cleanupPaths.push({ bucket: "reports", path: reportPath });
    ok("admin upload laporan (jalur privileged)");
  }

  console.log("signed URL:");
  check(
    "pemilik menandatangani submission sendiri",
    await signAs(memberA, "assignment-submissions", subPathA),
    true,
  );
  check(
    "member lain TIDAK bisa menandatangani submission A",
    await signAs(memberB, "assignment-submissions", subPathA),
    false,
  );
  check(
    "anon TIDAK bisa menandatangani submission A",
    await signAs(anon, "assignment-submissions", subPathA),
    false,
  );
  check(
    "penilai/staf (assignment.grade) bisa menandatangani submission A",
    await signAs(staff, "assignment-submissions", subPathA),
    true,
  );
  check(
    "member bisa menandatangani materi (material.view)",
    await signAs(memberB, "materials-private", matPath),
    true,
  );
  check(
    "member TIDAK bisa menandatangani laporan (regresi scope OWN)",
    await signAs(memberB, "reports", reportPath),
    false,
  );
  check(
    "staf bisa menandatangani laporan (report.view/export)",
    await signAs(staff, "reports", reportPath),
    true,
  );
  check(
    "anon TIDAK bisa menandatangani materi",
    await signAs(anon, "materials-private", matPath),
    false,
  );
} catch (err) {
  fail += 1;
  console.error(`[FATAL] ${err instanceof Error ? err.message : String(err)}`);
} finally {
  for (const { bucket, path } of cleanupPaths) {
    const { error } = await admin.storage.from(bucket).remove([path]);
    if (error)
      console.error(`  [cleanup] gagal hapus ${path}: ${error.message}`);
  }
  for (const id of createdUsers) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.error(`  [cleanup] gagal hapus user: ${error.message}`);
  }
}

console.log(
  `\nSTORAGE-TEST ${fail > 0 ? "FAILED" : "OK"} — ${pass} pass, ${fail} fail`,
);
process.exit(fail > 0 ? 1 : 0);
