import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@faden/supabase";
import { sendTransactionalEmail } from "@faden/server";

export const runtime = "nodejs";

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
      const orderId =
        typeof event.payload === "object" &&
        event.payload &&
        "order_id" in event.payload
          ? String((event.payload as { order_id: unknown }).order_id)
          : event.aggregate_type === "customer_order"
            ? event.aggregate_id
            : null;
      if (!orderId) {
        await db.rpc("complete_email_outbox", {
          p_id: event.id,
          p_delivered: true,
          p_error: undefined,
        });
        continue;
      }
      const { data: order } = await db
        .from("customer_orders")
        .select("customer_id")
        .eq("id", orderId)
        .maybeSingle();
      const user = order
        ? await db.auth.admin.getUserById(order.customer_id)
        : { data: { user: null } };
      if (!user.data.user?.email) {
        await db.rpc("complete_email_outbox", {
          p_id: event.id,
          p_delivered: true,
          p_error: undefined,
        });
        continue;
      }
      await sendTransactionalEmail({
        to: user.data.user.email,
        eventType: event.event_type,
        payload: event.payload,
      });
      await db.rpc("complete_email_outbox", {
        p_id: event.id,
        p_delivered: true,
        p_error: undefined,
      });
      delivered++;
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
