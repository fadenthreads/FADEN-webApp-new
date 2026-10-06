"use client";

import { useState } from "react";

export function PreviewDesignActions() {
  const [mode, setMode] = useState<
    "idle" | "changes" | "approved" | "changes_submitted"
  >("idle");
  const [feedback, setFeedback] = useState("");

  if (mode === "approved") {
    return (
      <div className="design-preview-result" role="status">
        <strong>Sample design approved.</strong>
        <p>
          In a real order this records the decision and lets the atelier begin
          production. This preview has not changed any order.
        </p>
        <button className="design-secondary" onClick={() => setMode("idle")}>
          Reset preview
        </button>
      </div>
    );
  }

  if (mode === "changes_submitted") {
    return (
      <div className="design-preview-result" role="status">
        <strong>Sample change request sent.</strong>
        <p>
          In a real order the atelier would see your feedback and publish a new
          version. This preview has not changed any order.
        </p>
        <button className="design-secondary" onClick={() => setMode("idle")}>
          Reset preview
        </button>
      </div>
    );
  }

  if (mode === "changes") {
    return (
      <div className="design-preview-result">
        <label htmlFor="preview-feedback">What would you like changed?</label>
        <textarea
          id="preview-feedback"
          minLength={10}
          maxLength={2000}
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder="For example: Please soften the neckline and show a warmer gold thread."
        />
        <button
          className="design-primary"
          disabled={feedback.trim().length < 10}
          onClick={() => setMode("changes_submitted")}
        >
          Submit sample feedback
        </button>
        <button className="design-secondary" onClick={() => setMode("idle")}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <>
      <button className="design-primary" onClick={() => setMode("approved")}>
        I Love It — Try Approval
      </button>
      <button className="design-secondary" onClick={() => setMode("changes")}>
        Try Requesting Changes
      </button>
    </>
  );
}
