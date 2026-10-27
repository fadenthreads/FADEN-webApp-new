import { NextRequest, NextResponse } from "next/server";
import {
  requireSameOrigin,
  requireUser,
  readJsonBody,
  isNextResponse,
  jsonError,
} from "@faden/server";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export async function POST(request: NextRequest) {
  const origin = requireSameOrigin(request);
  if (origin) return origin;
  const db = await getSupabaseServerClient();
  const user = await requireUser(db);
  if (isNextResponse(user)) return user;
  const body = await readJsonBody(request, 2048);
  if (isNextResponse(body)) return body;
  if (!body || typeof body !== "object" || Array.isArray(body))
    return jsonError("Check your account details.", 400);
  const value = body as Record<string, unknown>;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const phone = typeof value.phone === "string" ? value.phone.trim() : "";
  if (
    name.length < 2 ||
    name.length > 120 ||
    phone.length > 24 ||
    (phone && !/^\+?[0-9 ()-]{7,24}$/.test(phone))
  )
    return jsonError(
      "Enter your name and a valid contact phone, or leave the phone blank.",
      400,
    );
  const { data, error } = await db
    .from("profiles")
    .update({ display_name: name, phone: phone || null })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data)
    return jsonError(
      "Your account details could not be saved. Please try again.",
      400,
    );
  return NextResponse.json({ ok: true });
}
