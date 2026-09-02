import { NextRequest, NextResponse } from "next/server";

import {
  requireSameOrigin,
  requireAdminAal2,
  readJsonBody,
  jsonError,
  isNextResponse,
} from "@faden/server";
import { getSupabaseServerClient } from "../../../lib/supabase/server";
import { validateBoutiqueAction } from "../../../lib/boutique-management-core.mjs";

const MAX_REQUEST_BYTES = 2048;

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

    const command = validateBoutiqueAction(body);
    if (!command) {
      return jsonError(
        "Invalid request: action, boutique_id, and reason are required.",
        400,
        "invalid_request",
      );
    }

    const { action, boutiqueId, reason } = command;

    // Execute action based on type
    if (action === "suspend") {
      const { error } = await supabase.rpc("admin_suspend_boutique", {
        p_boutique_id: boutiqueId,
        p_reason: reason,
      });

      if (error) {
        console.error("Failed to suspend boutique:", error);
        return jsonError(
          "The boutique could not be suspended in its current state.",
          409,
          "suspension_failed",
        );
      }
    } else {
      const { error } = await supabase.rpc("admin_restore_boutique", {
        p_boutique_id: boutiqueId,
        p_reason: reason,
      });

      if (error) {
        console.error("Failed to restore boutique:", error);
        return jsonError(
          "The boutique could not be restored in its current state.",
          409,
          "restoration_failed",
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        boutique_id: boutiqueId,
        action,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Boutique action error:", error);
    return jsonError(
      "An unexpected error occurred.",
      500,
      "internal_server_error",
    );
  }
}
