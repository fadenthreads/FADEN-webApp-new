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
  return (
    <AtelierShell
      active="orders"
      name={boutiques.map((b) => b.name).join(" · ")}
    >
      <span className="offer-kicker">Your accepted commissions</span>
      <h1>Orders</h1>
      <p className="offer-lead">
        A considered beginning. Accepted quotes are saved here while payment is
        pending.
      </p>
      <p className="offer-notice">
        No real money has been collected through FADEN. Do not begin production
        or book fulfilment based on acceptance alone.
      </p>
      <div className="atelier-requests">
        {orders?.map((o) => (
          <Link key={o.id} className="atelier-request" href={`/orders/${o.id}`}>
            <span className="offer-badge">{orderStatusLabel(o.status)}</span>
            <h2>{briefText(o.quote, "title")}</h2>
            <p>
              {o.boutique_name} · {money(o.total_paise)}
            </p>
            <p>Quoted advance · {money(o.advance_paise)} · Test mode only</p>
            <span>View order →</span>
          </Link>
        ))}
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
