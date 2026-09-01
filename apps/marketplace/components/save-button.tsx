"use client";

import { createFadenBrowserClient } from "@faden/supabase";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MarketIcon } from "./market-icon";

interface SaveButtonProps {
  compact?: boolean;
  entityId: string;
  initialSaved: boolean;
  kind: "boutique" | "design";
  returnPath: string;
}

export function SaveButton({
  compact = false,
  entityId,
  initialSaved,
  kind,
  returnPath,
}: SaveButtonProps) {
  const router = useRouter();
  const supabase = useMemo(() => createFadenBrowserClient(), []);
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setSaved(initialSaved), [initialSaved]);

  async function toggleSaved() {
    setBusy(true);
    setError("");
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push(`/auth/sign-in?next=${encodeURIComponent(returnPath)}`);
        return;
      }

      const result =
        kind === "design"
          ? saved
            ? await supabase
                .from("saved_designs")
                .delete()
                .eq("user_id", data.user.id)
                .eq("design_id", entityId)
            : await supabase
                .from("saved_designs")
                .insert({ design_id: entityId, user_id: data.user.id })
          : saved
            ? await supabase
                .from("saved_boutiques")
                .delete()
                .eq("user_id", data.user.id)
                .eq("boutique_id", entityId)
            : await supabase
                .from("saved_boutiques")
                .insert({ boutique_id: entityId, user_id: data.user.id });

      if (!result.error) {
        setSaved(!saved);
        router.refresh();
      } else setError("Could not update your saved items. Please try again.");
    } catch {
      setError("Connection interrupted. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        aria-label={saved ? `Remove saved ${kind}` : `Save ${kind}`}
        aria-pressed={saved}
        className={`save-button${compact ? " save-button--compact" : ""}${saved ? " is-saved" : ""}`}
        disabled={busy}
        onClick={toggleSaved}
        type="button"
      >
        <MarketIcon name="heart" />
        {!compact && (saved ? "Saved to Inspiration" : "Save to Inspiration")}
      </button>
      {error && (
        <span className="save-error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
