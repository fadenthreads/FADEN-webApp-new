import { notFound, redirect } from "next/navigation";
import { getSupabaseServerClient } from "./supabase/server";
export async function customerOrder(id: string) {
  const supabase = await getSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user)
    redirect(`/auth/sign-in?next=${encodeURIComponent(`/orders/${id}`)}`);
  const { data: order, error } = await supabase
    .from("customer_orders")
    .select()
    .eq("id", id)
    .eq("customer_id", auth.user.id)
    .maybeSingle();
  if (error?.code === "22P02") notFound();
  if (error) throw new Error("Could not load your order. Please try again.");
  if (!order) notFound();
  return order;
}
