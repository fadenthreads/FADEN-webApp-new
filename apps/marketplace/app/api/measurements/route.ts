import { NextRequest, NextResponse } from "next/server";
import {
  isNextResponse,
  readJsonBody,
  requireSameOrigin,
  requireUser,
  routeGuardError,
} from "@faden/server";
import {
  validateDraft,
  MEASUREMENT_LABELS,
  type MeasurementKey,
} from "../../../lib/outfit-request";
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
    const d = validateDraft({ measurements: payload.measurements });
    delete d.measurements.reference;
    if (
      !(Object.keys(MEASUREMENT_LABELS) as MeasurementKey[]).some(
        (key) => d.measurements[key],
      )
    )
      throw new Error("Enter at least one measurement before saving.");
    const { error } = await supabase
      .from("measurement_profiles")
      .upsert({ user_id: user.id, measurements: d.measurements });
    if (error) throw new Error("Measurements could not be saved.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeGuardError(error, "Unable to save your request.");
  }
}
