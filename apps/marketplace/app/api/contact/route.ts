import { NextRequest, NextResponse } from "next/server";
import { jsonError, readJsonBody, requireSameOrigin } from "@faden/server";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export async function POST(request: NextRequest) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const body = await readJsonBody(request, 8_192);
  if (body instanceof NextResponse) return body;
  const input = body as Record<string, unknown>;
  if (typeof input.website === "string" && input.website) {
    return NextResponse.json({ reference: "received" });
  }
  if (
    typeof input.name !== "string" ||
    typeof input.email !== "string" ||
    typeof input.category !== "string" ||
    typeof input.message !== "string"
  )
    return jsonError(
      "Please complete every required field.",
      400,
      "invalid_contact",
    );

  const db = await getSupabaseServerClient();
  const { data, error } = await db.rpc("submit_contact_inquiry", {
    p_name: input.name,
    p_email: input.email,
    p_category: input.category,
    p_message: input.message,
  });
  if (error) {
    const limited = error.message.includes("wait before");
    return jsonError(
      limited
        ? "Please wait before sending another enquiry."
        : "We could not save your enquiry. Please email us instead.",
      limited ? 429 : 400,
      limited ? "rate_limited" : "invalid_contact",
    );
  }
  return NextResponse.json(
    { reference: `FAD-${String(data).slice(0, 8).toUpperCase()}` },
    { status: 201 },
  );
}
