"use client";
import Image from "next/image";
import { useState } from "react";
import { MarketIcon } from "./market-icon";

const links = [
  ["boutiques", "Boutiques", "/discover?type=boutiques"],
  ["designs", "Designs", "/discover?type=designs"],
  ["materials", "Materials", "/discover?type=materials"],
  ["atelier", "Atelier", "/requests"],
];

export function MarketplaceHeader({ active }: { active?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header
      className="market-header"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <nav aria-label="Marketplace navigation">
        {links.map(([key, label, href]) => (
          <a
            key={key}
            href={href}
            aria-current={active === key ? "page" : undefined}
          >
            {label}
          </a>
        ))}
      </nav>
      <a className="market-logo" href="/" aria-label="FADEN home">
        <Image
          src="/stitch-assets/asset-049.jpg"
          alt="FADEN"
          width={240}
          height={48}
          priority
          unoptimized
        />
      </a>
      <div className="market-actions">
        <a
          aria-label="Saved pieces"
          href="/saved"
          className="market-action market-action--desktop"
        >
          <MarketIcon name="bag" />
        </a>
        <a
          aria-label="Your account"
          href="/account"
          className="market-action market-action--desktop"
        >
          <MarketIcon name="person" />
        </a>
        <button
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
            <a href={href} key={key}>
              {label}
            </a>
          ))}
          <a href="/saved">Saved pieces</a>
          <a href="/account">Your account</a>
        </nav>
      )}
    </header>
  );
}
