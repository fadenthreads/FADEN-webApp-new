"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type VerificationDocument = {
  id: string;
  category: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  status: string;
  uploaded_at: string;
  storage_object_key: string;
};

type VerificationEvent = {
  id: number;
  event_type: string;
  actor_id: string;
  actor_role: string;
  metadata: Record<string, unknown>;
  reason: string | null;
  created_at: string;
};

type VerificationDetails = {
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
  documents: VerificationDocument[];
  events: VerificationEvent[];
};

type DecisionAction = "approve" | "request_changes" | "reject";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function maskPAN(pan: string): string {
  if (pan.length !== 10) return pan;
  return `XXX${pan.substring(3, 7)}X`;
}

function maskGSTIN(gstin: string | null): string | null {
  if (!gstin || gstin.length !== 15) return gstin;
  return `XX${gstin.substring(2, 7)}XXXXX`;
}

const REQUIRED_CATEGORIES = [
  "business_registration",
  "pan_document",
  "address_proof",
];

const CATEGORY_LABELS: Record<string, string> = {
  business_registration: "Business Registration",
  gst_certificate: "GST Certificate",
  pan_document: "PAN Document",
  address_proof: "Address Proof",
  authorized_representative_id: "Authorized Representative ID",
  other_supporting_document: "Other Supporting Document",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  changes_requested: "Changes Requested",
  approved: "Approved",
  rejected: "Rejected",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "gray",
  submitted: "blue",
  changes_requested: "yellow",
  approved: "green",
  rejected: "red",
};

export function VerificationDetailView({
  details,
}: {
  details: VerificationDetails;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDecisionForm, setShowDecisionForm] = useState(false);
  const [selectedAction, setSelectedAction] = useState<DecisionAction | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(
    null,
  );

  const canMakeDecision = details.status === "submitted";

  const requiredDocs = REQUIRED_CATEGORIES.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat] || cat,
    present: details.documents.some((doc) => doc.category === cat),
  }));

  const allRequiredPresent = requiredDocs.every((doc) => doc.present);

  async function handleDecision() {
    if (!selectedAction || !reason.trim() || !confirmed) {
      setError("Please provide a reason and confirm your decision.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: selectedAction,
          submission_id: details.id,
          reason: reason.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to process decision");
      }

      // Redirect back to boutique list or refresh
      router.push("/boutiques?refresh=1");
      router.refresh();
    } catch (err) {
      console.error("Decision error:", err);
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
      setIsSubmitting(false);
    }
  }

  function openDecisionForm(action: DecisionAction) {
    setSelectedAction(action);
    setShowDecisionForm(true);
    setReason("");
    setConfirmed(false);
    setError(null);
  }

  function closeDecisionForm() {
    setShowDecisionForm(false);
    setSelectedAction(null);
    setReason("");
    setConfirmed(false);
    setError(null);
  }

  async function openDocument(document: VerificationDocument) {
    setOpeningDocumentId(document.id);
    setError(null);
    try {
      const response = await fetch("/api/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sign-download",
          bucket: "verification-documents",
          path: document.storage_object_key,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        signedUrl?: string;
      };
      if (!response.ok || !data.signedUrl) {
        throw new Error(data.error || "This document is not available.");
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "This document is not available.",
      );
    } finally {
      setOpeningDocumentId(null);
    }
  }

  return (
    <div className="verification-detail">
      <div className="verification-summary">
        <div className="verification-summary__header">
          <div>
            <h2>{details.boutique_name}</h2>
            <p className="verification-summary__slug">
              /{details.boutique_slug}
            </p>
          </div>
          <div className="verification-summary__status">
            <span
              className={`status-badge status-badge--${STATUS_COLORS[details.status] || "gray"}`}
            >
              {STATUS_LABELS[details.status] || details.status}
            </span>
          </div>
        </div>

        {details.submitted_at && (
          <p className="verification-summary__meta">
            Submitted {formatDate(details.submitted_at)} by{" "}
            {details.owner_display_name || details.owner_email}
          </p>
        )}

        {details.admin_decision_reason && (
          <div className="verification-decision-reason">
            <h3>Admin Decision</h3>
            <p>{details.admin_decision_reason}</p>
            {details.reviewed_at && (
              <p className="verification-decision-reason__meta">
                Reviewed {formatDate(details.reviewed_at)}
              </p>
            )}
          </div>
        )}
        {error && !showDecisionForm && (
          <p className="verification-warning" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="verification-sections">
        <section className="verification-section">
          <h3>Business Details</h3>
          <dl className="verification-details-list">
            <dt>Legal Business Name</dt>
            <dd>{details.legal_business_name}</dd>

            {details.public_trading_name && (
              <>
                <dt>Trading Name</dt>
                <dd>{details.public_trading_name}</dd>
              </>
            )}

            <dt>Business Type</dt>
            <dd>{details.business_type}</dd>

            <dt>Registration Number</dt>
            <dd>{details.registration_number}</dd>

            {details.gstin && (
              <>
                <dt>GSTIN</dt>
                <dd>{maskGSTIN(details.gstin)}</dd>
              </>
            )}

            <dt>PAN</dt>
            <dd>{maskPAN(details.pan)}</dd>
          </dl>
        </section>

        <section className="verification-section">
          <h3>Registered Address</h3>
          <dl className="verification-details-list">
            <dt>Address</dt>
            <dd>
              {details.registered_address_line1}
              {details.registered_address_line2 && (
                <>
                  <br />
                  {details.registered_address_line2}
                </>
              )}
            </dd>

            <dt>City</dt>
            <dd>{details.city}</dd>

            <dt>State</dt>
            <dd>{details.state}</dd>

            <dt>Postal Code</dt>
            <dd>{details.postal_code}</dd>

            <dt>Country</dt>
            <dd>{details.country}</dd>
          </dl>
        </section>

        <section className="verification-section">
          <h3>Authorized Representative</h3>
          <dl className="verification-details-list">
            <dt>Name</dt>
            <dd>{details.authorized_rep_name}</dd>

            <dt>Role</dt>
            <dd>{details.authorized_rep_role}</dd>

            <dt>Contact Email</dt>
            <dd>{details.contact_email}</dd>

            <dt>Contact Phone</dt>
            <dd>{details.contact_phone}</dd>
          </dl>
        </section>

        <section className="verification-section">
          <h3>Required Documents</h3>
          <div className="verification-required-docs">
            {requiredDocs.map((doc) => (
              <div key={doc.category} className="verification-required-doc">
                <span
                  className={`material-symbols-outlined ${doc.present ? "text-green-600" : "text-red-600"}`}
                >
                  {doc.present ? "check_circle" : "cancel"}
                </span>
                <span>{doc.label}</span>
              </div>
            ))}
          </div>

          {!allRequiredPresent && (
            <p className="verification-warning">
              <span className="material-symbols-outlined">warning</span>
              Not all required documents are present
            </p>
          )}
        </section>

        <section className="verification-section">
          <h3>Submitted Documents</h3>
          {details.documents.length === 0 ? (
            <p className="verification-empty">No documents submitted</p>
          ) : (
            <div className="verification-documents">
              {details.documents.map((doc) => (
                <div key={doc.id} className="verification-document">
                  <div className="verification-document__info">
                    <span className="material-symbols-outlined">
                      description
                    </span>
                    <div>
                      <p className="verification-document__name">
                        {doc.file_name}
                      </p>
                      <p className="verification-document__meta">
                        {CATEGORY_LABELS[doc.category] || doc.category} •{" "}
                        {formatFileSize(doc.file_size_bytes)}
                      </p>
                    </div>
                  </div>
                  <div className="verification-document__actions">
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      disabled={openingDocumentId === doc.id}
                      onClick={() => void openDocument(doc)}
                    >
                      <span className="material-symbols-outlined">
                        download
                      </span>
                      {openingDocumentId === doc.id ? "Opening…" : "Open"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {canMakeDecision && (
        <div className="verification-actions">
          <h3>Review Actions</h3>
          <div className="verification-actions__buttons">
            <button
              type="button"
              className="btn-success"
              onClick={() => openDecisionForm("approve")}
              disabled={isSubmitting || !allRequiredPresent}
            >
              <span className="material-symbols-outlined">check_circle</span>
              Approve Verification
            </button>
            <button
              type="button"
              className="btn-warning"
              onClick={() => openDecisionForm("request_changes")}
              disabled={isSubmitting}
            >
              <span className="material-symbols-outlined">edit</span>
              Request Changes
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => openDecisionForm("reject")}
              disabled={isSubmitting}
            >
              <span className="material-symbols-outlined">cancel</span>
              Reject Verification
            </button>
          </div>
        </div>
      )}

      {showDecisionForm && selectedAction && (
        <div className="modal-overlay" onClick={closeDecisionForm}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {selectedAction === "approve"
                  ? "Approve Verification"
                  : selectedAction === "request_changes"
                    ? "Request Changes"
                    : "Reject Verification"}
              </h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeDecisionForm}
                aria-label="Close"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="modal-body">
              <div className="form-field">
                <label htmlFor="decision-reason">
                  Reason (required)
                  {selectedAction === "request_changes" && (
                    <span className="form-hint">
                      Explain what needs to be updated
                    </span>
                  )}
                </label>
                <textarea
                  id="decision-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    selectedAction === "approve"
                      ? "Document why this verification is approved..."
                      : selectedAction === "request_changes"
                        ? "Explain what information or documents need to be updated..."
                        : "Document the reason for rejection..."
                  }
                  rows={4}
                  maxLength={2000}
                  disabled={isSubmitting}
                  required
                />
                <p className="form-meta">{reason.length}/2000 characters</p>
              </div>

              <div className="form-field">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    disabled={isSubmitting}
                  />
                  <span>
                    I confirm this decision and understand it will{" "}
                    {selectedAction === "approve"
                      ? "verify the boutique"
                      : selectedAction === "request_changes"
                        ? "move the boutique back to draft status"
                        : "reject the boutique"}
                  </span>
                </label>
              </div>

              {error && (
                <div className="alert alert-error">
                  <span className="material-symbols-outlined">error</span>
                  {error}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={closeDecisionForm}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  selectedAction === "approve"
                    ? "btn-success"
                    : selectedAction === "request_changes"
                      ? "btn-warning"
                      : "btn-danger"
                }
                onClick={handleDecision}
                disabled={isSubmitting || !reason.trim() || !confirmed}
              >
                {isSubmitting ? (
                  <>
                    <span className="material-symbols-outlined spinning">
                      progress_activity
                    </span>
                    Processing...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">
                      {selectedAction === "approve"
                        ? "check_circle"
                        : selectedAction === "request_changes"
                          ? "edit"
                          : "cancel"}
                    </span>
                    Confirm{" "}
                    {selectedAction === "approve"
                      ? "Approval"
                      : selectedAction === "request_changes"
                        ? "Changes Request"
                        : "Rejection"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
