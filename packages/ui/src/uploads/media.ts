import { isImageObjectKey, publicPortfolioUrl } from "./fit.mjs";

export function portfolioDisplayUrl(
  key: string,
  width?: number,
  supabaseUrl = typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_SUPABASE_URL
    : "",
) {
  return publicPortfolioUrl(supabaseUrl ?? "", key, width);
}

export function catalogImageSrc(
  value: string | null | undefined,
  width = 1200,
) {
  if (!value) return "";
  if (isImageObjectKey(value)) return portfolioDisplayUrl(value, width);
  return value;
}
