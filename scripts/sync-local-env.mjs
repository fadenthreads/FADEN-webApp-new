import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  chmodSync,
} from "node:fs";
import { mergeLocalEnv } from "./merge-local-env.mjs";
import { dirname, resolve } from "node:path";

import {
  getLocalSupabaseEnvironment,
  requireLocalValue,
} from "./supabase-local-env.mjs";

const environment = getLocalSupabaseEnvironment();
const apiUrl = requireLocalValue(environment, "API_URL");
const publishableKey = requireLocalValue(
  environment,
  "PUBLISHABLE_KEY",
  "ANON_KEY",
);
const secretKey = requireLocalValue(
  environment,
  "SECRET_KEY",
  "SERVICE_ROLE_KEY",
);
const databaseUrl = requireLocalValue(environment, "DB_URL");

const contents = [
  `NEXT_PUBLIC_SUPABASE_URL=${apiUrl}`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishableKey}`,
  "NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false",
  `SUPABASE_SECRET_KEY=${secretKey}`,
  `DATABASE_URL=${databaseUrl}`,
  "NEXT_PUBLIC_APP_ENV=development",
  "NEXT_PUBLIC_MARKETPLACE_URL=http://localhost:3000",
  "NEXT_PUBLIC_STUDIO_URL=http://localhost:3001",
  "NEXT_PUBLIC_ADMIN_URL=http://localhost:3002",
  "",
].join("\n");

const destinations = [
  ".env.local",
  "apps/marketplace/.env.local",
  "apps/studio/.env.local",
  "apps/admin/.env.local",
];

for (const destination of destinations) {
  const fullPath = resolve(destination);
  mkdirSync(dirname(fullPath), { recursive: true });
  const existing = existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
  writeFileSync(fullPath, mergeLocalEnv(existing, contents), { mode: 0o600 });
  chmodSync(fullPath, 0o600);
}

console.log("Synced local Supabase settings to the root and all three apps.");
