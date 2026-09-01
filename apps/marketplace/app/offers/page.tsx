import Link from "next/link";
import Image from "next/image";
import { briefText, money, offerStatus } from "@faden/ui";
import { MarketplaceHeader } from "../../components/marketplace-header";
import { MarketplaceFooter } from "../../components/marketplace-footer";
import { customerOffers } from "../../lib/offers";
import { stitchImage } from "../../lib/stitch-assets";
export default async function Offers({
  searchParams,
}: {
  searchParams: Promise<{ request?: string }>;
}) {
  const { request } = await searchParams;
  const { supabase, user } = await customerOffers();
  let query = supabase
    .from("boutique_offers")
    .select("*,boutiques(name),request_shares(revoked_at)")
    .eq("customer_id", user.id)
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false });
  if (request) query = query.eq("request_id", request);
  const { data: offers, error } = await query;
  if (error) throw new Error("Could not load your offers.");
  const { data: profiles } = await supabase
    .from("boutique_profiles")
    .select("boutique_id,hero_image_url")
    .in("boutique_id", offers?.map((o) => o.boutique_id) ?? []);
  const requestIds = [...new Set(offers?.map((o) => o.request_id))];
  return (
    <div className="market-page offer-page">
      <MarketplaceHeader active="atelier" />
      <main className="offer-main">
        <header>
          <span className="offer-kicker">Your custom commissions</span>
          <h1>Your boutiques have sent their ideas</h1>
          <p className="offer-lead">
            Review the proposals crafted for your vision. Compare the
            craftsmanship, itemized prices and timelines before the next step.
          </p>
        </header>
        <div className="offer-actions">
          <Link className="offer-btn secondary" href="/requests">
            My Requests
          </Link>
          {request && (
            <Link className="offer-btn secondary" href="/offers">
              All offers
            </Link>
          )}
          {requestIds.map((id, i) => (
            <Link
              className="offer-btn secondary"
              href={`/offers/compare?request=${id}`}
              key={id}
            >
              Compare {requestIds.length > 1 ? `request ${i + 1}` : "offers"} →
            </Link>
          ))}
        </div>
        {!offers?.length && (
          <section className="offer-panel">
            <h2>Your next chapter is taking shape.</h2>
            <p>
              No offers yet. Share a submitted brief with your chosen boutiques
              to invite proposals.
            </p>
            <Link className="offer-btn" href="/requests">
              Choose a request →
            </Link>
          </section>
        )}
        <div className="offer-cards">
          {offers?.map((o) => (
            <article key={o.id} className="offer-card">
              <Image
                src={stitchImage(
                  profiles?.find((p) => p.boutique_id === o.boutique_id)
                    ?.hero_image_url,
                )}
                alt={`${o.boutiques?.name ?? "Boutique"} atelier`}
                width={700}
                height={500}
                unoptimized
              />
              <div className="offer-card-body">
                <span className="offer-badge">
                  {offerStatus(o.status, o.quote)}
                </span>
                <h2>{o.boutiques?.name ?? "Your boutique"}</h2>
                <p>{briefText(o.quote, "title")}</p>
                <div className="offer-facts">
                  <div>
                    <small>Total price</small>
                    <p>{money(o.total_paise)}</p>
                  </div>
                  <div>
                    <small>Expected completion</small>
                    <p>{briefText(o.quote, "delivery_date")}</p>
                  </div>
                </div>
                <Link className="offer-btn" href={`/offers/${o.id}`}>
                  View offer →
                </Link>
              </div>
            </article>
          ))}
        </div>
        <p className="offer-notice">
          Open an offer to review and accept its terms. Acceptance saves your
          order; only test payments are available. No real money is collected.{" "}
          <Link href="/orders">View my orders →</Link>
        </p>
      </main>
      <MarketplaceFooter />
    </div>
  );
}
