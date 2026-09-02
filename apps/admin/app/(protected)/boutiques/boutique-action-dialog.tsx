"use client";

import { useState, useEffect } from "react";

type BoutiqueActionDialogProps = {
  boutiqueId: string;
  boutiqueName: string;
  action: "suspend" | "restore";
  onClose: () => void;
  onSuccess: () => void;
};

export function BoutiqueActionDialog({
  boutiqueId,
  boutiqueName,
  action,
  onClose,
  onSuccess,
}: BoutiqueActionDialogProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const isSuspend = action === "suspend";
  const title = isSuspend ? "Suspend Boutique" : "Restore Boutique";
  const verb = isSuspend ? "suspend" : "restore";
  const requiresConfirmation = isSuspend;

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isSubmitting, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!reason.trim()) {
      setError(`Please provide a reason for ${verb}ing this boutique.`);
      return;
    }

    if (requiresConfirmation && !confirmed) {
      setError("Please confirm this action by checking the box.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/boutiques", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          boutique_id: boutiqueId,
          reason: reason.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to ${verb} boutique`);
      }

      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to ${verb} boutique`,
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div className="boutique-dialog-backdrop" onClick={onClose}>
      <div
        className="boutique-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="dialog-title"
        aria-modal="true"
      >
        <div className="boutique-dialog__header">
          <h2 id="dialog-title" className="boutique-dialog__title">
            {isSuspend && (
              <span className="material-symbols-outlined boutique-dialog__icon boutique-dialog__icon--warning">
                warning
              </span>
            )}
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="boutique-dialog__close"
            aria-label="Close dialog"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="boutique-dialog__body">
          <div className="boutique-dialog__notice">
            <p>
              You are about to {verb}{" "}
              <strong>&ldquo;{boutiqueName}&rdquo;</strong>.
            </p>
            {isSuspend && (
              <p className="boutique-dialog__warning">
                This will immediately unpublish the boutique and prevent new
                orders. Existing orders will continue.
              </p>
            )}
          </div>

          <div className="boutique-dialog__field">
            <label htmlFor="action-reason" className="boutique-dialog__label">
              Reason <span className="boutique-dialog__required">*</span>
            </label>
            <textarea
              id="action-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
              className="boutique-dialog__textarea"
              rows={4}
              placeholder={
                isSuspend
                  ? "e.g., Policy violation, customer complaints, pending investigation..."
                  : "e.g., Appeal approved, investigation complete, misunderstanding resolved..."
              }
              required
              aria-describedby={error ? "action-error" : undefined}
            />
            {error && (
              <p
                id="action-error"
                className="boutique-dialog__error"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>

          {requiresConfirmation && (
            <div className="boutique-dialog__confirmation">
              <label className="boutique-dialog__checkbox-label">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  disabled={isSubmitting}
                  className="boutique-dialog__checkbox"
                />
                <span>
                  I confirm that I want to suspend this boutique. This action
                  will be audited.
                </span>
              </label>
            </div>
          )}

          <div className="boutique-dialog__actions">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="boutique-dialog__button boutique-dialog__button--secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`boutique-dialog__button ${
                isSuspend
                  ? "boutique-dialog__button--danger"
                  : "boutique-dialog__button--primary"
              }`}
            >
              {isSubmitting ? (
                <>
                  <span className="boutique-dialog__spinner" aria-hidden="true">
                    <span className="material-symbols-outlined">
                      progress_activity
                    </span>
                  </span>
                  {isSuspend ? "Suspending..." : "Restoring..."}
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">
                    {isSuspend ? "block" : "restore"}
                  </span>
                  {title}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
