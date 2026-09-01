import { StudioFrame, marketplaceUrl } from "../../../components/studio-frame";
import { PortfolioManager } from "../../portfolio/portfolio-manager";
import { portfolioCategories } from "../../../lib/portfolio";
import manifest from "../../../../../design-reference/stitch/assets.json";
export default async function Preview({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; status?: string }>;
}) {
  const s = await searchParams,
    q = (s.q || "").slice(0, 100),
    category =
      portfolioCategories.find((c) => c === s.category) || "All Designs",
    status = ["draft", "published", "archived"].includes(s.status || "")
      ? s.status!
      : "all";
  const samples = [
    ["Antique Gold Lehenga", "Bridal", "published", "asset-057", 450000],
    ["Crimson Silk Saree", "Festive", "draft", "asset-039", 120000],
    ["Ivory Tailored Jacket", "Evening", "published", "asset-019", 85000],
  ] as const;
  const designs = samples
    .map(([title, occasion, state, asset, price], i) => ({
      id: String(i),
      boutique_id: "preview",
      title,
      description: "Fictional Stitch portfolio example.",
      status: state,
      base_price_paise: price * 100,
      primary_image_url: manifest.assets.find((a) => a.id === asset)!.sourceUrl,
      occasions: [occasion],
      lead_time_min_weeks: 3,
      lead_time_max_weeks: 6,
      updated_at: "2026-09-01T00:00:00Z",
      published_at: state === "published" ? "2026-09-01T00:00:00Z" : null,
      slug: "sample-" + i,
    }))
    .filter(
      (d) =>
        d.title.toLowerCase().includes(q.toLowerCase()) &&
        (status === "all" || d.status === status) &&
        (category === "All Designs" || d.occasions.some((o) => o === category)),
    );
  return (
    <StudioFrame demo active="portfolio" name="Aarya Studio">
      <PortfolioManager
        demo
        key={JSON.stringify(s)}
        boutiqueId="preview"
        boutiques={[{ id: "preview", name: "Aarya Studio" }]}
        initialDesigns={designs}
        count={designs.length}
        filters={{ q, category, status, page: 1 }}
        marketplaceBase={marketplaceUrl()}
      />
    </StudioFrame>
  );
}
