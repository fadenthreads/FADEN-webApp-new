import { NextRequest, NextResponse } from "next/server";
import { requestContext, jsonBody, apiError } from "../../../lib/request-api";
export async function POST(request: NextRequest) {
  try {
    const { supabase } = await requestContext(request);
    const body = await jsonBody(request);
    if (body.action === "revoke") {
      const { error } = await supabase.rpc("revoke_request_share", {
        target_share: String(body.shareId),
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }
    if (
      body.action !== "share" ||
      typeof body.measurements !== "boolean" ||
      typeof body.inspiration !== "boolean" ||
      body.confirmed !== true
    )
      throw new Error("Confirm the selected sharing permissions.");
    const { data, error } = await supabase.rpc("share_outfit_request", {
      target_request: String(body.requestId),
      target_boutique: String(body.boutiqueId),
      measurements_allowed: body.measurements,
      inspiration_allowed: body.inspiration,
      confirmed: true,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ id: data });
  } catch (error) {
    return apiError(error);
  }
}
