import { NextRequest, NextResponse } from "next/server";
import {
  isNextResponse,
  readJsonBody,
  requireSameOrigin,
  requireUser,
  routeGuardError,
} from "@faden/server";
import { validateDraft } from "../../../../../lib/outfit-request";
import { getSupabaseServerClient } from "../../../../../lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const originFailure = requireSameOrigin(request);
  if (originFailure) return originFailure;
  const supabase = await getSupabaseServerClient();
  const user = await requireUser(supabase);
  if (isNextResponse(user)) return user;
  const body = await readJsonBody(request, 55_000);
  if (isNextResponse(body)) return body;
  try {
    const { id } = await params;
    const payload = body as Record<string, unknown>;
    const { data } = await supabase
      .from("outfit_requests")
      .select()
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (!data) throw new Error("Request not found.");
    if (data.status === "submitted") return NextResponse.json({ id });
    validateDraft(data.draft, true);
    if (payload.version !== data.version)
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
    return routeGuardError(error, "Unable to save your request.");
  }
}
