import { getSupabaseServerClient } from "../../../lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { oauthCallbackDestination } from "@faden/auth";

export async function GET(request: NextRequest) {
  const next = await oauthCallbackDestination(
    request.nextUrl.searchParams,
    async (code) => {
      const supabase = await getSupabaseServerClient();
      return supabase.auth.exchangeCodeForSession(code);
    },
    "/account",
  );
  return NextResponse.redirect(new URL(next, request.url));
}
