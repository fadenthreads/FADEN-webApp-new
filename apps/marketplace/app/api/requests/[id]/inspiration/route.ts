import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@faden/supabase";
import {
  isNextResponse,
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
  try {
    const { id } = await params;
    if (Number(request.headers.get("content-length")) > 11 * 1024 * 1024)
      throw new Error("Images must be under 10 MB.");
    const form = await request.formData();
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size === 0 ||
      file.size > 10 * 1024 * 1024
    )
      throw new Error("Choose a JPG, PNG or WebP image under 10 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime =
      bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        ? "image/jpeg"
        : bytes[0] === 137 &&
            bytes[1] === 80 &&
            bytes[2] === 78 &&
            bytes[3] === 71
          ? "image/png"
          : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
              String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
            ? "image/webp"
            : null;
    if (!mime || mime !== file.type)
      throw new Error("The file does not match a supported image format.");
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
    const key = `${user.id}/${id}/${crypto.randomUUID()}.${mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp"}`;
    const upload = await supabase.storage
      .from("request-inspiration")
      .upload(key, bytes, { contentType: mime, upsert: false });
    if (upload.error) throw new Error("Upload failed. Please try again.");
    draft.inspirations.push({ key, note: "" });
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
      await supabase.storage.from("request-inspiration").remove([key]);
      throw new Error("Draft changed. Please retry the upload.");
    }
    const signed = await supabase.storage
      .from("request-inspiration")
      .createSignedUrl(key, 900);
    return NextResponse.json({ row: data, key, url: signed.data?.signedUrl });
  } catch (error) {
    return routeGuardError(error, "Unable to save your request.");
  }
}
