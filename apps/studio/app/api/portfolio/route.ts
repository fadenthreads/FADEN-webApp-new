import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  isNextResponse,
  isOwnedPortfolioKey,
  jsonError,
  readJsonBody,
  requireSameOrigin,
  requireUser,
} from "@faden/server";
import {
  allowedPortfolioImage,
  portfolioColumns,
} from "../../../lib/portfolio";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export async function POST(request: NextRequest) {
  const originFailure = requireSameOrigin(request);
  if (originFailure) return originFailure;
  const db = await getSupabaseServerClient();
  const user = await requireUser(db);
  if (isNextResponse(user)) return user;
  const body = await readJsonBody(request, 18_000);
  if (isNextResponse(body)) return body;
  const b = body as Record<string, unknown>;
  if (
    !b ||
    typeof b.boutiqueId !== "string" ||
    typeof b.id !== "string" ||
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(b.id) ||
    !["create", "update"].includes(String(b.action))
  )
    return jsonError("Invalid portfolio request.", 400);
  return savePortfolio(db, user, b);
}

async function savePortfolio(
  db: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  user: User,
  b: Record<string, unknown>,
) {
  const membership = await db
    .from("boutique_members")
    .select("boutique_id")
    .eq("boutique_id", b.boutiqueId as string)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membership.error || !membership.data)
    return jsonError("This portfolio is not available.", 403, "forbidden");
  if (
    typeof b.title !== "string" ||
    b.title.trim().length < 2 ||
    b.title.trim().length > 160 ||
    typeof b.description !== "string" ||
    b.description.length > 3000 ||
    typeof b.price !== "string" ||
    !/^\d{1,8}(\.\d{1,2})?$/.test(b.price) ||
    !["draft", "published", "archived"].includes(String(b.status)) ||
    typeof b.image !== "string" ||
    b.image.length > 2048 ||
    !allowedPortfolioImage(b.image, b.boutiqueId as string) ||
    !Number.isInteger(b.minWeeks) ||
    !Number.isInteger(b.maxWeeks) ||
    (b.minWeeks as number) < 1 ||
    (b.maxWeeks as number) < (b.minWeeks as number) ||
    (b.maxWeeks as number) > 104 ||
    !Array.isArray(b.occasions) ||
    b.occasions.length > 10 ||
    b.occasions.some(
      (o: unknown) => typeof o !== "string" || o.length < 1 || o.length > 40,
    )
  )
    return jsonError(
      "Check the title, price, image, categories and 1–104 week lead time.",
      400,
    );
  const price = Math.round(Number(b.price) * 100);
  if (!Number.isSafeInteger(price) || price > 1000000000)
    return jsonError("Starting price must not exceed ₹1,00,00,000.", 400);
  if (b.status === "published") {
    if (b.confirmPublished !== true || !b.image || price <= 0)
      return jsonError(
        "Confirm publishing and provide an image and a positive price.",
        400,
      );
    const boutique = await db
      .from("boutiques")
      .select("id")
      .eq("id", b.boutiqueId as string)
      .eq("status", "verified")
      .eq("is_published", true)
      .maybeSingle();
    if (boutique.error || !boutique.data)
      return jsonError("Publishing requires a verified, public boutique.", 409);
  }
  const patch = {
    title: (b.title as string).trim(),
    description: (b.description as string).trim(),
    base_price_paise: price,
    status: b.status as "draft" | "published" | "archived",
    primary_image_url: b.image as string,
    occasions: [...new Set(b.occasions as string[])],
    lead_time_min_weeks: b.minWeeks as number,
    lead_time_max_weeks: b.maxWeeks as number,
  };
  const slug = "design-" + b.id;
  const current = await db
    .from("designs")
    .select(portfolioColumns)
    .eq(
      b.action === "create" ? "slug" : "id",
      b.action === "create" ? slug : (b.id as string),
    )
    .eq("boutique_id", b.boutiqueId as string)
    .maybeSingle();
  if (current.error) return jsonError("Could not load the design.", 409);
  if (b.action === "create" && current.data) {
    const same = Object.entries(patch).every(
      ([k, v]) =>
        JSON.stringify(current.data?.[k as keyof typeof current.data]) ===
        JSON.stringify(v),
    );
    return same
      ? NextResponse.json({ id: current.data.id })
      : jsonError("Design reference already used.", 409);
  }
  if (
    b.action === "update" &&
    (!current.data ||
      typeof b.version !== "string" ||
      current.data.updated_at !== b.version)
  )
    return jsonError(
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
            boutique_id: b.boutiqueId as string,
            slug,
          })
          .select("id")
          .single()
      : await db
          .from("designs")
          .update({ ...patch, published_at })
          .eq("id", b.id as string)
          .eq("boutique_id", b.boutiqueId as string)
          .eq("updated_at", b.version as string)
          .select("id")
          .maybeSingle();
  if (result.error || !result.data)
    return jsonError(
      "Design changed or could not be saved. Reload and retry.",
      409,
    );
  const previous = current.data?.primary_image_url;
  const next = patch.primary_image_url;
  if (
    previous &&
    previous !== next &&
    isOwnedPortfolioKey(previous, b.boutiqueId as string) &&
    previous.split("/")[1] === user.id
  ) {
    const leftover = await db
      .from("designs")
      .select("id", { count: "exact", head: true })
      .eq("primary_image_url", previous);
    if ((leftover.count ?? 0) === 0) {
      await db.storage.from("portfolio-images").remove([previous]);
    }
  }
  return NextResponse.json({ id: result.data.id });
}
