import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MarketplaceHeader } from "../../../components/marketplace-header";
import { getSupabaseServerClient } from "../../../lib/supabase/server";
import { validateDraft, BUDGETS } from "../../../lib/outfit-request";
import { RequestSharing } from "../../../components/request-sharing";
export default async function RequestDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user)
    redirect(`/auth/sign-in?next=${encodeURIComponent("/requests/" + id)}`);
  const { data: r } = await supabase
    .from("outfit_requests")
    .select()
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!r) notFound();
  if (r.status === "draft") redirect(`/create/review?id=${id}`);
  const d = validateDraft(r.draft);
  const [
    { data: boutiques, error: boutiqueError },
    { data: shares, error: shareError },
  ] = await Promise.all([
    supabase
      .from("boutiques")
      .select("id,name,city")
      .eq("status", "verified")
      .eq("is_published", true)
      .neq("owner_id", auth.user.id)
      .order("name"),
    supabase
      .from("request_shares")
      .select()
      .eq("request_id", id)
      .eq("customer_id", auth.user.id)
      .order("created_at"),
  ]);
  if (boutiqueError || shareError)
    throw new Error("Could not load sharing permissions. Please refresh.");
  return (
    <div className="market-page">
      <MarketplaceHeader />
      <main className="request-dashboard submitted-request">
        <span className="eyebrow">Request received</span>
        <h1>Your vision, captured.</h1>
        <p>
          Your request has been saved securely. Invite your chosen boutiques
          below to receive proposals. No booking or payment has been made.
        </p>
        <p className="request-reference">Reference: {r.id}</p>
        <dl className="request-review">
          <div>
            <dt>Occasion & garment</dt>
            <dd>
              {d.occasion} · {d.garment}
            </dd>
          </div>
          <div>
            <dt>Style</dt>
            <dd>{d.expert ? "Expert Curation" : d.silhouette}</dd>
          </div>
          <div>
            <dt>Investment</dt>
            <dd>{BUDGETS[d.budget as keyof typeof BUDGETS]}</dd>
          </div>
          <div>
            <dt>Dates</dt>
            <dd>
              Delivery: {d.deliveryDate}
              <br />
              Event: {d.eventDate}
            </dd>
          </div>
          <div>
            <dt>Measurements</dt>
            <dd>
              {d.measurementMethod} — shared only with your explicit permission
              below
            </dd>
          </div>
          <div>
            <dt>Inspiration</dt>
            <dd>
              {d.inspirations.length} images · {d.links.length} links
            </dd>
          </div>
        </dl>
        <RequestSharing
          requestId={id}
          boutiques={boutiques ?? []}
          shares={shares ?? []}
          selected={r.boutique_id}
        />
        <div className="offer-actions">
          <Link className="offer-btn" href={`/offers?request=${id}`}>
            View offers →
          </Link>
        </div>
        <Link className="button button--primary" href="/requests">
          Back to My Requests
        </Link>
      </main>
    </div>
  );
}
