import { SignOutButton } from "@faden/auth";
import { FadenShell } from "@faden/ui";
import { redirect } from "next/navigation";

import { getSupabaseServerClient } from "../lib/supabase/server";

export default async function AdminHome() {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/auth/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", data.user.id)
    .single();
  if (profile?.role !== "admin") redirect("/auth/unauthorized");

  const { data: assurance } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== "aal2") redirect("/auth/mfa");

  return (
    <FadenShell kind="admin">
      <section className="workspace">
        <div className="workspace-header">
          <div>
            <p className="eyebrow">Platform administration</p>
            <h1>Secure operations.</h1>
          </div>
          <div className="header-actions">
            <span className="status-pill status-pill--ready">MFA verified</span>
            <SignOutButton redirectTo="/auth/sign-in" />
          </div>
        </div>
        <div className="foundation-banner">
          <div>
            <p className="eyebrow">
              Signed in as {profile.display_name ?? data.user.email}
            </p>
            <h2>Identity controls are live.</h2>
          </div>
          <ul className="foundation-list">
            <li>Admin role enforcement</li>
            <li>TOTP two-step verification</li>
            <li>Audited privilege changes</li>
            <li>Protected session refresh</li>
          </ul>
        </div>
      </section>
    </FadenShell>
  );
}
