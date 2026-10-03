"use client";
import Image from "next/image";
import Link from "next/link";
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
            <Link href={href} key={key} onClick={() => setOpen(false)}>
              {label}
            </Link>
          ))}
          <Link href="/saved" onClick={() => setOpen(false)}>
            Saved pieces
          </Link>
          <Link href="/account" onClick={() => setOpen(false)}>
            Your account
          </Link>
        </nav>
      )}
    </header>
  );
}
