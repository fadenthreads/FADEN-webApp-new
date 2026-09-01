import { NextRequest } from "next/server";
import { handleStorageRequest } from "@faden/server";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export async function POST(request: NextRequest) {
  return handleStorageRequest(
    request,
    await getSupabaseServerClient(),
    "studio",
  );
}
