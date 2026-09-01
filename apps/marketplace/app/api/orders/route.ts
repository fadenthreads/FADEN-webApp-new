import { NextRequest, NextResponse } from "next/server";
import {
  isNextResponse,
  readJsonBody,
  requireSameOrigin,
  requireUser,
  routeGuardError,
} from "@faden/server";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export async function POST(request: NextRequest) {
  const originFailure = requireSameOrigin(request);
  if (originFailure) return originFailure;
  const supabase = await getSupabaseServerClient();
  const user = await requireUser(supabase);
  if (isNextResponse(user)) return user;
  const body = await readJsonBody(request, 55_000);
  if (isNextResponse(body)) return body;
  try {
    const payload = body as Record<string, unknown>;
    if (
      payload.action === "cancel" &&
      typeof payload.orderId === "string" &&
      payload.confirmed === true
    ) {
      const { data, error } = await supabase.rpc("cancel_unpaid_order", {
        target_order: payload.orderId,
        confirmed: true,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ id: data });
    }
    if (
      payload.action !== "accept" ||
      payload.confirmed !== true ||
      !Number.isInteger(payload.version) ||
      typeof payload.offerId !== "string"
    )
      throw new Error("Review the offer and confirm its terms.");
    const { data, error } = await supabase.rpc("accept_boutique_offer", {
      target_offer: payload.offerId,
      expected_version: payload.version as number,
      confirmed: true,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ id: data });
  } catch (error) {
    return routeGuardError(error, "Unable to save your request.");
  }
}
