import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { briefText, parseQuote } from "@faden/ui";
import { atelierContext } from "../../../lib/atelier";
import { AtelierShell } from "../../../components/atelier-shell";
import { OfferBuilder } from "../../../components/offer-builder";
export default async function NewOffer({
  searchParams,
}: {
  searchParams: Promise<{ share?: string }>;
}) {
  const { share } = await searchParams;
  if (!share) redirect("/requests");
  const { supabase, boutiques } = await atelierContext();
  const { data: s } = await supabase
    .from("request_shares")
    .select()
    .eq("id", share)
    .in(
      "boutique_id",
      boutiques.map((b) => b.id),
    )
    .is("revoked_at", null)
    .maybeSingle();
  if (!s) notFound();
  const { data: o } = await supabase
    .from("boutique_offers")
    .select()
    .eq("share_id", share)
    .maybeSingle();
  if (o && o.status !== "draft") redirect(`/offers/${o.id}`);
  const title = `${briefText(s.brief, "occasion")} ${briefText(s.brief, "garment")}`;
  return (
    <AtelierShell
      name={boutiques.find((b) => b.id === s.boutique_id)?.name}
      active="offers"
    >
      <Link href={`/requests/${share}`} className="offer-kicker">
        ← Back to request
      </Link>
      <h1>Compose Offer</h1>
      <section className="offer-panel">
        <h2>{title}</h2>
        <p>Client: {s.client_label}</p>
        <p>
          {briefText(s.brief, "notes") ||
            "Craft a considered proposal for this customer’s vision."}
        </p>
      </section>
      <OfferBuilder
        shareId={share}
        version={o?.version ?? 0}
        initial={o ? parseQuote(o.quote) : null}
        title={title}
      />
    </AtelierShell>
  );
}
