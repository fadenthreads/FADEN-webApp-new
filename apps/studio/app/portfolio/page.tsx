import { redirect, notFound } from "next/navigation";
import { getSupabaseServerClient } from "../../lib/supabase/server";
import { StudioFrame, marketplaceUrl } from "../../components/studio-frame";
import { portfolioColumns, portfolioCategories } from "../../lib/portfolio";
import { PortfolioManager } from "./portfolio-manager";
export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{
    boutique?: string;
    q?: string;
    category?: string;
    status?: string;
    page?: string;
    saved?: string;
  }>;
}) {
  const db = await getSupabaseServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=/portfolio");
  const membership = await db
    .from("boutique_members")
    .select("boutique_id,boutiques(name)")
    .eq("user_id", user.id)
    .order("boutique_id");
  if (membership.error)
    throw new Error("Could not load your portfolio memberships.");
  if (!membership.data.length) redirect("/onboarding");
  const boutiques = membership.data.map((b) => ({
      id: b.boutique_id,
      name: b.boutiques?.name || "Assigned boutique",
    })),
    s = await searchParams;
  const selected = s.boutique
    ? boutiques.find((b) => b.id === s.boutique)
    : boutiques[0];
  if (!selected) notFound();
  const q = (s.q || "").slice(0, 100),
    category =
      portfolioCategories.find((c) => c === s.category) || "All Designs",
    status = ["draft", "published", "archived"].includes(s.status || "")
      ? s.status!
      : "all",
    page = Math.max(1, Math.min(1000, parseInt(s.page || "1", 10) || 1));
  let query = db
    .from("designs")
    .select(portfolioColumns, { count: "exact" })
    .eq("boutique_id", selected.id);
  if (q) query = query.ilike("title", "%" + q.replace(/[\\%_]/g, "\\$&") + "%");
  if (status !== "all")
    query = query.eq("status", status as "draft" | "published" | "archived");
  if (category !== "All Designs")
    query = query.contains("occasions", [category]);
  const result = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * 24, page * 24 - 1);
  if (result.error) throw new Error("Could not load portfolio designs.");
  return (
    <StudioFrame name={selected.name} active="portfolio">
      <PortfolioManager
        key={JSON.stringify(s)}
        boutiqueId={selected.id}
        boutiques={boutiques}
        initialDesigns={result.data ?? []}
        count={result.count ?? 0}
        filters={{ q, category, status, page }}
        marketplaceBase={marketplaceUrl()}
        saved={s.saved === "1"}
      />
    </StudioFrame>
  );
}
