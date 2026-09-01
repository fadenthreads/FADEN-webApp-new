import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  STORAGE_BUCKETS,
  createInspirationDisplayUrl,
  displayWidthFor,
  handleStorageRequest,
  isOwnedInspirationKey,
  isOwnedPortfolioKey,
  looksLikeSignedUrl,
  portfolioPublicUrl,
  uploadRequestInspirationObject,
} from "../packages/server/src/storage.mjs";

const require = createRequire(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../packages/server/package.json",
  ),
);
const { NextRequest } = require("next/server");

const userId = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const boutiqueId = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const requestId = "cccccccc-3333-4333-8333-cccccccccccc";
const objectId = "eeeeeeee-5555-4555-8555-eeeeeeeeeeee";
const portfolioPath = `${boutiqueId}/${userId}/${objectId}.jpg`;
const inspirationPath = `${userId}/${requestId}/${objectId}.png`;

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=",
  "base64",
);

function jsonRequest({
  origin = "http://localhost:3001",
  url = "http://localhost:3001/api/storage",
  body,
} = {}) {
  return new NextRequest(url, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function tableClient(row) {
  const client = {
    select: () => client,
    eq: () => client,
    maybeSingle: async () => ({ data: row, error: null }),
    then: (resolve) =>
      resolve({ data: row, error: null, count: row?.count ?? 0 }),
  };
  return client;
}

function userClient({
  id,
  role = "customer",
  aal = "aal1",
  tables = {},
  designsCount = 0,
  drafts = [],
  uploadError = null,
  removeError = null,
  removed = [],
  uploaded = [],
  writes = [],
} = {}) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: id ? { id } : null },
        error: null,
      }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: aal },
          error: null,
        }),
      },
    },
    from: (table) => {
      if (table === "profiles") return tableClient({ role });
      if (table === "designs") {
        const client = {
          select: () => client,
          eq: () => client,
          maybeSingle: async () => ({
            data: tables.designs ?? null,
            error: null,
          }),
          then: (resolve) =>
            resolve({ count: designsCount, data: null, error: null }),
        };
        return client;
      }
      if (table === "outfit_requests") {
        const client = {
          select: () => client,
          eq: () => client,
          update: (payload) => {
            writes.push(payload);
            return client;
          },
          maybeSingle: async () => ({
            data: tables.outfit_requests ?? drafts[0] ?? { id: requestId },
            error: null,
          }),
          then: (resolve) => resolve({ data: drafts, error: null }),
        };
        return client;
      }
      return tableClient(tables[table] ?? null);
    },
    storage: {
      from: (bucket) => ({
        createSignedUploadUrl: async (path) => ({
          data: {
            token: "upload-token",
            signedUrl: "https://storage.example/upload",
            path,
          },
          error: null,
        }),
        createSignedUrl: async (path, _ttl, options) => ({
          data: {
            signedUrl: options?.transform
              ? `https://storage.example/transform/${path}?width=${options.transform.width}`
              : `https://storage.example/sign/${path}`,
          },
          error: null,
        }),
        getPublicUrl: (path, options) => ({
          data: {
            publicUrl: options?.transform
              ? `https://storage.example/render/${path}?width=${options.transform.width}`
              : `https://storage.example/public/${path}`,
          },
        }),
        upload: async (path, bytes) => {
          uploaded.push({ bucket, path, bytes });
          return { data: uploadError ? null : { path }, error: uploadError };
        },
        remove: async (paths) => {
          removed.push({ bucket, paths });
          return { data: paths, error: removeError };
        },
      }),
    },
  };
}

test("display widths are allowlisted and object keys are not signed URLs", () => {
  assert.equal(displayWidthFor(1200), 1200);
  assert.equal(displayWidthFor(13), null);
  assert.equal(isOwnedPortfolioKey(portfolioPath, boutiqueId), true);
  assert.equal(isOwnedInspirationKey(inspirationPath, userId, requestId), true);
  assert.equal(
    looksLikeSignedUrl(
      "https://example.test/storage/v1/object/sign/x?token=secret",
    ),
    true,
  );
  assert.equal(
    portfolioPublicUrl("https://example.test", portfolioPath, 800).includes(
      "width=800",
    ),
    true,
  );
});

test("sign-download generates transformed URLs on demand", async () => {
  const studio = await handleStorageRequest(
    jsonRequest({
      body: {
        action: "sign-download",
        bucket: STORAGE_BUCKETS.portfolioImages,
        path: portfolioPath,
        width: 1200,
      },
    }),
    userClient({
      id: userId,
      tables: {
        boutique_members: { boutique_id: boutiqueId },
        boutiques: { status: "verified" },
      },
    }),
    "studio",
  );
  assert.equal(studio.status, 200);
  const payload = await studio.json();
  assert.equal(payload.path, portfolioPath);
  assert.match(payload.signedUrl, /width=1200/);

  const inspiration = await handleStorageRequest(
    jsonRequest({
      origin: "http://localhost:3000",
      url: "http://localhost:3000/api/storage",
      body: {
        action: "sign-download",
        bucket: STORAGE_BUCKETS.requestInspirations,
        path: inspirationPath,
        width: 800,
      },
    }),
    userClient({ id: userId }),
    "marketplace",
  );
  assert.equal(inspiration.status, 200);
  assert.match((await inspiration.json()).signedUrl, /width=800/);
});

test("failed inspiration uploads do not write a database record", async () => {
  const writes = [];
  const uploaded = [];
  await assert.rejects(
    () =>
      uploadRequestInspirationObject(
        userClient({
          id: userId,
          tables: { outfit_requests: { id: requestId } },
          uploadError: { message: "denied" },
          writes,
          uploaded,
        }),
        {
          userId,
          requestId,
          file: new File([PNG], "mood.png", { type: "image/png" }),
        },
      ),
    (error) => error.status === 403,
  );
  assert.equal(writes.length, 0);
  assert.equal(uploaded.length, 1);
});

test("authorization denies removing another user's object", async () => {
  const otherPath = `${boutiqueId}/ffffffff-ffff-4fff-8fff-ffffffffffff/${objectId}.jpg`;
  const denied = await handleStorageRequest(
    jsonRequest({
      body: {
        action: "remove",
        bucket: STORAGE_BUCKETS.portfolioImages,
        path: otherPath,
      },
    }),
    userClient({
      id: userId,
      tables: {
        boutique_members: { boutique_id: boutiqueId },
        boutiques: { status: "verified" },
      },
    }),
    "studio",
  );
  assert.equal(denied.status, 403);
});

test("referenced objects stay until detached; unreferenced objects are removed", async () => {
  const referenced = await handleStorageRequest(
    jsonRequest({
      body: {
        action: "remove",
        bucket: STORAGE_BUCKETS.portfolioImages,
        path: portfolioPath,
      },
    }),
    userClient({
      id: userId,
      designsCount: 1,
      tables: {
        boutique_members: { boutique_id: boutiqueId },
        boutiques: { status: "verified" },
      },
    }),
    "studio",
  );
  assert.equal(referenced.status, 409);
  assert.equal((await referenced.json()).code, "still_referenced");

  const removed = [];
  const cleaned = await handleStorageRequest(
    jsonRequest({
      body: {
        action: "remove",
        bucket: STORAGE_BUCKETS.portfolioImages,
        path: portfolioPath,
      },
    }),
    userClient({
      id: userId,
      designsCount: 0,
      removed,
      tables: {
        boutique_members: { boutique_id: boutiqueId },
        boutiques: { status: "verified" },
      },
    }),
    "studio",
  );
  assert.equal(cleaned.status, 200);
  assert.deepEqual(removed, [
    { bucket: STORAGE_BUCKETS.portfolioImages, paths: [portfolioPath] },
  ]);

  const stillUsed = await handleStorageRequest(
    jsonRequest({
      origin: "http://localhost:3000",
      url: "http://localhost:3000/api/storage",
      body: {
        action: "remove",
        bucket: STORAGE_BUCKETS.requestInspirations,
        path: inspirationPath,
      },
    }),
    userClient({
      id: userId,
      drafts: [
        {
          id: requestId,
          draft: { inspirations: [{ key: inspirationPath, note: "" }] },
        },
      ],
    }),
    "marketplace",
  );
  assert.equal(stillUsed.status, 409);

  const inspirationRemoved = [];
  const detached = await handleStorageRequest(
    jsonRequest({
      origin: "http://localhost:3000",
      url: "http://localhost:3000/api/storage",
      body: {
        action: "remove",
        bucket: STORAGE_BUCKETS.requestInspirations,
        path: inspirationPath,
      },
    }),
    userClient({ id: userId, drafts: [], removed: inspirationRemoved }),
    "marketplace",
  );
  assert.equal(detached.status, 200);
  assert.equal(inspirationRemoved.length, 2);
});

test("inspiration display URLs are signed on demand", async () => {
  const signed = await createInspirationDisplayUrl(
    userClient({ id: userId }),
    inspirationPath,
    800,
  );
  assert.equal(signed.path, inspirationPath);
  assert.match(signed.signedUrl, /width=800/);
});
