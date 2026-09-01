import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../lib/supabase/server";
import {
  allowedPortfolioImage,
  portfolioColumns,
} from "../../../lib/portfolio";
const fail = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return fail("Invalid request origin.", 403);
  const db = await getSupabaseServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return fail("Please sign in.", 401);
  try {
    const text = await request.text();
    if (text.length > 18000) return fail("Request too large.", 413);
    const b = JSON.parse(text);
    if (
      !b ||
      typeof b.boutiqueId !== "string" ||
      typeof b.id !== "string" ||
      !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(b.id) ||
      !["create", "update"].includes(b.action)
    )
      return fail("Invalid portfolio request.");
    const membership = await db
      .from("boutique_members")
      .select("boutique_id")
      .eq("boutique_id", b.boutiqueId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membership.error || !membership.data)
      return fail("This portfolio is not available.", 403);
    if (
      typeof b.title !== "string" ||
      b.title.trim().length < 2 ||
      b.title.trim().length > 160 ||
      typeof b.description !== "string" ||
      b.description.length > 3000 ||
      typeof b.price !== "string" ||
      !/^\d{1,8}(\.\d{1,2})?$/.test(b.price) ||
      !["draft", "published", "archived"].includes(b.status) ||
      typeof b.image !== "string" ||
      b.image.length > 2048 ||
      !allowedPortfolioImage(b.image) ||
      !Number.isInteger(b.minWeeks) ||
      !Number.isInteger(b.maxWeeks) ||
      b.minWeeks < 1 ||
      b.maxWeeks < b.minWeeks ||
      b.maxWeeks > 104 ||
      !Array.isArray(b.occasions) ||
      b.occasions.length > 10 ||
      b.occasions.some(
        (o: unknown) => typeof o !== "string" || o.length < 1 || o.length > 40,
      )
    )
      return fail(
        "Check the title, price, image, categories and 1–104 week lead time.",
      );
    const price = Math.round(Number(b.price) * 100);
    if (!Number.isSafeInteger(price) || price > 1000000000)
      return fail("Starting price must not exceed ₹1,00,00,000.");
    if (b.status === "published") {
      if (b.confirmPublished !== true || !b.image || price <= 0)
        return fail(
          "Confirm publishing and provide an image and a positive price.",
        );
      const boutique = await db
        .from("boutiques")
        .select("id")
        .eq("id", b.boutiqueId)
        .eq("status", "verified")
        .eq("is_published", true)
        .maybeSingle();
      if (boutique.error || !boutique.data)
        return fail("Publishing requires a verified, public boutique.", 409);
    }
    const patch = {
      title: b.title.trim(),
      description: b.description.trim(),
      base_price_paise: price,
      status: b.status as "draft" | "published" | "archived",
      primary_image_url: b.image,
      occasions: [...new Set(b.occasions as string[])],
      lead_time_min_weeks: b.minWeeks,
      lead_time_max_weeks: b.maxWeeks,
    };
    // Stable retry reference; the database still generates the protected row ID.
    const slug = "design-" + b.id;
    const current = await db
      .from("designs")
      .select(portfolioColumns)
      .eq(
        b.action === "create" ? "slug" : "id",
        b.action === "create" ? slug : b.id,
      )
      .eq("boutique_id", b.boutiqueId)
      .maybeSingle();
    if (current.error) return fail("Could not load the design.", 409);
    if (b.action === "create" && current.data) {
      const same = Object.entries(patch).every(
        ([k, v]) =>
          JSON.stringify(current.data?.[k as keyof typeof current.data]) ===
          JSON.stringify(v),
      );
      return same
        ? NextResponse.json({ id: current.data.id })
        : fail("Design reference already used.", 409);
    }
    if (
      b.action === "update" &&
      (!current.data ||
        typeof b.version !== "string" ||
        current.data.updated_at !== b.version)
    )
      return fail(
        "Design changed or is unavailable. Reload before editing.",
        409,
      );
    const published_at =
      b.status === "published"
        ? current.data?.published_at || new Date().toISOString()
        : null;
    const result =
      b.action === "create"
        ? await db
            .from("designs")
            .insert({
              ...patch,
              published_at,
              boutique_id: b.boutiqueId,
              slug,
            })
            .select("id")
            .single()
        : await db
            .from("designs")
            .update({ ...patch, published_at })
            .eq("id", b.id)
            .eq("boutique_id", b.boutiqueId)
            .eq("updated_at", b.version)
            .select("id")
            .maybeSingle();
    if (result.error || !result.data)
      return fail(
        "Design changed or could not be saved. Reload and retry.",
        409,
      );
    return NextResponse.json({ id: result.data.id });
  } catch {
    return fail("Invalid portfolio request.");
  }
}
