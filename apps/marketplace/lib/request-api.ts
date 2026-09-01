import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "./supabase/server";
export async function requestContext(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin)
    throw new Error("Invalid request origin.");
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Please sign in to continue.");
  return { supabase, user: data.user };
}
export async function jsonBody(request: NextRequest) {
  const text = await request.text();
  if (text.length > 55000) throw new Error("Request is too large.");
  return JSON.parse(text);
}
export function apiError(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof Error ? error.message : "Unable to save your request.",
    },
    { status: 400 },
  );
}
