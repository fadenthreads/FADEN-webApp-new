import { NextRequest, NextResponse } from "next/server";
import {
  getShiprocketReadiness,
  mapShiprocketStatus,
  shiprocketConfiguration,
  verifyShiprocketWebhookToken,
} from "../../../../lib/shiprocket-core.mjs";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const readiness = getShiprocketReadiness();
  if (!readiness.configured || !readiness.apiEnabled)
    return NextResponse.json(
      { error: "Courier webhook is not enabled." },
      { status: 503 },
    );

  const config = shiprocketConfiguration();
  if (
    !verifyShiprocketWebhookToken(
      request.headers.get("x-api-key"),
      config.webhookSecret,
    )
  )
    return NextResponse.json(
      { error: "Invalid webhook token." },
      { status: 401 },
    );

  const text = await request.text();
  if (Buffer.byteLength(text) > 262_144)
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });

  try {
    const event = JSON.parse(text) as Record<string, unknown>;
    const awb = String(event.awb ?? event.awb_code ?? "").trim();
    const currentStatus = String(
      event.current_status ?? event.shipment_status ?? event.status ?? "",
    ).trim();
    if (!awb || !currentStatus)
      return NextResponse.json(
        { error: "Invalid tracking event." },
        { status: 400 },
      );

    // Persistence is intentionally activated only with the provider connection.
    // Returning 503 prevents Shiprocket from treating an unpersisted event as accepted.
    return NextResponse.json(
      {
        error: "Courier persistence is not enabled yet.",
        mappedStatus: mapShiprocketStatus(currentStatus),
      },
      { status: 503 },
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook payload." },
      { status: 400 },
    );
  }
}
