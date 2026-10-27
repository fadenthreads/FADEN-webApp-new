import { AtelierShell } from "../../components/atelier-shell";
import { marketplaceUrl } from "../../components/studio-frame";
import { atelierContext } from "../../lib/atelier";
import { StorefrontEditor } from "./storefront-editor";
import Link from "next/link";
import { ApprovalGuide } from "../../components/approval-guide";
import { studioVisibility } from "../../lib/studio-capabilities.mjs";
import { imageForPortfolio } from "../../lib/portfolio";

export default async function StorefrontPage() {
  const { supabase, user, ownedBoutiques } = await atelierContext();
  const boutique = ownedBoutiques[0];
  if (!boutique)
    return (
      <AtelierShell active="storefront">
        <h1>Create your boutique first</h1>
        <p>
          <Link href="/onboarding">Register your boutique</Link> to set up your
          public profile.
        </p>
      </AtelierShell>
    );
  if (!["pending_verification", "verified"].includes(boutique.status))
    return (
      <AtelierShell active="storefront" name={boutique.name}>
        <h1>Storefront editing is unavailable</h1>
        <p>{studioVisibility(boutique.status, boutique.is_published).label}</p>
        <Link href="/verification">Read review feedback</Link>
        <ApprovalGuide />
      </AtelierShell>
    );
  const [details, profile, designs] = await Promise.all([
    supabase
      .from("boutiques")
      .select("id,name,slug,description,city,status,is_published")
      .eq("id", boutique.id)
      .eq("owner_id", user.id)
      .single(),
    supabase
      .from("boutique_profiles")
      .select(
        "hero_image_url,story,specialties,services,years_experience,response_time_hours,next_available_date,minimum_price_paise,lead_time_min_weeks,lead_time_max_weeks,updated_at",
      )
      .eq("boutique_id", boutique.id)
      .single(),
    supabase
      .from("designs")
      .select("id,title,primary_image_url")
      .eq("boutique_id", boutique.id)
      .eq("status", "published")
      .order("title")
      .limit(100),
  ]);
  if (details.error || profile.error || designs.error)
    throw new Error("Could not load your public storefront.");
  return (
    <AtelierShell active="storefront" name={details.data.name}>
      <header className="atelier-header">
        <div>
          <span className="offer-kicker">Customer-facing profile</span>
          <h1>Public storefront</h1>
          <p className="offer-lead">
            Control the information customers see before they invite your
            boutique to a request.
          </p>
        </div>
        {boutique.status === "verified" && boutique.is_published ? (
          <a
            className="offer-btn secondary"
            href={`${marketplaceUrl()}/boutiques/${details.data.slug}`}
            target="_blank"
            rel="noreferrer"
          >
            Preview customer page ↗
          </a>
        ) : (
          <Link className="offer-btn secondary" href="/verification">
            Private until Admin approval →
          </Link>
        )}
      </header>
      <StorefrontEditor
        boutique={details.data}
        profile={profile.data}
        covers={(designs.data ?? []).map((d) => ({
          key: d.primary_image_url,
          title: d.title,
          url: imageForPortfolio(d.primary_image_url, marketplaceUrl()),
        }))}
        currentCover={imageForPortfolio(
          profile.data.hero_image_url ?? "",
          marketplaceUrl(),
        )}
      />
      <ApprovalGuide />
    </AtelierShell>
  );
}
