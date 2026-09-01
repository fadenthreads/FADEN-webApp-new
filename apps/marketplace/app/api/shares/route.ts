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
    if (payload.action === "revoke") {
      const { error } = await supabase.rpc("revoke_request_share", {
        target_share: String(payload.shareId),
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }
    if (
      payload.action !== "share" ||
      typeof payload.measurements !== "boolean" ||
      typeof payload.inspiration !== "boolean" ||
      payload.confirmed !== true
    )
      throw new Error("Confirm the selected sharing permissions.");
    const { data, error } = await supabase.rpc("share_outfit_request", {
      target_request: String(payload.requestId),
      target_boutique: String(payload.boutiqueId),
      measurements_allowed: payload.measurements,
      inspiration_allowed: payload.inspiration,
      confirmed: true,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ id: data });
  } catch (error) {
    return routeGuardError(error, "Unable to save your request.");
  }
}
