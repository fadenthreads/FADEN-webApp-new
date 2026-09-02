import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { getAdminAccessRedirect } from "./admin-access";
import { getSupabaseServerClient } from "./supabase/server";

export type AdminSession = {
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>;
  user: User;
  displayName: string | null;
  email: string;
  assuranceLevel: string;
};

export async function requireAdminSession(): Promise<AdminSession> {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  const { data: profile } = data.user
    ? await supabase
        .from("profiles")
        .select("display_name, role")
        .eq("id", data.user.id)
        .maybeSingle()
    : { data: null };

  const { data: assurance } = data.user
    ? await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    : { data: null };

  const redirectPath = getAdminAccessRedirect({
    authenticated: Boolean(data.user),
    role: profile?.role ?? null,
    aal: assurance?.currentLevel ?? null,
  });
  if (redirectPath) redirect(redirectPath);

  return {
    supabase,
    user: data.user!,
    displayName: profile?.display_name ?? null,
    email: data.user!.email ?? "administrator",
    assuranceLevel: assurance?.currentLevel ?? "aal2",
  };
}
