"use client";

import { SignOutButton } from "@faden/auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { AdminIcon } from "./admin-icon";
import {
  ADMIN_COMMERCE_NAV,
  ADMIN_PRIMARY_NAV,
  isAdminNavActive,
  isCommerceSubnavVisible,
  shouldCloseMobileMenu,
} from "../lib/admin-nav";

export function AdminMobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add("admin-mobile-menu-open");
    firstLinkRef.current?.focus();
    return () => document.body.classList.remove("admin-mobile-menu-open");
  }, [open]);

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (shouldCloseMobileMenu(event.key)) {
        event.preventDefault();
        close();
        menuButtonRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  return (
    <div className="admin-mobile-nav">
      <button
        ref={menuButtonRef}
        type="button"
        className="admin-icon-button admin-mobile-nav__toggle"
        aria-label="Open admin navigation menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <AdminIcon name="menu" />
      </button>

      {open && (
        <button
          type="button"
          className="admin-mobile-nav__backdrop"
          aria-label="Close admin navigation menu"
          onClick={close}
        />
      )}

      <div
        id={menuId}
        className={`admin-mobile-nav__drawer${open ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
        hidden={!open}
      >
        <div className="admin-mobile-nav__drawer-header">
          <span className="admin-mobile-nav__wordmark">FADEN Admin</span>
          <button
            type="button"
            className="admin-icon-button"
            aria-label="Close admin navigation menu"
            onClick={close}
          >
            <AdminIcon name="close" />
          </button>
        </div>
        <nav aria-label="Admin navigation">
          <ul className="admin-nav-list">
            {ADMIN_PRIMARY_NAV.map((item, index) => {
              const active = isAdminNavActive(pathname, item);
              return (
                <li key={item.key}>
                  <Link
                    ref={index === 0 ? firstLinkRef : undefined}
                    href={item.href}
                    className={`admin-nav-link${active ? " is-active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    onClick={close}
                  >
                    <AdminIcon name={item.icon} filled={active} />
                    <span>{item.label}</span>
                  </Link>
                  {item.section === "commerce" &&
                    isCommerceSubnavVisible(pathname) && (
                      <ul className="admin-subnav-list">
                        {ADMIN_COMMERCE_NAV.map((child) => {
                          const childActive = isAdminNavActive(pathname, child);
                          return (
                            <li key={child.key}>
                              <Link
                                href={child.href}
                                className={`admin-subnav-link${childActive ? " is-active" : ""}`}
                                aria-current={childActive ? "page" : undefined}
                                onClick={close}
                              >
                                {child.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="admin-mobile-nav__footer">
          <SignOutButton redirectTo="/auth/sign-in" />
        </div>
      </div>
    </div>
  );
}
