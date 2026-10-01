#!/usr/bin/env bun
/**
 * security-scan.ts — P0-1305: static security scan (OWASP + secret).
 *
 * Dijalankan: bun run test:security
 * Cakupan:
 * - secret scan: kunci/key/password di file ter-track (git) + .env harus
 *   tak ter-track
 * - bundle scan: build Next tidak membocorkan SUPABASE_SECRET_KEY
 * - OWASP static: pola berbahaya (eval, dangerouslySetInnerHTML, innerHTML),
 *   secret key hanya diizinkan di src/lib/supabase/admin.ts
 * - RLS coverage: setiap create table di migrations wajib
 *   enable row level security
 * - dependency scan: jalankan `bun audit` (script terpisah, lihat package.json)
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

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

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

// ---------- 1. .env tak boleh ter-track ----------
console.log("secret scan:");
{
  const envFiles = tracked.filter(
    (f) => f === ".env" || (f.startsWith(".env.") && f !== ".env.example"),
  );
  if (envFiles.length === 0) ok(".env tidak ter-track di git");
  else bad(".env tidak ter-track di git", envFiles.join(", "));
}

// ---------- 2. pola rahasia di file ter-track ----------
const SECRET_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "Supabase secret key", re: /sb_secret_[A-Za-z0-9_-]{16,}/ },
  { label: "private key PEM", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    label: "password di URL (bukan localhost)",
    re: /(?:postgres(?:ql)?|mysql|redis|mongodb):\/\/[^\s:/@]+:[^\s@]+@(?!localhost|127\.0\.0\.1)/,
  },
  {
    label: "assignment literal secret key",
    re: /SUPABASE_SECRET_KEY\s*=\s*["']?sb_secret_/,
  },
];
for (const f of tracked) {
  if (f === ".env.example" || f.endsWith(".test.ts")) continue;
  let content: string;
  try {
    if (statSync(f).size > 2_000_000) continue;
    content = readFileSync(f, "utf8");
  } catch {
    continue;
  }
  for (const p of SECRET_PATTERNS) {
    if (p.re.test(content)) bad(`rahasia di ${f}`, p.label);
  }
}
ok("tidak ada pola rahasia di file ter-track");

// ---------- 3. publishable/secret hardcoded di src ----------
{
  const srcFiles = tracked.filter(
    (f) => f.startsWith("src/") && f.endsWith(".ts"),
  );
  for (const f of srcFiles) {
    const content = readFileSync(f, "utf8");
    if (content.includes("sb_publishable_")) {
      bad("publishable key hardcoded", f);
    }
    if (
      content.includes("SUPABASE_SECRET_KEY") &&
      f !== "src/lib/supabase/admin.ts"
    ) {
      bad("SUPABASE_SECRET_KEY di luar admin.ts", f);
    }
  }
  ok("tidak ada key hardcoded di src/ (admin.ts dikecualikan)");
}

// ---------- 4. pola OWASP berbahaya ----------
console.log("owasp static:");
const DANGEROUS: { label: string; re: RegExp }[] = [
  { label: "dangerouslySetInnerHTML", re: /dangerouslySetInnerHTML/ },
  { label: "eval(", re: /[^a-zA-Z0-9_$.]eval\s*\(/ },
  { label: "new Function(", re: /new\s+Function\s*\(/ },
  { label: "innerHTML assignment", re: /\.innerHTML\s*=/ },
];
{
  let clean = true;
  for (const f of tracked.filter((f) => /^src\/.*\.(ts|tsx)$/.test(f))) {
    const content = readFileSync(f, "utf8");
    for (const d of DANGEROUS) {
      if (d.re.test(content)) {
        bad(d.label, f);
        clean = false;
      }
    }
  }
  if (clean) ok("tanpa eval/innerHTML/dangerouslySetInnerHTML di src/");
}

// ---------- 5. bundle tidak membawa secret ----------
console.log("bundle scan:");
{
  const staticDir = join(".next", "static");
  if (!existsSync(staticDir)) {
    console.log("  [SKIP] .next/static belum ada — jalankan build dulu");
  } else {
    const leaked: string[] = [];
    const keyRe = /sb_secret_[A-Za-z0-9_-]{16,}/;
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else {
          const content = readFileSync(full, "utf8");
          if (keyRe.test(content)) leaked.push(full);
        }
      }
    };
    walk(staticDir);
    if (leaked.length === 0) ok("bundle Next tidak mengandung sb_secret_");
    else
      bad(
        "bundle Next tidak mengandung sb_secret_",
        leaked.slice(0, 3).join(", "),
      );
  }
}

// ---------- 6. RLS coverage semua tabel migrasi ----------
console.log("rls coverage:");
{
  const migDir = join("supabase", "migrations");
  const allSql = readdirSync(migDir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(join(migDir, f), "utf8"))
    .join("\n");
  const tables = new Set<string>();
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?([a-zA-Z_][\w.]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(allSql)) !== null) {
    const name = m[1];
    if (name) tables.add(name.toLowerCase());
  }
  // Tabel platform (bukan milik migrasi kita) dikecualikan.
  const exempt = new Set(["storage.buckets", "storage.objects", "auth.users"]);
  const missing = [...tables].filter(
    (t) =>
      !exempt.has(t) &&
      !new RegExp(
        `alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:public\\.)?${t.replace(/\./g, "\\.")}\\s+enable\\s+row\\s+level\\s+security`,
        "i",
      ).test(allSql),
  );
  if (missing.length === 0) ok(`semua ${tables.size} tabel migrasi punya RLS`);
  else bad("RLS coverage", `tanpa enable RLS: ${missing.join(", ")}`);
}

console.log(
  `\nSECURITY-SCAN ${fail > 0 ? "FAILED" : "OK"} — ${pass} pass, ${fail} fail`,
);
process.exit(fail > 0 ? 1 : 0);
