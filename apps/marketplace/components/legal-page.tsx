import Link from "next/link";
import { MarketplaceHeader } from "./marketplace-header";
import { MarketplaceFooter } from "./marketplace-footer";

type LegalPageProps = {
  title: string;
  updated: string;
  children: React.ReactNode;
};
export function LegalPage({ title, updated, children }: LegalPageProps) {
  return (
    <div className="market-page legal-page">
      <MarketplaceHeader active="atelier" />
      <main className="legal-page__main">
        <Link className="offer-kicker" href="/">
          ← FADEN
        </Link>
        <h1>{title}</h1>
        <p className="legal-page__updated">Last updated: {updated}</p>
        <div className="legal-page__content">{children}</div>
      </main>
      <MarketplaceFooter />
    </div>
  );
}
