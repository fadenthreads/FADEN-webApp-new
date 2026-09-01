import { NextRequest, NextResponse } from "next/server";
import { requestContext, jsonBody, apiError } from "../../../lib/request-api";
import { validateDraft } from "../../../lib/outfit-request";
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requestContext(request);
    const body = await jsonBody(request);
    const d = validateDraft({ measurements: body.measurements });
    if (!d.measurements.chest || !d.measurements.waist || !d.measurements.hips)
      throw new Error("Enter chest, waist and hips before saving.");
    const { error } = await supabase
      .from("measurement_profiles")
      .upsert({ user_id: user.id, measurements: d.measurements });
    if (error) throw new Error("Measurements could not be saved.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
