import { redirect } from "next/navigation";

import { StudioFrame } from "../../components/studio-frame";
import { getSupabaseServerClient } from "../../lib/supabase/server";
import {
  VerificationForm,
  type VerificationSubmission,
} from "./verification-form";

export default async function VerificationPage() {
  const supabase = await getSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/auth/sign-in?next=/verification");

  const { data: boutique } = await supabase
    .from("boutiques")
    .select("id, name, status")
    .eq("owner_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!boutique) redirect("/onboarding");

  const { data: submission } = await supabase
    .from("boutique_verification_submissions")
    .select("*")
    .eq("boutique_id", boutique.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: documents } = submission
    ? await supabase
        .from("boutique_verification_documents")
        .select(
          "id, category, file_name, file_size_bytes, mime_type, status, storage_object_key, uploaded_at",
        )
        .eq("submission_id", submission.id)
        .order("uploaded_at")
    : { data: [] };

  return (
    <StudioFrame active="verification" name={boutique.name}>
      <VerificationForm
        boutique={{
          id: boutique.id,
          name: boutique.name,
          status: boutique.status,
        }}
        initialSubmission={submission as VerificationSubmission | null}
        initialDocuments={documents ?? []}
      />
    </StudioFrame>
  );
}
