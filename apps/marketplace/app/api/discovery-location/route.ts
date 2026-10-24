import { NextRequest, NextResponse } from "next/server";
import { getMapsReadiness } from "@faden/integrations";
import { isNextResponse, readJsonBody, requireSameOrigin } from "@faden/server";

const windows = new Map<string, { count: number; until: number }>();

export async function POST(request: NextRequest) {
  const origin = requireSameOrigin(request);
  if (origin) return origin;
  const key =
    request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const now = Date.now();
  for (const [id, value] of windows) if (value.until < now) windows.delete(id);
  const window = windows.get(key) ?? { count: 0, until: now + 60000 };
  if (++window.count > 25)
    return NextResponse.json(
      { error: "Please wait a minute before searching again." },
      { status: 429 },
    );
  windows.set(key, window);
  const body = await readJsonBody(request, 2048);
  if (isNextResponse(body)) return body;
  if (!body || typeof body !== "object" || Array.isArray(body))
    return NextResponse.json({ error: "Choose a location." }, { status: 400 });
  const b = body as Record<string, unknown>;
  const search = typeof b.query === "string" ? b.query.trim() : "";
  const reverse =
    typeof b.latitude === "number" &&
    typeof b.longitude === "number" &&
    Number.isFinite(b.latitude) &&
    Number.isFinite(b.longitude) &&
    Math.abs(b.latitude) <= 85 &&
    Math.abs(b.longitude) <= 180;
  if (!reverse && (search.length < 2 || search.length > 120))
    return NextResponse.json(
      { error: "Choose a point on the map or enter a city." },
      { status: 400 },
    );
  const maps = getMapsReadiness();
  if (!maps.configured || !maps.enabled)
    return NextResponse.json(
      {
        error:
          "Location lookup is unavailable. Choose a city below to filter boutiques.",
      },
      { status: 503 },
    );
  const endpoint = new URL(
    `https://api.geoapify.com/v1/geocode/${reverse ? "reverse" : "search"}`,
  );
  endpoint.searchParams.set("apiKey", process.env.GEOAPIFY_API_KEY!);
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("limit", "1");
  if (reverse) {
    endpoint.searchParams.set("lat", String(b.latitude));
    endpoint.searchParams.set("lon", String(b.longitude));
  } else {
    endpoint.searchParams.set("text", search);
    endpoint.searchParams.set("filter", "countrycode:in");
    endpoint.searchParams.set("type", "city");
  }
  try {
    const response = await fetch(endpoint, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error();
    const payload = await response.json();
    const place = payload.results?.[0];
    const city =
      place?.city || place?.town || place?.village || place?.municipality;
    if (
      !city ||
      place.country_code !== "in" ||
      !Number.isFinite(place.lat) ||
      !Number.isFinite(place.lon)
    )
      return NextResponse.json(
        {
          error:
            "No Indian city found at this point. Choose another location or select a city.",
        },
        { status: 404 },
      );
    return NextResponse.json(
      {
        city,
        latitude: place.lat,
        longitude: place.lon,
        label: place.formatted || city,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Location lookup is temporarily unavailable. Choose a city below instead.",
      },
      { status: 502 },
    );
  }
}
