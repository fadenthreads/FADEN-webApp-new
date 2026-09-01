import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { briefText, briefList, object } from "@faden/ui";
import { atelierContext } from "../../../lib/atelier";
import { AtelierShell } from "../../../components/atelier-shell";
import { AtelierNotes } from "../../../components/atelier-notes";
export default async function RequestDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, boutiques } = await atelierContext();
  const { data: s } = await supabase
    .from("request_shares")
    .select()
    .eq("id", id)
    .in(
      "boutique_id",
      boutiques.map((b) => b.id),
    )
    .is("revoked_at", null)
    .maybeSingle();
  if (!s) notFound();
  const { data: offer } = await supabase
    .from("boutique_offers")
    .select("id,status")
    .eq("share_id", id)
    .maybeSingle();
  const { data: notes } = await supabase
    .from("atelier_request_notes")
    .select("notes")
    .eq("share_id", id)
    .maybeSingle();
  const b = object(s.brief);
  const inspirations = Array.isArray(b.inspirations)
    ? b.inspirations.map(object)
    : [];
  const images = await Promise.all(
    inspirations.map(async (item) => {
      const key = typeof item.key === "string" ? item.key : "";
      if (!key.startsWith(`${s.customer_id}/${s.request_id}/`)) return null;
      const { data } = await supabase.storage
        .from("request-inspiration")
        .createSignedUrl(key, 900);
      return data
        ? {
            url: data.signedUrl,
            note: typeof item.note === "string" ? item.note : "",
          }
        : null;
    }),
  );
  const links = briefList(b, "links").filter((l) => {
    try {
      const u = new URL(l);
      return u.protocol === "https:" && !u.username && !u.password;
    } catch {
      return false;
    }
  });
  return (
    <AtelierShell name={boutiques.find((x) => x.id === s.boutique_id)?.name}>
      <header className="atelier-header">
        <div>
          <Link href="/requests" className="offer-kicker">
            ← Back to requests
          </Link>
          <h1>
            {briefText(b, "occasion")} {briefText(b, "garment")}
          </h1>
          <p>
            {s.client_label} · Event {briefText(b, "eventDate")}
          </p>
          <span className="offer-badge">{offer?.status ?? "New inquiry"}</span>
        </div>
        <Link
          className="offer-btn"
          href={offer ? `/offers/${offer.id}` : `/offers/new?share=${id}`}
        >
          {offer ? "View offer" : "Prepare offer →"}
        </Link>
      </header>
      <div className="atelier-grid">
        <div>
          <section className="offer-panel">
            <h2>Customer Vision</h2>
            <div className="offer-facts">
              <div>
                <small>Color palette</small>
                <p>
                  {briefList(b, "colors").join(", ") || "Open to suggestions"}
                </p>
              </div>
              <div>
                <small>Style</small>
                <p>
                  {b.expert === true
                    ? "Expert Curation"
                    : briefText(b, "silhouette")}
                </p>
              </div>
            </div>
            <p>
              {[
                briefText(b, "neckline"),
                briefText(b, "sleeves"),
                ...briefList(b, "fabrics"),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <h3>Client notes</h3>
            <p className="preserve-lines">
              {briefText(b, "notes") || "No additional notes."}
            </p>
          </section>
          <section className="offer-panel">
            <h2>Inspiration Board</h2>
            {!s.include_inspiration ? (
              <p>The customer has not shared their inspiration board.</p>
            ) : (
              <>
                <div className="brief-images">
                  {images.map(
                    (i, n) =>
                      i && (
                        <figure key={n}>
                          <Image
                            src={i.url}
                            alt={`Shared inspiration ${n + 1}`}
                            width={600}
                            height={600}
                            unoptimized
                          />
                          <figcaption>
                            {i.note || "Shared by the customer"}
                          </figcaption>
                        </figure>
                      ),
                  )}
                </div>
                {!images.some(Boolean) && <p>No shared images available.</p>}
                {links.map((l, n) => (
                  <p key={n}>
                    <a href={l} target="_blank" rel="noopener noreferrer">
                      Reference: {new URL(l).hostname} ↗
                    </a>
                  </p>
                ))}
              </>
            )}
          </section>
          <AtelierNotes shareId={id} initial={notes?.notes ?? ""} />
        </div>
        <aside>
          <section className="offer-panel">
            <h2>Measurements</h2>
            <p>
              Preference: {briefText(b, "measurementMethod") || "To discuss"}
            </p>
            {s.include_measurements ? (
              <p>
                {["chest", "waist", "hips", "height"]
                  .map((k) => `${k}: ${briefText(b.measurements, k) || "—"}`)
                  .join(" · ")}{" "}
                ({briefText(b.measurements, "unit")})
              </p>
            ) : (
              <p>
                Measurements are private. The customer has not approved sharing
                them.
              </p>
            )}
            <p className="offer-notice">
              Fitting scheduling is not available yet. Do not treat a preference
              as a booking.
            </p>
          </section>
          <section className="offer-panel">
            <h2>Timeline & budget</h2>
            <p>Desired delivery: {briefText(b, "deliveryDate")}</p>
            <p>
              Budget preference: {briefText(b, "budget").replaceAll("_", " ")}
            </p>
            <p>Shared {new Date(s.created_at).toLocaleDateString("en-IN")}</p>
          </section>
        </aside>
      </div>
    </AtelierShell>
  );
}
