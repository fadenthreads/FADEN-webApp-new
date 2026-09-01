"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function DesignDecision({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [decision, setDecision] = useState<"approved" | "changes_requested">(
    "approved",
  );
  const [feedback, setFeedback] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const response = await fetch("/api/design-reviews", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reviewId, decision, feedback, confirmed }),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error);
          router.refresh();
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Could not record your decision.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        <legend>Your decision</legend>
        <label className="design-confirm">
          <input
            type="radio"
            name="decision"
            checked={decision === "approved"}
            onChange={() => {
              setDecision("approved");
              setConfirmed(false);
            }}
          />
          I Love It — Approve Design
        </label>
        <label className="design-confirm">
          <input
            type="radio"
            name="decision"
            checked={decision === "changes_requested"}
            onChange={() => {
              setDecision("changes_requested");
              setConfirmed(false);
            }}
          />
          Request Changes
        </label>
        <label htmlFor="design-feedback">
          {decision === "changes_requested"
            ? "What would you like changed?"
            : "Feedback (optional)"}
        </label>
        <textarea
          id="design-feedback"
          rows={4}
          maxLength={2000}
          minLength={decision === "changes_requested" ? 10 : undefined}
          required={decision === "changes_requested"}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
        <label className="design-confirm">
          <input
            type="checkbox"
            checked={confirmed}
            required
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I reviewed this version. I understand this records my decision and
          does not start production or change prices.
        </label>
        <button className="design-primary" disabled={!confirmed || busy}>
          {busy ? "Recording…" : "Confirm decision"}
        </button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
