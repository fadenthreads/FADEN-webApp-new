import { NextRequest, NextResponse } from "next/server";
import {
  createDailyClient,
  dailyConfiguration,
  getDailyReadiness,
} from "@faden/integrations";
import {
  isNextResponse,
  jsonError,
  readJsonBody,
  requireSameOrigin,
  requireUser,
} from "@faden/server";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const originFailure = requireSameOrigin(request);
  if (originFailure) return originFailure;
  const readiness = getDailyReadiness();
  if (!readiness.live)
    return jsonError("Video calls are not enabled yet.", 503);
  const supabase = await getSupabaseServerClient();
  const auth = await requireUser(supabase);
  if (isNextResponse(auth)) return auth;
  const body = await readJsonBody(request, 2000);
  if (isNextResponse(body)) return body;
  const payload = body as Record<string, unknown>;
  if (typeof payload.appointmentId !== "string")
    return jsonError("Invalid video request.", 400, "invalid_json");
  const { data: appointment } = await supabase
    .from("measurement_appointments")
    .select("id,customer_id,owner_id,kind,status,starts_at,ends_at")
    .eq("id", payload.appointmentId)
    .maybeSingle();
  if (
    !appointment ||
    appointment.kind !== "video" ||
    appointment.status !== "confirmed" ||
    (appointment.customer_id !== auth.id && appointment.owner_id !== auth.id)
  )
    return jsonError("Video appointment not available.", 404);
  const now = Date.now();
  if (
    now < Date.parse(appointment.starts_at) - 15 * 60_000 ||
    now > Date.parse(appointment.ends_at) + 30 * 60_000
  )
    return jsonError(
      "Join access opens 15 minutes before the appointment.",
      409,
    );
  try {
    const client = createDailyClient(dailyConfiguration());
    const room = await client.ensurePrivateRoom({
      appointmentId: appointment.id,
      startsAt: appointment.starts_at,
      endsAt: appointment.ends_at,
    });
    const token = await client.createMeetingToken({
      appointmentId: appointment.id,
      startsAt: appointment.starts_at,
      endsAt: appointment.ends_at,
      userId: auth.id,
      userName:
        typeof auth.user_metadata?.full_name === "string"
          ? auth.user_metadata.full_name
          : appointment.owner_id === auth.id
            ? "Boutique"
            : "Customer",
      isOwner: appointment.owner_id === auth.id,
    });
    if (typeof room.url !== "string" || typeof token.token !== "string")
      throw new Error("Invalid provider response.");
    const joinUrl = new URL(room.url);
    joinUrl.searchParams.set("t", token.token);
    return NextResponse.json(
      { joinUrl: joinUrl.toString() },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch {
    return jsonError("Video room could not be prepared.", 503);
  }
}
