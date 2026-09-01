import manifest from "../../../design-reference/stitch/assets.json";
import {
  isImageObjectKey,
  looksLikeSignedUrl,
  portfolioDisplayUrl,
} from "@faden/ui";

export const portfolioColumns =
  "id,boutique_id,title,description,status,base_price_paise,primary_image_url,occasions,lead_time_min_weeks,lead_time_max_weeks,updated_at,slug,published_at" as const;
export type PortfolioDesign = {
  id: string;
  boutique_id: string;
  title: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  base_price_paise: number;
  primary_image_url: string;
  occasions: string[];
  lead_time_min_weeks: number;
  lead_time_max_weeks: number;
  updated_at: string;
  slug: string;
  published_at: string | null;
};
export const portfolioCategories = [
  "All Designs",
  "Bridal",
  "Festive",
  "Evening",
  "Bespoke",
] as const;
export function imageForPortfolio(url: string, marketplaceBase: string) {
  if (isImageObjectKey(url)) return portfolioDisplayUrl(url, 1200);
  const asset = manifest.assets.find(
    (a) => a.sourceUrl === url.replace(/=w\d+(?:-h\d+)?$/, ""),
  );
  if (asset) return marketplaceBase + "/stitch-assets/" + asset.id + ".jpg";
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !u.username && !u.password ? url : "";
  } catch {
    return "";
  }
}
export function allowedPortfolioImage(value: string, boutiqueId?: string) {
  if (!value) return true;
  if (looksLikeSignedUrl(value)) return false;
  if (isImageObjectKey(value)) {
    return !boutiqueId || value.startsWith(`${boutiqueId}/`);
  }
  try {
    const u = new URL(value);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.search ||
      u.hash
    )
      return false;
    if (
      manifest.assets.some(
        (a) => a.sourceUrl === value.replace(/=w\d+(?:-h\d+)?$/, ""),
      )
    )
      return true;
    const base = new URL(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321",
    );
    return (
      u.origin === base.origin &&
      u.pathname.startsWith("/storage/v1/object/public/")
    );
  } catch {
    return false;
  }
}
