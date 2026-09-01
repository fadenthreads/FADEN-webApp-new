import type { ReactNode } from "react";

export type ShellKind = "marketplace" | "studio" | "admin";

export interface FadenShellProps {
  children: ReactNode;
  kind: ShellKind;
}

const marketplaceUrl = (
  process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3000"
).replace(/\/$/, "");

const globalNavigation = [
  { href: `${marketplaceUrl}/discover?type=boutiques`, label: "Boutiques" },
  { href: `${marketplaceUrl}/designs`, label: "Designs" },
  { href: `${marketplaceUrl}/discover?type=materials`, label: "Materials" },
  { href: `${marketplaceUrl}/account`, label: "Atelier" },
];

const studioNavigation = [
  { href: "/", label: "Overview" },
  { href: "/requests", label: "Requests" },
  { href: "/production", label: "Production" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/analytics", label: "Analytics" },
];

const adminNavigation = [
  { href: "/", label: "Overview" },
  { href: "/boutiques", label: "Marketplace" },
  { href: "/orders", label: "Commerce" },
  { href: "/disputes", label: "Trust & Support" },
  { href: "/settings", label: "Platform" },
  { href: "/audit", label: "Administration" },
];

function GlobalHeader() {
  return (
    <header className="faden-header faden-header--global">
      <a
        className="faden-wordmark"
        href={marketplaceUrl}
        aria-label="FADEN home"
      >
        FADEN
      </a>
      <nav className="faden-nav" aria-label="FADEN navigation">
        {globalNavigation.map((item, index) => (
          <a
            className={index === 0 ? "is-active" : ""}
            href={item.href}
            key={item.label}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <div className="faden-header__actions">
        <a
          className="shell-icon-link"
          aria-label="Open marketplace"
          href={`${marketplaceUrl}/saved`}
        >
          ◇
        </a>
        <a
          className="shell-icon-link"
          aria-label="Open account"
          href={`${marketplaceUrl}/account`}
        >
          ○
        </a>
      </div>
    </header>
  );
}

function StudioShell({ children }: { children: ReactNode }) {
  return (
    <div className="faden-shell faden-shell--studio">
      <GlobalHeader />
      <div className="studio-shell__layout">
        <aside className="studio-sidebar">
          <p>Aarya Studio</p>
          <nav aria-label="Boutique Studio navigation">
            {studioNavigation.map((item, index) => (
              <a
                className={index === 0 ? "is-active" : ""}
                href={item.href}
                key={item.label}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>
        <main className="studio-shell__content">{children}</main>
      </div>
    </div>
  );
}

function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="faden-shell faden-shell--admin">
      <aside className="admin-sidebar">
        <div>
          <a className="admin-sidebar__brand" href="/">
            FADEN
          </a>
          <span>Administration</span>
        </div>
        <nav aria-label="Admin navigation">
          {adminNavigation.map((item, index) => (
            <a
              className={index === 0 ? "is-active" : ""}
              href={item.href}
              key={item.label}
            >
              <span aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="admin-sidebar__footer">
          <a href="/account">Profile</a>
          <a href="/auth/sign-in">Logout</a>
        </div>
      </aside>
      <div className="admin-shell__main">
        <header className="admin-topbar">
          <div>
            <strong>FADEN Admin</strong>
            <span>Overview</span>
          </div>
          <div>
            <span className="environment-pill">
              {process.env.NEXT_PUBLIC_APP_ENV || "development"}
            </span>
            <a className="shell-icon-link" href="/" aria-label="Admin profile">
              ○
            </a>
          </div>
        </header>
        <main className="admin-shell__content">{children}</main>
      </div>
    </div>
  );
}

export function FadenShell({ children, kind }: FadenShellProps) {
  if (kind === "admin") return <AdminShell>{children}</AdminShell>;
  if (kind === "studio") return <StudioShell>{children}</StudioShell>;

  return (
    <div className="faden-shell faden-shell--marketplace">
      <GlobalHeader />
      <main>{children}</main>
    </div>
  );
}
