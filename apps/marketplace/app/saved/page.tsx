import { redirect } from "next/navigation";

import { CatalogCard } from "../../components/catalog-card";
import { MarketplaceFooter } from "../../components/marketplace-footer";
import { MarketplaceHeader } from "../../components/marketplace-header";
import { formatInr } from "../../lib/catalog";
import { getSupabaseServerClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const supabase = await getSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/auth/sign-in?next=/saved");

  const [{ data: savedDesigns }, { data: savedBoutiques }] = await Promise.all([
    supabase
      .from("saved_designs")
      .select(
        "designs(id, slug, title, primary_image_url, base_price_paise, lead_time_min_weeks, lead_time_max_weeks, boutiques(name))",
      )
      .eq("user_id", authData.user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("saved_boutiques")
      .select(
        "boutiques(id, slug, name, city, description, boutique_profiles(hero_image_url, rating))",
      )
      .eq("user_id", authData.user.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="market-page">
      <MarketplaceHeader />
      <main className="saved-page">
        <header>
          <p className="eyebrow">Your inspiration</p>
          <h1>Saved for later.</h1>
          <p>
            Keep the ateliers and forms that might become part of your story.
          </p>
        </header>

        <section>
          <div className="section-heading">
            <h2>Designs</h2>
          </div>
          <div className="catalog-grid catalog-grid--three">
            {(savedDesigns ?? []).map(
              ({ designs: design }) =>
                design && (
                  <CatalogCard
                    boutique={design.boutiques.name}
                    href={`/designs/${design.slug}`}
                    imageUrl={design.primary_image_url}
                    key={design.id}
                    meta={`${formatInr(design.base_price_paise)} · ${design.lead_time_min_weeks}-${design.lead_time_max_weeks} weeks`}
                    title={design.title}
                  />
                ),
            )}
          </div>
          {(savedDesigns?.length ?? 0) === 0 && (
            <div className="empty-state">
              <h2>No saved designs yet.</h2>
              <a href="/designs">Discover designs →</a>
            </div>
          )}
        </section>

        <section>
          <div className="section-heading">
            <h2>Boutiques</h2>
          </div>
          <div className="boutique-saved-grid">
            {(savedBoutiques ?? []).map(
              ({ boutiques: boutique }) =>
                boutique && (
                  <a
                    className="saved-boutique"
                    href={`/boutiques/${boutique.slug}`}
                    key={boutique.id}
                  >
                    <div
                      aria-label={boutique.name}
                      role="img"
                      style={{
                        backgroundImage: `url(${boutique.boutique_profiles?.hero_image_url ?? ""})`,
                      }}
                    />
                    <span>
                      <strong>{boutique.name}</strong>
                      <small>
                        {boutique.city} · ★{" "}
                        {boutique.boutique_profiles?.rating ?? "New"}
                      </small>
                    </span>
                  </a>
                ),
            )}
          </div>
          {(savedBoutiques?.length ?? 0) === 0 && (
            <div className="empty-state">
              <h2>No saved boutiques yet.</h2>
              <a href="/discover?type=boutiques">Meet the ateliers →</a>
            </div>
          )}
        </section>
      </main>
      <MarketplaceFooter />
    </div>
  );
}
