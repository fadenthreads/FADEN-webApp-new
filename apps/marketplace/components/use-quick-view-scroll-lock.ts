"use client";

import { useEffect } from "react";

/** Body overflow alone does not reliably lock the background on mobile Safari. */
export function useQuickViewScrollLock(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const position = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    Object.assign(body.style, {
      position: "fixed",
      top: `-${position}px`,
      width: "100%",
      overflow: "hidden",
    });
    return () => {
      Object.assign(body.style, previous);
      window.scrollTo({ top: position, behavior: "instant" });
    };
  }, [open]);
}
