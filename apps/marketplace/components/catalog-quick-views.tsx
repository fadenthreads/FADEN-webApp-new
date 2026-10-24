"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ShowcaseItem } from "./showcase-carousel";
import { useQuickViewScrollLock } from "./use-quick-view-scroll-lock";

/** Keep catalogue links usable without JavaScript and open their quick view when hydrated. */
export function CatalogQuickViews({
  items,
  children,
}: {
  items: ShowcaseItem[];
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<ShowcaseItem | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLAnchorElement | null>(null);
  useQuickViewScrollLock(Boolean(selected));

  useEffect(() => {
    if (!selected) return;
    dialog.current?.showModal();
  }, [selected]);

  function close() {
    dialog.current?.close();
    setSelected(null);
    trigger.current?.focus({ preventScroll: true });
  }

  return (
    <>
      <div
        onClick={(event) => {
          if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          const anchor = (
            event.target as HTMLElement
          ).closest<HTMLAnchorElement>("a[href]");
          if (
            !anchor ||
            !event.currentTarget.contains(anchor) ||
            anchor.target === "_blank"
          )
            return;
          const item = items.find(
            (value) => value.href === anchor.getAttribute("href"),
          );
          if (!item) return;
          event.preventDefault();
          trigger.current = anchor;
          setSelected(item);
        }}
      >
        {children}
      </div>
      <dialog
        ref={dialog}
        className="showcase-dialog"
        aria-label={selected ? `Quick view: ${selected.title}` : "Quick view"}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        {selected && (
          <div className="showcase-dialog__body">
            <button
              className="showcase-dialog__close"
              onClick={close}
              aria-label="Close quick view"
              autoFocus
            >
              ×
            </button>
            <Image
              src={selected.image}
              alt={selected.title}
              width={600}
              height={800}
              unoptimized
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = "/image-placeholder.svg";
              }}
            />
            <div className="showcase-dialog__copy">
              <p className="eyebrow">{selected.subtitle}</p>
              <h2>{selected.title}</h2>
              <p>{selected.description}</p>
              <p>{selected.detail}</p>
              <a className="button button--primary" href={selected.href}>
                {selected.action} →
              </a>
              <button className="showcase-dialog__back" onClick={close}>
                Keep exploring
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
