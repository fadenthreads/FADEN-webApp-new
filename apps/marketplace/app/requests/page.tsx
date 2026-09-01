import Link from "next/link";
import { redirect } from "next/navigation";
import { MarketplaceHeader } from "../../components/marketplace-header";
import { getSupabaseServerClient } from "../../lib/supabase/server";
import { validateDraft } from "../../lib/outfit-request";
export default async function RequestsPage() {
  const supabase = await getSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/auth/sign-in?next=/requests");
  const { data, error } = await supabase
    .from("outfit_requests")
    .select()
    .eq("user_id", auth.user.id)
    .order("updated_at", { ascending: false });
  return (
    <div className="market-page">
      <MarketplaceHeader active="atelier" />
      <main className="request-dashboard">
        <p className="eyebrow">Your digital atelier</p>
        <h1>My Requests</h1>
        <p>
          Pick up an idea where you left off, or start something entirely new.
        </p>
        <Link className="button button--primary" href="/create">
          Create an Outfit →
        </Link>
        <div className="offer-actions">
          <Link className="offer-btn secondary" href="/offers">
            Your offers →
          </Link>
          <Link className="offer-btn secondary" href="/orders">
            My orders →
          </Link>
        </div>
        {error ? (
          <p role="alert">Your requests could not be loaded. Please refresh.</p>
        ) : !data?.length ? (
          <div className="empty-state">
            <h2>A blank canvas.</h2>
            <p>Your saved drafts and submitted requests will appear here.</p>
          </div>
        ) : (
          <div className="request-list">
            {data.map((r) => {
              const d = validateDraft(r.draft);
              return (
                <Link
                  key={r.id}
                  href={
                    r.status === "draft"
                      ? `/create/occasion?id=${r.id}`
                      : `/requests/${r.id}`
                  }
                >
                  <span className="eyebrow">
                    {r.status === "draft" ? "Private draft" : "Submitted"}
                  </span>
                  <h2>
                    {d.occasion || "New idea"}
                    {d.garment ? " · " + d.garment : ""}
                  </h2>
                  <p>
                    Updated {new Date(r.updated_at).toLocaleDateString("en-IN")}
                  </p>
                  <span>
                    {r.status === "draft" ? "Resume draft" : "View request"} →
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
