import Link from "next/link";
import { notFound } from "next/navigation";
import { QuoteSummary, OfferAction, briefText, offerStatus } from "@faden/ui";
import { atelierContext } from "../../../lib/atelier";
import { AtelierShell } from "../../../components/atelier-shell";
export default async function OfferDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, boutiques } = await atelierContext();
  const { data: o } = await supabase
    .from("boutique_offers")
    .select()
    .eq("id", id)
    .in(
      "boutique_id",
      boutiques.map((b) => b.id),
    )
    .maybeSingle();
  if (!o) notFound();
  const { data: order } = await supabase
    .from("customer_orders")
    .select("id")
    .eq("offer_id", o.id)
    .maybeSingle();
  return (
    <AtelierShell
      name={boutiques.find((b) => b.id === o.boutique_id)?.name}
      active="offers"
    >
      <Link href="/offers" className="offer-kicker">
        ← Back to offers
      </Link>
      <h1>{briefText(o.quote, "title")}</h1>
      <span className="offer-badge">{offerStatus(o.status, o.quote)}</span>
      <div className="offer-actions">
        {order && (
          <Link href={`/orders/${order.id}`} className="offer-btn">
            View accepted order →
          </Link>
        )}
        <Link href={`/requests/${o.share_id}`} className="offer-btn secondary">
          View request
        </Link>
        {o.status === "draft" && (
          <Link href={`/offers/new?share=${o.share_id}`} className="offer-btn">
            Edit draft →
          </Link>
        )}
      </div>
      <QuoteSummary
        quote={o.quote}
        subtotal={o.subtotal_paise}
        tax={o.tax_paise}
        total={o.total_paise}
      />
      {o.status === "sent" && (
        <OfferAction
          endpoint="/api/offers"
          body={{ action: "withdrawn", offerId: o.id, version: o.version }}
          label="Withdraw offer"
        />
      )}
      <p className="offer-notice">
        {o.status === "draft"
          ? "Only your atelier can see this draft. Send it when your quote is ready."
          : "Sent quotes are locked. Customers can accept a quote and test checkout. Only unpaid orders with no checkout attempt can be cancelled. Do not begin production: test payments collect no real money."}
      </p>
    </AtelierShell>
  );
}
