import { NextRequest, NextResponse } from "next/server";
import { requestContext, jsonBody, apiError } from "../../../lib/request-api";
export async function POST(request: NextRequest) {
  try {
    const { supabase } = await requestContext(request);
    const body = await jsonBody(request);
    if (
      body.action === "cancel" &&
      typeof body.orderId === "string" &&
      body.confirmed === true
    ) {
      const { data, error } = await supabase.rpc("cancel_unpaid_order", {
        target_order: body.orderId,
        confirmed: true,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ id: data });
    }
    if (
      body.action !== "accept" ||
      body.confirmed !== true ||
      !Number.isInteger(body.version) ||
      typeof body.offerId !== "string"
    )
      throw new Error("Review the offer and confirm its terms.");
    const { data, error } = await supabase.rpc("accept_boutique_offer", {
      target_offer: body.offerId,
      expected_version: body.version,
      confirmed: true,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ id: data });
  } catch (error) {
    return apiError(error);
  }
}
