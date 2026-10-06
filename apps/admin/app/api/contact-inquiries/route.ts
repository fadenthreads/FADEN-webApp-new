import { NextRequest, NextResponse } from "next/server";
import {
  isNextResponse,
  jsonError,
  readJsonBody,
  requireAdminAal2,
  requireSameOrigin,
} from "@faden/server";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export async function POST(request: NextRequest) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const db = await getSupabaseServerClient();
  const user = await requireAdminAal2(db);
  if (isNextResponse(user)) return user;
  const body = await readJsonBody(request, 2_048);
  if (isNextResponse(body)) return body;
  const input = body as Record<string, unknown>;
  if (
    typeof input.id !== "string" ||
    !["new", "in_progress", "resolved", "closed"].includes(String(input.status))
  ) {
    return jsonError("Invalid contact update.", 400, "invalid_request");
  }
  const { error } = await db.rpc("admin_update_contact_inquiry", {
    p_id: input.id,
    p_status: String(input.status),
  });
  return error
    ? jsonError("Unable to update the enquiry.", 409, "contact_conflict")
    : NextResponse.json({ success: true });
}
