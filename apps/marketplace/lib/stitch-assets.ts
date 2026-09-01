import manifest from "../../../design-reference/stitch/assets.json";

const localAssets = new Map(
  manifest.assets.map((asset) => [
    asset.sourceUrl,
    `/stitch-assets/${asset.id}.jpg`,
  ]),
);

/** Resolve original Stitch media locally without replacing user-uploaded images. */
export function stitchImage(url: string | null | undefined): string {
  if (!url) return "/image-placeholder.svg";
  return localAssets.get(url.replace(/=w\d+(?:-h\d+)?$/, "")) ?? url;
}
