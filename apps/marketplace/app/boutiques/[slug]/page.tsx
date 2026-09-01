import Image from "next/image";
import { DetailHeader } from "../../../components/detail-header";
import { stitchImage } from "../../../lib/stitch-assets";
import { notFound } from "next/navigation";

import { CatalogCard } from "../../../components/catalog-card";
import { MarketplaceFooter } from "../../../components/marketplace-footer";
import { MarketplaceHeader } from "../../../components/marketplace-header";
import { SaveButton } from "../../../components/save-button";
import { formatAvailability, formatInr } from "../../../lib/catalog";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function BoutiqueProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: boutique } = await supabase
    .from("boutiques")
    .select("*, boutique_profiles(*)")
    .eq("slug", slug)
    .eq("is_published", true)
    .eq("status", "verified")
    .maybeSingle();
  if (!boutique || !boutique.boutique_profiles) notFound();
  const profile = boutique.boutique_profiles;

  const { data: designs } = await supabase
    .from("designs")
    .select(
      "id, slug, title, primary_image_url, base_price_paise, lead_time_min_weeks, lead_time_max_weeks",
    )
    .eq("boutique_id", boutique.id)
    .eq("status", "published")
    .order("is_featured", { ascending: false });

  const { data: authData } = await supabase.auth.getUser();
  const { data: saved } = authData.user
    ? await supabase
        .from("saved_boutiques")
        .select("boutique_id")
        .eq("user_id", authData.user.id)
        .eq("boutique_id", boutique.id)
        .maybeSingle()
    : { data: null };

  return (
    <div className="market-page stitch-profile">
      <MarketplaceHeader active="boutiques" />
      <DetailHeader
        kind="boutique"
        entityId={boutique.id}
        initialSaved={Boolean(saved)}
        returnPath={`/boutiques/${boutique.slug}`}
        title={boutique.name}
      />
      <main>
        <section
          className="boutique-hero"
          style={{
            backgroundImage: `url(${stitchImage(profile.hero_image_url)})`,
          }}
        >
          {boutique.slug === "studio-vanya" && (
            <Image
              className="boutique-mobile-cover"
              src="/stitch-assets/asset-072.jpg"
              alt={`${boutique.name} bespoke couture`}
              fill
              sizes="100vw"
              unoptimized
              priority
            />
          )}
          <div className="boutique-hero__veil" />
          <div className="boutique-hero__content">
            <div>
              <div className="boutique-identity">
                <div className="boutique-monogram" aria-hidden="true">
                  {boutique.name
                    .split(" ")
                    .map((word) => word[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <h1>{boutique.name}</h1>
              </div>
              <p className="boutique-mobile-description">
                {boutique.description}
              </p>
              <p className="eyebrow">
                ✓ Verified boutique · ★ {profile.rating} ({profile.review_count}{" "}
                reviews) · {boutique.city}
              </p>
              <div className="tag-row tag-row--inverse">
                {profile.specialties.map((specialty) => (
                  <span key={specialty}>{specialty}</span>
                ))}
              </div>
            </div>
            <div className="boutique-hero__actions">
              <a
                className="button button--primary button--full"
                href={`/create?boutique=${encodeURIComponent(boutique.slug)}`}
              >
                Create an outfit with this boutique
              </a>
              <SaveButton
                entityId={boutique.id}
                initialSaved={Boolean(saved)}
                kind="boutique"
                returnPath={`/boutiques/${boutique.slug}`}
              />
            </div>
          </div>
        </section>

        <section className="boutique-facts">
          <div>
            <span>Response time</span>
            <strong>Within {profile.response_time_hours} hours</strong>
          </div>
          <div>
            <span>Next available</span>
            <strong>{formatAvailability(profile.next_available_date)}</strong>
          </div>
          <div>
            <span>Creation time</span>
            <strong>
              {profile.lead_time_min_weeks}-{profile.lead_time_max_weeks} weeks
              average
            </strong>
          </div>
        </section>

        <section className="boutique-story">
          <div>
            <h2>The Atelier Story</h2>
            <p>{profile.story}</p>
            <dl>
              <div>
                <dt>Specialties</dt>
                <dd>{profile.specialties.join(" & ")}</dd>
              </div>
              <div>
                <dt>Experience</dt>
                <dd>{profile.years_experience} years of craftsmanship</dd>
              </div>
              <div>
                <dt>Services</dt>
                <dd>{profile.services.join(" · ")}</dd>
              </div>
            </dl>
          </div>
          <div
            aria-label={`${boutique.name} craftsmanship`}
            className="boutique-story__image"
            role="img"
            style={{
              backgroundImage: `url(${stitchImage(profile.story_image_url ?? profile.hero_image_url)})`,
            }}
          />
        </section>

        {(designs?.length ?? 0) > 0 && (
          <section className="editorial-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Signature forms</p>
                <h2>Signature Forms</h2>
              </div>
            </div>
            <div className="catalog-grid catalog-grid--three">
              {(designs ?? []).map((design) => (
                <CatalogCard
                  boutique={boutique.name}
                  href={`/designs/${design.slug}`}
                  imageUrl={stitchImage(design.primary_image_url)}
                  key={design.id}
                  meta={`${formatInr(design.base_price_paise)} · ${design.lead_time_min_weeks}-${design.lead_time_max_weeks} weeks`}
                  title={design.title}
                />
              ))}
            </div>
          </section>
        )}
      </main>
      <div className="mobile-bottom-action">
        <a
          className="button button--primary button--full"
          href={`/create?boutique=${encodeURIComponent(boutique.slug)}`}
        >
          Create an Outfit <span aria-hidden="true">↗</span>
        </a>
      </div>
      <MarketplaceFooter />
    </div>
  );
}
