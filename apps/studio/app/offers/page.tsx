import Link from "next/link";
import { briefText, money, offerStatus } from "@faden/ui";
import { atelierContext } from "../../lib/atelier";
import { AtelierShell } from "../../components/atelier-shell";
export default async function Offers() {
  const { supabase, boutiques } = await atelierContext();
  const { data: offers, error } = await supabase
    .from("boutique_offers")
    .select()
    .in(
      "boutique_id",
      boutiques.map((b) => b.id),
    )
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Could not load offers.");
  return (
    <AtelierShell
      name={boutiques.map((b) => b.name).join(" · ")}
      active="offers"
    >
      <span className="offer-kicker">Your considered proposals</span>
      <h1>Offers</h1>
      <p className="offer-lead">
        Drafts stay private until you send them. Every amount is calculated from
        your itemized quote.
      </p>
      <div className="atelier-requests">
        {offers?.map((o) => (
          <Link key={o.id} className="atelier-request" href={`/offers/${o.id}`}>
            <span className="offer-badge">
              {offerStatus(o.status, o.quote)}
            </span>
            <h2>{briefText(o.quote, "title")}</h2>
            <p>
              {money(o.total_paise)} · Ready by{" "}
              {briefText(o.quote, "delivery_date") || "Not set"}
            </p>
            <span>View proposal →</span>
          </Link>
        ))}
      </div>
      {!offers?.length && (
        <p className="offer-notice">
          No proposals yet. Open a shared request to prepare your first offer.
        </p>
      )}
    </AtelierShell>
  );
}
