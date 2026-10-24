import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@faden/supabase";
import {
  detectAllowedMime,
  extensionForMime,
  stripImageExif,
  requireSameOrigin,
  requireUser,
  isNextResponse,
  routeGuardError,
} from "@faden/server";
import { validateDraft } from "../../../../../lib/outfit-request";
import { getSupabaseServerClient } from "../../../../../lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const origin = requireSameOrigin(request);
  if (origin) return origin;
  const db = await getSupabaseServerClient();
  const user = await requireUser(db);
  if (isNextResponse(user)) return user;
  let uploaded = "";
  let persisted = false;
  const bucket = db.storage.from("request-measurements");
  try {
    if (Number(request.headers.get("content-length")) > 11 * 1024 * 1024)
      throw new Error("Choose an image under 10 MB.");
    const { id } = await params;
    const form = await request.formData();
    const { data: row } = await db
      .from("outfit_requests")
      .select()
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("status", "draft")
      .maybeSingle();
    if (!row || row.version !== Number(form.get("version")))
      return NextResponse.json(
        { error: "Draft changed. Reload before uploading." },
        { status: 409 },
      );
    const draft = validateDraft(row.draft);
    const old = draft.measurements.reference;
    if (form.get("action") !== "remove") {
      const file = form.get("file");
      if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024)
        throw new Error("Choose a JPG, PNG or WebP image under 10 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mime = detectAllowedMime(bytes, file.type);
      if (!mime || mime === "application/pdf")
        throw new Error(
          "Use a JPG, PNG or WebP photo/screenshot of your chart.",
        );
      uploaded = `${user.id}/${id}/${crypto.randomUUID()}.${extensionForMime(mime)}`;
      const result = await bucket.upload(
        uploaded,
        stripImageExif(bytes, mime),
        { contentType: mime, upsert: false },
      );
      if (result.error)
        throw new Error("Could not upload the chart. Please try again.");
    }
    draft.measurements.reference = uploaded;
    draft.consent = false;
    const { data, error } = await db
      .from("outfit_requests")
      .update({
        draft:
          draft as unknown as Database["public"]["Tables"]["outfit_requests"]["Row"]["draft"],
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("status", "draft")
      .eq("version", row.version)
      .select()
      .maybeSingle();
    if (error || !data) throw new Error("Draft changed. Please retry.");
    persisted = true;
    if (old && old.startsWith(`${user.id}/${id}/`)) await bucket.remove([old]);
    const signed = uploaded
      ? await bucket.createSignedUrl(uploaded, 900)
      : null;
    return NextResponse.json({
      row: data,
      key: uploaded,
      url: signed?.data?.signedUrl,
    });
  } catch (error) {
    if (uploaded && !persisted) await bucket.remove([uploaded]);
    return routeGuardError(error, "Unable to save your measurement chart.");
  }
}
