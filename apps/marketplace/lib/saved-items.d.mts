import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@faden/supabase";
type Client = SupabaseClient<Database>;
export function readSavedItem(
  client: Client,
  kind: "design" | "boutique",
  entityId: string,
  userId?: string,
): Promise<{ saved: boolean; error: unknown }>;
export function insertSavedItem(
  client: Client,
  kind: "design" | "boutique",
  entityId: string,
  userId: string,
): PromiseLike<{ error: unknown }>;
