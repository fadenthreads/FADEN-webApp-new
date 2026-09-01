import Link from "next/link";
import { redirect } from "next/navigation";
import { briefText, money, orderStatusLabel } from "@faden/ui";
import { MarketplaceHeader } from "../../components/marketplace-header";
import { getSupabaseServerClient } from "../../lib/supabase/server";
export default async function Orders() {
  const supabase = await getSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/auth/sign-in?next=/orders");
  const { data: orders, error } = await supabase
    .from("customer_orders")
    .select()
    .eq("customer_id", auth.user.id)
    .order("accepted_at", { ascending: false });
  if (error) throw new Error("Could not load your orders.");
  return (
    <div className="market-page offer-page">
      <MarketplaceHeader active="atelier" />
      <main className="offer-main">
        <span className="offer-kicker">Your digital atelier</span>
        <h1>My orders</h1>
        <p className="offer-lead">
          Your accepted proposals, with their original prices and terms
          preserved.
        </p>
        <div className="offer-actions">
          <Link className="offer-btn secondary" href="/offers">
            Review offers
          </Link>
          <Link className="offer-btn secondary" href="/requests">
            My Requests
          </Link>
        </div>
        <div className="atelier-requests">
          {orders?.map((o) => (
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
              <span>View your order →</span>
            </Link>
          ))}
        </div>
        {!orders?.length && (
          <section className="offer-panel">
            <h2>Your next creation starts with an offer.</h2>
            <p>
              No accepted orders yet. Choose a proposal from your invited
              boutiques to see the checkout summary.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
