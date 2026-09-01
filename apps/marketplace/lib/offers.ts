import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "./supabase/server";
export async function customerOffers() {
  const supabase = await getSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/auth/sign-in?next=/offers");
  return { supabase, user: auth.user };
}
