import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "@faden/auth";
export function AtelierShell({
  children,
  name = "Boutique Studio",
  active = "requests",
}: {
  children: ReactNode;
  name?: string;
  active?: string;
}) {
  return (
    <div className="atelier-layout">
      <aside className="atelier-sidebar">
        <Link href="/" className="atelier-brand">
          FADEN
        </Link>
        <p>{name}</p>
        <nav aria-label="Atelier navigation">
          {[
            ["overview", "/", "Overview"],
            ["requests", "/requests", "Requests"],
            ["offers", "/offers", "Offers"],
            ["orders", "/orders", "Orders"],
            ["production", "/production", "Production Board"],
            ["appointments", "/appointments", "Measurement sessions"],
            ["portfolio", "/portfolio", "Portfolio"],
          ].map(([key, href, label]) => (
            <Link
              key={key}
              href={href}
              aria-current={key === active ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="offer-actions">
          <SignOutButton redirectTo="/auth/sign-in" />
        </div>
      </aside>
      <main className="atelier-main">{children}</main>
    </div>
  );
}
