import { NextRequest, NextResponse } from "next/server";
import {
  isNextResponse,
  jsonError,
  readJsonBody,
  requireSameOrigin,
  requireUser,
} from "@faden/server";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const date = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: NextRequest) {
  const originFailure = requireSameOrigin(request);
  if (originFailure) return originFailure;
  const db = await getSupabaseServerClient();
  const user = await requireUser(db);
  if (isNextResponse(user)) return user;
  const body = await readJsonBody(request, 20_000);
  if (isNextResponse(body)) return body;
  const value = body as Record<string, unknown>;
  if (!value || typeof value !== "object" || Array.isArray(value))
    return jsonError("Check the storefront details.", 400);
  const text = (key: string) =>
    typeof value[key] === "string" ? value[key].trim() : "";
  const list = (key: string) =>
    Array.isArray(value[key])
      ? [...new Set(value[key] as unknown[])].filter(
          (item): item is string =>
            typeof item === "string" && item.length >= 2 && item.length <= 60,
        )
      : [];
  const boutiqueId = text("boutiqueId");
  const specialties = list("specialties");
  const services = list("services");
  const years = Number(value.yearsExperience);
  const responseHours = Number(value.responseHours);
  const price = Number(value.minimumPricePaise);
  const minWeeks = Number(value.leadTimeMinWeeks);
  const maxWeeks = Number(value.leadTimeMaxWeeks);
  const nextDate = value.nextAvailableDate;
  if (
    !uuid.test(boutiqueId) ||
    text("version").length < 10 ||
    text("name").length < 2 ||
    text("name").length > 120 ||
    text("city").length < 2 ||
    text("city").length > 120 ||
    text("description").length < 10 ||
    text("description").length > 1000 ||
    text("story").length < 40 ||
    text("story").length > 5000 ||
    specialties.length < 1 ||
    specialties.length > 10 ||
    services.length < 1 ||
    services.length > 10 ||
    !Number.isInteger(years) ||
    years < 0 ||
    years > 100 ||
    !Number.isInteger(responseHours) ||
    responseHours < 1 ||
    responseHours > 720 ||
    !Number.isSafeInteger(price) ||
    price < 0 ||
    price > 1_000_000_000 ||
    !Number.isInteger(minWeeks) ||
    minWeeks < 1 ||
    minWeeks > 104 ||
    !Number.isInteger(maxWeeks) ||
    maxWeeks < minWeeks ||
    maxWeeks > 104 ||
    (nextDate !== null &&
      (typeof nextDate !== "string" || !date.test(nextDate)))
  )
    return jsonError("Check the storefront details and try again.", 400);
  const { data, error } = await db.rpc("save_boutique_storefront", {
    p_boutique_id: boutiqueId,
    p_version: text("version"),
    p_details: {
      name: text("name"),
      city: text("city"),
      description: text("description"),
      story: text("story"),
      specialties,
      services,
      yearsExperience: years,
      responseHours,
      minimumPricePaise: price,
      leadTimeMinWeeks: minWeeks,
      leadTimeMaxWeeks: maxWeeks,
      nextAvailableDate: nextDate as string | null,
      ...(typeof value.heroImage === "string"
        ? { heroImage: value.heroImage }
        : {}),
    },
  });
  if (error) {
    if (error.message.includes("not editable"))
      return jsonError(
        "This storefront cannot currently be edited. Check verification or contact FADEN.",
        403,
      );
    if (error.message.includes("changed"))
      return jsonError(
        "Another storefront update was saved. Refresh this page before making more changes.",
        409,
      );
    return jsonError(
      "Could not save the storefront. Check the selected cover and required details.",
      400,
    );
  }
  return NextResponse.json({
    ok: true,
    ...(data as { version: string; live: boolean }),
  });
}
