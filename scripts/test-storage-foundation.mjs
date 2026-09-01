import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  IMAGE_MAX_BYTES,
  PDF_MAX_BYTES,
  STORAGE_BUCKETS,
  StorageGrantError,
  buildStorageObjectPath,
  createDownloadGrant,
  createUploadGrant,
  detectAllowedMime,
  handleStorageRequest,
  isSafeObjectPath,
  maxBytesFor,
  stripImageExif,
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
const orderId = "dddddddd-4444-4444-8444-dddddddddddd";
const objectId = "eeeeeeee-5555-4555-8555-eeeeeeeeeeee";

function jpegWithExif() {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    Buffer.from([0xff, 0xe1, 0x00, 0x0c]),
    Buffer.from("Exif\0\0TEST"),
    Buffer.from([0xff, 0xd9]),
  ]);
}

function pngWithExif() {
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    Buffer.from([
      0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0,
      0, 0, 0, 0, 0,
    ]),
    Buffer.from([0, 0, 0, 4, 0x65, 0x58, 0x49, 0x66, 1, 2, 3, 4, 0, 0, 0, 0]),
    Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0, 0, 0, 0]),
  ]);
}

function mutationRequest({
  origin = "http://localhost:3000",
  url = "http://localhost:3000/api/storage",
  body = "{}",
  includeOrigin = true,
} = {}) {
  const headers = new Headers();
  if (includeOrigin && origin) headers.set("origin", origin);
  return new NextRequest(url, { method: "POST", headers, body });
}

function tableClient(row) {
  const client = {
    select: () => client,
    eq: () => client,
    maybeSingle: async () => ({ data: row, error: null }),
  };
  return client;
}

function userClient({
  id,
  role = "customer",
  aal = "aal1",
  tables = {},
  signedUpload = {
    token: "upload-token",
    signedUrl: "https://storage.example/upload",
  },
  signedDownload = { signedUrl: "https://storage.example/download" },
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
      return tableClient(tables[table] ?? null);
    },
    storage: {
      from: () => ({
        createSignedUploadUrl: async (path) => ({
          data: { ...signedUpload, path },
          error: null,
        }),
        createSignedUrl: async () => ({ data: signedDownload, error: null }),
        getPublicUrl: (path) => ({
          data: {
            publicUrl: `https://storage.example/public/${path}`,
          },
        }),
      }),
    },
  };
}

test("paths include authenticated ownership identifiers", () => {
  assert.equal(
    buildStorageObjectPath({
      bucket: STORAGE_BUCKETS.portfolioImages,
      userId,
      subjectId: boutiqueId,
      mimeType: "image/jpeg",
      objectId,
    }),
    `${boutiqueId}/${userId}/${objectId}.jpg`,
  );
  assert.equal(
    buildStorageObjectPath({
      bucket: STORAGE_BUCKETS.requestInspirations,
      userId,
      subjectId: requestId,
      mimeType: "image/webp",
      objectId,
    }),
    `${userId}/${requestId}/${objectId}.webp`,
  );
  assert.equal(
    buildStorageObjectPath({
      bucket: STORAGE_BUCKETS.orderFiles,
      userId,
      subjectId: orderId,
      purpose: "customer",
      mimeType: "application/pdf",
      objectId,
    }),
    `${orderId}/customer/${userId}/${objectId}.pdf`,
  );
  assert.equal(
    isSafeObjectPath(
      `${boutiqueId}/${userId}/${objectId}.pdf`,
      STORAGE_BUCKETS.verificationDocuments,
    ),
    true,
  );
  assert.equal(
    isSafeObjectPath(`../${objectId}.jpg`, STORAGE_BUCKETS.portfolioImages),
    false,
  );
});

test("MIME and size limits follow image 10MB and verification PDF 15MB rules", () => {
  assert.equal(
    maxBytesFor(STORAGE_BUCKETS.portfolioImages, "image/jpeg"),
    IMAGE_MAX_BYTES,
  );
  assert.equal(
    maxBytesFor(STORAGE_BUCKETS.verificationDocuments, "application/pdf"),
    PDF_MAX_BYTES,
  );
  assert.equal(
    maxBytesFor(STORAGE_BUCKETS.requestInspirations, "application/pdf"),
    0,
  );
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00]);
  assert.equal(detectAllowedMime(jpeg, "image/jpeg"), "image/jpeg");
  assert.equal(detectAllowedMime(jpeg, "image/png"), null);
  assert.equal(
    detectAllowedMime(Buffer.from("%PDF-1.7"), "application/pdf"),
    "application/pdf",
  );
  assert.throws(
    () =>
      createUploadGrant({
        audience: "studio",
        userId,
        bucket: STORAGE_BUCKETS.portfolioImages,
        subjectId: boutiqueId,
        mimeType: "image/jpeg",
        byteSize: IMAGE_MAX_BYTES + 1,
      }),
    (error) =>
      error instanceof StorageGrantError &&
      error.status === 413 &&
      error.code === "payload_too_large",
  );
  assert.throws(
    () =>
      createUploadGrant({
        audience: "studio",
        userId,
        bucket: STORAGE_BUCKETS.verificationDocuments,
        subjectId: boutiqueId,
        mimeType: "application/pdf",
        byteSize: PDF_MAX_BYTES + 1,
      }),
    (error) => error instanceof StorageGrantError && error.status === 413,
  );
});

test("audience boundaries keep marketplace, studio and admin grants separate", () => {
  assert.throws(
    () =>
      createUploadGrant({
        audience: "marketplace",
        userId,
        bucket: STORAGE_BUCKETS.verificationDocuments,
        subjectId: boutiqueId,
        mimeType: "application/pdf",
        byteSize: 100,
      }),
    (error) => error instanceof StorageGrantError && error.status === 403,
  );
  assert.throws(
    () =>
      createUploadGrant({
        audience: "admin",
        userId,
        bucket: STORAGE_BUCKETS.verificationDocuments,
        subjectId: boutiqueId,
        mimeType: "application/pdf",
        byteSize: 100,
      }),
    (error) => error instanceof StorageGrantError && error.status === 403,
  );
  assert.throws(
    () =>
      createUploadGrant({
        audience: "marketplace",
        userId,
        bucket: STORAGE_BUCKETS.requestInspirations,
        subjectId: requestId,
        mimeType: "image/jpeg",
        byteSize: 100,
      }),
    (error) =>
      error instanceof StorageGrantError && error.code === "multipart_required",
  );
  assert.throws(
    () =>
      createUploadGrant({
        audience: "marketplace",
        userId,
        bucket: STORAGE_BUCKETS.orderFiles,
        subjectId: orderId,
        purpose: "atelier",
        mimeType: "image/png",
        byteSize: 100,
      }),
    (error) => error instanceof StorageGrantError && error.status === 403,
  );
  const grant = createUploadGrant({
    audience: "studio",
    userId,
    bucket: STORAGE_BUCKETS.portfolioImages,
    subjectId: boutiqueId,
    mimeType: "image/png",
    byteSize: 2048,
    objectId,
  });
  assert.equal(grant.path.includes(userId), true);
  assert.equal(grant.path.includes(boutiqueId), true);
  assert.deepEqual(
    createDownloadGrant({
      audience: "admin",
      bucket: STORAGE_BUCKETS.verificationDocuments,
      path: `${boutiqueId}/${userId}/${objectId}.pdf`,
    }),
    {
      bucket: STORAGE_BUCKETS.verificationDocuments,
      path: `${boutiqueId}/${userId}/${objectId}.pdf`,
    },
  );
  assert.throws(
    () =>
      createDownloadGrant({
        audience: "admin",
        bucket: STORAGE_BUCKETS.requestInspirations,
        path: `${userId}/${requestId}/${objectId}.jpg`,
      }),
    (error) => error instanceof StorageGrantError && error.status === 404,
  );
});

test("inspiration EXIF and sidecar metadata are stripped before processing", () => {
  const jpeg = stripImageExif(jpegWithExif(), "image/jpeg");
  assert.equal(Buffer.from(jpeg).includes(Buffer.from("Exif")), false);
  assert.equal(jpeg[0], 0xff);
  assert.equal(jpeg[1], 0xd8);
  const png = stripImageExif(pngWithExif(), "image/png");
  assert.equal(Buffer.from(png).includes(Buffer.from("eXIf")), false);
  assert.equal(Buffer.from(png).includes(Buffer.from("IHDR")), true);
});

test("storage routes require same-origin sessions and never use a service role", async () => {
  const denied = await handleStorageRequest(
    mutationRequest({ includeOrigin: false }),
    userClient({ id: userId }),
    "studio",
  );
  assert.equal(denied.status, 403);

  const unauthenticated = await handleStorageRequest(
    mutationRequest({
      body: JSON.stringify({ action: "sign-upload" }),
    }),
    userClient({ id: null }),
    "studio",
  );
  assert.equal(unauthenticated.status, 401);

  const adminUpload = await handleStorageRequest(
    mutationRequest({
      url: "http://localhost:3002/api/storage",
      origin: "http://localhost:3002",
      body: JSON.stringify({
        action: "sign-upload",
        bucket: STORAGE_BUCKETS.verificationDocuments,
        subjectId: boutiqueId,
        mimeType: "application/pdf",
        byteSize: 100,
      }),
    }),
    userClient({ id: userId, role: "admin", aal: "aal2" }),
    "admin",
  );
  assert.equal(adminUpload.status, 403);
  assert.deepEqual(await adminUpload.json(), {
    error: "This upload is not available.",
    code: "forbidden",
  });

  const aal1Admin = await handleStorageRequest(
    mutationRequest({
      url: "http://localhost:3002/api/storage",
      origin: "http://localhost:3002",
      body: JSON.stringify({
        action: "sign-download",
        bucket: STORAGE_BUCKETS.verificationDocuments,
        path: `${boutiqueId}/${userId}/${objectId}.pdf`,
      }),
    }),
    userClient({ id: userId, role: "admin", aal: "aal1" }),
    "admin",
  );
  assert.equal(aal1Admin.status, 403);
  assert.deepEqual(await aal1Admin.json(), {
    error: "Administrator MFA verification required.",
    code: "aal2_required",
  });

  const signed = await handleStorageRequest(
    mutationRequest({
      url: "http://localhost:3001/api/storage",
      origin: "http://localhost:3001",
      body: JSON.stringify({
        action: "sign-upload",
        bucket: STORAGE_BUCKETS.portfolioImages,
        subjectId: boutiqueId,
        mimeType: "image/jpeg",
        byteSize: 128,
        serviceRoleKey: "super-secret",
      }),
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
  assert.equal(signed.status, 200);
  const payload = await signed.json();
  assert.equal(payload.bucket, STORAGE_BUCKETS.portfolioImages);
  assert.equal(payload.token, "upload-token");
  assert.equal(payload.path.includes(userId), true);
  assert.equal(JSON.stringify(payload).includes("super-secret"), false);
  assert.equal(JSON.stringify(payload).includes("serviceRole"), false);
});
