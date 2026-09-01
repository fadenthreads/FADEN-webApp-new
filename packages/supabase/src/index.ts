import {
  createBrowserClient,
  createServerClient,
  type CookieMethodsServer,
} from "@supabase/ssr";

import type { Database } from "./database.types";

function getSupabaseSettings() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return { publishableKey, url };
}

export function createFadenBrowserClient() {
  const { publishableKey, url } = getSupabaseSettings();
  return createBrowserClient<Database>(url, publishableKey);
}

export function createFadenServerClient(cookies: CookieMethodsServer) {
  const { publishableKey, url } = getSupabaseSettings();
  return createServerClient<Database>(url, publishableKey, { cookies });
}

export type { Database, Json } from "./database.types";
export type FadenCookieMethods = CookieMethodsServer;
