import Link from "next/link";
import { briefText, QuoteSummary, orderStatusLabel } from "@faden/ui";
import { MarketplaceHeader } from "../../../components/marketplace-header";
import { customerOrder } from "../../../lib/orders";
import { CancelOrder } from "../../../components/cancel-order";
export default async function OrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const o = await customerOrder(id);
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
        <div className="offer-actions">
          <Link className="offer-btn secondary" href={`/orders/${id}/messages`}>
            Private messages
          </Link>
          <Link
            className="offer-btn secondary"
            href={`/orders/${id}/aftercare`}
          >
            Aftercare rehearsal
          </Link>
          <Link className="offer-btn secondary" href={`/orders/${id}/delivery`}>
            Delivery rehearsal
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
            Your outfit journey
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
                  No real money collected. Live payments remain disabled.
                </span>
              </li>
              <li>
                <strong>Production not started</strong>
                <span>
                  Design review is available. Production and delivery remain
                  disabled.
                </span>
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
            View test receipt →
          </Link>
        )}
      </main>
    </div>
  );
}
