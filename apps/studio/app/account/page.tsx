import Link from "next/link";
import { AtelierShell } from "../../components/atelier-shell";
import { ApprovalGuide } from "../../components/approval-guide";
import { marketplaceUrl } from "../../components/studio-frame";
import { atelierContext } from "../../lib/atelier";
import { studioVisibility } from "../../lib/studio-capabilities.mjs";
import { StudioAccountForm } from "./account-form";

export default async function StudioAccountPage() {
  const { supabase, user, ownedBoutiques } = await atelierContext();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name,phone,role")
    .eq("id", user.id)
    .single();
  if (error) throw new Error("Could not load your account details.");
  return (
    <AtelierShell active="account" name={ownedBoutiques[0]?.name}>
      <header className="atelier-header">
        <div>
          <span className="offer-kicker">Your Studio</span>
          <h1>Account & settings</h1>
          <p>
            Manage your account, finish verification, and understand what
            customers can see.
          </p>
        </div>
      </header>
      <div className="storefront-form">
        <section className="offer-panel">
          <h2>Your boutique</h2>
          {ownedBoutiques.length ? (
            ownedBoutiques.map((b) => (
              <article key={b.id}>
                <h3>{b.name}</h3>
                <p>{studioVisibility(b.status, b.is_published).label}</p>
              </article>
            ))
          ) : (
            <p>
              {profile.role === "boutique_staff" ? (
                <>
                  Your staff account can manage assigned designs in{" "}
                  <Link href="/portfolio">Portfolio</Link>. Business
                  verification and storefront settings belong to the boutique
                  owner.
                </>
              ) : (
                <>
                  No boutique application yet.{" "}
                  <Link href="/onboarding">Create your boutique</Link>.
                </>
              )}
            </p>
          )}
          <div className="offer-actions">
            <Link className="offer-btn" href="/storefront">
              Edit public storefront
            </Link>
            <Link className="offer-btn secondary" href="/portfolio">
              Manage designs
            </Link>
            <Link className="offer-btn secondary" href="/verification">
              Business verification & feedback
            </Link>
          </div>
        </section>
        <StudioAccountForm
          name={profile.display_name ?? ""}
          phone={profile.phone ?? ""}
          email={user.email ?? ""}
        />
        <ApprovalGuide />
        <section className="offer-panel">
          <h2>Sign-in & business support</h2>
          <p>
            For password recovery, use{" "}
            <Link href="/auth/sign-in">Forgot your password?</Link> on the
            sign-in page. Google-only accounts use Google sign-in.
          </p>
          <p>
            For approved legal details, public handle changes, bank/payout
            information, account deletion or ownership changes,{" "}
            <a href={`${marketplaceUrl()}/contact`}>contact FADEN support</a>.
            These are not self-service changes.
          </p>
        </section>
      </div>
    </AtelierShell>
  );
}
