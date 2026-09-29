import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Matikan aturan format eslint yang berkonflik — Prettier yang berkuasa.
  prettierConfig,
  {
    rules: {
      // Spec .md di root tidak boleh diimport ke src/ — anti-bocor bundle/UI/log.
      "no-restricted-imports": ["error", { patterns: ["*.md", "**/*.md"] }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Artefak generate Prisma (jangan lint, jangan edit manual):
    "src/prisma/contract.d.ts",
    // State workflow lokal Prisma (refs/snapshots):
    "migrations/**",
  ]),
]);

export default eslintConfig;
