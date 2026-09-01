import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@faden/supabase";
import {
  apiError,
  jsonBody,
  requestContext,
} from "../../../../lib/request-api";
import { validateDraft } from "../../../../lib/outfit-request";
type Json = Database["public"]["Tables"]["outfit_requests"]["Row"]["draft"];
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase, user } = await requestContext(request);
    const { id } = await params;
    const body = await jsonBody(request);
    if (!Number.isInteger(body.version))
      throw new Error("Reload this draft before saving.");
    const draft = validateDraft(body.draft);
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
      .eq("version", body.version)
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
    return apiError(error);
  }
}
