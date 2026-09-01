import { NextResponse } from "next/server.js";

/** @typedef {{ error: string, code?: string }} JsonErrorBody */

/** @param {string} message @param {number} status @param {string} [code] */
export function jsonError(message, status, code) {
  return NextResponse.json(
    code ? { error: message, code } : { error: message },
    { status },
  );
}

/** @param {unknown} value */
export function isNextResponse(value) {
  return value instanceof NextResponse;
}

/** @param {import('next/server').NextRequest} request */
export function requireSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    return jsonError("Invalid request origin.", 403, "invalid_origin");
  }
  return null;
}

/** @param {import('@supabase/supabase-js').SupabaseClient} supabase */
export async function requireUser(supabase) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return jsonError("Please sign in.", 401, "unauthenticated");
  }
  return data.user;
}

/** @param {import('@supabase/supabase-js').SupabaseClient} supabase */
export async function requireAdminAal2(supabase) {
  const user = await requireUser(supabase);
  if (isNextResponse(user)) return user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return jsonError("Administrator access required.", 403, "forbidden");
  }

  const { data: assurance } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== "aal2") {
    return jsonError(
      "Administrator MFA verification required.",
      403,
      "aal2_required",
    );
  }

  return user;
}

/** @param {import('next/server').NextRequest} request @param {number} maxBytes */
export async function readJsonBody(request, maxBytes) {
  const text = await request.text();
  if (text.length > maxBytes) {
    return jsonError("Request too large.", 413, "payload_too_large");
  }
  try {
    return JSON.parse(text);
  } catch {
    return jsonError("Invalid JSON request.", 400, "invalid_json");
  }
}

/** @param {unknown} error @param {string} [fallback] */
export function routeGuardError(
  error,
  fallback = "Unable to complete the request.",
) {
  if (error instanceof Error) {
    return jsonError(error.message, 400);
  }
  return jsonError(fallback, 400);
}
