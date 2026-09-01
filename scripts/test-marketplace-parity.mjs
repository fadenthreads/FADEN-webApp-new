import assert from "node:assert/strict";
import { test } from "node:test";

const base = process.env.FADEN_TEST_URL ?? "http://localhost:3000";
async function page(path) {
  const response = await fetch(new URL(path, base));
  return { status: response.status, html: await response.text() };
}
function headings(html) {
  return [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/gs)].map((match) =>
    match[1].replace(/<[^>]*>/g, ""),
  );
}
test("homepage uses the exact local Stitch hero and no invented sections", async () => {
  const { status, html } = await page("/");
  assert.equal(status, 200);
  assert.match(html, /stitch-assets\/asset-027.jpg/);
  assert.match(html, /Made for you/);
  assert.doesNotMatch(html, /Designs with a point of view/);
});
test("catalog uses local full-resolution assets", async () => {
  const { status, html } = await page("/discover?type=designs");
  assert.equal(status, 200);
  assert.match(html, /design-masonry/);
  assert.match(html, /stitch-assets\/asset-/);
  assert.ok(headings(html).includes("Antique Gold Zardosi Lehenga"));
});
test("fabric filtering and empty state use real Supabase results", async () => {
  const wool = await page("/discover?type=designs&fabric=Wool");
  assert.ok(headings(wool.html).includes("Architectural Wool Blazer"));
  assert.ok(!headings(wool.html).includes("Terracotta Silk Form"));
  const empty = await page("/discover?type=designs&q=faden-no-such-design-782");
  assert.match(empty.html, /No exact matches yet/);
});
test("boutique rating sorting and service filtering are valid server queries", async () => {
  const sorted = await page("/discover?type=boutiques&sort=rating");
  assert.equal(sorted.status, 200);
  assert.doesNotMatch(sorted.html, /We couldn.t load the atelier/);
  assert.ok(headings(sorted.html).includes("Studio Vanya"));
  const service = await page("/discover?type=boutiques&service=Home%20fitting");
  assert.equal(service.status, 200);
  assert.doesNotMatch(service.html, /We couldn.t load the atelier/);
});
test("product gallery and focused mobile controls are rendered", async () => {
  const { status, html } = await page("/designs/antique-gold-zardosi-lehenga");
  assert.equal(status, 200);
  assert.match(html, /View detail 1/);
  assert.match(html, /mobile-bottom-action/);
  assert.match(html, /asset-008.jpg/);
});
test("boutique occasion filter follows published designs", async () => {
  const { html } = await page("/discover?type=boutiques&occasion=Bridal");
  assert.ok(headings(html).includes("Studio Vanya"));
  assert.ok(!headings(html).includes("The Loom House"));
});
test("invalid product slugs remain protected by 404", async () => {
  assert.equal((await page("/designs/does-not-exist-782")).status, 404);
});
