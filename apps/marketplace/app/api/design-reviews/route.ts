import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../lib/supabase/server";
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
    if (text.length > 12000)
      return NextResponse.json(
        { error: "Request too large." },
        { status: 413 },
      );
    const b = JSON.parse(text);
    if (
      typeof b.reviewId !== "string" ||
      !["approved", "changes_requested"].includes(b.decision) ||
      typeof b.feedback !== "string" ||
      b.feedback.length > 2000 ||
      b.confirmed !== true
    )
      return NextResponse.json(
        { error: "Review and confirm your decision." },
        { status: 400 },
      );
    const { error } = await supabase.rpc("decide_order_design", {
      target_review: b.reviewId,
      decision: b.decision,
      customer_feedback: b.feedback,
      confirmed: b.confirmed,
    });
    if (error)
      return NextResponse.json(
        {
          error:
            error.code === "P0001"
              ? error.message
              : "Could not record the decision. Refresh and try again.",
        },
        { status: 409 },
      );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid design decision." },
      { status: 400 },
    );
  }
}
