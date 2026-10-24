"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

export function OrderUpdateRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) router.refresh();
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);
  return (
    <div className="offer-actions">
      <p>Order updates refresh automatically while you’re here.</p>
      <button
        className="offer-btn secondary"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        {pending ? "Refreshing…" : "Refresh updates"}
      </button>
    </div>
  );
}
