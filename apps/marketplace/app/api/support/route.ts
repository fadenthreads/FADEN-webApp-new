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
  const origin = requireSameOrigin(request);
  if (origin) return origin;
  const supabase = await getSupabaseServerClient();
  const user = await requireUser(supabase);
  if (isNextResponse(user)) return user;
  const body = await readJsonBody(request, 8192);
  if (isNextResponse(body)) return body;
  const input = body as Record<string, unknown>;
  if (
    typeof input.order_id !== "string" ||
    typeof input.kind !== "string" ||
    typeof input.subject !== "string" ||
    typeof input.message !== "string"
  )
    return jsonError("Invalid support request.", 400, "invalid_request");
  const { data, error } = await supabase.rpc("customer_open_support_case", {
    p_order_id: input.order_id,
    p_kind: input.kind,
    p_subject: input.subject,
    p_message: input.message,
  });
  return error
    ? jsonError("Unable to open support case.", 409, "support_conflict")
    : NextResponse.json({ id: data });
}
