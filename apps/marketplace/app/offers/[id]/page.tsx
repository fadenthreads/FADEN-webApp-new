import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { briefText, QuoteSummary, OfferAction, offerStatus } from "@faden/ui";
import { MarketplaceHeader } from "../../../components/marketplace-header";
import { customerOffers } from "../../../lib/offers";
import { stitchImage } from "../../../lib/stitch-assets";
import { AcceptOffer } from "../../../components/accept-offer";
export default async function OfferDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await customerOffers();
  const { data: o } = await supabase
    .from("boutique_offers")
    .select("*,boutiques(name)")
    .eq("id", id)
    .eq("customer_id", user.id)
    .not("sent_at", "is", null)
    .maybeSingle();
  if (!o) notFound();
  const { data: order, error: orderError } = await supabase
    .from("customer_orders")
    .select("id,offer_id")
    .eq("request_id", o.request_id)
    .eq("customer_id", user.id)
    .maybeSingle();
  if (orderError) throw new Error("Could not load the order status.");
  const { data: profile } = await supabase
    .from("boutique_profiles")
    .select("hero_image_url")
    .eq("boutique_id", o.boutique_id)
    .maybeSingle();
  return (
    <div className="market-page offer-page">
      <MarketplaceHeader active="atelier" />
      <main className="offer-main">
        <Link href={`/offers?request=${o.request_id}`} className="offer-kicker">
          ← Back to offers
        </Link>
        <div className="offer-split">
          <section>
            <span className="offer-badge">
              {offerStatus(o.status, o.quote)}
            </span>
            <h1>
              Your offer from
              <br />
              {o.boutiques?.name ?? "your boutique"}
            </h1>
            <p className="offer-lead">{briefText(o.quote, "title")}</p>
            <Image
              src={stitchImage(profile?.hero_image_url)}
              alt={`${o.boutiques?.name ?? "Boutique"} atelier`}
              width={650}
              height={800}
              style={{
                width: "100%",
                height: "auto",
                maxHeight: 650,
                objectFit: "cover",
                borderRadius: 8,
              }}
              unoptimized
            />
            <div className="offer-actions">
              <Link
                className="offer-btn secondary"
                href={`/offers/compare?request=${o.request_id}`}
              >
                Compare offers
              </Link>
              <Link
                className="offer-btn secondary"
                href={`/requests/${o.request_id}`}
              >
                View request & sharing
              </Link>
            </div>
            <p className="offer-notice">
              Accepting saves your chosen quote. It does not collect payment,
              book a fitting or authorize production. Only test payments are
              available; no real money is collected.
            </p>
            {order ? (
              <div className="offer-panel">
                <p>
                  {order.offer_id === o.id
                    ? "You accepted this offer."
                    : "You already chose another offer for this request."}
                </p>
                <Link className="offer-btn" href={`/orders/${order.id}`}>
                  View your order →
                </Link>
              </div>
            ) : offerStatus(o.status, o.quote) === "sent" ? (
              <AcceptOffer offerId={o.id} version={o.version} />
            ) : null}
            {!order && o.status === "sent" && (
              <OfferAction
                endpoint="/api/offers"
                body={{ action: "declined", offerId: o.id, version: o.version }}
                label="Decline offer"
              />
            )}
          </section>
          <QuoteSummary
            quote={o.quote}
            subtotal={o.subtotal_paise}
            tax={o.tax_paise}
            total={o.total_paise}
          />
        </div>
      </main>
    </div>
  );
}
