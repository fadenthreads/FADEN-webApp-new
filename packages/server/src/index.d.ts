import type { Database } from "@faden/supabase";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export interface JsonErrorBody {
  error: string;
  code?: string;
}

export function jsonError(
  message: string,
  status: number,
  code?: string,
): NextResponse<JsonErrorBody>;

export function isNextResponse(value: unknown): value is NextResponse;

export function requireSameOrigin(request: NextRequest): NextResponse | null;

export function requireUser(
  supabase: SupabaseClient<Database>,
): Promise<User | NextResponse>;

export function requireAdminAal2(
  supabase: SupabaseClient<Database>,
): Promise<User | NextResponse>;

export function readJsonBody(
  request: NextRequest,
  maxBytes: number,
): Promise<unknown | NextResponse>;

export function routeGuardError(
  error: unknown,
  fallback?: string,
): NextResponse<JsonErrorBody>;

export const STORAGE_BUCKETS: {
  readonly portfolioImages: "portfolio-images";
  readonly requestInspirations: "request-inspirations";
  readonly orderFiles: "order-files";
  readonly verificationDocuments: "verification-documents";
};

export const IMAGE_MAX_BYTES: number;
export const PDF_MAX_BYTES: number;
export const SIGNED_URL_TTL_SECONDS: number;
export const DISPLAY_MAX_EDGE: number;
export const DISPLAY_WIDTHS: readonly number[];
export const LEGACY_INSPIRATION_BUCKET: "request-inspiration";
export const IMAGE_MIME_TYPES: readonly string[];
export const ORDER_FILE_PURPOSES: readonly string[];

export type StorageAudience = "marketplace" | "studio" | "admin";

export class StorageGrantError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string);
}

export function isUuid(value: unknown): value is string;
export function extensionForMime(mimeType: string): string | null;
export function maxBytesFor(bucket: string, mimeType: string): number;
export function detectAllowedMime(
  input: Uint8Array | ArrayBuffer | Buffer,
  declaredType?: string,
): string | null;

export interface StorageUploadGrantInput {
  audience: StorageAudience;
  userId: string;
  bucket: string;
  subjectId: string;
  purpose?: string | null;
  mimeType: string;
  byteSize: number;
  objectId?: string;
}

export interface StorageUploadGrant {
  bucket: string;
  mimeType: string;
  purpose: string | null;
  path: string;
}

export function createUploadGrant(
  input: StorageUploadGrantInput,
): StorageUploadGrant;
export function createDownloadGrant(input: {
  audience: StorageAudience;
  bucket: string;
  path: string;
}): { bucket: string; path: string };
export function buildStorageObjectPath(input: {
  bucket: string;
  userId: string;
  subjectId: string;
  purpose?: string | null;
  mimeType: string;
  objectId?: string;
}): string;
export function isSafeObjectPath(path: string, bucket: string): boolean;
export function displayWidthFor(value: unknown): number | null;
export function looksLikeSignedUrl(value: unknown): boolean;
export function isOwnedPortfolioKey(path: string, boutiqueId: string): boolean;
export function isOwnedInspirationKey(
  path: string,
  userId: string,
  requestId: string,
): boolean;
export function portfolioPublicUrl(
  supabaseUrl: string,
  path: string,
  width?: number,
): string;
export function createInspirationDisplayUrl(
  supabase: SupabaseClient<Database>,
  path: string,
  width?: number,
): Promise<{ bucket: string; path: string; signedUrl: string } | null>;
export function uploadRequestInspirationObject(
  supabase: SupabaseClient<Database>,
  input: { userId: string; requestId: string; file: File },
): Promise<{ bucket: string; path: string; mimeType: string }>;
export function stripImageExif(
  input: Uint8Array | ArrayBuffer | Buffer,
  mimeType: string,
): Uint8Array;
export function handleStorageRequest(
  request: NextRequest,
  supabase: SupabaseClient<Database>,
  audience: StorageAudience,
): Promise<NextResponse>;
