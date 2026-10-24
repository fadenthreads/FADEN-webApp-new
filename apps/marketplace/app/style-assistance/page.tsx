import Link from "next/link";
import { MarketplaceHeader } from "../../components/marketplace-header";
import { MarketplaceFooter } from "../../components/marketplace-footer";
import { fadenContact } from "@faden/ui";

export const metadata = { title: "Find shoppers or stylists — FADEN" };

export default function StyleAssistancePage() {
  return (
    <div className="market-page">
      <MarketplaceHeader />
      <main className="style-assistance">
        <p className="eyebrow">A little expert guidance</p>
        <h1>Find shoppers or stylists</h1>
        <p>
          Tell FADEN what you have in mind. Our team can help you explore
          available personal shopping or styling support.
        </p>
        <div className="style-assistance__grid">
          {[
            {
              title: "Personal shopper",
              text: "Help finding boutiques, comparing pieces, and choosing fabrics within your budget.",
              subject: "Personal shopper enquiry",
            },
            {
              title: "Fashion stylist",
              text: "Guidance on silhouettes, occasion dressing, colour combinations, and completing your look.",
              subject: "Fashion stylist enquiry",
            },
          ].map((option) => (
            <section key={option.title}>
              <h2>{option.title}</h2>
              <p>{option.text}</p>
              <a
                className="button button--primary"
                href={`mailto:${fadenContact.email}?subject=${encodeURIComponent(option.subject)}&body=${encodeURIComponent("Hi FADEN, I would like help with:\nOccasion:\nCity:\nEvent date:\nBudget:\nPreferences:\n")}`}
              >
                Request help by email
              </a>
            </section>
          ))}
        </div>
        <p>
          These are assisted enquiries, not confirmed bookings. Availability,
          scope, and any fees will be confirmed before you agree. No payment is
          collected here.
        </p>
        <p>
          Prefer to talk? Call{" "}
          <a href={fadenContact.phoneHref}>{fadenContact.phone}</a>, or{" "}
          <Link href="/contact">send an enquiry through our contact form</Link>.
        </p>
        <Link className="button button--ghost" href="/discover?type=boutiques">
          Explore boutiques yourself
        </Link>
      </main>
      <MarketplaceFooter />
    </div>
  );
}
