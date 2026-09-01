"use client";
import { useState } from "react";
import { MarketIcon } from "./market-icon";
import { SaveButton } from "./save-button";

export function DetailHeader({
  kind,
  entityId,
  initialSaved,
  returnPath,
  title,
}: {
  kind: "boutique" | "design";
  entityId: string;
  initialSaved: boolean;
  returnPath: string;
  title: string;
}) {
  const [message, setMessage] = useState("");
  async function share() {
    try {
      if (navigator.share)
        await navigator.share({ title, url: window.location.href });
      else {
        await navigator.clipboard.writeText(window.location.href);
        setMessage("Link copied.");
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError"))
        setMessage(
          "Unable to share. You can copy the address from your browser.",
        );
    }
  }
  return (
    <header className="detail-mobile-header">
      <a
        href={
          kind === "design"
            ? "/discover?type=designs"
            : "/discover?type=boutiques"
        }
        aria-label="Back to discovery"
      >
        <MarketIcon name="back" />
      </a>
      <div>
        <SaveButton
          compact
          kind={kind}
          entityId={entityId}
          initialSaved={initialSaved}
          returnPath={returnPath}
        />
        <button aria-label="Share" onClick={share}>
          <MarketIcon name="share" />
        </button>
      </div>
      {message && (
        <span role="status" className="share-status">
          {message}
        </span>
      )}
    </header>
  );
}
