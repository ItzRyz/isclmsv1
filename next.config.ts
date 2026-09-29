import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Jangan pernah jadikan .md sebagai page/route.
  // File spek di root (AGENTS.md, prd.md, dst.) tidak boleh bisa diakses via URL prod.
  pageExtensions: ["tsx", "ts", "jsx", "js"],
  outputFileTracingExcludes: {
    "*": ["./*.md", "./**/*.md", "./public/**/*.md"],
  },
};

export default nextConfig;
