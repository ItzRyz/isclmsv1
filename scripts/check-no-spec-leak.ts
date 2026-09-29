#!/usr/bin/env bun
/**
 * check-no-spec-leak.ts
 * Dijalankan via: bun scripts/check-no-spec-leak.ts (juga sebagai prebuild)
 * Aturan: file spek di root tidak boleh diimport/dirender/dilog di src/.
 * Output kegagalan hanya file:line + rule-id — TIDAK menampilkan isi file spek.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const PUBLIC = join(ROOT, "public");

const SPEC_FILES = [
  "AGENTS.md",
  "api.md",
  "architecture.md",
  "contributing.md",
  "database.md",
  "deployment.md",
  "prd.md",
  "rbac.md",
  "security.md",
  "tasks.md",
  "testing.md",
  "ui_ux_brief.md",
  "README.md",
  "CLAUDE.md",
];

const CODE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

type Violation = { file: string; line: number; rule: string };

const violations: Violation[] = [];

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(p, out);
    } else {
      out.push(p);
    }
  }
  return out;
}

function rel(p: string): string {
  return p.replace(ROOT + "\\", "").replace(ROOT + "/", "");
}

// Rule 1: tidak boleh ada file .md di public/ atau src/
for (const base of [PUBLIC, SRC]) {
  for (const f of walk(base)) {
    if (extname(f).toLowerCase() === ".md") {
      violations.push({ file: rel(f), line: 0, rule: "no-md-in-public-or-src" });
    }
  }
}

// Rule 2: tidak boleh ada import/require/readFile *.md di src/
const importMdRe = /(\bfrom\s+["'][^"']*\.md["']|\bimport\s*\([^)]*\.md|require\s*\([^)]*\.md|\breadFile[A-Za-z]*\s*\([^)]*\.md)/;
const specNameRes = SPEC_FILES.map(
  (n) => ({ name: n, re: new RegExp(`\\b${n.replace(".", "\\.")}\\b`) }),
);

for (const f of walk(SRC)) {
  if (!CODE_EXTS.has(extname(f).toLowerCase())) continue;
  const content = readFileSync(f, "utf8");
  const lines = content.split("\n");
  lines.forEach((lineText, idx) => {
    const line = idx + 1;
    if (importMdRe.test(lineText)) {
      violations.push({ file: rel(f), line, rule: "no-md-import" });
      return;
    }
    for (const { name, re } of specNameRes) {
      if (re.test(lineText)) {
        violations.push({ file: rel(f), line, rule: `no-spec-ref:${name}` });
        break;
      }
    }
  });
}

// Rule 3: next.config harus menjaga pageExtensions tanpa md/mdx
const nextConfigTs = join(ROOT, "next.config.ts");
const nextConfigMjs = join(ROOT, "next.config.mjs");
const nextConfigJs = join(ROOT, "next.config.js");
const cfgPath = [nextConfigTs, nextConfigMjs, nextConfigJs].find((p) => existsSync(p));
if (cfgPath) {
  const cfg = readFileSync(cfgPath, "utf8");
  if (!cfg.includes("pageExtensions")) {
    violations.push({ file: rel(cfgPath), line: 0, rule: "missing-pageExtensions-guard" });
  } else if (/["']mdx?["']/.test(cfg)) {
    violations.push({ file: rel(cfgPath), line: 0, rule: "pageExtensions-must-exclude-md" });
  }
} else {
  violations.push({ file: "next.config.ts", line: 0, rule: "missing-next-config" });
}

if (violations.length > 0) {
  console.error(`SPEC-LEAK-CHECK FAILED: ${violations.length} pelanggaran`);
  for (const v of violations.slice(0, 50)) {
    console.error(`- ${v.file}:${v.line} [${v.rule}]`);
  }
  process.exit(1);
} else {
  console.log("SPEC-LEAK-CHECK OK");
}
