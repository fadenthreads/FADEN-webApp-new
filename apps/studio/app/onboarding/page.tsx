import { redirect } from "next/navigation";
import { AtelierShell } from "../../components/atelier-shell";

import { getSupabaseServerClient } from "../../lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export default async function StudioOnboardingPage() {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/auth/sign-in?next=/onboarding");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();
  if (profile?.role === "boutique_owner" || profile?.role === "boutique_staff")
    redirect("/");

  return (
    <AtelierShell active="onboarding" name="Boutique registration">
      <section className="workspace onboarding-workspace">
        <div className="workspace-header">
          <div>
            <p className="eyebrow">FADEN Studio</p>
            <h1>Bring your boutique online.</h1>
          </div>
        </div>
        <OnboardingForm />
      </section>
    </AtelierShell>
  );
}
