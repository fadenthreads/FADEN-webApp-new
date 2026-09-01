import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../lib/supabase/server";
import type { Database } from "@faden/supabase";
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  const supabase = await getSupabaseServerClient();
  if (!(await supabase.auth.getUser()).data.user)
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    const text = await request.text();
    if (text.length > 20000)
      return NextResponse.json(
        { error: "Proposal too large." },
        { status: 413 },
      );
    const b = JSON.parse(text);
    if (
      typeof b.orderId !== "string" ||
      !Number.isInteger(b.revision) ||
      !b.proposal ||
      typeof b.proposal !== "object"
    )
      return NextResponse.json({ error: "Invalid proposal." }, { status: 400 });
    const { data, error } = await supabase.rpc("publish_order_design", {
      target_order: b.orderId,
      expected_revision: b.revision,
      proposal:
        b.proposal as Database["public"]["Tables"]["customer_orders"]["Row"]["quote"],
    });
    if (error)
      return NextResponse.json(
        {
          error:
            error.code === "P0001"
              ? error.message
              : "Could not share the design. Reload and try again.",
        },
        { status: 409 },
      );
    return NextResponse.json({ id: data });
  } catch {
    return NextResponse.json({ error: "Invalid proposal." }, { status: 400 });
  }
}
