import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@faden/supabase";
import { sendTransactionalEmail } from "@faden/server";

export const runtime = "nodejs";

type Db = SupabaseClient<Database>;
type Event = Database["public"]["Tables"]["outbox_events"]["Row"];
type Recipient = { userId: string; canonicalUrl: string };

const customerEvents = new Set([
  "payment.refund_pending",
  "payment.refund_completed",
  "payment.refund_failed",
  "design.published",
  "production.updated",
]);
const boutiqueEvents = new Set([
  "design.approved",
  "design.changes_requested",
  "aftercare.submitted",
]);
const bothOrderEvents = new Set([
  "order.accepted",
  "order.cancelled",
  "payment.test_captured",
  "appointment.preview_reserved",
  "appointment.preview_cancelled",
  "manual_shipment.updated",
  "aftercare.updated",
]);
const adminOrderEvents = new Set([
  "order.accepted",
  "payment.test_captured",
  "payment.refund_pending",
  "payment.refund_completed",
  "payment.refund_failed",
]);

function payloadValue(event: Event, key: string) {
  const payload = event.payload;
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? String((payload as Record<string, unknown>)[key] || "")
    : "";
}

async function resolveRecipients(db: Db, event: Event) {
  const marketplace =
    process.env.MARKETPLACE_URL ||
    process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
    "https://faden.in";
  const studio =
    process.env.STUDIO_URL ||
    process.env.NEXT_PUBLIC_STUDIO_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://faden.in";
  const admin =
    process.env.ADMIN_URL ||
    process.env.NEXT_PUBLIC_ADMIN_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    marketplace;
  const recipients: Recipient[] = [];
  const add = (userId: string | null | undefined, canonicalUrl: string) => {
    if (userId && !recipients.some((item) => item.userId === userId))
      recipients.push({ userId, canonicalUrl });
  };
  const addAdmins = async () => {
    const result = await db.from("profiles").select("id").eq("role", "admin");
    if (result.error) throw result.error;
    result.data.forEach((profile) => add(profile.id, admin));
  };

  if (event.event_type === "request.shared") {
    const shareId = payloadValue(event, "share_id") || event.aggregate_id;
    const share = await db
      .from("request_shares")
      .select("boutiques(owner_id)")
      .eq("id", shareId)
      .maybeSingle();
    if (share.error) throw share.error;
    add(share.data?.boutiques?.owner_id, studio);
    return recipients;
  }
  if (event.event_type === "outfit_request.submitted") {
    const requestId = payloadValue(event, "request_id") || event.aggregate_id;
    const outfitRequest = await db
      .from("outfit_requests")
      .select("user_id")
      .eq("id", requestId)
      .maybeSingle();
    if (outfitRequest.error) throw outfitRequest.error;
    add(outfitRequest.data?.user_id, marketplace);
    return recipients;
  }
  if (event.event_type === "boutique.application.created") {
    await addAdmins();
    return recipients;
  }
  if (event.event_type === "offer.sent") {
    const offerId = payloadValue(event, "offer_id") || event.aggregate_id;
    const offer = await db
      .from("boutique_offers")
      .select("customer_id")
      .eq("id", offerId)
      .maybeSingle();
    if (offer.error) throw offer.error;
    add(offer.data?.customer_id, marketplace);
    return recipients;
  }
  if (event.event_type.startsWith("verification_")) {
    const submission = await db
      .from("boutique_verification_submissions")
      .select("boutiques(owner_id)")
      .eq("id", event.aggregate_id)
      .maybeSingle();
    if (submission.error) throw submission.error;
    if (event.event_type === "verification_submitted") await addAdmins();
    else add(submission.data?.boutiques?.owner_id, studio);
    return recipients;
  }

  let orderId = payloadValue(event, "order_id");
  if (!orderId && event.aggregate_type === "customer_order")
    orderId = event.aggregate_id;
  if (!orderId && event.aggregate_type === "measurement_appointment") {
    const appointment = await db
      .from("measurement_appointments")
      .select("order_id")
      .eq("id", payloadValue(event, "appointment_id") || event.aggregate_id)
      .maybeSingle();
    if (appointment.error) throw appointment.error;
    orderId = appointment.data?.order_id || "";
  }
  if (!orderId && event.event_type === "aftercare.updated") {
    const item = await db
      .from("order_aftercare_items")
      .select("order_id")
      .eq("id", payloadValue(event, "item_id"))
      .maybeSingle();
    if (item.error) throw item.error;
    orderId = item.data?.order_id || "";
  }
  if (!orderId) return recipients;
  const order = await db
    .from("customer_orders")
    .select("customer_id,boutique_owner_id")
    .eq("id", orderId)
    .maybeSingle();
  if (order.error) throw order.error;
  if (!order.data) return recipients;

  if (event.event_type === "order.message_sent") {
    const sender = payloadValue(event, "sender_id");
    if (sender === order.data.customer_id)
      add(order.data.boutique_owner_id, studio);
    else add(order.data.customer_id, marketplace);
  } else if (customerEvents.has(event.event_type)) {
    add(order.data.customer_id, marketplace);
  } else if (boutiqueEvents.has(event.event_type)) {
    add(order.data.boutique_owner_id, studio);
  } else if (bothOrderEvents.has(event.event_type)) {
    add(order.data.customer_id, marketplace);
    add(order.data.boutique_owner_id, studio);
  } else if (event.event_type === "support.opened") {
    add(order.data.customer_id, marketplace);
    await addAdmins();
  }
  if (adminOrderEvents.has(event.event_type)) await addAdmins();
  return recipients;
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key)
    return NextResponse.json(
      { error: "Email worker is unavailable" },
      { status: 503 },
    );
  const db = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: events, error } = await db.rpc("claim_email_outbox", {
    p_limit: 20,
  });
  if (error)
    return NextResponse.json(
      { error: "Unable to claim email events" },
      { status: 500 },
    );
  let delivered = 0;
  for (const event of events ?? []) {
    try {
      const recipients = await resolveRecipients(db, event);
      for (const recipient of recipients) {
        const user = await db.auth.admin.getUserById(recipient.userId);
        if (!user.data.user?.email) continue;
        const result = await sendTransactionalEmail({
          to: user.data.user.email,
          eventType: event.event_type,
          payload: event.payload,
          canonicalUrl: recipient.canonicalUrl,
        });
        if (!result.skipped) delivered++;
      }
      await db.rpc("complete_email_outbox", {
        p_id: event.id,
        p_delivered: true,
        p_error: undefined,
      });
    } catch {
      await db.rpc("complete_email_outbox", {
        p_id: event.id,
        p_delivered: false,
        p_error: "delivery failed",
      });
    }
  }
  return NextResponse.json({ delivered });
}
