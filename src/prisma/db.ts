// P0-008 — Prisma 8 RC stub.
//
// `prisma contract emit` (prisma@8.0.0-rc.17 + @prisma/orm-postgres@8.0.0-rc.13,
// contract source: src/prisma/contract.prisma) saat ini gagal upstream dengan:
//   CONTRACT.VALIDATION_FAILED: ... User.storage.ref must be an object ...
// Berlaku untuk SEMUA varian starter (Int/Uuid, dengan/tanpa @@map).
// Sesuai peringatan spek: jangan perlakukan Prisma 8 RC sebagai stabil.
//
// Sampai emit hijau dan src/prisma/contract.json + contract.d.ts ter-generate,
// modul ini sengaja TIDAK mengimpor artefak tersebut agar
// `bun run typecheck/lint/build` tetap hijau.
//
// Regenerasi saat RC sudah diperbaiki:
//   1. bunx prisma contract emit   (harus exit 0 + menulis contract.json/.d.ts)
//   2. Kembalikan klien asli (template dari `prisma orm init`):
//        import 'dotenv/config';
//        import postgres from '@prisma/orm-postgres/runtime';
//        import type { Contract } from './contract.d';
//        import contractJson from './contract.json' with { type: 'json' };
//        export const db = postgres<Contract>({
//          contractJson,
//          url: process.env['DATABASE_URL']!,
//        });
//   3. Hapus stub ini.

export function getDb(): never {
  throw new Error(
    "Prisma contract belum di-emit (upstream RC CONTRACT.VALIDATION_FAILED). " +
      "Jalankan `bunx prisma contract emit` setelah RC diperbaiki.",
  );
}
