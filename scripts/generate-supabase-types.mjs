import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const types = execFileSync(
  "npx",
  ["supabase", "gen", "types", "typescript", "--local"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);

writeFileSync(resolve("packages/supabase/src/database.types.ts"), types);
console.log("Generated Supabase database types.");
