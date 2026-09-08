"use client";

import { sendWithProgress } from "@faden/ui";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useRef, useState } from "react";

const CATEGORIES = [
  ["business_registration", "Business registration"],
  ["pan_document", "PAN document"],
  ["address_proof", "Registered address proof"],
  ["gst_certificate", "GST certificate (if registered)"],
  ["authorized_representative_id", "Representative ID"],
  ["other_supporting_document", "Other supporting document"],
] as const;
const REQUIRED_CATEGORIES = new Set([
  "business_registration",
  "pan_document",
  "address_proof",
]);
const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const MAX_BYTES = 15 * 1024 * 1024;

type Document = {
  id: string;
  category: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  status: string;
  storage_object_key: string;
  uploaded_at: string;
};

export type VerificationSubmission = {
  id: string;
  status: string;
  version: number;
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
  authorized_rep_name: string;
  authorized_rep_role: string;
  contact_email: string;
  contact_phone: string;
  declaration_version: string;
  admin_decision_reason: string | null;
  submitted_at: string | null;
};

function title(status: string) {
  return (
    {
      draft: "Draft",
      submitted: "Submitted for review",
      changes_requested: "Changes requested",
      approved: "Verified",
      rejected: "Not approved",
    }[status] ?? status
  );
}

function detailsFrom(form: HTMLFormElement) {
  const data = new FormData(form);
  const optional = new Set([
    "public_trading_name",
    "gstin",
    "registered_address_line2",
  ]);
  return Object.fromEntries(
    [
      "legal_business_name",
      "public_trading_name",
      "business_type",
      "registration_number",
      "gstin",
      "pan",
      "registered_address_line1",
      "registered_address_line2",
      "city",
      "state",
      "postal_code",
      "authorized_rep_name",
      "authorized_rep_role",
      "contact_email",
      "contact_phone",
    ].map((key) => {
      const value = String(data.get(key) ?? "").trim();
      return [key, value || (optional.has(key) ? null : value)];
    }),
  );
}

function formatBytes(value: number) {
  return value < 1024 * 1024
    ? `${Math.ceil(value / 1024)} KB`
    : `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

async function command(body: Record<string, unknown>) {
  const response = await fetch("/api/verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as { error?: string } & Record<
    string,
    unknown
  >;
  if (!response.ok)
    throw new Error(data.error || "Could not update verification.");
  return data;
}

export function VerificationForm({
  boutique,
  initialSubmission,
  initialDocuments,
}: {
  boutique: { id: string; name: string; status: string };
  initialSubmission: VerificationSubmission | null;
  initialDocuments: Document[];
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [submission] = useState(initialSubmission);
  const [documents, setDocuments] = useState(initialDocuments);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const editable =
    !submission ||
    ["draft", "changes_requested", "rejected"].includes(submission.status);
  const canSubmit =
    submission && ["draft", "changes_requested"].includes(submission.status);
  const requiredReady = useMemo(
    () =>
      [...REQUIRED_CATEGORIES].every((category) =>
        documents.some((document) => document.category === category),
      ),
    [documents],
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const details = detailsFrom(event.currentTarget);
      const data =
        submission && submission.status !== "rejected"
          ? await command({
              action: "update_draft",
              submission_id: submission.id,
              version: submission.version,
              details,
            })
          : await command({
              action: "create_draft",
              boutique_id: boutique.id,
              details,
            });
      const submissionId = String(data.submission_id ?? submission?.id ?? "");
      if (!submissionId) throw new Error("The draft could not be created.");
      setMessage(
        "Draft saved. Attach the required documents, then submit it for review.",
      );
      window.location.assign("/verification");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save the draft.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function upload(category: string, file: File | undefined) {
    if (
      !file ||
      !submission ||
      !["draft", "changes_requested"].includes(submission.status)
    )
      return;
    if (
      !ACCEPTED_TYPES.has(file.type) ||
      file.size <= 0 ||
      file.size > MAX_BYTES
    ) {
      setError("Choose a JPG, PNG, WebP or PDF document under 15 MB.");
      return;
    }
    setUploading(category);
    setError("");
    try {
      const signed = await fetch("/api/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sign-upload",
          bucket: "verification-documents",
          subjectId: boutique.id,
          mimeType: file.type,
          byteSize: file.size,
        }),
      });
      const grant = (await signed.json()) as {
        error?: string;
        path?: string;
        signedUrl?: string;
      };
      if (!signed.ok || !grant.path || !grant.signedUrl)
        throw new Error(grant.error || "Could not prepare the upload.");
      const put = await sendWithProgress({
        url: grant.signedUrl,
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (put.status >= 400)
        throw new Error("The document upload failed. Please retry.");
      try {
        await command({
          action: "attach_document",
          submission_id: submission.id,
          category,
          storage_object_key: grant.path,
          file_name: file.name,
          file_size_bytes: file.size,
          mime_type: file.type,
        });
      } catch (caught) {
        await fetch("/api/storage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "remove",
            bucket: "verification-documents",
            path: grant.path,
          }),
        }).catch(() => undefined);
        throw caught;
      }
      setMessage("Document attached to your draft.");
      window.location.assign("/verification");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not attach the document.",
      );
    } finally {
      setUploading(null);
    }
  }

  async function remove(document: Document) {
    if (!submission || !window.confirm(`Remove ${document.file_name}?`)) return;
    setBusy(true);
    setError("");
    try {
      await command({
        action: "remove_document",
        submission_id: submission.id,
        document_id: document.id,
      });
      await fetch("/api/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove",
          bucket: "verification-documents",
          path: document.storage_object_key,
        }),
      });
      setDocuments((current) =>
        current.filter((item) => item.id !== document.id),
      );
      setMessage("Document removed from this draft.");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not remove the document.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!submission || !canSubmit || !requiredReady || busy) return;
    setBusy(true);
    setError("");
    try {
      await command({
        action: "submit",
        submission_id: submission.id,
        version: submission.version,
      });
      setMessage("Your verification has been submitted for FADEN review.");
      window.location.assign("/verification");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not submit verification.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="verification-owner-page">
      <header className="studio-page-heading">
        <div>
          <p className="eyebrow">Trust &amp; safety</p>
          <h1>Verify {boutique.name}</h1>
          <p>
            Business information and documents are private. FADEN reviews them
            before your boutique can operate.
          </p>
        </div>
        <span
          className={`verification-status verification-status--${submission?.status ?? "new"}`}
        >
          {title(submission?.status ?? "new")}
        </span>
      </header>

      {submission?.admin_decision_reason && (
        <section className="verification-notice" aria-label="Review feedback">
          <strong>
            {submission.status === "changes_requested"
              ? "Changes requested"
              : "Review decision"}
          </strong>
          <p>{submission.admin_decision_reason}</p>
        </section>
      )}
      {submission?.status === "submitted" && (
        <section className="verification-notice">
          <strong>Your application is being reviewed.</strong>
          <p>
            You can view the submitted information below. Changes are locked
            while it is under review.
          </p>
        </section>
      )}
      {submission?.status === "approved" && (
        <section className="verification-notice verification-notice--success">
          <strong>Your boutique is verified.</strong>
          <p>Verification does not publish your boutique automatically.</p>
        </section>
      )}
      {submission?.status === "rejected" && (
        <section className="verification-notice verification-notice--warning">
          <strong>You may start a new application.</strong>
          <p>Use the information below to prepare a corrected submission.</p>
        </section>
      )}

      <form ref={form} className="verification-owner-form" onSubmit={save}>
        <fieldset disabled={!editable || busy}>
          <section className="verification-owner-card">
            <h2>Business details</h2>
            <div className="verification-owner-grid">
              <label>
                Legal business name
                <input
                  name="legal_business_name"
                  required
                  maxLength={200}
                  defaultValue={submission?.legal_business_name ?? ""}
                />
              </label>
              <label>
                Trading name <span>(optional)</span>
                <input
                  name="public_trading_name"
                  maxLength={200}
                  defaultValue={submission?.public_trading_name ?? ""}
                />
              </label>
              <label>
                Business type
                <input
                  name="business_type"
                  required
                  maxLength={100}
                  defaultValue={submission?.business_type ?? ""}
                  placeholder="Proprietorship, LLP, private limited…"
                />
              </label>
              <label>
                Registration number
                <input
                  name="registration_number"
                  required
                  maxLength={50}
                  defaultValue={submission?.registration_number ?? ""}
                />
              </label>
              <label>
                PAN
                <input
                  name="pan"
                  required
                  maxLength={10}
                  pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]"
                  defaultValue={submission?.pan ?? ""}
                  style={{ textTransform: "uppercase" }}
                />
              </label>
              <label>
                GSTIN <span>(if registered)</span>
                <input
                  name="gstin"
                  maxLength={15}
                  defaultValue={submission?.gstin ?? ""}
                  style={{ textTransform: "uppercase" }}
                />
              </label>
            </div>
          </section>
          <section className="verification-owner-card">
            <h2>Registered address</h2>
            <div className="verification-owner-grid">
              <label className="verification-owner-grid__wide">
                Address line 1
                <input
                  name="registered_address_line1"
                  required
                  maxLength={200}
                  defaultValue={submission?.registered_address_line1 ?? ""}
                />
              </label>
              <label className="verification-owner-grid__wide">
                Address line 2 <span>(optional)</span>
                <input
                  name="registered_address_line2"
                  maxLength={200}
                  defaultValue={submission?.registered_address_line2 ?? ""}
                />
              </label>
              <label>
                City
                <input
                  name="city"
                  required
                  maxLength={100}
                  defaultValue={submission?.city ?? ""}
                />
              </label>
              <label>
                State
                <input
                  name="state"
                  required
                  maxLength={100}
                  defaultValue={submission?.state ?? ""}
                />
              </label>
              <label>
                PIN code
                <input
                  name="postal_code"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  defaultValue={submission?.postal_code ?? ""}
                />
              </label>
            </div>
          </section>
          <section className="verification-owner-card">
            <h2>Authorized representative</h2>
            <div className="verification-owner-grid">
              <label>
                Full name
                <input
                  name="authorized_rep_name"
                  required
                  maxLength={200}
                  defaultValue={submission?.authorized_rep_name ?? ""}
                />
              </label>
              <label>
                Role
                <input
                  name="authorized_rep_role"
                  required
                  maxLength={100}
                  defaultValue={submission?.authorized_rep_role ?? ""}
                />
              </label>
              <label>
                Email
                <input
                  name="contact_email"
                  type="email"
                  required
                  maxLength={255}
                  defaultValue={submission?.contact_email ?? ""}
                />
              </label>
              <label>
                Phone
                <input
                  name="contact_phone"
                  type="tel"
                  required
                  maxLength={20}
                  defaultValue={submission?.contact_phone ?? ""}
                />
              </label>
            </div>
          </section>
          {editable && (
            <button className="studio-button" type="submit">
              {busy
                ? "Saving…"
                : submission?.status === "rejected"
                  ? "Start new application"
                  : "Save draft"}
            </button>
          )}
        </fieldset>
      </form>

      {submission && (
        <section className="verification-owner-card verification-documents-card">
          <div>
            <h2>Verification documents</h2>
            <p>JPG, PNG, WebP or PDF. Images up to 10 MB; PDFs up to 15 MB.</p>
          </div>
          <div className="verification-document-list">
            {CATEGORIES.map(([category, label]) => {
              const files = documents.filter(
                (document) => document.category === category,
              );
              return (
                <div className="verification-document-row" key={category}>
                  <div>
                    <strong>{label}</strong>
                    {REQUIRED_CATEGORIES.has(category) && (
                      <span className="verification-required">Required</span>
                    )}
                    {files.map((document) => (
                      <p key={document.id}>
                        {document.file_name} ·{" "}
                        {formatBytes(document.file_size_bytes)}{" "}
                        {editable && document.status !== "submitted" && (
                          <button
                            type="button"
                            onClick={() => void remove(document)}
                          >
                            Remove
                          </button>
                        )}
                      </p>
                    ))}
                  </div>
                  {editable && (
                    <label className="studio-button ghost verification-upload-button">
                      {uploading === category ? "Uploading…" : "Attach"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        disabled={Boolean(uploading)}
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          event.currentTarget.value = "";
                          void upload(category, file);
                        }}
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
          {canSubmit && (
            <div className="verification-submit">
              <p>
                {requiredReady
                  ? "Required documents are attached. Confirm the information is accurate before submitting."
                  : "Attach business registration, PAN and registered-address proof before submitting."}
              </p>
              <button
                className="studio-button"
                type="button"
                disabled={busy || Boolean(uploading) || !requiredReady}
                onClick={() => void submit()}
              >
                {busy ? "Submitting…" : "Submit for review"}
              </button>
            </div>
          )}
        </section>
      )}
      {(message || error) && (
        <p
          className={error ? "studio-error" : "form-message"}
          role={error ? "alert" : "status"}
        >
          {error || message}
        </p>
      )}
    </section>
  );
}
