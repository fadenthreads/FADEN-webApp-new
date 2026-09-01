import { NextRequest, NextResponse } from "next/server";
import { apiError, jsonBody, requestContext } from "../../../lib/request-api";
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requestContext(request);
    const body = await jsonBody(request);
    let boutiqueId: string | null = null,
      designId: string | null = null;
    if (body.design) {
      const { data } = await supabase
        .from("designs")
        .select("id,boutique_id")
        .eq("slug", String(body.design))
        .eq("status", "published")
        .single();
      if (!data) throw new Error("That design is no longer available.");
      designId = data.id;
      boutiqueId = data.boutique_id;
    }
    if (body.boutique) {
      const { data } = await supabase
        .from("boutiques")
        .select("id")
        .eq("slug", String(body.boutique))
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
    return apiError(error);
  }
}
