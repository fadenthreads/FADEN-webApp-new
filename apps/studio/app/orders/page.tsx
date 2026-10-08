import Link from "next/link";
import { briefText, money, orderStatusLabel } from "@faden/ui";
import { atelierContext } from "../../lib/atelier";
import { AtelierShell } from "../../components/atelier-shell";
export default async function Orders() {
  const { supabase, boutiques } = await atelierContext();
  const { data: orders, error } = await supabase
    .from("customer_orders")
    .select()
    .in(
      "boutique_id",
      boutiques.map((b) => b.id),
    )
    .order("accepted_at", { ascending: false });
  if (error) throw new Error("Could not load orders.");
  const orderIds = (orders ?? []).map((order) => order.id);
  const [payments, progress] = orderIds.length
    ? await Promise.all([
        supabase
          .from("order_payment_attempts")
          .select("order_id,status")
          .in("order_id", orderIds),
        supabase
          .from("order_production_summary")
          .select("order_id,stage,created_at")
          .in("order_id", orderIds),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (payments.error || progress.error)
    throw new Error("Could not load order progress.");
  return (
    <AtelierShell
      active="orders"
      name={boutiques.map((b) => b.name).join(" · ")}
    >
      <span className="offer-kicker">Your accepted commissions</span>
      <h1>Orders</h1>
      <p className="offer-lead">
        Accepted commissions are saved here. Payment status controls when your
        team can start production.
      </p>
      <p className="offer-notice">
        Do not begin production or arrange fulfilment until a confirmed payment
        is shown on the order.
      </p>
      <div className="atelier-requests">
        {orders?.map((o) => {
          const payment = payments.data?.find((item) => item.order_id === o.id);
          const production = progress.data?.find(
            (item) => item.order_id === o.id,
          );
          return (
            <Link
              key={o.id}
              className="atelier-request"
              href={`/orders/${o.id}`}
            >
              <span className="offer-badge">{orderStatusLabel(o.status)}</span>
              <h2>{briefText(o.quote, "title")}</h2>
              <p>
                {o.boutique_name} · {money(o.total_paise)}
              </p>
              <p>Quoted advance · {money(o.advance_paise)}</p>
              <div className="order-tracking-summary">
                <span>
                  {payment?.status === "captured"
                    ? "Payment confirmed"
                    : "Payment pending"}
                </span>
                <span>
                  {production
                    ? `Production stage ${production.stage} of 5`
                    : "Production not started"}
                </span>
                <span>
                  {o.status === "cancelled" ? "Order closed" : "Order active"}
                </span>
              </div>
              <span>Track and manage order →</span>
            </Link>
          );
        })}
      </div>
      {!orders?.length && (
        <div className="offer-panel">
          <h2>No accepted orders yet</h2>
          <p>Your customers’ accepted offers will appear here.</p>
          <Link href="/offers" className="offer-btn secondary">
            View offers
          </Link>
        </div>
      )}
    </AtelierShell>
  );
}
