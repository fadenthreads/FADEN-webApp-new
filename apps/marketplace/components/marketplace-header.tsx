"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MarketIcon } from "./market-icon";

const links = [
  ["home", "Home", "/"],
  ["boutiques", "Boutiques", "/discover?type=boutiques"],
  ["designs", "Designs", "/discover?type=designs"],
  ["materials", "Materials", "/discover?type=materials"],
  ["atelier", "Atelier", "/requests"],
];

export function MarketplaceHeader({ active }: { active?: string }) {
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 761px)");
    const resize = () => {
      if (desktop.matches) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    desktop.addEventListener("change", resize);
    return () => {
      document.removeEventListener("pointerdown", outside);
      desktop.removeEventListener("change", resize);
    };
  }, [open]);
  return (
    <header
      className="market-header"
      ref={header}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <nav aria-label="Marketplace navigation">
        {links.map(([key, label, href]) => (
          <Link
            key={key}
            href={href}
            aria-current={active === key ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <Link className="market-logo" href="/" aria-label="FADEN home">
        <Image
          src="/stitch-assets/asset-049.jpg"
          alt="FADEN"
          width={240}
          height={48}
          priority
          unoptimized
        />
      </Link>
      <div className="market-actions">
        <Link
          aria-label="Saved pieces"
          href="/saved"
          className="market-action market-action--desktop"
        >
          <MarketIcon name="bag" />
        </Link>
        <Link
          aria-label="Your account"
          href="/account"
          className="market-action market-action--desktop"
        >
          <MarketIcon name="person" />
        </Link>
        <button
          ref={toggle}
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          className="market-action market-menu"
          type="button"
          onClick={() => setOpen(!open)}
        >
          <MarketIcon name={open ? "close" : "menu"} />
        </button>
      </div>
      {open && (
        <nav
          id="mobile-navigation"
          className="mobile-navigation"
          aria-label="Mobile navigation"
        >
          {links.map(([key, label, href]) => (
            <Link
              href={href}
              key={key}
              aria-current={active === key ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          ))}
          <Link href="/saved" onClick={() => setOpen(false)}>
            Saved pieces
          </Link>
          <Link href="/style-assistance" onClick={() => setOpen(false)}>
            Find shoppers or stylists
          </Link>
          <Link href="/account" onClick={() => setOpen(false)}>
            Your account
          </Link>
          <Link href="/orders" onClick={() => setOpen(false)}>
            My orders & updates
          </Link>
          <Link href="/auth/sign-in" onClick={() => setOpen(false)}>
            Sign in
          </Link>
          <Link
            className="mobile-register-link"
            href="/auth/sign-in?action=sign-up"
            onClick={() => setOpen(false)}
          >
            Register
          </Link>
          <Link href="/contact" onClick={() => setOpen(false)}>
            Contact & help
          </Link>
        </nav>
      )}
    </header>
  );
}
