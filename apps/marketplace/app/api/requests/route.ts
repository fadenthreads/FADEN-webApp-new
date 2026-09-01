import { NextRequest, NextResponse } from "next/server";
import {
  isNextResponse,
  readJsonBody,
  requireSameOrigin,
  requireUser,
  routeGuardError,
} from "@faden/server";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export async function POST(request: NextRequest) {
  const originFailure = requireSameOrigin(request);
  if (originFailure) return originFailure;
  const supabase = await getSupabaseServerClient();
  const user = await requireUser(supabase);
  if (isNextResponse(user)) return user;
  const body = await readJsonBody(request, 55_000);
  if (isNextResponse(body)) return body;
  try {
    const payload = body as Record<string, unknown>;
    let boutiqueId: string | null = null,
      designId: string | null = null;
    if (payload.design) {
      const { data } = await supabase
        .from("designs")
        .select("id,boutique_id")
        .eq("slug", String(payload.design))
        .eq("status", "published")
        .single();
      if (!data) throw new Error("That design is no longer available.");
      designId = data.id;
      boutiqueId = data.boutique_id;
    }
    if (payload.boutique) {
      const { data } = await supabase
        .from("boutiques")
        .select("id")
        .eq("slug", String(payload.boutique))
        .eq("status", "verified")
        .eq("is_published", true)
        .single();
      if (!data || (boutiqueId && boutiqueId !== data.id))
        throw new Error("Please check the selected boutique.");
      boutiqueId = data.id;
    }
    const { count } = await supabase
      .from("outfit_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "draft");
    if ((count ?? 0) >= 20)
      throw new Error(
        "You have 20 drafts. Please resume one from My Requests.",
      );
    const { data, error } = await supabase
      .from("outfit_requests")
      .insert({
        user_id: user.id,
        boutique_id: boutiqueId,
        design_id: designId,
      })
      .select()
      .single();
    if (error) throw new Error("Could not create a draft. Please try again.");
    return NextResponse.json(data);
  } catch (error) {
    return routeGuardError(error, "Unable to save your request.");
  }
}
