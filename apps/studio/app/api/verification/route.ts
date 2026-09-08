import { NextRequest, NextResponse } from "next/server";

import {
  isNextResponse,
  jsonError,
  readJsonBody,
  requireSameOrigin,
  requireUser,
} from "@faden/server";

import { getSupabaseServerClient } from "../../../lib/supabase/server";

const MAX_REQUEST_BYTES = 24_000;
const DOCUMENT_CATEGORIES = new Set([
  "business_registration",
  "gst_certificate",
  "pan_document",
  "address_proof",
  "authorized_representative_id",
  "other_supporting_document",
]);
const DOCUMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

type Details = Record<string, string | null>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function detailsFrom(value: unknown): Details | null {
  const input = asRecord(value);
  if (!input) return null;
  const required = [
    "legal_business_name",
    "business_type",
    "registration_number",
    "pan",
    "registered_address_line1",
    "city",
    "state",
    "postal_code",
    "authorized_rep_name",
    "authorized_rep_role",
    "contact_email",
    "contact_phone",
  ];
  const optional = ["public_trading_name", "gstin", "registered_address_line2"];
  const output: Details = {};
  for (const key of [...required, ...optional]) {
    const item = input[key];
    if (item == null && optional.includes(key)) {
      output[key] = null;
      continue;
    }
    if (typeof item !== "string") return null;
    const normalized = item.trim();
    if (required.includes(key) && !normalized) return null;
    output[key] = normalized || null;
  }
  return output;
}

function string(value: unknown, max = 2_000): string | null {
  return typeof value === "string" && value.trim() && value.trim().length <= max
    ? value.trim()
    : null;
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function rpcError(error: { message?: string } | null) {
  const message = error?.message ?? "";
  if (message.includes("Optimistic concurrency")) {
    return jsonError(
      "This application changed. Refresh and try again.",
      409,
      "conflict",
    );
  }
  if (
    message.includes("Only the boutique owner") ||
    message.includes("Authentication")
  ) {
    return jsonError(
      "You do not have permission to change this application.",
      403,
      "forbidden",
    );
  }
  if (
    message.includes("Missing") ||
    message.includes("required") ||
    message.includes("Invalid")
  ) {
    return jsonError(
      "Check the required information and documents, then try again.",
      400,
      "invalid_request",
    );
  }
  if (
    message.includes("Only draft") ||
    message.includes("Only submitted") ||
    message.includes("Cannot submit")
  ) {
    return jsonError(
      "This application cannot be changed in its current status.",
      409,
      "invalid_state",
    );
  }
  return jsonError(
    "The verification application could not be updated.",
    409,
    "verification_failed",
  );
}

export async function POST(request: NextRequest) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const supabase = await getSupabaseServerClient();
  const user = await requireUser(supabase);
  if (isNextResponse(user)) return user;
  const body = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (isNextResponse(body)) return body;
  const input = asRecord(body);
  if (!input || typeof input.action !== "string") {
    return jsonError("Invalid verification request.", 400, "invalid_request");
  }

  if (input.action === "create_draft") {
    const boutiqueId = string(input.boutique_id, 36);
    const details = detailsFrom(input.details);
    if (!boutiqueId || !details) {
      return jsonError(
        "Complete the required business details first.",
        400,
        "invalid_request",
      );
    }
    const { data, error } = await supabase.rpc(
      "owner_create_verification_draft",
      {
        p_boutique_id: boutiqueId,
        p_details: details,
      },
    );
    return error ? rpcError(error) : NextResponse.json(data);
  }

  const submissionId = string(input.submission_id, 36);
  if (!submissionId) {
    return jsonError(
      "Invalid verification application.",
      400,
      "invalid_request",
    );
  }

  if (input.action === "update_draft") {
    const details = detailsFrom(input.details);
    const version = positiveInteger(input.version);
    if (!details || !version) {
      return jsonError(
        "Complete the required business details first.",
        400,
        "invalid_request",
      );
    }
    const { data, error } = await supabase.rpc(
      "owner_update_verification_draft",
      {
        p_submission_id: submissionId,
        p_details: details,
        p_expected_version: version,
      },
    );
    return error ? rpcError(error) : NextResponse.json(data);
  }

  if (input.action === "attach_document") {
    const category = string(input.category, 80);
    const path = string(input.storage_object_key, 240);
    const fileName = string(input.file_name, 255);
    const mimeType = string(input.mime_type, 100);
    const fileSize = positiveInteger(input.file_size_bytes);
    if (
      !category ||
      !DOCUMENT_CATEGORIES.has(category) ||
      !path ||
      !fileName ||
      !mimeType ||
      !DOCUMENT_TYPES.has(mimeType) ||
      !fileSize
    ) {
      return jsonError("Choose a supported document.", 400, "invalid_request");
    }
    const { data, error } = await supabase.rpc(
      "owner_attach_verification_document",
      {
        p_submission_id: submissionId,
        p_category: category,
        p_storage_object_key: path,
        p_file_name: fileName,
        p_file_size_bytes: fileSize,
        p_mime_type: mimeType,
      },
    );
    return error ? rpcError(error) : NextResponse.json(data);
  }

  if (input.action === "remove_document") {
    const documentId = string(input.document_id, 36);
    if (!documentId)
      return jsonError("Invalid document.", 400, "invalid_request");
    const { data, error } = await supabase.rpc(
      "owner_remove_verification_document",
      {
        p_document_id: documentId,
      },
    );
    return error ? rpcError(error) : NextResponse.json(data);
  }

  if (input.action === "submit") {
    const version = positiveInteger(input.version);
    if (!version)
      return jsonError("Invalid application version.", 400, "invalid_request");
    const { data, error } = await supabase.rpc("owner_submit_verification", {
      p_submission_id: submissionId,
      p_expected_version: version,
    });
    return error ? rpcError(error) : NextResponse.json(data);
  }

  return jsonError("Invalid verification action.", 400, "invalid_request");
}
