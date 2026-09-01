import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  jsonBody,
  requestContext,
} from "../../../../../lib/request-api";
import { validateDraft } from "../../../../../lib/outfit-request";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase, user } = await requestContext(request);
    const { id } = await params;
    const body = await jsonBody(request);
    const { data } = await supabase
      .from("outfit_requests")
      .select()
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (!data) throw new Error("Request not found.");
    if (data.status === "submitted") return NextResponse.json({ id });
    validateDraft(data.draft, true);
    if (body.version !== data.version)
      return NextResponse.json(
        { error: "Your draft changed. Reload and review it again." },
        { status: 409 },
      );
    const { error } = await supabase.rpc("submit_outfit_request", {
      request_id: id,
      expected_version: data.version,
    });
    if (error)
      throw new Error(
        "Submission could not be completed. Reload and check your details.",
      );
    return NextResponse.json({ id });
  } catch (error) {
    return apiError(error);
  }
}
