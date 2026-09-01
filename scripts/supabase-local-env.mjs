import { execFileSync } from "node:child_process";

export function getLocalSupabaseEnvironment() {
  const output = execFileSync(
    "npx",
    ["supabase", "status", "--output", "env"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );

  return Object.fromEntries(
    output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator);
        const value = line.slice(separator + 1).replace(/^"|"$/g, "");
        return [key, value];
      }),
  );
}

export function requireLocalValue(environment, ...keys) {
  const value = keys.map((key) => environment[key]).find(Boolean);
  if (!value) {
    throw new Error(`Supabase status did not return ${keys.join(" or ")}.`);
  }
  return value;
}
