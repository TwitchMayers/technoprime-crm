import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "out/**",
    "dist/**",
    "build/**",
    "coverage/**",
    "postgres-data/**",
    "*.tsbuildinfo",
    ".next.bak*/**",
    "legacy/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
