import { notFound } from "next/navigation";

import { MarketplaceFooter } from "../../../components/marketplace-footer";
import { MarketplaceHeader } from "../../../components/marketplace-header";
import { ProductGallery } from "../../../components/product-gallery";
import { DetailHeader } from "../../../components/detail-header";
import { stitchImage } from "../../../lib/stitch-assets";
import { SaveButton } from "../../../components/save-button";
import { formatInr } from "../../../lib/catalog";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DesignDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: design } = await supabase
    .from("designs")
    .select("*, boutiques(id, name, slug, city)")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!design) notFound();

  const { data: authData } = await supabase.auth.getUser();
  const { data: saved } = authData.user
    ? await supabase
        .from("saved_designs")
        .select("design_id")
        .eq("user_id", authData.user.id)
        .eq("design_id", design.id)
        .maybeSingle()
    : { data: null };

  const primary = stitchImage(design.primary_image_url);
  return (
    <div className="market-page stitch-product">
      <MarketplaceHeader active="designs" />
      <DetailHeader
        kind="design"
        entityId={design.id}
        initialSaved={Boolean(saved)}
        returnPath={`/designs/${design.slug}`}
        title={design.title}
      />
      <main className="design-detail">
        <ProductGallery
          primary={primary}
          images={design.gallery_image_urls.map(stitchImage)}
          title={design.title}
          mobileImage={
            design.slug === "antique-gold-zardosi-lehenga" &&
            primary.startsWith("/stitch-assets/")
              ? "/stitch-assets/asset-008.jpg"
              : undefined
          }
        />
        <section className="design-summary">
          <div className="design-title-block">
            <a className="eyebrow" href={`/boutiques/${design.boutiques.slug}`}>
              {design.boutiques.name}
            </a>
            <h1>{design.title}</h1>
            <p className="design-price">
              From {formatInr(design.base_price_paise)} •{" "}
              {design.lead_time_min_weeks}–{design.lead_time_max_weeks} weeks
              creation
            </p>
            <div className="mobile-price">
              <div>
                <span>Base guidance</span>
                <strong>{formatInr(design.base_price_paise)}</strong>
              </div>
              <div>
                <span>Lead time</span>
                <strong>
                  {design.lead_time_min_weeks}–{design.lead_time_max_weeks}{" "}
                  Weeks
                </strong>
              </div>
            </div>
          </div>
          <div className="design-aesthetic">
            <h2 className="mobile-only">The Aesthetic</h2>
            <p className="design-description">{design.description}</p>
            <div className="design-attributes">
              <span>◇ {design.materials.join(", ")} Fabric</span>
              <span>✦ {design.occasions.join(", ")}</span>
              <span>⌁ {design.techniques.join(", ")}</span>
              <span>↔ Customized Fit</span>
            </div>
          </div>
          <div className="customizable-box">
            <h2>Customizable Elements</h2>
            <ul>
              {design.customizable_elements.map((element) => (
                <li key={element}>{element}</li>
              ))}
            </ul>
          </div>
          <div className="product-desktop-actions">
            <a
              className="button button--primary button--full"
              href={`/create?design=${encodeURIComponent(design.slug)}`}
            >
              Customize This Design
            </a>
            <div className="design-actions">
              <SaveButton
                entityId={design.id}
                initialSaved={Boolean(saved)}
                kind="design"
                returnPath={`/designs/${design.slug}`}
              />
              <a
                className="button button--ghost"
                href={`/boutiques/${design.boutiques.slug}`}
              >
                Visit Boutique
              </a>
            </div>
          </div>
        </section>
      </main>
      <div className="mobile-bottom-action">
        <a
          className="button button--primary button--full"
          href={`/create?design=${encodeURIComponent(design.slug)}`}
        >
          Customize This Design <span aria-hidden="true">→</span>
        </a>
      </div>
      <MarketplaceFooter />
    </div>
  );
}
