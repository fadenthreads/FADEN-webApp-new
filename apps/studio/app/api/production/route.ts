import { NextRequest, NextResponse } from "next/server";
import { isPreviewMutationAllowed } from "@faden/integrations";
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
  if (!isPreviewMutationAllowed())
    return jsonError("Rehearsal updates are disabled in production.", 503);
  const supabase = await getSupabaseServerClient();
  const user = await requireUser(supabase);
  if (isNextResponse(user)) return user;
  const body = await readJsonBody(request, 12_000);
  if (isNextResponse(body)) return body;
  const b = body as Record<string, unknown>;
  if (
    !b ||
    typeof b.orderId !== "string" ||
    typeof b.commandId !== "string" ||
    !Number.isInteger(b.sequence) ||
    !Number.isInteger(b.stage) ||
    typeof b.note !== "string" ||
    (b.photo !== null && typeof b.photo !== "string") ||
    b.confirmed !== true
  )
    return jsonError("Complete and confirm your rehearsal update.", 400);
  const { data, error } = await supabase.rpc("record_production_update", {
    target_order: b.orderId,
    expected_sequence: b.sequence as number,
    target_stage: b.stage as number,
    progress_note: b.note,
    photo: b.photo,
    command_id: b.commandId,
    confirmed: b.confirmed,
  } as never);
  if (error)
    return NextResponse.json(
      {
        error:
          error.code === "P0001"
            ? error.message
            : "Could not record progress. Reload and try again.",
      },
      { status: 409 },
    );
  return NextResponse.json({ id: data });
}
