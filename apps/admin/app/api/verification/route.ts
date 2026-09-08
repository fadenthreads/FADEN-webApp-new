import { NextRequest, NextResponse } from "next/server";

import {
  requireSameOrigin,
  requireAdminAal2,
  readJsonBody,
  jsonError,
  isNextResponse,
} from "@faden/server";

import { getSupabaseServerClient } from "../../../lib/supabase/server";

const MAX_REQUEST_BYTES = 4096;

type VerificationDecisionAction = "approve" | "request_changes" | "reject";

function validateVerificationDecision(body: unknown): {
  action: VerificationDecisionAction;
  submissionId: string;
  reason: string;
} | null {
  if (
    typeof body !== "object" ||
    body === null ||
    !("action" in body) ||
    !("submission_id" in body) ||
    !("reason" in body)
  ) {
    return null;
  }

  const { action, submission_id, reason } = body as Record<string, unknown>;

  if (
    typeof action !== "string" ||
    typeof submission_id !== "string" ||
    typeof reason !== "string"
  ) {
    return null;
  }

  if (
    action !== "approve" &&
    action !== "request_changes" &&
    action !== "reject"
  ) {
    return null;
  }

  if (!reason || reason.trim().length === 0) {
    return null;
  }

  if (reason.trim().length > 2000) {
    return null;
  }

  return {
    action,
    submissionId: submission_id,
    reason: reason.trim(),
  };
}

export async function POST(request: NextRequest) {
  try {
    // Guard: same origin
    const originError = requireSameOrigin(request);
    if (originError) return originError;

    // Guard: authenticated admin with AAL2
    const supabase = await getSupabaseServerClient();
    const user = await requireAdminAal2(supabase);
    if (isNextResponse(user)) return user;

    // Guard: read and validate body
    const body = await readJsonBody(request, MAX_REQUEST_BYTES);
    if (isNextResponse(body)) return body;

    const command = validateVerificationDecision(body);
    if (!command) {
      return jsonError(
        "Invalid request: action, submission_id, and reason are required.",
        400,
        "invalid_request",
      );
    }

    const { action, submissionId, reason } = command;

    // Execute action based on type
    if (action === "approve") {
      const { error } = await supabase.rpc("admin_approve_verification", {
        p_submission_id: submissionId,
        p_reason: reason,
      });

      if (error) {
        console.error("Failed to approve verification:", error);

        // Provide more specific error messages
        if (error.message?.includes("suspended")) {
          return jsonError(
            "Cannot approve verification for suspended boutique.",
            409,
            "boutique_suspended",
          );
        }
        if (error.message?.includes("submitted")) {
          return jsonError(
            "Only submitted verifications can be approved.",
            409,
            "invalid_state",
          );
        }
        if (error.message?.includes("missing")) {
          return jsonError(
            "Verification has missing required fields or documents.",
            400,
            "incomplete_verification",
          );
        }

        return jsonError(
          "The verification could not be approved in its current state.",
          409,
          "approval_failed",
        );
      }
    } else if (action === "request_changes") {
      const { error } = await supabase.rpc(
        "admin_request_verification_changes",
        {
          p_submission_id: submissionId,
          p_reason: reason,
        },
      );

      if (error) {
        console.error("Failed to request verification changes:", error);

        if (error.message?.includes("submitted")) {
          return jsonError(
            "Only submitted verifications can have changes requested.",
            409,
            "invalid_state",
          );
        }

        return jsonError(
          "Changes could not be requested for this verification.",
          409,
          "request_changes_failed",
        );
      }
    } else {
      // reject
      const { error } = await supabase.rpc("admin_reject_verification", {
        p_submission_id: submissionId,
        p_reason: reason,
      });

      if (error) {
        console.error("Failed to reject verification:", error);

        if (error.message?.includes("submitted")) {
          return jsonError(
            "Only submitted verifications can be rejected.",
            409,
            "invalid_state",
          );
        }

        return jsonError(
          "The verification could not be rejected.",
          409,
          "rejection_failed",
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        submission_id: submissionId,
        action,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Verification decision error:", error);
    return jsonError(
      "An unexpected error occurred.",
      500,
      "internal_server_error",
    );
  }
}
