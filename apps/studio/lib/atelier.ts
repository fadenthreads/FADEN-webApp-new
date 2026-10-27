import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "./supabase/server";
export async function atelierContext() {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/auth/sign-in");
  const { data: owned, error } = await supabase
    .from("boutiques")
    .select("id,name,status,is_published")
    .eq("owner_id", data.user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load your atelier.");
  const ownedBoutiques = owned ?? [];
  return {
    supabase,
    user: data.user,
    ownedBoutiques,
    boutiques: ownedBoutiques.filter(
      (b) => b.status === "verified" && b.is_published,
    ),
  };
}
