import Link from "next/link";
import { briefText } from "@faden/ui";
import { atelierContext } from "../../lib/atelier";
import { AtelierShell } from "../../components/atelier-shell";
export default async function Requests() {
  const { supabase, boutiques } = await atelierContext();
  const { data: shares, error } = await supabase
    .from("request_shares")
    .select()
    .in(
      "boutique_id",
      boutiques.map((b) => b.id),
    )
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load shared requests.");
  return (
    <AtelierShell
      name={boutiques.map((b) => b.name).join(" · ") || "Boutique Studio"}
    >
      <header>
        <span className="offer-kicker">
          Your atelier · customer invitations
        </span>
        <h1>Every vision starts here.</h1>
        <p className="offer-lead">
          Review briefs that customers have explicitly shared with your
          boutique.
        </p>
      </header>
      {!boutiques.length && (
        <p className="offer-notice">
          A verified, published boutique owned by your account is required to
          receive requests. Team-member permissions will be added separately.
        </p>
      )}
      <div className="atelier-requests">
        {shares?.map((s) => (
          <Link
            className="atelier-request"
            key={s.id}
            href={`/requests/${s.id}`}
          >
            <span className="offer-kicker">{s.client_label}</span>
            <h2>
              {briefText(s.brief, "occasion")} {briefText(s.brief, "garment")}
            </h2>
            <p>
              Requested delivery:{" "}
              {briefText(s.brief, "deliveryDate") || "To discuss"} · Shared{" "}
              {new Date(s.created_at).toLocaleDateString("en-IN")}
            </p>
            <span>Review request →</span>
          </Link>
        ))}
      </div>
      {!shares?.length && (
        <section className="offer-panel">
          <h2>No shared requests yet.</h2>
          <p>
            A customer can submit an outfit brief and invite your boutique from
            My Requests. Private, unshared drafts never appear here.
          </p>
        </section>
      )}
    </AtelierShell>
  );
}
