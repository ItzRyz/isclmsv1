/**
 * Fixtures E2E: konstanta persona + helper data via Supabase (service role,
 * hanya untuk seed/lookup test — tidak pernah masuk bundle browser).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function loadEnv(): void {
  if (process.env["NEXT_PUBLIC_SUPABASE_URL"]) return;
  try {
    const raw = readFileSync(join(process.cwd(), ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
      if (m?.[1] && m[2] !== undefined && !(m[1] in process.env)) {
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // .env tidak ada — biarkan requireEnv yang gagalkan dengan pesan jelas.
  }
}
loadEnv();

export const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://localhost:3100";
export const PASSWORD = "E2e-Test-2026";
export const emails = {
  admin: "e2e-admin@e2e.test",
  member: "e2e-member@e2e.test",
  target: "e2e-target@e2e.test",
} as const;
/** Sufiks unik per run untuk slug yang dibuat lewat UI. */
export const runId = Date.now().toString(36);

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `env ${name} kosong — jalankan lewat "bun run test:e2e" (auto-load .env)`,
    );
  }
  return v;
}

export function adminClient(): SupabaseClient {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function getUserId(email: string): Promise<string> {
  const admin = adminClient();
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    if (data.users.length < 200) {
      throw new Error(`user ${email} tidak ada — jalankan "bun run e2e:seed"`);
    }
    page += 1;
  }
}

async function getIdWhere(
  table: "courses" | "materials" | "academic_periods" | "grade_components",
  column: string,
  value: string,
  label: string,
): Promise<string> {
  const r = await adminClient()
    .from(table)
    .select("id")
    .eq(column, value)
    .maybeSingle();
  if (r.error) throw new Error(`${label}: ${r.error.message}`);
  if (!r.data)
    throw new Error(`${label} tidak ada — jalankan "bun run e2e:seed"`);
  return r.data.id;
}

export async function getCourseId(): Promise<string> {
  return getIdWhere("courses", "slug", "e2e-course", "course e2e");
}

export async function getMaterialId(slug: string): Promise<string> {
  return getIdWhere("materials", "slug", slug, `material ${slug}`);
}

export async function getPeriodId(): Promise<string> {
  return getIdWhere(
    "academic_periods",
    "code",
    "E2E-PERIOD",
    "periode E2E-PERIOD",
  );
}

export async function getComponentId(code: string): Promise<string> {
  return getIdWhere(
    "grade_components",
    "code",
    code,
    `komponen ${code} (grade_components seed?)`,
  );
}

export async function getQuestionId(prompt: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const r = await adminClient()
      .from("questions")
      .select("id")
      .eq("prompt", prompt)
      .maybeSingle();
    if (r.data) return r.data.id;
    if (r.error) throw new Error(`question: ${r.error.message}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`question "${prompt}" tidak ada`);
}

export async function getCertificateToken(userId: string): Promise<string> {
  const r = await adminClient()
    .from("certificates")
    .select("verification_token")
    .eq("user_id", userId)
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (r.error || !r.data) {
    throw new Error("sertifikat e2e tidak ada — terbitkan lewat UI dulu");
  }
  return r.data.verification_token;
}

/** "YYYY-MM-DDTHH:mm" untuk input datetime-local (timezone mesin lokal). */
export function localDateTime(offsetMs: number): string {
  const d = new Date(Date.now() + offsetMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
