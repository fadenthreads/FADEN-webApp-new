import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { orderProgressSummary } from "../apps/marketplace/lib/order-progress.mjs";
import {
  readSavedItem,
  insertSavedItem,
} from "../apps/marketplace/lib/saved-items.mjs";

const stages = [
  "Fabric sourced",
  "Cutting",
  "Stitching",
  "Quality check",
  "Ready for fitting",
];
test("saved-state restoration is scoped to the session user and selected entity", async () => {
  for (const kind of ["boutique", "design"]) {
    const calls = [];
    const query = {
      select(value) {
        calls.push(["select", value]);
        return this;
      },
      eq(key, value) {
        calls.push([key, value]);
        return this;
      },
      async maybeSingle() {
        return { data: { id: "saved" }, error: null };
      },
    };
    const client = {
      from(table) {
        calls.push(["table", table]);
        return query;
      },
    };
    const result = await readSavedItem(client, kind, "entity", "owner");
    assert.equal(result.saved, true);
    assert.ok(
      calls.some(([key, value]) => key === "user_id" && value === "owner"),
    );
    assert.ok(
      calls.some(([key, value]) => key === `${kind}_id` && value === "entity"),
    );
    assert.deepEqual(await readSavedItem(null, kind, "entity", undefined), {
      saved: false,
      error: null,
    });
  }
});
test("repeated saves use ignore-duplicate inserts, not update or duplicate errors", async () => {
  for (const kind of ["boutique", "design"]) {
    let payload, options;
    const client = {
      from() {
        return {
          async upsert(row, config) {
            payload = row;
            options = config;
            return { error: null };
          },
        };
      },
    };
    await insertSavedItem(client, kind, "entity", "owner");
    assert.equal(payload.user_id, "owner");
    assert.equal(payload[`${kind}_id`], "entity");
    assert.equal(options.ignoreDuplicates, true);
    assert.equal(options.onConflict, `user_id,${kind}_id`);
  }
});
test("order milestone reports the latest persisted stage and note", () => {
  assert.deepEqual(
    orderProgressSummary(
      [
        { stage: 3, note: "Your sleeves are being stitched." },
        { stage: 2, note: "Cut" },
      ],
      false,
      stages,
    ),
    {
      title: "Stitching",
      detail: "Your sleeves are being stitched.",
    },
  );
  assert.equal(
    orderProgressSummary([{ stage: 5, note: null }], false, stages).title,
    "Ready for fitting",
  );
});
test("missing data and failed queries are not misrepresented as not started", () => {
  assert.equal(
    orderProgressSummary([], false, stages).title,
    "Awaiting first production update",
  );
  assert.equal(
    orderProgressSummary(null, true, stages).title,
    "Production updates unavailable",
  );
  assert.equal(
    orderProgressSummary([{ stage: 99, note: "Update" }], false, stages).title,
    "Production update",
  );
});
test("registration uses real Studio navigation rather than seeded legacy shell", () => {
  const page = readFileSync("apps/studio/app/onboarding/page.tsx", "utf8");
  assert.match(page, /<AtelierShell/);
  assert.doesNotMatch(page, /FadenShell|Aarya Studio|\/analytics/);
  const form = readFileSync(
    "apps/studio/app/onboarding/onboarding-form.tsx",
    "utf8",
  );
  assert.match(form, /finally\s*\{\s*setBusy\(false\)/);
  assert.match(form, /router\.push\("\/verification"\)/);
});
test("saved boutique covers resolve persisted object keys", () => {
  const page = readFileSync("apps/marketplace/app/saved/page.tsx", "utf8");
  assert.match(
    page,
    /backgroundImage:.*stitchImage\(boutique\.boutique_profiles\?\.hero_image_url\)/,
  );
});
