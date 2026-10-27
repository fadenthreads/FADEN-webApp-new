"use client";

import { createFadenBrowserClient } from "@faden/supabase";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { MarketIcon } from "./market-icon";
import { readSavedItem, insertSavedItem } from "../lib/saved-items.mjs";

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
  const revision = useRef(0);
  useEffect(() => setSaved(initialSaved), [initialSaved]);
  useEffect(() => {
    let active = true;
    async function restore() {
      const version = revision.current;
      try {
        // Local session is for UI hydration only; Storage/database RLS still
        // authorizes every query. Do not add blocking auth to discovery SSR.
        const { data } = await supabase.auth.getSession();
        const result = await readSavedItem(
          supabase,
          kind,
          entityId,
          data.session?.user.id,
        );
        if (active && version === revision.current && !result.error)
          setSaved(result.saved);
      } catch {
        // Browsing remains usable when the optional saved-state read fails.
      }
    }
    void restore();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT")
        queueMicrotask(() => {
          if (active) void restore();
        });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [supabase, kind, entityId]);

  async function toggleSaved() {
    revision.current++;
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
            : await insertSavedItem(supabase, kind, entityId, data.user.id)
          : saved
            ? await supabase
                .from("saved_boutiques")
                .delete()
                .eq("user_id", data.user.id)
                .eq("boutique_id", entityId)
            : await insertSavedItem(supabase, kind, entityId, data.user.id);

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
