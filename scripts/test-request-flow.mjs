import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";
import path from "node:path";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createRequestQueue,
  mergeRequestDraft,
} from "../apps/marketplace/lib/request-merge.mjs";

const module = { exports: {} };
new Function(
  "exports",
  ts.transpileModule(
    fs.readFileSync("apps/marketplace/lib/outfit-request.ts", "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText,
)(module.exports);
const {
  EMPTY_DRAFT,
  OCCASIONS,
  NECKLINES,
  SLEEVES,
  validateDraft,
  measurementFields,
  requiredMeasurements,
} = module.exports;
const full = {
  ...EMPTY_DRAFT,
  occasion: "Wedding",
  garment: "Blouse",
  expert: true,
  measurementMethod: "manual",
  measurements: {
    ...EMPTY_DRAFT.measurements,
    chest: "86",
    sleeveLength: "24",
    shoulder: "36",
  },
  budget: "10k_25k",
  eventDate: "2099-12-31",
  deliveryDate: "2099-12-01",
  consent: true,
};

test("all occasions work and Other requires the customer's own occasion", () => {
  assert.ok(OCCASIONS.length > 12);
  for (const occasion of OCCASIONS.filter((x) => x !== "Other"))
    assert.equal(validateDraft({ ...full, occasion }, true).occasion, occasion);
  assert.throws(
    () => validateDraft({ ...full, occasion: "Other" }, true),
    /occasion/,
  );
  assert.equal(
    validateDraft(
      { ...full, occasion: "Other", otherOccasion: "Housewarming" },
      true,
    ).otherOccasion,
    "Housewarming",
  );
});
test("custom silhouette, necklines and sleeves persist and custom details are required", () => {
  assert.throws(
    () =>
      validateDraft(
        { ...full, expert: false, silhouette: "Custom Form" },
        true,
      ),
    /custom silhouette/,
  );
  assert.equal(
    validateDraft(
      {
        ...full,
        expert: false,
        silhouette: "Custom Form",
        customSilhouette: "Draped asymmetric peplum",
      },
      true,
    ).customSilhouette,
    "Draped asymmetric peplum",
  );
  for (const neckline of NECKLINES)
    assert.equal(
      validateDraft(
        { ...full, neckline, necklineNotes: "My own neckline" },
        true,
      ).neckline,
      neckline,
    );
  for (const sleeves of SLEEVES)
    assert.equal(
      validateDraft({ ...full, sleeves, sleeveNotes: "My own sleeves" }, true)
        .sleeves,
      sleeves,
    );
});
test("blouse needs no hip size; sleeve fields disappear for sleeveless pieces", () => {
  assert.ok(measurementFields("Blouse").includes("sleeveLength"));
  assert.ok(!measurementFields("Blouse").includes("hips"));
  assert.ok(
    !measurementFields("Blouse", "Sleeveless").includes("sleeveLength"),
  );
  assert.deepEqual(requiredMeasurements("Blouse"), ["chest"]);
  assert.doesNotThrow(() => validateDraft(full, true));
  assert.throws(
    () => validateDraft({ ...full, garment: "Dress" }, true),
    /Waist/,
  );
});
test("extra dimensions and custom colour values survive draft save", () => {
  const d = validateDraft({
    ...full,
    colors: ["Dusty rose (#d8a0af)"],
    measurements: {
      ...full.measurements,
      upperArm: "28",
      armhole: "38",
      garmentLength: "45",
    },
  });
  assert.equal(d.measurements.upperArm, "28");
  assert.equal(d.colors[0], "Dusty rose (#d8a0af)");
  assert.throws(() =>
    validateDraft({
      ...full,
      measurements: { ...full.measurements, shoulder: "-1" },
    }),
  );
});
test("stale unchanged fields do not overwrite saved changes", () => {
  const base = { ...EMPTY_DRAFT };
  const remote = { ...base, occasion: "Birthday" };
  const local = { ...base, garment: "Blouse" };
  const result = mergeRequestDraft(base, local, remote);
  assert.equal(result.merged.occasion, "Birthday");
  assert.equal(result.merged.garment, "Blouse");
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(
    mergeRequestDraft(base, { ...base, occasion: "Wedding" }, remote).conflicts,
    ["occasion"],
  );
  assert.deepEqual(mergeRequestDraft(base, remote, remote).conflicts, []);
});
test("parallel saves/uploads use successive versions and recover after a failed operation", async () => {
  const queue = createRequestQueue();
  let version = 1;
  const versions = [];
  const save = () =>
    queue(async () => {
      const read = version;
      await new Promise((resolve) => setTimeout(resolve, 5));
      assert.equal(version, read);
      versions.push(read);
      return ++version;
    });
  await Promise.all([save(), save(), save()]);
  assert.deepEqual(versions, [1, 2, 3]);
  await assert.rejects(
    queue(async () => {
      throw Error("failed upload");
    }),
  );
  assert.equal(await save(), 5);
});

// Render the real wizard without credentials or writes to a hosted project.
// Only framework navigation, image loading and upload transport are stubbed.
const require = createRequire(import.meta.url);
const cache = new Map();
function loadComponent(filename) {
  if (cache.has(filename)) return cache.get(filename);
  const output = { exports: {} };
  const localRequire = (name) => {
    if (name === "next/navigation")
      return { useRouter: () => ({ push() {}, replace() {} }) };
    if (name === "next/image")
      return {
        __esModule: true,
        default: ({ src, alt, width, height }) =>
          React.createElement("img", { src, alt, width, height }),
      };
    if (name === "next/link")
      return {
        __esModule: true,
        default: (props) => React.createElement("a", props),
      };
    if (name === "@faden/ui")
      return {
        MediaUploader: ({ label }) =>
          React.createElement("input", { type: "file", "aria-label": label }),
        sendWithProgress() {},
      };
    if (name.endsWith("outfit-request")) return module.exports;
    if (name.endsWith("request-merge.mjs"))
      return { createRequestQueue, mergeRequestDraft };
    if (name.startsWith("."))
      return loadComponent(path.resolve(path.dirname(filename), `${name}.tsx`));
    return require(name);
  };
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  new Function("require", "module", "exports", compiled)(
    localRequire,
    output,
    output.exports,
  );
  cache.set(filename, output.exports);
  return output.exports;
}
const { RequestWizard } = loadComponent(
  path.resolve("apps/marketplace/components/request-wizard.tsx"),
);
function renderStep(step, draft = full) {
  return renderToStaticMarkup(
    React.createElement(RequestWizard, {
      step,
      initial: validateDraft(draft),
      requestId: null,
      version: 1,
      sources: {},
      initialUrls: {},
      savedMeasurements: null,
      context: "",
    }),
  );
}
test("step 1 renders additional occasions and a named Other input", () => {
  const html = renderStep("occasion", {
    ...full,
    occasion: "Other",
    otherOccasion: "Housewarming",
  });
  assert.ok(html.includes("Sangeet"));
  assert.ok(html.includes("Birthday"));
  assert.ok(html.includes("Housewarming"));
  assert.ok(html.includes("Your occasion"));
});
test("step 3 renders custom form details, colour palette and expanded style options", () => {
  const html = renderStep("style", {
    ...full,
    silhouette: "Custom Form",
    customSilhouette: "Peplum",
    neckline: "Custom / Other",
    necklineNotes: "Square with trim",
  });
  assert.ok(html.includes('type="color"'));
  assert.ok(html.includes("Peplum"));
  assert.ok(html.includes("Queen Anne"));
  assert.ok(html.includes("Juliet"));
  assert.ok(html.includes("Velvety &amp; Plush"));
});
test("step 4 renders garment-specific inputs, separate entry/upload sections, and a readable guide", () => {
  const html = renderStep("measurements");
  assert.ok(html.includes('id="measurement-manual"'));
  assert.ok(html.includes('aria-label="Sleeve length"'));
  assert.ok(!html.includes('aria-label="Hips"'));
  assert.ok(!html.includes("This phase does not share"));
  assert.ok(html.includes('viewBox="0 0 180 290"'));
  const upload = renderStep("measurements", {
    ...full,
    measurementMethod: "reference",
  });
  assert.ok(upload.includes('id="measurement-upload"'));
  assert.ok(!upload.includes('id="measurement-manual"'));
});
test("review renders all edit actions and save-and-continue is explicit", () => {
  assert.equal(
    (renderStep("review").match(/>Edit<\/button>/g) ?? []).length,
    5,
  );
  assert.ok(
    renderStep("budget").includes("When would you like to get your outfit?"),
  );
  assert.ok(renderStep("budget").includes("Save and continue"));
  assert.ok(renderStep("review").includes("Save draft"));
});
