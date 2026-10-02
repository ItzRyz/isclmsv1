#!/usr/bin/env bun
/**
 * staging-seed.ts — P0-1401: seed staging (data demo + user demo).
 * Urutan: seed.sql (konten) dulu via pg, lalu user via admin API.
 * Idempoten: aman dijalankan berulang.
 *
 * Jalankan: bun run db:seed
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const secret = process.env["SUPABASE_SECRET_KEY"];
const directUrl = process.env["DIRECT_URL"];
if (!url || !secret || !directUrl) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY / DIRECT_URL kosong",
  );
  process.exit(1);
}

const PASSWORD = process.env["STAGING_SEED_PASSWORD"] ?? "Staging-2026!";

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function fail(msg: string): never {
  console.error(`STAGING-SEED FAILED: ${msg}`);
  process.exit(1);
}

async function findUserId(email: string): Promise<string | null> {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) fail(`listUsers: ${error.message}`);
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function ensureUser(email: string, fullName: string): Promise<string> {
  let id = await findUserId(email);
  if (!id) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user) fail(`createUser ${email}: ${error?.message}`);
    id = data.user.id;
  }
  return id;
}

async function assignRole(userId: string, roleCode: string): Promise<void> {
  const role = await admin
    .from("roles")
    .select("id")
    .eq("code", roleCode)
    .single();
  if (role.error || !role.data) fail(`role ${roleCode} tidak ada`);
  const existing = await admin
    .from("user_roles")
    .select("user_id, role_id")
    .eq("user_id", userId)
    .eq("role_id", role.data.id)
    .maybeSingle();
  if (!existing.error && !existing.data) {
    const ins = await admin.from("user_roles").insert({
      user_id: userId,
      role_id: role.data.id,
      assigned_by: null,
    });
    if (ins.error) fail(`user_roles ${roleCode}: ${ins.error.message}`);
  }
}

async function main(): Promise<void> {
  const sql = readFileSync(join("supabase", "seed.sql"), "utf8");
  const pg = new Client({ connectionString: directUrl });
  await pg.connect();
  try {
    await pg.query(sql);
  } finally {
    await pg.end();
  }
  console.log("seed.sql: OK");

  const adminId = await ensureUser("admin@studyclub.local", "Staging Admin");
  await assignRole(adminId, "SUPER_ADMIN");

  const mentors: Array<[string, string, string]> = [
    ["mentor-web@studyclub.local", "Mentor Web", "WEB"],
    ["mentor-ml@studyclub.local", "Mentor ML", "ML"],
    ["mentor-uiux@studyclub.local", "Mentor UI/UX", "UIUX"],
  ];
  for (const [email, name, divisionCode] of mentors) {
    const id = await ensureUser(email, name);
    await assignRole(id, "MENTOR");
    const div = await admin
      .from("divisions")
      .select("id")
      .eq("code", divisionCode)
      .single();
    if (div.error || !div.data) fail(`divisi ${divisionCode} tidak ada`);
    const member = await admin
      .from("user_divisions")
      .select("user_id")
      .eq("user_id", id)
      .eq("division_id", div.data.id)
      .maybeSingle();
    if (!member.error && !member.data) {
      const ins = await admin
        .from("user_divisions")
        .insert({ user_id: id, division_id: div.data.id });
      if (ins.error) fail(`user_divisions ${email}: ${ins.error.message}`);
    }
  }

  const members: Array<[string, string, string]> = [
    ["alice@studyclub.local", "Alice Anggota", "WEB-A-2026"],
    ["bob@studyclub.local", "Bob Budi", "ML-A-2026"],
    ["cici@studyclub.local", "Cici Citra", "UIUX-A-2026"],
  ];
  for (const [email, name, classCode] of members) {
    const id = await ensureUser(email, name);
    await assignRole(id, "MEMBER");
    const cls = await admin
      .from("classes")
      .select("id")
      .eq("code", classCode)
      .single();
    if (cls.error || !cls.data) fail(`kelas ${classCode} tidak ada`);
    const member = await admin
      .from("class_members")
      .select("user_id")
      .eq("user_id", id)
      .eq("class_id", cls.data.id)
      .maybeSingle();
    if (!member.error && !member.data) {
      const ins = await admin
        .from("class_members")
        .insert({ class_id: cls.data.id, user_id: id });
      if (ins.error) fail(`class_members ${email}: ${ins.error.message}`);
    }
  }

  console.log("STAGING-SEED OK");
  console.log(`password user demo: ${PASSWORD}`);
}

main().catch((e: unknown) => fail(String(e)));
