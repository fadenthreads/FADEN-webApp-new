import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../lib/supabase/server";
import { parseQuote } from "@faden/ui";
import type { Database } from "@faden/supabase";
export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin)
      throw new Error("Invalid request origin.");
    const supabase = await getSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new Error("Please sign in.");
    const raw = await request.text();
    if (raw.length > 25000) throw new Error("Proposal too large.");
    const body = JSON.parse(raw);
    if (body.action === "notes") {
      if (typeof body.notes !== "string" || body.notes.length > 5000)
        throw new Error("Notes must be under 5,000 characters.");
      const { error } = await supabase
        .from("atelier_request_notes")
        .upsert({ share_id: String(body.shareId), notes: body.notes });
      if (error) throw new Error("Could not save internal notes.");
      return NextResponse.json({ ok: true });
    }
    if (!Number.isInteger(body.version))
      throw new Error("Reload the offer before saving.");
    if (body.action === "withdrawn") {
      const { error } = await supabase.rpc("close_boutique_offer", {
        target_offer: String(body.offerId),
        expected_version: body.version,
        action: "withdrawn",
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }
    if (body.action !== "save" || typeof body.send !== "boolean")
      throw new Error("Invalid offer action.");
    const proposal = parseQuote(body.quote);
    const { data: id, error } = await supabase.rpc("save_boutique_offer", {
      target_share: String(body.shareId),
      expected_version: body.version,
      proposal:
        proposal as unknown as Database["public"]["Tables"]["boutique_offers"]["Row"]["quote"],
      send_now: body.send,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ id });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not save offer.",
      },
      { status: 400 },
    );
  }
}
