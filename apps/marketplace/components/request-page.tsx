import { notFound, redirect } from "next/navigation";
import { createInspirationDisplayUrl } from "@faden/server";
import { getSupabaseServerClient } from "../lib/supabase/server";
import {
  EMPTY_DRAFT,
  validateDraft,
  type RequestStep,
} from "../lib/outfit-request";
import { RequestWizard } from "./request-wizard";
export type RequestQuery = { id?: string; boutique?: string; design?: string };
export async function RequestPage({
  step,
  query,
}: {
  step: RequestStep;
  query: RequestQuery;
}) {
  const supabase = await getSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
  if (!auth.user)
    redirect(
      `/auth/sign-in?next=${encodeURIComponent("/create/" + step + "?" + params)}`,
    );
  let row = null;
  if (query.id) {
    const result = await supabase
      .from("outfit_requests")
      .select()
      .eq("id", query.id)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (!result.data) notFound();
    row = result.data;
    if (row.status === "submitted") redirect(`/requests/${row.id}`);
  }
  const draft = row ? validateDraft(row.draft) : EMPTY_DRAFT;
  const urls: Record<string, string> = {};
  await Promise.all(
    draft.inspirations.map(async (i) => {
      if (!i.key.startsWith(`${auth.user!.id}/${row?.id}/`)) return;
      const signed = await createInspirationDisplayUrl(supabase, i.key, 800);
      if (signed) urls[i.key] = signed.signedUrl;
    }),
  );
  const { data: saved } = await supabase
    .from("measurement_profiles")
    .select("measurements")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  let context = "";
  if (row?.design_id) {
    const { data } = await supabase
      .from("designs")
      .select("title")
      .eq("id", row.design_id)
      .maybeSingle();
    context = data?.title ?? "";
  } else if (row?.boutique_id) {
    const { data } = await supabase
      .from("boutiques")
      .select("name")
      .eq("id", row.boutique_id)
      .maybeSingle();
    context = data?.name ?? "";
  }
  return (
    <RequestWizard
      key={`${row?.id ?? "new"}-${step}`}
      step={step}
      initial={draft}
      requestId={row?.id ?? null}
      version={row?.version ?? 0}
      sources={{ boutique: query.boutique, design: query.design }}
      context={context}
      initialUrls={urls}
      savedMeasurements={
        saved
          ? validateDraft({ measurements: saved.measurements }).measurements
          : null
      }
    />
  );
}
