import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { parseQuote, briefText, money, offerStatus } from "@faden/ui";
import { MarketplaceHeader } from "../../../components/marketplace-header";
import { customerOffers } from "../../../lib/offers";
export default async function Compare({
  searchParams,
}: {
  searchParams: Promise<{ request?: string }>;
}) {
  const { request } = await searchParams;
  if (!request) redirect("/offers");
  const { supabase, user } = await customerOffers();
  const { data: r } = await supabase
    .from("outfit_requests")
    .select("id,draft")
    .eq("id", request)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!r) notFound();
  const { data: offers, error } = await supabase
    .from("boutique_offers")
    .select("*,boutiques(name)")
    .eq("request_id", request)
    .eq("customer_id", user.id)
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(3);
  if (error) throw new Error("Could not compare offers.");
  const active =
    offers?.filter((o) => offerStatus(o.status, o.quote) === "sent") ?? [];
  return (
    <div className="market-page offer-page">
      <MarketplaceHeader active="atelier" />
      <main className="offer-main">
        <Link href={`/offers?request=${request}`} className="offer-kicker">
          ← Back to offers
        </Link>
        <header>
          <h1>Find your perfect fit.</h1>
          <p className="offer-lead">
            A considered comparison for your {briefText(r.draft, "occasion")}{" "}
            {briefText(r.draft, "garment")}. Only active offers for this request
            appear here.
          </p>
        </header>
        {active.length < 2 && (
          <p className="offer-notice">
            {active.length === 0
              ? "No active offers to compare yet."
              : "One active offer so far. More proposals will appear when your invited boutiques send them."}
          </p>
        )}
        <div className="offer-compare">
          {active.map((o) => {
            const q = parseQuote(o.quote);
            return (
              <article className="offer-panel" key={o.id}>
                <h2>{o.boutiques?.name ?? "Boutique"}</h2>
                <dl>
                  <div>
                    <dt>Total including tax</dt>
                    <dd>{money(o.total_paise)}</dd>
                  </div>
                  <div>
                    <dt>Advance requested</dt>
                    <dd>{money(q.advance_paise)}</dd>
                  </div>
                  <div>
                    <dt>Expected completion</dt>
                    <dd>{q.delivery_date}</dd>
                  </div>
                  <div>
                    <dt>Valid through (UTC)</dt>
                    <dd>{q.expires_on}</dd>
                  </div>
                  <div>
                    <dt>Included work</dt>
                    <dd>
                      {q.items
                        .map(
                          (i) =>
                            `${i.quantity} × ${i.label}${i.detail ? `: ${i.detail}` : ""}`,
                        )
                        .join("\n")}
                    </dd>
                  </div>
                  <div>
                    <dt>Fitting & alteration terms</dt>
                    <dd>{q.terms}</dd>
                  </div>
                </dl>
                <Link href={`/offers/${o.id}`} className="offer-btn secondary">
                  View full offer →
                </Link>
              </article>
            );
          })}
        </div>
        <p className="offer-notice">
          No automatic “best value” claims: compare the actual scope and terms.
          Open the full offer to accept its terms. Only test payments are
          available; no real money is collected.
        </p>
      </main>
    </div>
  );
}
