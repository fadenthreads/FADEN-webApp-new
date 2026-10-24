import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@faden/supabase";
import {
  isNextResponse,
  isOwnedInspirationKey,
  readJsonBody,
  requireSameOrigin,
  requireUser,
  routeGuardError,
} from "@faden/server";
import { validateDraft } from "../../../../lib/outfit-request";
import { mergeRequestDraft } from "../../../../lib/request-merge.mjs";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";

type Json = Database["public"]["Tables"]["outfit_requests"]["Row"]["draft"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await getSupabaseServerClient();
  const user = await requireUser(supabase);
  if (isNextResponse(user)) return user;
  const { id } = await params;
  const { data, error } = await supabase
    .from("outfit_requests")
    .select()
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error)
    return NextResponse.json(
      { error: "Unable to load your saved request. Try again." },
      { status: 503 },
    );
  if (!data)
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const originFailure = requireSameOrigin(request);
  if (originFailure) return originFailure;
  const supabase = await getSupabaseServerClient();
  const user = await requireUser(supabase);
  if (isNextResponse(user)) return user;
  const body = await readJsonBody(request, 110_000);
  if (isNextResponse(body)) return body;
  try {
    const { id } = await params;
    const payload = body as Record<string, unknown>;
    if (!Number.isInteger(payload.version))
      throw new Error("Reload this draft before saving.");
    let draft = validateDraft(payload.draft);
    let expectedVersion = payload.version as number;
    const { data: current } = await supabase
      .from("outfit_requests")
      .select()
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!current)
      return NextResponse.json(
        { error: "Request not found." },
        { status: 404 },
      );
    if (current.status === "submitted")
      return NextResponse.json(
        {
          code: "already_submitted",
          id,
          error: "This request is already submitted. Opening your request.",
        },
        { status: 409 },
      );
    if (current.version !== expectedVersion && payload.baseDraft) {
      const result = mergeRequestDraft(
        validateDraft(payload.baseDraft),
        draft,
        validateDraft(current.draft),
      );
      if (result.conflicts.length)
        return NextResponse.json(
          {
            code: "draft_conflict",
            current,
            conflicts: result.conflicts,
            error:
              "We found another saved change. Choose which version to keep.",
          },
          { status: 409 },
        );
      draft = validateDraft(result.merged);
      draft.consent = false;
      expectedVersion = current.version;
    }
    if (
      draft.measurements.reference &&
      !isOwnedInspirationKey(draft.measurements.reference, user.id, id)
    )
      throw new Error("Invalid measurement reference ownership.");
    if (
      draft.inspirations.some((i) => !isOwnedInspirationKey(i.key, user.id, id))
    )
      throw new Error("Invalid inspiration ownership.");
    const { data, error } = await supabase
      .from("outfit_requests")
      .update({ draft: draft as unknown as Json })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("status", "draft")
      .eq("version", expectedVersion)
      .select()
      .maybeSingle();
    if (error) throw new Error("Could not save the draft.");
    if (!data)
      return NextResponse.json(
        {
          code: "retry_save",
          error: "Syncing your latest changes. Please try saving again.",
        },
        { status: 409 },
      );
    return NextResponse.json(data);
  } catch (error) {
    return routeGuardError(error, "Unable to save your request.");
  }
}
