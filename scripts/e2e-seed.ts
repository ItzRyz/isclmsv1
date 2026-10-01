#!/usr/bin/env bun
/**
 * e2e-seed.ts — fixture deterministik untuk E2E (P0-1306).
 * Idempoten: aman dijalankan berulang. Data: 3 persona (admin/member/target),
 * kelas + periode akademik + pita nilai, course/modul/materi (termasuk draf
 * & prasyarat) untuk alur learning.
 *
 * Jalankan: bun run e2e:seed
 */
import { createClient } from "@supabase/supabase-js";
import { PASSWORD } from "../e2e/fixtures";

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const secret = process.env["SUPABASE_SECRET_KEY"];
if (!url || !secret) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY kosong");
  process.exit(1);
}

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function fail(msg: string): never {
  console.error(`E2E-SEED FAILED: ${msg}`);
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

async function ensureUser(
  email: string,
  fullName: string,
  roleCode: string | null,
): Promise<string> {
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
  if (roleCode) {
    const role = await admin
      .from("roles")
      .select("id")
      .eq("code", roleCode)
      .single();
    if (role.error || !role.data) fail(`role ${roleCode} tidak ada`);
    const existing = await admin
      .from("user_roles")
      .select("user_id, role_id")
      .eq("user_id", id)
      .eq("role_id", role.data.id)
      .maybeSingle();
    if (!existing.error && !existing.data) {
      const ins = await admin
        .from("user_roles")
        .insert({ user_id: id, role_id: role.data.id, assigned_by: null });
      if (ins.error) fail(`user_roles ${email}: ${ins.error.message}`);
    }
  }
  return id;
}

async function idOrInsert(
  table: string,
  row: Record<string, unknown>,
  onConflict: string,
  lookup: () => Promise<string | null>,
  label: string,
): Promise<string> {
  const existing = await lookup();
  if (existing) return existing;
  const { error } = await admin
    .from(table)
    .upsert(row, { onConflict, ignoreDuplicates: true });
  if (error) fail(`${label} insert: ${error.message}`);
  const id = await lookup();
  if (!id) fail(`${label}: insert tidak menghasilkan baris`);
  return id;
}

async function main(): Promise<void> {
  // 1. Organisasi + divisi (seed migrasi, cukup dibaca).
  const org = await admin
    .from("organizations")
    .select("id")
    .eq("slug", "study-club")
    .single();
  if (org.error || !org.data)
    fail("organisasi study-club tidak ada (migrasi?)");
  const orgId = org.data.id;

  const div = await admin
    .from("divisions")
    .select("id")
    .eq("code", "WEB")
    .single();
  if (div.error || !div.data) fail("divisi WEB tidak ada (migrasi?)");
  const divisionId = div.data.id;

  // 2. Persona.
  const adminId = await ensureUser(
    "e2e-admin@e2e.test",
    "E2E Admin",
    "SUPER_ADMIN",
  );
  const memberId = await ensureUser(
    "e2e-member@e2e.test",
    "E2E Member",
    "MEMBER",
  );
  const targetId = await ensureUser("e2e-target@e2e.test", "E2E Target", null);
  // Target selalu mulai tanpa peran (alur assign/cabut deterministik).
  const wipe = await admin.from("user_roles").delete().eq("user_id", targetId);
  if (wipe.error) fail(`wipe target roles: ${wipe.error.message}`);

  // 3. Kelas + periode akademik.
  const classId = await idOrInsert(
    "classes",
    { division_id: divisionId, name: "E2E Class", code: "E2E-CLASS" },
    "code",
    async () => {
      const r = await admin
        .from("classes")
        .select("id")
        .eq("code", "E2E-CLASS")
        .maybeSingle();
      if (r.error) fail(r.error.message);
      return r.data?.id ?? null;
    },
    "kelas E2E",
  );

  const periodId = await idOrInsert(
    "academic_periods",
    { organization_id: orgId, name: "E2E Periode", code: "E2E-PERIOD" },
    "code",
    async () => {
      const r = await admin
        .from("academic_periods")
        .select("id")
        .eq("code", "E2E-PERIOD")
        .maybeSingle();
      if (r.error) fail(r.error.message);
      return r.data?.id ?? null;
    },
    "periode E2E",
  );

  // 4. Pita nilai (untuk surat rapor A/B/C/D).
  const scales = await admin
    .from("grade_scales")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  if (scales.error) fail(scales.error.message);
  if ((scales.count ?? 0) === 0) {
    const bands = [
      {
        code: "A",
        letter: "A",
        min_score: 90,
        max_score: 100,
        is_passing: true,
      },
      {
        code: "B",
        letter: "B",
        min_score: 80,
        max_score: 89,
        is_passing: true,
      },
      {
        code: "C",
        letter: "C",
        min_score: 70,
        max_score: 79,
        is_passing: true,
      },
      {
        code: "D",
        letter: "D",
        min_score: 0,
        max_score: 69,
        is_passing: false,
      },
    ].map((b) => ({ organization_id: orgId, ...b }));
    const ins = await admin.from("grade_scales").insert(bands);
    if (ins.error) fail(`grade_scales: ${ins.error.message}`);
  }

  // 5. Course + modul + materi.
  const courseId = await idOrInsert(
    "courses",
    {
      division_id: divisionId,
      name: "E2E Course",
      slug: "e2e-course",
      status: "PUBLISHED",
      published_at: new Date().toISOString(),
      created_by: adminId,
      description: "Course fixture E2E.",
    },
    "division_id,slug",
    async () => {
      const r = await admin
        .from("courses")
        .select("id")
        .eq("slug", "e2e-course")
        .maybeSingle();
      if (r.error) fail(r.error.message);
      return r.data?.id ?? null;
    },
    "course E2E",
  );

  // Course draf (negatif: member harus 404).
  await admin.from("courses").upsert(
    {
      division_id: divisionId,
      name: "E2E Course Draf",
      slug: "e2e-course-draft",
      status: "DRAFT",
      created_by: adminId,
    },
    { onConflict: "division_id,slug", ignoreDuplicates: true },
  );

  const moduleId = await idOrInsert(
    "modules",
    {
      course_id: courseId,
      title: "E2E Modul",
      slug: "e2e-modul",
      position: 0,
      status: "PUBLISHED",
    },
    "course_id,position",
    async () => {
      const r = await admin
        .from("modules")
        .select("id")
        .eq("course_id", courseId)
        .eq("slug", "e2e-modul")
        .maybeSingle();
      if (r.error) fail(r.error.message);
      return r.data?.id ?? null;
    },
    "modul E2E",
  );

  async function ensureMaterial(
    slug: string,
    title: string,
    status: "PUBLISHED" | "DRAFT",
    isRequired: boolean,
    content: string,
  ): Promise<string> {
    return idOrInsert(
      "materials",
      {
        module_id: moduleId,
        title,
        slug,
        type: "TEXT",
        content_text: content,
        is_required: isRequired,
        status,
        ...(status === "PUBLISHED"
          ? { published_at: new Date().toISOString() }
          : {}),
        created_by: adminId,
      },
      "module_id,slug",
      async () => {
        const r = await admin
          .from("materials")
          .select("id")
          .eq("module_id", moduleId)
          .eq("slug", slug)
          .maybeSingle();
        if (r.error) fail(r.error.message);
        return r.data?.id ?? null;
      },
      `materi ${slug}`,
    );
  }

  const matA = await ensureMaterial(
    "e2e-materi-a",
    "E2E Materi A",
    "PUBLISHED",
    true,
    "Isi materi A untuk E2E.",
  );
  const matB = await ensureMaterial(
    "e2e-materi-b",
    "E2E Materi B",
    "PUBLISHED",
    false,
    "Materi B (prasyarat: Materi A).",
  );
  await ensureMaterial(
    "e2e-materi-draft",
    "E2E Materi Draf",
    "DRAFT",
    true,
    "Tidak boleh terlihat member.",
  );

  const pre = await admin
    .from("material_prerequisites")
    .upsert(
      { material_id: matB, prerequisite_material_id: matA },
      { ignoreDuplicates: true },
    );
  if (pre.error) fail(`prasyarat: ${pre.error.message}`);

  // 6. Reset state berulang dari run sebelumnya (biar idempoten).
  const mp = await admin
    .from("material_progress")
    .delete()
    .in("material_id", [matA, matB]);
  if (mp.error) fail(`reset material_progress: ${mp.error.message}`);
  const gr = await admin
    .from("grades")
    .delete()
    .eq("user_id", memberId)
    .eq("academic_period_id", periodId);
  if (gr.error) fail(`reset grades: ${gr.error.message}`);
  const rc = await admin
    .from("report_cards")
    .delete()
    .eq("user_id", memberId)
    .eq("academic_period_id", periodId);
  if (rc.error) fail(`reset report_cards: ${rc.error.message}`);

  console.log("E2E-SEED OK");
  console.log(
    JSON.stringify(
      {
        adminId,
        memberId,
        targetId,
        courseId,
        periodId,
        classId,
        matA,
        matB,
      },
      null,
      2,
    ),
  );
}

main().catch((e: unknown) => fail(String(e)));
