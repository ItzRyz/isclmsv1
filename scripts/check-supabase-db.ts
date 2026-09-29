#!/usr/bin/env bun
/**
 * check-supabase-db.ts
 * Smoke test koneksi Prisma -> Postgres Supabase (staging).
 * Dijalankan via: bun run db:ping
 * TIDAK PERNAH menampilkan URL, user, atau password — hanya host/port/database.
 */
import "dotenv/config";
import { Client } from "pg";

const TARGETS = ["DATABASE_URL", "DIRECT_URL"] as const;

function describe(raw: string): string {
  const u = new URL(raw);
  return `host=${u.hostname} port=${u.port || "(default)"} db=${u.pathname.replace("/", "")}`;
}

let failed = 0;

for (const name of TARGETS) {
  const raw = process.env[name];
  if (!raw) {
    console.error(`- ${name}: EMPTY (isi dulu di .env)`);
    failed += 1;
    continue;
  }
  try {
    console.log(`- ${name}: ${describe(raw)}`);
    const client = new Client({
      connectionString: raw,
      connectionTimeoutMillis: 15000,
    });
    await client.connect();
    const res = await client.query(
      "select version() as version, current_user as usr, current_database() as db",
    );
    const row = res.rows[0] as {
      version: string;
      usr: string;
      db: string;
    };
    console.log(
      `  OK user=${row.usr} db=${row.db} server=${String(row.version).split(" ").slice(0, 2).join(" ")}`,
    );
    await client.end();
  } catch (err) {
    failed += 1;
    console.error(
      `  FAIL ${name}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

if (failed > 0) {
  console.error(`DB-PING FAILED: ${failed} target bermasalah`);
  process.exit(1);
}
console.log("DB-PING OK");
