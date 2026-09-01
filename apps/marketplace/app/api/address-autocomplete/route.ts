import { NextRequest, NextResponse } from "next/server";

import { getMapsReadiness } from "@faden/integrations";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";

const requestWindows = new Map<string, { count: number; resetAt: number }>();

function withinSearchLimit(userId: string) {
  const now = Date.now();
  const current = requestWindows.get(userId);
  if (!current || current.resetAt <= now) {
    requestWindows.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (current.count >= 30) return false;
  current.count += 1;
  return true;
}

interface GeoapifyResult {
  address_line1?: string;
  city?: string;
  formatted?: string;
  lat?: number;
  lon?: number;
  place_id?: string;
  postcode?: string;
  state?: string;
  town?: string;
  village?: string;
}

export async function GET(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.json(
      { error: "Please sign in to continue." },
      { status: 401 },
    );
  }
  if (!withinSearchLimit(data.user.id)) {
    return NextResponse.json(
      { error: "Too many address searches. Please wait a minute." },
      { status: 429 },
    );
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 3) return NextResponse.json({ suggestions: [] });
  if (query.length > 160) {
    return NextResponse.json(
      { error: "Address search is too long." },
      { status: 400 },
    );
  }

  const maps = getMapsReadiness();
  if (!maps.configured || !maps.enabled) {
    return NextResponse.json(
      {
        error: "Address search is not configured. Enter the address manually.",
      },
      { status: 503 },
    );
  }

  const apiKey = process.env.GEOAPIFY_API_KEY!;

  const endpoint = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
  endpoint.search = new URLSearchParams({
    apiKey,
    filter: "countrycode:in",
    format: "json",
    lang: "en",
    limit: "6",
    text: query,
  }).toString();

  try {
    const response = await fetch(endpoint, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("Provider request failed");

    const payload = (await response.json()) as { results?: GeoapifyResult[] };
    const suggestions = (payload.results ?? [])
      .filter(
        (result) => result.place_id && result.formatted && result.address_line1,
      )
      .map((result) => ({
        city: result.city ?? result.town ?? result.village ?? "",
        id: result.place_id as string,
        label: result.formatted as string,
        latitude: typeof result.lat === "number" ? result.lat : null,
        line1: result.address_line1 as string,
        longitude: typeof result.lon === "number" ? result.lon : null,
        postalCode: result.postcode ?? "",
        state: result.state ?? "",
      }));

    return NextResponse.json(
      { suggestions },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error: "Address search is temporarily unavailable. Enter it manually.",
      },
      { status: 502 },
    );
  }
}
