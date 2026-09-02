"use client";

import { SignOutButton } from "@faden/auth";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AdminIcon } from "./admin-icon";
import {
  ADMIN_COMMERCE_NAV,
  ADMIN_PRIMARY_NAV,
  isAdminNavActive,
  isCommerceSubnavVisible,
} from "../lib/admin-nav";

export function AdminSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-sidebar__nav" aria-label="Admin navigation">
      <ul className="admin-nav-list">
        {ADMIN_PRIMARY_NAV.map((item) => {
          const active = isAdminNavActive(pathname, item);
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                className={`admin-nav-link${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
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
  );
}

export function AdminSidebarFooter() {
  return (
    <div className="admin-sidebar__footer">
      <SignOutButton redirectTo="/auth/sign-in" />
    </div>
  );
}
