import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@faden/supabase";
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
  const body = await readJsonBody(request, 20_000);
  if (isNextResponse(body)) return body;
  const b = body as Record<string, unknown>;
  if (
    typeof b.orderId !== "string" ||
    !Number.isInteger(b.revision) ||
    !b.proposal ||
    typeof b.proposal !== "object"
  )
    return jsonError("Invalid proposal.", 400);
  const { data, error } = await supabase.rpc("publish_order_design", {
    target_order: b.orderId,
    expected_revision: b.revision as number,
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
}
