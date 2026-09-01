import assert from "node:assert/strict";
import test from "node:test";
import {
  DISPLAY_MAX_EDGE,
  IMAGE_MAX_BYTES,
  IMAGE_MIME_TYPES,
  fitWithin,
  isImageObjectKey,
  looksLikeSignedUrl,
  publicPortfolioUrl,
  validateUploadFile,
} from "../packages/ui/src/uploads/fit.mjs";

const key =
  "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb/aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa/eeeeeeee-5555-4555-8555-eeeeeeeeeeee.jpg";

test("client validation rejects unsupported types and oversized files before upload", () => {
  assert.equal(IMAGE_MAX_BYTES, 10 * 1024 * 1024);
  assert.deepEqual(
    [...IMAGE_MIME_TYPES],
    ["image/jpeg", "image/png", "image/webp"],
  );
  assert.equal(validateUploadFile({ type: "image/gif", size: 100 }).ok, false);
  assert.equal(
    validateUploadFile({ type: "image/png", size: IMAGE_MAX_BYTES + 1 }).ok,
    false,
  );
  assert.equal(validateUploadFile({ type: "image/png", size: 12 }).ok, true);
});

test("display images fit inside the max edge without distortion or upscaling", () => {
  assert.deepEqual(fitWithin(1200, 800, DISPLAY_MAX_EDGE), {
    width: 1200,
    height: 800,
    scale: 1,
    resized: false,
  });
  const fitted = fitWithin(4800, 2400, DISPLAY_MAX_EDGE);
  assert.equal(fitted.resized, true);
  assert.equal(fitted.width, 2400);
  assert.equal(fitted.height, 1200);
  assert.equal(fitted.width / fitted.height, 2);
});

test("catalog rendering uses object keys, never persisted signed URLs", () => {
  assert.equal(isImageObjectKey(key), true);
  assert.equal(looksLikeSignedUrl(key), false);
  assert.equal(
    looksLikeSignedUrl(
      "https://example.supabase.co/storage/v1/object/sign/portfolio-images/x?token=abc",
    ),
    true,
  );
  assert.equal(
    publicPortfolioUrl("https://example.supabase.co", key, 1200),
    "https://example.supabase.co/storage/v1/render/image/public/portfolio-images/" +
      `${key}?width=1200&resize=contain`,
  );
  assert.equal(
    publicPortfolioUrl("https://example.supabase.co", key, 13),
    "https://example.supabase.co/storage/v1/object/public/portfolio-images/" +
      key,
  );
});
