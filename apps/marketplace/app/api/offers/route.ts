import { NextRequest, NextResponse } from "next/server";
import { requestContext, jsonBody, apiError } from "../../../lib/request-api";
export async function POST(request: NextRequest) {
  try {
    const { supabase } = await requestContext(request);
    const body = await jsonBody(request);
    if (body.action !== "declined" || !Number.isInteger(body.version))
      throw new Error("Invalid offer action.");
    const { error } = await supabase.rpc("close_boutique_offer", {
      target_offer: String(body.offerId),
      expected_version: body.version,
      action: "declined",
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
