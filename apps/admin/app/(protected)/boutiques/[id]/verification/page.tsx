import { notFound } from "next/navigation";
import { Suspense } from "react";

import { requireAdminSession } from "../../../../../lib/admin-session";
import { VerificationDetailView } from "./verification-detail-view";

type PageProps = {
  params: Promise<{ id: string }>;
};

async function VerificationLoader({ boutiqueId }: { boutiqueId: string }) {
  const { supabase } = await requireAdminSession();

  // Fetch latest submission for this boutique
  const { data: submissions, error: submissionsError } = await supabase
    .from("boutique_verification_submissions")
    .select("id, status, submitted_at")
    .eq("boutique_id", boutiqueId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (submissionsError) {
    console.error("Failed to load verification submissions:", submissionsError);
    return (
      <div className="admin-overview-error">
        <span className="material-symbols-outlined admin-icon">error</span>
        <div className="admin-overview-error__message">
          <p>
            <strong>Unable to load verification</strong>
          </p>
          <p>
            The verification submission could not be retrieved. Check your
            permissions and try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  if (!submissions || submissions.length === 0) {
    return (
      <div className="admin-overview-empty">
        <span className="material-symbols-outlined admin-icon">
          pending_actions
        </span>
        <div className="admin-overview-empty__message">
          <p>
            <strong>No verification submitted</strong>
          </p>
          <p>This boutique has not yet submitted a verification request.</p>
        </div>
      </div>
    );
  }

  const submission = submissions[0];

  // Fetch complete submission details via RPC
  const { data: detailsRaw, error: detailsError } = await supabase.rpc(
    "admin_read_verification_submission",
    {
      p_submission_id: submission.id,
    },
  );

  if (detailsError || !detailsRaw) {
    console.error("Failed to load verification details:", detailsError);
    return (
      <div className="admin-overview-error">
        <span className="material-symbols-outlined admin-icon">error</span>
        <div className="admin-overview-error__message">
          <p>
            <strong>Unable to load verification details</strong>
          </p>
          <p>
            The verification details could not be retrieved. Please try again.
          </p>
        </div>
      </div>
    );
  }

  // Type assertion for JSON result from RPC
  const details = detailsRaw as unknown as {
    id: string;
    boutique_id: string;
    boutique_name: string;
    boutique_slug: string;
    boutique_status: string;
    submitting_owner_id: string;
    owner_display_name: string | null;
    owner_email: string;
    legal_business_name: string;
    public_trading_name: string | null;
    business_type: string;
    registration_number: string;
    gstin: string | null;
    pan: string;
    registered_address_line1: string;
    registered_address_line2: string | null;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    authorized_rep_name: string;
    authorized_rep_role: string;
    contact_email: string;
    contact_phone: string;
    status: string;
    declaration_version: string;
    submitted_at: string | null;
    reviewed_at: string | null;
    reviewing_admin_id: string | null;
    admin_decision_reason: string | null;
    created_at: string;
    updated_at: string;
    version: number;
    documents: Array<{
      id: string;
      category: string;
      file_name: string;
      file_size_bytes: number;
      mime_type: string;
      status: string;
      uploaded_at: string;
      storage_object_key: string;
    }>;
    events: Array<{
      id: number;
      event_type: string;
      actor_id: string;
      actor_role: string;
      metadata: Record<string, unknown>;
      reason: string | null;
      created_at: string;
    }>;
  };

  return <VerificationDetailView details={details} />;
}

function VerificationLoading() {
  return (
    <div className="admin-overview-loading">
      <span className="material-symbols-outlined admin-icon">
        progress_activity
      </span>
      <span>Loading verification details...</span>
    </div>
  );
}

export default async function VerificationPage({ params }: PageProps) {
  const { id } = await params;

  if (!id || typeof id !== "string") {
    notFound();
  }

  return (
    <div className="verification-admin-page">
      <div className="admin-page-header">
        <h1>Boutique Verification</h1>
        <p>
          Review and approve, request changes, or reject the boutique
          verification submission.
        </p>
      </div>

      <Suspense fallback={<VerificationLoading />}>
        <VerificationLoader boutiqueId={id} />
      </Suspense>
    </div>
  );
}
