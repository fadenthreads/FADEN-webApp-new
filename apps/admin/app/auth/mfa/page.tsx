import { MfaPanel } from "@faden/auth";
import { redirect } from "next/navigation";

import { getSupabaseServerClient } from "../../../lib/supabase/server";

export default async function AdminMfaPage() {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/auth/sign-in?next=/auth/mfa");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();
  if (profile?.role !== "admin") redirect("/auth/unauthorized");

  return (
    <main className="auth-page auth-page--admin">
      <a className="faden-wordmark auth-wordmark" href="/">
        FADEN / ADMIN
      </a>
      <MfaPanel nextPath="/" />
    </main>
  );
}
