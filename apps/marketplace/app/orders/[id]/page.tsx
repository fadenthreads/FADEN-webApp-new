import Link from "next/link";
import { briefText, QuoteSummary, orderStatusLabel } from "@faden/ui";
import { MarketplaceHeader } from "../../../components/marketplace-header";
import { customerOrder } from "../../../lib/orders";
import { CancelOrder } from "../../../components/cancel-order";
import { OrderUpdateRefresh } from "../../../components/order-update-refresh";
import { getSupabaseServerClient } from "../../../lib/supabase/server";
import { productionStages } from "@faden/ui";
import { orderProgressSummary } from "../../../lib/order-progress.mjs";
export default async function OrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const o = await customerOrder(id);
  const db = await getSupabaseServerClient();
  const { data: progress, error: progressError } = await db
    .from("order_production_updates")
    .select("id,note,stage,created_at")
    .eq("order_id", id)
    .order("sequence", { ascending: false })
    .limit(3);
  const production = orderProgressSummary(
    progress,
    Boolean(progressError),
    productionStages,
  );
  return (
    <div className="market-page offer-page">
      <MarketplaceHeader active="atelier" />
      <main className="offer-main">
        <Link className="offer-kicker" href="/orders">
          ← My orders
        </Link>
        <h1>{briefText(o.quote, "title")}</h1>
        <span className="offer-badge">{orderStatusLabel(o.status)}</span>
        <p className="offer-lead">
          {o.boutique_name} · Accepted{" "}
          {new Date(o.accepted_at).toLocaleDateString("en-IN")}
        </p>
        <p className="request-reference">Order reference: {o.id}</p>
        <OrderUpdateRefresh />
        <section className="offer-panel">
          <h2>Latest updates from your boutique</h2>
          {progressError ? (
            <p>Updates could not be loaded. Refresh to try again.</p>
          ) : progress?.length ? (
            progress.map((update) => (
              <article key={update.id}>
                <h3>{productionStages[update.stage - 1]}</h3>
                <time dateTime={update.created_at}>
                  {new Date(update.created_at).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}{" "}
                  IST
                </time>
                <p>{update.note}</p>
              </article>
            ))
          ) : (
            <p>
              Your boutique’s notes and progress updates will appear here once
              production begins.
            </p>
          )}
          <Link href={`/journey/${id}`}>View all updates and photos →</Link>
        </section>
        <div className="offer-actions">
          {o.status !== "cancelled" && (
            <Link
              className="offer-btn secondary"
              href={`/orders/${id}/messages`}
            >
              Chat with boutique
            </Link>
          )}
          <Link className="offer-btn secondary" href={`/orders/${id}/support`}>
            Get support
          </Link>
          <Link
            className="offer-btn secondary"
            href={`/orders/${id}/aftercare`}
          >
            Aftercare
          </Link>
          <Link className="offer-btn secondary" href={`/orders/${id}/delivery`}>
            Delivery tracking
          </Link>
          <Link
            className="offer-btn secondary"
            href={`/orders/${id}/appointments`}
          >
            Measurement sessions
          </Link>
          <Link className="offer-btn secondary" href={`/orders/${id}/approval`}>
            Review your design
          </Link>
          <Link className="offer-btn secondary" href={`/journey/${id}`}>
            Boutique updates & outfit journey
          </Link>
          <Link className="offer-btn" href={`/orders/secure?id=${id}`}>
            View checkout →
          </Link>
          <Link
            className="offer-btn secondary"
            href={`/requests/${o.request_id}`}
          >
            Request & sharing
          </Link>
        </div>
        <div className="offer-split">
          <section>
            <h2>Your order, recorded.</h2>
            <p>
              The accepted quote is saved as an immutable snapshot. Subsequent
              boutique edits cannot change these prices or terms.
            </p>
            <ol className="order-milestones">
              <li>
                <strong>Offer accepted</strong>
                <span>
                  {new Date(o.accepted_at).toLocaleDateString("en-IN")}
                </span>
              </li>
              <li>
                <strong>{orderStatusLabel(o.status)}</strong>
                <span>
                  Payment status is verified before production begins.
                </span>
              </li>
              <li>
                <strong>{production.title}</strong>
                <span>{production.detail}</span>
              </li>
            </ol>
            <p className="offer-notice">
              Revoking brief access does not cancel an order or erase its
              commercial record. Changes require cancellation before checkout
              and a new request.
            </p>
          </section>
          <QuoteSummary
            quote={o.quote}
            subtotal={o.subtotal_paise}
            tax={o.tax_paise}
            total={o.total_paise}
          />
        </div>
        {o.status === "awaiting_payment" && <CancelOrder orderId={o.id} />}
        {o.status === "test_advance_paid" && (
          <Link className="offer-btn" href={`/orders/${o.id}/receipt`}>
            View receipt →
          </Link>
        )}
      </main>
    </div>
  );
}
