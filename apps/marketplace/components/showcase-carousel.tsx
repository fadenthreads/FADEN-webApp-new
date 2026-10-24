"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

export interface ShowcaseItem {
  id: string;
  title: string;
  image: string;
  subtitle: string;
  description: string;
  detail: string;
  href: string;
  action: string;
}

export function ShowcaseCarousel({
  title,
  eyebrow,
  items,
  href,
}: {
  title: string;
  eyebrow: string;
  items: ShowcaseItem[];
  href: string;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [selected, setSelected] = useState<ShowcaseItem | null>(null);
  const [interacting, setInteracting] = useState(false);

  function loopWidth() {
    const card = rail.current?.querySelector<HTMLElement>(".showcase-card");
    return card ? (card.offsetWidth + 24) * items.length : 0;
  }

  function normalizeLoop() {
    const element = rail.current;
    const width = loopWidth();
    if (!element || !width || items.length < 2) return;
    // All three sets are identical, so crossing into the middle set is invisible.
    if (element.scrollLeft < width / 2) element.scrollLeft += width;
    else if (element.scrollLeft >= width * 2) element.scrollLeft -= width;
  }

  useEffect(() => {
    const element = rail.current;
    if (!element || items.length < 2) return;
    element.scrollLeft = loopWidth();
    const observer = new ResizeObserver(() => {
      element.scrollLeft = loopWidth();
    });
    observer.observe(element);
    return () => observer.disconnect();
    // The repeated sets change only when the catalogue changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  function move(direction: number) {
    const element = rail.current;
    if (!element || items.length < 2) return;
    const card = element.querySelector<HTMLElement>(".showcase-card");
    const step = (card?.offsetWidth ?? 300) + 24;
    normalizeLoop();
    element.scrollTo({
      left: element.scrollLeft + direction * step,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }

  useEffect(() => {
    if (
      interacting ||
      selected ||
      items.length < 2 ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let frame = 0;
    let previous = 0;
    let position = rail.current?.scrollLeft ?? 0;
    function animate(time: number) {
      const element = rail.current;
      if (element && !document.hidden && previous) {
        position += Math.min(time - previous, 50) * 0.028;
        element.scrollLeft = position;
        normalizeLoop();
        if (Math.abs(element.scrollLeft - position) > 2)
          position = element.scrollLeft;
      }
      previous = time;
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interacting, selected, items.length]);

  useEffect(() => {
    if (!selected) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [selected]);

  function close() {
    dialog.current?.close();
    setSelected(null);
    trigger.current?.focus();
  }

  return (
    <section className="home-showcase" aria-label={eyebrow}>
      <div className="home-showcase__heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <a href={href}>
          Explore all <span aria-hidden="true">↗</span>
        </a>
      </div>
      {items.length ? (
        <>
          <div
            className="showcase-rail"
            ref={rail}
            onScroll={normalizeLoop}
            onTouchStart={() => setInteracting(true)}
            onTouchEnd={() => setInteracting(false)}
            onMouseEnter={() => setInteracting(true)}
            onMouseLeave={() => setInteracting(false)}
            onFocusCapture={() => setInteracting(true)}
            onBlurCapture={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget))
                setInteracting(false);
            }}
            aria-label={`${eyebrow} cards`}
          >
            {(items.length > 1 ? [...items, ...items, ...items] : items).map(
              (item, index) => (
                <button
                  className="showcase-card"
                  key={`${item.id}-${index}`}
                  tabIndex={
                    items.length > 1 &&
                    (index < items.length || index >= items.length * 2)
                      ? -1
                      : 0
                  }
                  onClick={(e) => {
                    trigger.current = e.currentTarget;
                    setSelected(item);
                  }}
                  aria-haspopup="dialog"
                  aria-label={`Quick view: ${item.title}`}
                >
                  <div className="showcase-card__image">
                    <Image
                      width={600}
                      height={800}
                      unoptimized
                      src={item.image}
                      alt={item.title}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "/image-placeholder.svg";
                      }}
                    />
                    <span>
                      Quick view <span aria-hidden="true">+</span>
                    </span>
                  </div>
                  <div className="showcase-card__copy">
                    <p>{item.subtitle}</p>
                    <h3>{item.title}</h3>
                    <span>{item.detail}</span>
                  </div>
                </button>
              ),
            )}
          </div>
          {items.length > 1 && (
            <div className="showcase-controls">
              <button
                onMouseEnter={() => setInteracting(true)}
                onMouseLeave={() => setInteracting(false)}
                onClick={() => move(-1)}
                aria-label={`Previous ${eyebrow}`}
              >
                ←
              </button>
              <button
                onMouseEnter={() => setInteracting(true)}
                onMouseLeave={() => setInteracting(false)}
                onClick={() => move(1)}
                aria-label={`Next ${eyebrow}`}
              >
                →
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="showcase-empty">
          <p>
            Our collection is taking shape. Discover more from our boutiques.
          </p>
          <a href={href}>Browse the collection →</a>
        </div>
      )}
      <dialog
        className="showcase-dialog"
        ref={dialog}
        aria-label={selected ? `Quick view: ${selected.title}` : "Quick view"}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
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
              width={600}
              height={800}
              unoptimized
              src={selected.image}
              alt={selected.title}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "/image-placeholder.svg";
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
    </section>
  );
}
