import { SignOutButton } from "@faden/auth";
import { FadenShell } from "@faden/ui";
import { redirect } from "next/navigation";

import { getSupabaseServerClient } from "../../lib/supabase/server";
import { AccountForm } from "./account-form";

export default async function AccountPage() {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/auth/sign-in?next=/account");

  const [profileResult, preferenceResult, addressResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, phone")
      .eq("id", data.user.id)
      .single(),
    supabase
      .from("user_preferences")
      .select(
        "email_transactional, email_marketing, sms_transactional, whatsapp_updates",
      )
      .eq("user_id", data.user.id)
      .single(),
    supabase
      .from("user_addresses")
      .select(
        "id, label, recipient_name, phone, line1, line2, city, state, postal_code, latitude, longitude",
      )
      .eq("user_id", data.user.id)
      .eq("is_default", true)
      .maybeSingle(),
  ]);

  if (!profileResult.data || !preferenceResult.data) {
    throw new Error("Your account profile could not be loaded.");
  }

  const providers = Array.from(
    new Set((data.user.identities ?? []).map((identity) => identity.provider)),
  );

  return (
    <FadenShell kind="marketplace">
      <section className="workspace account-workspace">
        <div className="workspace-header">
          <div>
            <p className="eyebrow">Account</p>
            <h1>Made personal.</h1>
          </div>
          <SignOutButton redirectTo="/" />
        </div>
        <div className="hero-actions" style={{ marginBottom: 32 }}>
          <a className="button button--primary" href="/create">
            Create an Outfit
          </a>
          <a className="button button--ghost" href="/requests">
            My Requests
          </a>
          <a className="button button--ghost" href="/orders">
            My Orders
          </a>
        </div>
        <AccountForm
          address={addressResult.data}
          email={data.user.email ?? ""}
          googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true"}
          phone={data.user.phone ?? ""}
          preferences={preferenceResult.data}
          profile={profileResult.data}
          providers={providers}
          phoneAuthEnabled={
            process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED === "true" ||
            process.env.NODE_ENV !== "production"
          }
          userId={data.user.id}
        />
      </section>
    </FadenShell>
  );
}
