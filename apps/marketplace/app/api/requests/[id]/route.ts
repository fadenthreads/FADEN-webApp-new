import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@faden/supabase";
import {
  isNextResponse,
  readJsonBody,
  requireSameOrigin,
  requireUser,
  routeGuardError,
} from "@faden/server";
import { validateDraft } from "../../../../lib/outfit-request";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";

type Json = Database["public"]["Tables"]["outfit_requests"]["Row"]["draft"];

export async function PATCH(
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
    if (!Number.isInteger(payload.version))
      throw new Error("Reload this draft before saving.");
    const draft = validateDraft(payload.draft);
    if (
      draft.inspirations.some(
        (i) => !i.key.startsWith(`${user.id}/${id}/`) || i.key.includes(".."),
      )
    )
      throw new Error("Invalid inspiration ownership.");
    const { data, error } = await supabase
      .from("outfit_requests")
      .update({ draft: draft as unknown as Json })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("status", "draft")
      .eq("version", payload.version as number)
      .select()
      .maybeSingle();
    if (error) throw new Error("Could not save the draft.");
    if (!data)
      return NextResponse.json(
        {
          error:
            "This draft changed in another tab or was submitted. Reload to continue.",
        },
        { status: 409 },
      );
    return NextResponse.json(data);
  } catch (error) {
    return routeGuardError(error, "Unable to save your request.");
  }
}
