import Link from "next/link";
import { briefText } from "@faden/ui";
import { atelierContext } from "../lib/atelier";
import { StudioFrame, marketplaceUrl } from "../components/studio-frame";
import { StudioOverview } from "../components/studio-overview";
export default async function StudioHome() {
  const { supabase: db, user, boutiques } = await atelierContext();
  const ids = boutiques.map((b) => b.id),
    now = new Date().toISOString();
  const day = new Date(Date.now() + 19800000).toISOString().slice(0, 10);
  const start = new Date(day + "T00:00:00+05:30"),
    end = new Date(start.getTime() + 86400000);
  const [
    requests,
    drafts,
    sent,
    orders,
    sessions,
    pending,
    recent,
    today,
    profile,
    publicBoutique,
  ] = await Promise.all([
    db
      .from("request_shares")
      .select("id", { head: true, count: "exact" })
      .in("boutique_id", ids)
      .is("revoked_at", null),
    db
      .from("boutique_offers")
      .select("id", { head: true, count: "exact" })
      .in("boutique_id", ids)
      .eq("status", "draft"),
    db
      .from("boutique_offers")
      .select("id", { head: true, count: "exact" })
      .in("boutique_id", ids)
      .eq("status", "sent"),
    db
      .from("customer_orders")
      .select("id", { head: true, count: "exact" })
      .in("boutique_id", ids)
      .eq("boutique_owner_id", user.id)
      .neq("status", "cancelled"),
    db
      .from("measurement_appointments")
      .select("id", { head: true, count: "exact" })
      .in("boutique_id", ids)
      .eq("owner_id", user.id)
      .eq("status", "confirmed")
      .gt("ends_at", now),
    db
      .from("measurement_appointments")
      .select("id", { head: true, count: "exact" })
      .in("boutique_id", ids)
      .eq("owner_id", user.id)
      .eq("status", "confirmed")
      .lte("ends_at", now),
    db
      .from("request_shares")
      .select("id,client_label,brief")
      .in("boutique_id", ids)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .order("id")
      .limit(5),
    db
      .from("measurement_appointments")
      .select("id,order_id,starts_at,kind")
      .in("boutique_id", ids)
      .eq("owner_id", user.id)
      .eq("status", "confirmed")
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString())
      .order("starts_at")
      .order("id")
      .limit(5),
    db.from("profiles").select("display_name").eq("id", user.id).single(),
    db
      .from("boutiques")
      .select("slug")
      .in("id", ids)
      .order("id")
      .limit(1)
      .maybeSingle(),
  ]);
  if (
    [
      requests,
      drafts,
      sent,
      orders,
      sessions,
      pending,
      recent,
      today,
      profile,
      publicBoutique,
    ].some((r) => r.error)
  )
    throw new Error("Could not load your Studio overview.");
  const name = boutiques.map((b) => b.name).join(" · ") || "Boutique Studio";
  return (
    <StudioFrame active="overview" name={name}>
      {!ids.length ? (
        <section className="studio-empty">
          <h1>Your atelier is taking shape.</h1>
          <p>
            Order operations require a verified, published boutique owned by
            your account. Catalog members can still manage their assigned
            portfolio.
          </p>
          <div className="studio-actions">
            <Link className="studio-button" href="/onboarding">
              Boutique onboarding →
            </Link>
            <Link className="studio-button ghost" href="/portfolio">
              Portfolio
            </Link>
          </div>
        </section>
      ) : (
        <StudioOverview
          data={{
            name,
            welcome: profile.data?.display_name?.split(" ")[0] || "back",
            publicHref:
              ids.length === 1 && publicBoutique.data
                ? marketplaceUrl() + "/boutiques/" + publicBoutique.data.slug
                : undefined,
            requests: requests.count ?? 0,
            drafts: drafts.count ?? 0,
            sent: sent.count ?? 0,
            orders: orders.count ?? 0,
            sessions: sessions.count ?? 0,
            pendingSessions: pending.count ?? 0,
            recent: (recent.data ?? []).map((r) => ({
              id: r.id,
              label: r.client_label,
              occasion: briefText(r.brief, "occasion"),
              garment: briefText(r.brief, "garment"),
            })),
            today: today.data ?? [],
          }}
        />
      )}
    </StudioFrame>
  );
}
