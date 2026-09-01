import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@faden/supabase";
import {
  createInspirationDisplayUrl,
  isNextResponse,
  requireSameOrigin,
  requireUser,
  routeGuardError,
  STORAGE_BUCKETS,
  StorageGrantError,
  uploadRequestInspirationObject,
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
  let uploadedPath = "";
  let persisted = false;
  try {
    const { id } = await params;
    if (Number(request.headers.get("content-length")) > 11 * 1024 * 1024)
      throw new Error("Images must be under 10 MB.");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      throw new Error("Choose a JPG, PNG or WebP image under 10 MB.");
    const { data: row } = await supabase
      .from("outfit_requests")
      .select()
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("status", "draft")
      .single();
    if (!row || row.version !== Number(form.get("version")))
      throw new Error("Draft changed. Reload before uploading.");
    const draft = validateDraft(row.draft);
    if (draft.inspirations.length >= 8)
      throw new Error("You can add up to eight images.");
    const uploaded = await uploadRequestInspirationObject(supabase, {
      userId: user.id,
      requestId: id,
      file,
    });
    uploadedPath = uploaded.path;
    draft.inspirations.push({ key: uploaded.path, note: "" });
    const { data, error } = await supabase
      .from("outfit_requests")
      .update({
        draft:
          draft as unknown as Database["public"]["Tables"]["outfit_requests"]["Row"]["draft"],
      })
      .eq("id", id)
      .eq("version", row.version)
      .eq("status", "draft")
      .select()
      .maybeSingle();
    if (error || !data) {
      throw new Error("Draft changed. Please retry the upload.");
    }
    persisted = true;
    const signed = await createInspirationDisplayUrl(
      supabase,
      uploaded.path,
      800,
    );
    return NextResponse.json({
      row: data,
      key: uploaded.path,
      url: signed?.signedUrl,
    });
  } catch (error) {
    if (uploadedPath && !persisted) {
      await supabase.storage
        .from(STORAGE_BUCKETS.requestInspirations)
        .remove([uploadedPath]);
    }
    if (error instanceof StorageGrantError) {
      return NextResponse.json(
        error.code
          ? { error: error.message, code: error.code }
          : { error: error.message },
        { status: error.status },
      );
    }
    return routeGuardError(error, "Unable to save your request.");
  }
}
