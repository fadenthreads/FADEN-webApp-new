import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@faden/supabase";
import { parseQuote } from "@faden/ui";
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
  const body = await readJsonBody(request, 25_000);
  if (isNextResponse(body)) return body;
  try {
    const payload = body as Record<string, unknown>;
    if (payload.action === "notes") {
      if (
        typeof payload.notes !== "string" ||
        (payload.notes as string).length > 5000
      )
        throw new Error("Notes must be under 5,000 characters.");
      const { error } = await supabase.from("atelier_request_notes").upsert({
        share_id: String(payload.shareId),
        notes: payload.notes,
      });
      if (error) throw new Error("Could not save internal notes.");
      return NextResponse.json({ ok: true });
    }
    if (!Number.isInteger(payload.version))
      throw new Error("Reload the offer before saving.");
    if (payload.action === "withdrawn") {
      const { error } = await supabase.rpc("close_boutique_offer", {
        target_offer: String(payload.offerId),
        expected_version: payload.version as number,
        action: "withdrawn",
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }
    if (payload.action !== "save" || typeof payload.send !== "boolean")
      throw new Error("Invalid offer action.");
    const proposal = parseQuote(payload.quote);
    const { data: id, error } = await supabase.rpc("save_boutique_offer", {
      target_share: String(payload.shareId),
      expected_version: payload.version as number,
      proposal:
        proposal as unknown as Database["public"]["Tables"]["boutique_offers"]["Row"]["quote"],
      send_now: payload.send,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ id });
  } catch (error) {
    return routeGuardError(error, "Could not save offer.");
  }
}
