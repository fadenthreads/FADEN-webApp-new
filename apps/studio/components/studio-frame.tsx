import Link from "next/link";
import { SignOutButton } from "@faden/auth";
import type { ReactNode } from "react";
export function marketplaceUrl() {
  return process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3000";
}
export function StudioFrame({
  children,
  name,
  active,
  demo = false,
}: {
  children: ReactNode;
  name: string;
  active: "overview" | "portfolio";
  demo?: boolean;
}) {
  const links = [
    ["overview", demo ? "/preview/overview" : "/", "Overview"],
    ["requests", "/requests", "Requests"],
    ["offers", "/offers", "Offers"],
    ["orders", "/orders", "Orders"],
    ["production", "/production", "Production"],
    ["appointments", "/appointments", "Appointments"],
    ["portfolio", demo ? "/preview/portfolio" : "/portfolio", "Portfolio"],
  ];
  const navigation = (
    <nav aria-label="Studio navigation">
      {links.map(([key, href, label]) => (
        <Link
          key={key}
          href={href}
          aria-current={active === key ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
  return (
    <div
      className={`studio-refresh ${active === "overview" ? "studio-overview-shell" : "studio-portfolio-shell"}`}
    >
      <header className="studio-top">
        <Link
          className="studio-wordmark"
          href={demo ? "/preview/overview" : "/"}
        >
          {active === "overview" ? "FADEN" : "ATELIER ADMIN"}
        </Link>
        {active === "overview" ? (
          <nav aria-label="Marketplace links">
            {["Boutiques", "Designs", "Materials", "Atelier"].map(
              (label, i) => (
                <a
                  key={label}
                  href={
                    marketplaceUrl() +
                    (i === 3
                      ? "/requests"
                      : `/discover?type=${label.toLowerCase()}`)
                  }
                >
                  {label}
                </a>
              ),
            )}
          </nav>
        ) : (
          <span className="studio-boutique-select">Boutique Select</span>
        )}
        <a href={marketplaceUrl() + "/account"}>Account ↗</a>
        <details className="studio-mobile-menu">
          <summary>Menu</summary>
          <div className="studio-mobile-menu-panel">
            {navigation}
            {!demo && <SignOutButton redirectTo="/auth/sign-in" />}
          </div>
        </details>
      </header>
      <div className="studio-workspace">
        <aside className="studio-local-nav">
          <p>{name}</p>
          {navigation}
          {demo ? (
            <p className="studio-muted">Fictional preview</p>
          ) : (
            <SignOutButton redirectTo="/auth/sign-in" />
          )}
        </aside>
        <main className="studio-canvas">
          {demo && (
            <p className="studio-preview-note">
              Fictional Stitch preview · No customer records. Editing and
              publishing are disabled; private workspace links require sign-in.
            </p>
          )}
          {children}
        </main>
      </div>
      {active === "overview" && (
        <footer className="studio-footer">
          <strong>FADEN</strong>
          <span>© 2026 FADEN ATELIER</span>
          <Link href={demo ? "/preview/portfolio" : "/portfolio"}>
            Portfolio
          </Link>
          <a href={marketplaceUrl()}>Marketplace ↗</a>
        </footer>
      )}
    </div>
  );
}
