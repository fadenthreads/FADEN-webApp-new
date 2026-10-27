import { redirect } from "next/navigation";
import Link from "next/link";

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

  if (boutique.status === "verified" && submission?.status !== "approved") {
    return (
      <StudioFrame active="verification" name={boutique.name}>
        <section className="studio-empty">
          <h1>Your boutique has Admin approval</h1>
          <p>
            You can operate on FADEN without official documents at this
            early-launch stage. This is marketplace approval, not confirmation
            that official documents were verified.
          </p>
          <div className="studio-actions">
            <Link className="studio-button" href="/storefront">
              Manage storefront
            </Link>
            <Link className="studio-button ghost" href="/portfolio">
              Manage portfolio
            </Link>
          </div>
        </section>
      </StudioFrame>
    );
  }

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
