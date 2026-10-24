import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const type = request.nextUrl.searchParams.get("type") ?? "designs";
  const city = (request.nextUrl.searchParams.get("city") ?? "").slice(0, 100);
  if (
    q.length < 2 ||
    q.length > 100 ||
    !["boutiques", "designs", "materials", "cities"].includes(type)
  )
    return NextResponse.json({ results: [] });
  // Strip PostgREST filter syntax and wildcard characters from free text.
  const term = q.replace(/[^\p{L}\p{N} \-]/gu, " ").trim();
  if (!term) return NextResponse.json({ results: [] });
  try {
    const db = await getSupabaseServerClient();
    if (type === "cities") {
      const { data, error } = await db
        .from("boutiques")
        .select("city")
        .eq("status", "verified")
        .eq("is_published", true)
        .ilike("city", `%${term}%`)
        .limit(500);
      if (error) throw error;
      return NextResponse.json({
        results: [...new Set((data ?? []).map((b) => b.city).filter(Boolean))]
          .slice(0, 6)
          .map((value) => ({
            label: value,
            detail: "Browse this city",
            value,
          })),
      });
    }
    const params = new URLSearchParams({ type, q });
    if (city) params.set("city", city);
    if (type === "boutiques") {
      let query = db
        .from("boutiques")
        .select("name,city,slug")
        .eq("status", "verified")
        .eq("is_published", true)
        .ilike("name", `%${term}%`);
      if (city) query = query.ilike("city", `%${city.replace(/[%_]/g, "")}%`);
      const { data, error } = await query.order("name").limit(6);
      if (error) throw error;
      return NextResponse.json({
        results: (data ?? []).map((b) => ({
          label: b.name,
          detail: b.city,
          href: `/boutiques/${b.slug}`,
        })),
        allHref: `/discover?${params}`,
      });
    }
    let query = db
      .from("designs")
      .select(
        "title,slug,materials,boutiques!inner(name,city,status,is_published)",
      )
      .eq("status", "published")
      .eq("boutiques.status", "verified")
      .eq("boutiques.is_published", true)
      .or(
        `title.ilike.%${term}%,description.ilike.%${term}%,materials.cs.{${term}}`,
      );
    if (city)
      query = query.ilike("boutiques.city", `%${city.replace(/[%_]/g, "")}%`);
    const { data, error } = await query.order("title").limit(6);
    if (error) throw error;
    return NextResponse.json({
      results: (data ?? []).map((d) => ({
        label: d.title,
        detail:
          type === "materials" ? d.materials.join(" · ") : d.boutiques.name,
        href: `/designs/${d.slug}`,
      })),
      allHref: `/discover?${params}`,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Suggestions are unavailable. Press Search to try the full catalogue.",
      },
      { status: 503 },
    );
  }
}
