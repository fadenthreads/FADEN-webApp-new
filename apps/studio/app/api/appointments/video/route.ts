import { NextRequest, NextResponse } from "next/server";
import {
  createDailyClient,
  dailyConfiguration,
  getDailyReadiness,
} from "@faden/integrations";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  const readiness = getDailyReadiness();
  if (!readiness.liveRoomsEnabled)
    return NextResponse.json(
      { error: "Video calls are not enabled yet." },
      { status: 503 },
    );
  const supabase = await getSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user)
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    const text = await request.text();
    if (text.length > 2000)
      return NextResponse.json(
        { error: "Request too large." },
        { status: 413 },
      );
    const body = JSON.parse(text) as { appointmentId?: unknown };
    if (typeof body.appointmentId !== "string") throw new Error();
    const { data: appointment } = await supabase
      .from("measurement_appointments")
      .select("id,customer_id,owner_id,kind,status,starts_at,ends_at")
      .eq("id", body.appointmentId)
      .maybeSingle();
    if (
      !appointment ||
      appointment.kind !== "video" ||
      appointment.status !== "confirmed" ||
      (appointment.customer_id !== auth.user.id &&
        appointment.owner_id !== auth.user.id)
    )
      return NextResponse.json(
        { error: "Video appointment not available." },
        { status: 404 },
      );
    const now = Date.now();
    if (
      now < Date.parse(appointment.starts_at) - 15 * 60_000 ||
      now > Date.parse(appointment.ends_at) + 30 * 60_000
    )
      return NextResponse.json(
        { error: "Join access opens 15 minutes before the appointment." },
        { status: 409 },
      );
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
      userId: auth.user.id,
      userName:
        typeof auth.user.user_metadata?.full_name === "string"
          ? auth.user.user_metadata.full_name
          : appointment.owner_id === auth.user.id
            ? "Boutique"
            : "Customer",
      isOwner: appointment.owner_id === auth.user.id,
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
    return NextResponse.json(
      { error: "Video room could not be prepared." },
      { status: 503 },
    );
  }
}
