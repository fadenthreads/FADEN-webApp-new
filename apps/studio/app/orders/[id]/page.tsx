import Link from "next/link";
import { notFound } from "next/navigation";
import { QuoteSummary, briefText, orderStatusLabel } from "@faden/ui";
import { atelierContext } from "../../../lib/atelier";
import { AtelierShell } from "../../../components/atelier-shell";
export default async function Order({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, boutiques } = await atelierContext();
  const { data: order, error } = await supabase
    .from("customer_orders")
    .select()
    .eq("id", id)
    .in(
      "boutique_id",
      boutiques.map((b) => b.id),
    )
    .maybeSingle();
  if (error) throw new Error("Could not load the order.");
  if (!order) notFound();
  return (
    <AtelierShell active="orders" name={order.boutique_name}>
      <Link href="/orders" className="offer-kicker">
        ← Back to orders
      </Link>
      <h1>{briefText(order.quote, "title")}</h1>
      <span className="offer-badge">{orderStatusLabel(order.status)}</span>
      <p className="offer-lead">
        Accepted {new Date(order.accepted_at).toLocaleDateString("en-IN")} ·
        Order {order.id.slice(0, 8)}
      </p>
      <p className="offer-notice">
        This is the commercial quote accepted by your customer. No real money
        has been collected. Rehearsal progress is available after design
        approval; live production, fitting bookings and courier booking are not
        enabled.
      </p>
      <div className="offer-actions">
        <Link className="offer-btn secondary" href={`/orders/${id}/messages`}>
          Private messages
        </Link>
        <Link className="offer-btn secondary" href={`/orders/${id}/aftercare`}>
          Aftercare rehearsal
        </Link>
        <Link className="offer-btn secondary" href={`/orders/${id}/delivery`}>
          Delivery rehearsal →
        </Link>
        <Link className="offer-btn secondary" href={`/orders/${id}/production`}>
          Production rehearsal →
        </Link>
        <Link className="offer-btn" href={`/orders/${id}/design`}>
          Design proposals & customer feedback →
        </Link>
      </div>
      <QuoteSummary
        quote={order.quote}
        subtotal={order.subtotal_paise}
        tax={order.tax_paise}
        total={order.total_paise}
      />
      <div className="offer-panel">
        <h2>Privacy & access</h2>
        <p>
          This saved quote does not include private measurements, inspiration or
          delivery addresses. Request access may be revoked without deleting
          this commercial record.
        </p>
      </div>
    </AtelierShell>
  );
}
