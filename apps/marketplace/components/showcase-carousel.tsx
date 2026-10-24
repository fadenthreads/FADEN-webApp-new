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
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);

  function move(direction: number) {
    const element = rail.current;
    if (!element || items.length < 2) return;
    const card = element.querySelector<HTMLElement>(".showcase-card");
    const step = (card?.offsetWidth ?? 300) + 24;
    const end = element.scrollWidth - element.clientWidth;
    const next = element.scrollLeft + direction * step;
    element.scrollTo({
      left: next > end + 2 ? 0 : next < -2 ? end : next,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }

  useEffect(() => {
    if (
      paused ||
      interacting ||
      selected ||
      items.length < 2 ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const timer = setInterval(() => {
      if (!document.hidden) move(1);
    }, 4500);
    return () => clearInterval(timer);
    // Movement reads the current rail position, including manual scrolling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, interacting, selected, items.length]);

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
            onMouseEnter={() => setInteracting(true)}
            onMouseLeave={() => setInteracting(false)}
            onFocusCapture={() => setInteracting(true)}
            onBlurCapture={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget))
                setInteracting(false);
            }}
            aria-label={`${eyebrow} cards`}
          >
            {items.map((item) => (
              <button
                className="showcase-card"
                key={item.id}
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
            ))}
          </div>
          {items.length > 1 && (
            <div className="showcase-controls">
              <button
                onClick={() => move(-1)}
                aria-label={`Previous ${eyebrow}`}
              >
                ←
              </button>
              <button onClick={() => setPaused(!paused)} aria-pressed={paused}>
                {paused ? "Play slideshow" : "Pause slideshow"}
              </button>
              <button onClick={() => move(1)} aria-label={`Next ${eyebrow}`}>
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
