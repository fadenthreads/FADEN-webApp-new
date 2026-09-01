export const IMAGE_MAX_BYTES: number;
export const DISPLAY_MAX_EDGE: number;
export const DISPLAY_WIDTHS: readonly number[];
export const IMAGE_MIME_TYPES: readonly string[];
export const IMAGE_ACCEPT: string;
export function fitWithin(
  width: number,
  height: number,
  maxEdge?: number,
): {
  width: number;
  height: number;
  scale: number;
  resized: boolean;
};
export function validateUploadFile(
  file: { type?: string; size?: number } | null | undefined,
  options?: { maxBytes?: number; mimeTypes?: readonly string[] },
): { ok: boolean; error?: string };
export function isImageObjectKey(value: unknown): value is string;
export function looksLikeSignedUrl(value: unknown): boolean;
export function publicPortfolioUrl(
  supabaseUrl: string,
  key: string,
  width?: number,
): string;
