import manifest from "../../../design-reference/stitch/assets.json";
import { catalogImageSrc, isImageObjectKey } from "@faden/ui";

const localAssets = new Map(
  manifest.assets.map((asset) => [
    asset.sourceUrl,
    `/stitch-assets/${asset.id}.jpg`,
  ]),
);

/** Resolve original Stitch media locally without replacing user-uploaded images. */
export function stitchImage(url: string | null | undefined): string {
  if (!url) return "/image-placeholder.svg";
  const local = localAssets.get(url.replace(/=w\d+(?:-h\d+)?$/, ""));
  if (local) return local;
  if (isImageObjectKey(url)) return catalogImageSrc(url, 1200) || url;
  return url;
}
