import Link from "next/link";
import type { ReactNode } from "react";

import { AdminMobileNav } from "./admin-mobile-nav";
import { AdminSidebarFooter, AdminSidebarNav } from "./admin-sidebar-nav";
import { AdminIcon } from "./admin-icon";
import type { AdminSession } from "../lib/admin-session";
import { getAdminPageMeta } from "../lib/admin-nav";

export function AdminShell({
  session,
  pathname,
  children,
}: {
  session: AdminSession;
  pathname: string;
  children: ReactNode;
}) {
  const page = getAdminPageMeta(pathname);
  const environment = process.env.NEXT_PUBLIC_APP_ENV || "development";
  const identity = session.displayName ?? session.email;

  return (
    <div className="admin-app">
      <a className="admin-skip-link" href="#admin-main">
        Skip to content
      </a>

      <aside className="admin-sidebar" aria-label="Admin sidebar">
        <div className="admin-sidebar__brand">
          <div className="admin-sidebar__logo" aria-hidden="true">
            <span>F</span>
          </div>
          <div>
            <Link className="admin-sidebar__title" href="/">
              FADEN
            </Link>
            <p className="admin-sidebar__subtitle">Platform Admin</p>
          </div>
        </div>

        <AdminSidebarNav />
        <AdminSidebarFooter />
      </aside>

      <div className="admin-shell__main">
        <header className="admin-topbar">
          <div className="admin-topbar__start">
            <AdminMobileNav />
            <div className="admin-topbar__context">
              <span className="admin-topbar__product">FADEN Admin</span>
              <span className="admin-topbar__divider" aria-hidden="true" />
              <span className="admin-topbar__page">{page.title}</span>
            </div>
          </div>

          <div className="admin-topbar__end">
            <div
              className="admin-identity"
              aria-label="Signed-in administrator"
            >
              <span className="admin-identity__name">{identity}</span>
              <span className="admin-identity__email">{session.email}</span>
            </div>

            <span
              className="admin-mfa-pill admin-mfa-pill--verified"
              title="Multi-factor authentication assurance level"
            >
              MFA · AAL2
            </span>

            <div
              className="admin-environment-pill"
              aria-label="Deployment environment"
            >
              <span
                className="admin-environment-pill__dot"
                aria-hidden="true"
              />
              <span>{environment}</span>
            </div>

            <button
              type="button"
              className="admin-icon-button"
              aria-label="Security center (coming soon)"
              disabled
            >
              <AdminIcon name="security" />
            </button>
          </div>
        </header>

        <main id="admin-main" className="admin-shell__content">
          <div className="admin-page-header">
            <div>
              <h1>{page.title}</h1>
              <p>{page.description}</p>
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
