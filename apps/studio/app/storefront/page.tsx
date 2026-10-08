import { notFound } from "next/navigation";
import { AtelierShell } from "../../components/atelier-shell";
import { marketplaceUrl } from "../../components/studio-frame";
import { atelierContext } from "../../lib/atelier";
import { StorefrontEditor } from "./storefront-editor";

export default async function StorefrontPage() {
  const { supabase, user, boutiques } = await atelierContext();
  const boutique = boutiques[0];
  if (!boutique) notFound();
  const [details, profile] = await Promise.all([
    supabase
      .from("boutiques")
      .select("id,name,slug,description,city,status,is_published")
      .eq("id", boutique.id)
      .eq("owner_id", user.id)
      .single(),
    supabase
      .from("boutique_profiles")
      .select(
        "story,specialties,services,years_experience,response_time_hours,next_available_date,minimum_price_paise,lead_time_min_weeks,lead_time_max_weeks,updated_at",
      )
      .eq("boutique_id", boutique.id)
      .single(),
  ]);
  if (details.error || profile.error)
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
        <a
          className="offer-btn secondary"
          href={`${marketplaceUrl()}/boutiques/${details.data.slug}`}
          target="_blank"
          rel="noreferrer"
        >
          Preview customer page ↗
        </a>
      </header>
      <StorefrontEditor boutique={details.data} profile={profile.data} />
    </AtelierShell>
  );
}
