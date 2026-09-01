import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const compatibility = new FlatCompat({ baseDirectory: currentDirectory });

export default [
  {
    ignores: [
      "**/.next/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/next-env.d.ts",
      "packages/supabase/src/database.types.ts",
    ],
  },
  ...compatibility.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
];
