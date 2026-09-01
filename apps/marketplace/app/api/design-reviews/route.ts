import { NextRequest, NextResponse } from "next/server";
import {
  isNextResponse,
  jsonError,
  readJsonBody,
  requireSameOrigin,
  requireUser,
} from "@faden/server";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export async function POST(request: NextRequest) {
  const originFailure = requireSameOrigin(request);
  if (originFailure) return originFailure;
  const supabase = await getSupabaseServerClient();
  const user = await requireUser(supabase);
  if (isNextResponse(user)) return user;
  const body = await readJsonBody(request, 12_000);
  if (isNextResponse(body)) return body;
  const b = body as Record<string, unknown>;
  if (
    typeof b.reviewId !== "string" ||
    !["approved", "changes_requested"].includes(String(b.decision)) ||
    typeof b.feedback !== "string" ||
    (b.feedback as string).length > 2000 ||
    b.confirmed !== true
  )
    return jsonError("Review and confirm your decision.", 400);
  const { error } = await supabase.rpc("decide_order_design", {
    target_review: b.reviewId,
    decision: b.decision as string,
    customer_feedback: b.feedback as string,
    confirmed: b.confirmed as boolean,
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
}
