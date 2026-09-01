import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "./supabase/server";
export async function atelierContext() {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/auth/sign-in");
  const { data: boutiques, error } = await supabase
    .from("boutiques")
    .select("id,name,status,is_published")
    .eq("owner_id", data.user.id)
    .eq("status", "verified")
    .eq("is_published", true);
  if (error) throw new Error("Could not load your atelier.");
  return { supabase, user: data.user, boutiques: boutiques ?? [] };
}
