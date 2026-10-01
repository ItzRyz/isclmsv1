#!/usr/bin/env bun
/**
 * rls-test.ts — P0-1302: uji RLS di database staging (transaction + ROLLBACK).
 *
 * Cakupan (testing.md §4):
 * - positive/negative policy per tabel kritis (profiles, grades,
 *   point_transactions, audit_logs, user_roles)
 * - role matrix: anon, member, mentor, coordinator, leader, super admin
 * - scope matrix: level DB hanya cek permission (has_permission tanpa scope);
 *   penyempitan scope CLASS/DIVISION/OWN diuji app-side di
 *   src/lib/auth/authorization.test.ts (deny default, wrong scope).
 * - revoked role: cabut peran -> akses tulis hilang.
 *
 * Dijalankan: bun run test:rls (butuh DIRECT_URL). TIDAK menampilkan kredensial.
 * Semua fixture di dalam transaksi dan di-ROLLBACK — staging tidak berubah.
 */
import "dotenv/config";
import { Client, type Client as PgClient } from "pg";

const url = process.env.DIRECT_URL;
if (!url) {
  console.error("RLS-TEST FAILED: DIRECT_URL kosong di .env");
  process.exit(1);
}

const runId = Math.random().toString(36).slice(2, 8);
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

type Persona = { role: "anon" | "authenticated"; sub?: string };

async function assumePersona(
  client: PgClient,
  persona: Persona,
): Promise<void> {
  await client.query("reset role");
  await client.query(`set local role ${persona.role}`);
  if (persona.sub) {
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: persona.sub, role: "authenticated" }),
    ]);
  } else {
    await client.query("select set_config('request.jwt.claims', '', true)");
  }
}

/**
 * Setiap kasus dibungkus savepoint: satu error statement membatalkan
 * seluruh transaksi Postgres, sehingga wajib di-ROLLBACK TO agar kasus
 * berikutnya tetap berjalan.
 */
let sp = 0;
async function savepoint(client: PgClient): Promise<string> {
  sp += 1;
  const name = `t${sp}`;
  await client.query(`savepoint ${name}`);
  return name;
}
async function release(client: PgClient, name: string): Promise<void> {
  await client.query(`rollback to ${name}`);
  await client.query(`release ${name}`);
}

async function expectAtLeast(
  client: PgClient,
  label: string,
  sql: string,
  params: unknown[],
  min: number,
): Promise<void> {
  const name = await savepoint(client);
  try {
    const res = await client.query(sql, params as never[]);
    const n = Number((res.rows[0] as { count: string }).count);
    if (n >= min) ok(label);
    else bad(label, `dapat ${n}, harap >= ${min}`);
  } catch (err) {
    bad(label, `error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await release(client, name);
  }
}

async function expectCount(
  client: PgClient,
  label: string,
  sql: string,
  params: unknown[],
  expected: number,
): Promise<void> {
  const name = await savepoint(client);
  try {
    const res = await client.query(sql, params as never[]);
    const n = Number((res.rows[0] as { count: string }).count);
    if (n === expected) ok(label);
    else bad(label, `dapat ${n}, harap ${expected}`);
  } catch (err) {
    bad(label, `error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await release(client, name);
  }
}

async function expectRowCount(
  client: PgClient,
  label: string,
  sql: string,
  params: unknown[],
  expected: number,
): Promise<void> {
  const name = await savepoint(client);
  try {
    const res = await client.query(sql, params as never[]);
    const n = res.rowCount ?? 0;
    if (n === expected) ok(label);
    else bad(label, `rowCount ${n}, harap ${expected}`);
  } catch (err) {
    bad(label, `error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await release(client, name);
  }
}

async function expectDenied(
  client: PgClient,
  label: string,
  sql: string,
  params: unknown[],
): Promise<void> {
  const name = await savepoint(client);
  try {
    await client.query(sql, params as never[]);
    bad(label, "ternyata berhasil, seharusnya ditolak");
  } catch (err) {
    const code = (err as { code?: string }).code ?? "?";
    ok(`${label} (ditolak ${code})`);
  } finally {
    await release(client, name);
  }
}

async function expectOk(
  client: PgClient,
  label: string,
  sql: string,
  params: unknown[],
): Promise<void> {
  const name = await savepoint(client);
  try {
    await client.query(sql, params as never[]);
    ok(label);
  } catch (err) {
    bad(label, `error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await release(client, name);
  }
}

const client = new Client({
  connectionString: url,
  connectionTimeoutMillis: 15000,
});

try {
  await client.connect();
  await client.query("begin");

  // ---------- fixture (superuser, dibuang lewat ROLLBACK) ----------
  const orgRes = await client.query(
    "select id from organizations where slug = 'study-club'",
  );
  const orgId = (orgRes.rows[0] as { id: string } | undefined)?.id;
  if (!orgId) throw new Error("organisasi seed 'study-club' tidak ada");

  await client.query(
    `insert into academic_periods (organization_id, name, code)
     values ($1, 'Periode RLS', 'RLS-TEST') on conflict (code) do nothing`,
    [orgId],
  );
  await client.query(
    `insert into grade_components (organization_id, code, name)
     values ($1, 'RLS-COMP', 'Komponen RLS') on conflict (organization_id, code) do nothing`,
    [orgId],
  );
  const periodId = (
    (
      await client.query(
        "select id from academic_periods where code = 'RLS-TEST'",
      )
    ).rows[0] as { id: string }
  ).id;
  const compId = (
    (
      await client.query(
        "select id from grade_components where code = 'RLS-COMP' and organization_id = $1",
        [orgId],
      )
    ).rows[0] as { id: string }
  ).id;

  async function makeUser(name: string): Promise<string> {
    const res = await client.query(
      `insert into auth.users
         (instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
          created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),
          'authenticated', 'authenticated', $1, 'rls-test-no-login', now(),
          '{"provider":"email","providers":["email"]}', $2, now(), now())
       returning id`,
      [`rls-${name}-${runId}@test.local`, JSON.stringify({ full_name: name })],
    );
    return (res.rows[0] as { id: string }).id;
  }

  async function assignRole(userId: string, roleCode: string): Promise<void> {
    await client.query(
      `insert into user_roles (user_id, role_id, assigned_by)
       select $1, id, null from roles where code = $2
       on conflict do nothing`,
      [userId, roleCode],
    );
  }

  const memberA = await makeUser("Member A");
  const memberB = await makeUser("Member B");
  const mentor = await makeUser("Mentor");
  const coord = await makeUser("Coordinator");
  const leader = await makeUser("Leader");
  const admin = await makeUser("Super Admin");
  await assignRole(memberA, "MEMBER");
  await assignRole(memberB, "MEMBER");
  await assignRole(mentor, "MENTOR");
  await assignRole(coord, "WEB_COORDINATOR");
  await assignRole(leader, "LEADER");
  await assignRole(admin, "SUPER_ADMIN");

  const gradeRes = await client.query(
    `insert into grades
       (user_id, academic_period_id, grade_component_id, source_type,
        raw_score, normalized_score, weight_applied, weighted_score, created_by)
     values ($1, $2, $3, 'assignment', 80, 80, 1, 80, $4)
     returning id`,
    [memberA, periodId, compId, mentor],
  );
  const gradeId = (gradeRes.rows[0] as { id: string }).id;
  const gradeBRes = await client.query(
    `insert into grades
       (user_id, academic_period_id, grade_component_id, source_type,
        raw_score, normalized_score, weight_applied, weighted_score, created_by)
     values ($1, $2, $3, 'assignment', 75, 75, 1, 75, $4)
     returning id`,
    [memberB, periodId, compId, mentor],
  );
  const gradeBId = (gradeBRes.rows[0] as { id: string }).id;
  await client.query(
    `insert into point_transactions
       (user_id, amount, point_type, source_type, description, created_by)
     values ($1, 10, 'REWARD', 'manual', 'fixture', $2)`,
    [memberA, mentor],
  );
  await client.query(
    `insert into point_transactions
       (user_id, amount, point_type, source_type, description, created_by)
     values ($1, 5, 'REWARD', 'manual', 'fixture', $2)`,
    [memberB, mentor],
  );
  await client.query(
    `insert into audit_logs (actor_id, action, entity_type, entity_id)
     values (null, 'fixture.seed', 'rls_test', 'setup')`,
  );

  const A: Persona = { role: "authenticated", sub: memberA };
  const B: Persona = { role: "authenticated", sub: memberB };
  const M: Persona = { role: "authenticated", sub: mentor };
  const C: Persona = { role: "authenticated", sub: coord };
  const L: Persona = { role: "authenticated", sub: leader };
  const SA: Persona = { role: "authenticated", sub: admin };
  const ANON: Persona = { role: "anon" };

  // ---------- sanity role matrix (superuser) ----------
  console.log("role matrix (has_permission baseline):");
  await expectCount(
    client,
    "MEMBER: course.view = true, grade.create = false",
    `select count(*) as count from (values
       (has_permission($1::uuid, 'course.view')),
       (not has_permission($1::uuid, 'grade.create'))
     ) v(c) where c`,
    [memberA],
    2,
  );
  await expectCount(
    client,
    "MENTOR: grade.create = true",
    `select count(*) as count where has_permission($1::uuid, 'grade.create')`,
    [mentor],
    1,
  );
  await expectCount(
    client,
    "WEB_COORDINATOR: grade.create = true (scope DIVISION dicatat)",
    `select count(*) as count from role_permissions rp
     join roles r on r.id = rp.role_id
     join permissions p on p.id = rp.permission_id
     where r.code = 'WEB_COORDINATOR' and p.code = 'grade.create'
       and rp.scope = 'DIVISION'`,
    [],
    1,
  );
  await expectCount(
    client,
    "LEADER: audit.view = true, user.assign_role = false",
    `select count(*) as count from (values
       (has_permission($1::uuid, 'audit.view')),
       (not has_permission($1::uuid, 'user.assign_role'))
     ) v(c) where c`,
    [leader],
    2,
  );
  await expectCount(
    client,
    "SUPER_ADMIN: user.assign_role = true",
    `select count(*) as count where has_permission($1::uuid, 'user.assign_role')`,
    [admin],
    1,
  );

  // ---------- anon ----------
  // Policy dibuat `to authenticated`: anon tidak kena policy apa pun ->
  // RLS default-deny -> 0 baris (bukan error), selama ada grant tabel.
  console.log("anon:");
  await assumePersona(client, ANON);
  await expectCount(
    client,
    "anon SELECT profiles = 0 baris (default deny)",
    "select count(*) as count from profiles",
    [],
    0,
  );
  await expectCount(
    client,
    "anon SELECT grades = 0 baris (default deny)",
    "select count(*) as count from grades",
    [],
    0,
  );
  await expectCount(
    client,
    "anon SELECT user_roles = 0 baris (default deny)",
    "select count(*) as count from user_roles",
    [],
    0,
  );

  // ---------- member A (positive + negative) ----------
  console.log("member (MEMBER):");
  await assumePersona(client, A);
  await expectCount(
    client,
    "lihat profil sendiri",
    "select count(*) as count from profiles where id = $1::uuid",
    [memberA],
    1,
  );
  await expectCount(
    client,
    "profil orang lain tidak terlihat",
    "select count(*) as count from profiles where id = $1::uuid",
    [memberB],
    0,
  );
  await expectRowCount(
    client,
    "UPDATE profil sendiri berhasil",
    "update profiles set full_name = full_name where id = $1::uuid",
    [memberA],
    1,
  );
  await expectRowCount(
    client,
    "UPDATE profil orang lain = 0 baris (RLS)",
    "update profiles set full_name = full_name where id = $1::uuid",
    [memberB],
    0,
  );
  await expectDenied(
    client,
    "INSERT profiles ditolak (tanpa policy)",
    "insert into profiles (id) values (gen_random_uuid())",
    [],
  );
  await expectCount(
    client,
    "nilai sendiri terlihat",
    "select count(*) as count from grades where user_id = $1::uuid",
    [memberA],
    1,
  );
  await expectCount(
    client,
    "nilai orang lain tidak terlihat",
    "select count(*) as count from grades where user_id = $1::uuid",
    [memberB],
    0,
  );
  await expectDenied(
    client,
    "INSERT grades ditolak (tanpa grade.create)",
    "insert into grades (user_id, academic_period_id, grade_component_id, source_type, raw_score, normalized_score) values ($1::uuid, $2::uuid, $3::uuid, 'manual', 50, 50)",
    [memberB, periodId, compId],
  );
  await expectRowCount(
    client,
    "UPDATE grades = 0 baris (tanpa grade.update)",
    `update grades set raw_score = 1 where id = $1::uuid`,
    [gradeId],
    0,
  );
  await expectCount(
    client,
    "poin sendiri terlihat",
    "select count(*) as count from point_transactions where user_id = $1::uuid",
    [memberA],
    1,
  );
  await expectCount(
    client,
    "poin orang lain tidak terlihat",
    "select count(*) as count from point_transactions where user_id = $1::uuid",
    [memberB],
    0,
  );
  await expectDenied(
    client,
    "INSERT point_transactions ditolak (tanpa point.manage)",
    "insert into point_transactions (user_id, amount, point_type, source_type, description) values ($1::uuid, 5, 'REWARD', 'manual', 'x')",
    [memberA],
  );
  await expectRowCount(
    client,
    "UPDATE point_transactions = 0 baris (append-only via RLS)",
    `update point_transactions set amount = 1 where user_id = $1::uuid`,
    [memberA],
    0,
  );
  await expectCount(
    client,
    "audit_logs terfilter (tanpa audit.view)",
    "select count(*) as count from audit_logs",
    [],
    0,
  );
  await expectOk(
    client,
    "INSERT audit_logs untuk diri sendiri diizinkan",
    "insert into audit_logs (actor_id, action, entity_type) values ($1::uuid, 'test.self', 'rls_test')",
    [memberA],
  );
  await expectDenied(
    client,
    "self-assign peran ditolak (tanpa user.assign_role)",
    "insert into user_roles (user_id, role_id, assigned_by) select $1::uuid, id, $1::uuid from roles where code = 'LEADER'",
    [memberA],
  );
  await expectCount(
    client,
    "hanya peran sendiri yang terlihat",
    "select count(*) as count from user_roles where user_id = $1::uuid",
    [memberB],
    0,
  );
  await expectDenied(
    client,
    "ganti status sendiri ditolak trigger (tanpa user.update)",
    "update profiles set status = 'SUSPENDED' where id = $1::uuid",
    [memberA],
  );

  // ---------- member B (ownership) ----------
  console.log("member B (ownership):");
  await assumePersona(client, B);
  await expectCount(
    client,
    "profil sendiri terlihat",
    "select count(*) as count from profiles where id = $1::uuid",
    [memberB],
    1,
  );
  await expectCount(
    client,
    "profil member A tidak terlihat",
    "select count(*) as count from profiles where id = $1::uuid",
    [memberA],
    0,
  );
  await expectCount(
    client,
    "grades member A tidak terlihat",
    "select count(*) as count from grades where user_id = $1::uuid",
    [memberA],
    0,
  );
  await expectRowCount(
    client,
    "UPDATE grades sendiri = 0 baris (tanpa grade.update)",
    "update grades set raw_score = 1 where id = $1::uuid",
    [gradeBId],
    0,
  );

  // ---------- mentor ----------
  console.log("mentor (MENTOR):");
  await assumePersona(client, M);
  await expectOk(
    client,
    "INSERT grades diizinkan (grade.create)",
    "insert into grades (user_id, academic_period_id, grade_component_id, source_type, raw_score, normalized_score) values ($1::uuid, $2::uuid, $3::uuid, 'manual', 70, 70) returning id",
    [memberB, periodId, compId],
  );
  await expectRowCount(
    client,
    "UPDATE grades diizinkan (grade.update)",
    "update grades set raw_score = 81 where id = $1::uuid",
    [gradeId],
    1,
  );
  await expectCount(
    client,
    "lihat semua grades (grade.view/create)",
    "select count(*) as count from grades where user_id = $1::uuid",
    [memberB],
    1,
  );
  await expectDenied(
    client,
    "INSERT user_roles ditolak (tanpa user.assign_role)",
    "insert into user_roles (user_id, role_id, assigned_by) select $1::uuid, id, $2::uuid from roles where code = 'MENTOR'",
    [memberB, mentor],
  );

  // ---------- coordinator ----------
  console.log("coordinator (WEB_COORDINATOR):");
  await assumePersona(client, C);
  await expectOk(
    client,
    "INSERT grades diizinkan (grade.create)",
    "insert into grades (user_id, academic_period_id, grade_component_id, source_type, raw_score, normalized_score) values ($1::uuid, $2::uuid, $3::uuid, 'manual', 60, 60) returning id",
    [memberB, periodId, compId],
  );
  await expectDenied(
    client,
    "INSERT user_roles ditolak",
    "insert into user_roles (user_id, role_id, assigned_by) select $1::uuid, id, $2::uuid from roles where code = 'MENTOR'",
    [memberB, coord],
  );

  // ---------- leader ----------
  console.log("leader (LEADER):");
  await assumePersona(client, L);
  await expectAtLeast(
    client,
    "audit_logs terlihat (audit.view)",
    "select count(*) as count from audit_logs",
    [],
    1,
  );
  await expectDenied(
    client,
    "assign peran ditolak (LEADER tanpa user.assign_role)",
    "insert into user_roles (user_id, role_id, assigned_by) select $1::uuid, id, $2::uuid from roles where code = 'LEADER'",
    [memberB, leader],
  );

  // ---------- super admin ----------
  console.log("super admin (SUPER_ADMIN):");
  await assumePersona(client, SA);
  await expectOk(
    client,
    "INSERT user_roles diizinkan + trigger audit jalan",
    "insert into user_roles (user_id, role_id, assigned_by) select $1::uuid, id, $2::uuid from roles where code = 'SECRETARY' on conflict do nothing",
    [memberB, admin],
  );
  await expectRowCount(
    client,
    "UPDATE profil orang lain diizinkan (profiles_update_staff)",
    "update profiles set full_name = full_name where id = $1::uuid",
    [memberB],
    1,
  );
  await expectRowCount(
    client,
    "ubah status orang lain diizinkan (user.update)",
    "update profiles set status = status where id = $1::uuid",
    [memberB],
    1,
  );
  await expectRowCount(
    client,
    "UPDATE point_transactions = 0 baris (append-only global)",
    `update point_transactions set amount = 1 where user_id = $1::uuid`,
    [memberA],
    0,
  );
  await expectAtLeast(
    client,
    "audit_logs terlihat",
    "select count(*) as count from audit_logs",
    [],
    1,
  );

  // ---------- revoked role ----------
  console.log("revoked role:");
  await client.query("reset role");
  await client.query(
    "delete from user_roles where user_id = $1::uuid and role_id = (select id from roles where code = 'WEB_COORDINATOR')",
    [coord],
  );
  await assumePersona(client, C);
  await expectDenied(
    client,
    "setelah dicabut: INSERT grades ditolak",
    "insert into grades (user_id, academic_period_id, grade_component_id, source_type, raw_score, normalized_score) values ($1::uuid, $2::uuid, $3::uuid, 'manual', 10, 10)",
    [memberB, periodId, compId],
  );

  // ---------- selesai ----------
  await client.query("rollback");
} catch (err) {
  fail += 1;
  console.error(`[FATAL] ${err instanceof Error ? err.message : String(err)}`);
  try {
    await client.query("rollback");
  } catch {
    /* abaikan */
  }
} finally {
  await client.end();
}

console.log(
  `\nRLS-TEST ${fail > 0 ? "FAILED" : "OK"} — ${pass} pass, ${fail} fail`,
);
process.exit(fail > 0 ? 1 : 0);
