import 'dotenv/config';
import { definePrismaConfig } from 'prisma/config';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';

// PENTING: pasangan versi ini koheren (satu @prisma/orm-toolchain).
// prisma@rc.17 + orm-postgres@rc.12 => toolchain rc.12 tunggal.
// Jangan upgrade salah satu tanpa verifikasi `bunx prisma contract emit`
// tetap hijau — toolchain ganda = CONTRACT.VALIDATION_FAILED (storage.ref).
export default definePrismaConfig({
  orm: ormConfig({
    contract: "./src/prisma/contract.prisma",
    db: {
      connection: process.env['DATABASE_URL']!,
    },
  }),
});
