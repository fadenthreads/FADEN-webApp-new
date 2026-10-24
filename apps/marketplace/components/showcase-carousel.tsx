"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  normalizeShowcasePosition,
  showcaseGroup,
  showcaseGestureMoved,
} from "../lib/showcase-motion.mjs";
import { useQuickViewScrollLock } from "./use-quick-view-scroll-lock";

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
  const openedWithKeyboard = useRef(false);
  const resumeAt = useRef(0);
  const [selected, setSelected] = useState<ShowcaseItem | null>(null);
  const group = showcaseGroup(items);
  const groupSize = group.length;
  const geometry = useRef({ width: 0, step: 0 });
  const touchActive = useRef(false);
  const hovered = useRef(false);
  const keyboardFocus = useRef(false);
  const manualScroll = useRef(false);
  const lastScroll = useRef(0);
  const gesture = useRef({ x: 0, y: 0, moved: false });
  useQuickViewScrollLock(Boolean(selected));

  function loopWidth() {
    return geometry.current.width;
  }

  function normalizeLoop() {
    const element = rail.current;
    const width = loopWidth();
    if (!element || !width || items.length < 2) return;
    // All three sets are identical, so crossing into the middle set is invisible.
    if (element.scrollLeft < width || element.scrollLeft >= width * 2)
      element.scrollLeft = normalizeShowcasePosition(element.scrollLeft, width);
  }

  useEffect(() => {
    const element = rail.current;
    if (!element || items.length < 2) return;
    const measure = () => {
      const cards = element.querySelectorAll<HTMLElement>(".showcase-card");
      if (!cards[groupSize] || !cards[1]) return;
      const first = cards[0].getBoundingClientRect().left;
      const width = cards[groupSize].getBoundingClientRect().left - first;
      const step = cards[1].getBoundingClientRect().left - first;
      const old = geometry.current;
      const fraction = old.width
        ? (normalizeShowcasePosition(element.scrollLeft, old.width) -
            old.width) /
          old.width
        : 0;
      geometry.current = { width, step };
      element.scrollLeft = width * (1 + fraction);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
    // The repeated sets change only when the catalogue changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupSize]);

  function move(direction: number) {
    resumeAt.current = performance.now() + 1400;
    manualScroll.current = true;
    const element = rail.current;
    if (!element || items.length < 2) return;
    const step = geometry.current.step;
    normalizeLoop();
    element.scrollTo({
      left: element.scrollLeft + direction * step,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }

  useEffect(() => {
    if (selected || items.length < 2) return;
    let frame = 0;
    let previous = 0;
    let position = rail.current?.scrollLeft ?? 0;
    let visible = false;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
    };
    const start = () => {
      stop();
      if (visible && !document.hidden && !motion.matches)
        frame = requestAnimationFrame(animate);
    };
    function animate(time: number) {
      const element = rail.current;
      if (
        element &&
        (touchActive.current ||
          hovered.current ||
          keyboardFocus.current ||
          time < resumeAt.current ||
          (manualScroll.current && time - lastScroll.current < 250))
      ) {
        position = element.scrollLeft;
        previous = time;
        frame = requestAnimationFrame(animate);
        return;
      }
      if (element && !document.hidden && previous) {
        if (manualScroll.current) {
          normalizeLoop();
          position = element.scrollLeft;
          manualScroll.current = false;
        }
        position += Math.min(time - previous, 50) * 0.028;
        position = normalizeShowcasePosition(position, loopWidth());
        element.scrollLeft = position;
        if (Math.abs(element.scrollLeft - position) > 2)
          position = element.scrollLeft;
      }
      previous = time;
      frame = requestAnimationFrame(animate);
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      position = rail.current?.scrollLeft ?? 0;
      start();
    });
    if (rail.current) observer.observe(rail.current);
    document.addEventListener("visibilitychange", start);
    motion.addEventListener("change", start);
    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", start);
      motion.removeEventListener("change", start);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, groupSize]);

  useEffect(() => {
    if (!selected) return;
    dialog.current?.showModal();
  }, [selected]);

  function close() {
    dialog.current?.close();
    setSelected(null);
    resumeAt.current = performance.now() + 1400;
    trigger.current?.focus({ preventScroll: true });
    keyboardFocus.current = openedWithKeyboard.current;
  }

  return (
    <section className="home-showcase" aria-label={eyebrow}>
      <div className="home-showcase__heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <a href={href}>
          {href.includes("boutiques")
            ? "View all boutiques"
            : href.includes("materials")
              ? "View all materials"
              : "View all clothing"}{" "}
          <span aria-hidden="true">↗</span>
        </a>
      </div>
      {items.length ? (
        <>
          <div
            className="showcase-rail"
            ref={rail}
            onScroll={() => {
              if (manualScroll.current) lastScroll.current = performance.now();
            }}
            onTouchStart={() => {
              touchActive.current = true;
              manualScroll.current = true;
            }}
            onTouchEnd={() => {
              resumeAt.current = performance.now() + 1400;
              touchActive.current = false;
            }}
            onTouchCancel={() => {
              resumeAt.current = performance.now() + 1400;
              touchActive.current = false;
            }}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") hovered.current = true;
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") hovered.current = false;
            }}
            onPointerDown={(event) => {
              gesture.current = {
                x: event.clientX,
                y: event.clientY,
                moved: false,
              };
            }}
            onPointerMove={(event) => {
              if (event.buttons || touchActive.current)
                gesture.current.moved ||= showcaseGestureMoved(
                  gesture.current,
                  { x: event.clientX, y: event.clientY },
                );
            }}
            onPointerCancel={() => {
              gesture.current.moved = true;
            }}
            onWheel={() => {
              manualScroll.current = true;
              resumeAt.current = performance.now() + 1400;
            }}
            onFocusCapture={(event) => {
              keyboardFocus.current = event.target.matches(":focus-visible");
            }}
            onBlurCapture={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget))
                keyboardFocus.current = false;
            }}
            aria-label={`${eyebrow} cards`}
          >
            {(items.length > 1 ? [...group, ...group, ...group] : items).map(
              (item, index) => (
                <button
                  className="showcase-card"
                  key={`${item.id}-${index}`}
                  tabIndex={
                    items.length > 1 &&
                    (index < groupSize || index >= groupSize * 2)
                      ? -1
                      : 0
                  }
                  onClick={(e) => {
                    if (gesture.current.moved && e.detail !== 0) {
                      e.preventDefault();
                      return;
                    }
                    trigger.current = e.currentTarget;
                    openedWithKeyboard.current = e.detail === 0;
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
                onClick={() => move(-1)}
                aria-label={`Previous ${eyebrow}`}
              >
                ←
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
