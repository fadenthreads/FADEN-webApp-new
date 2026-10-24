import { getSupabaseServerClient } from "../lib/supabase/server";
import { stitchImage } from "../lib/stitch-assets";
import { formatInr } from "../lib/catalog";
import { ShowcaseCarousel, type ShowcaseItem } from "./showcase-carousel";

export async function HomeShowcases() {
  try {
    const db = await getSupabaseServerClient();
    const [boutiques, designs] = await Promise.all([
      db
        .from("boutiques")
        .select(
          "id,slug,name,description,city,boutique_profiles!inner(hero_image_url,rating,review_count)",
        )
        .eq("status", "verified")
        .eq("is_published", true)
        .order("boutique_profiles(rating)", {
          ascending: false,
          nullsFirst: false,
        })
        .order("name")
        .limit(12)
        .abortSignal(AbortSignal.timeout(6000)),
      db
        .from("designs")
        .select(
          "id,slug,title,description,primary_image_url,base_price_paise,materials,boutiques!inner(name,status,is_published)",
        )
        .eq("status", "published")
        .eq("boutiques.status", "verified")
        .eq("boutiques.is_published", true)
        .order("is_featured", { ascending: false })
        .order("published_at", { ascending: false })
        .limit(24)
        .abortSignal(AbortSignal.timeout(6000)),
    ]);
    const boutiqueItems: ShowcaseItem[] = (boutiques.data ?? []).map((b) => ({
      id: b.id,
      title: b.name,
      image: stitchImage(b.boutique_profiles.hero_image_url),
      subtitle: b.city || "Independent atelier",
      description: b.description || "Discover the atelier and its collection.",
      detail:
        b.boutique_profiles.review_count > 0
          ? `${b.boutique_profiles.rating} / 5 · ${b.boutique_profiles.review_count} reviews`
          : "Explore the atelier",
      href: `/boutiques/${encodeURIComponent(b.slug)}`,
      action: "Visit boutique",
    }));
    const clothing: ShowcaseItem[] = (designs.data ?? [])
      .slice(0, 12)
      .map((d) => ({
        id: d.id,
        title: d.title,
        image: stitchImage(d.primary_image_url),
        subtitle: d.boutiques.name,
        description:
          d.description ||
          "Discover the details and make this design your own.",
        detail: `From ${formatInr(d.base_price_paise)}`,
        href: `/designs/${encodeURIComponent(d.slug)}`,
        action: "View design",
      }));
    const fabrics = new Map<string, ShowcaseItem>();
    for (const d of designs.data ?? []) {
      for (const material of d.materials) {
        const name = material.trim();
        if (!name || fabrics.has(name.toLowerCase())) continue;
        fabrics.set(name.toLowerCase(), {
          id: name.toLowerCase(),
          title: name,
          image: stitchImage(d.primary_image_url),
          subtitle: "Fabric inspiration",
          description: `Explore ${name} through the pieces our boutiques create. Image shown: ${d.title} by ${d.boutiques.name}. Ask the boutique about fabric availability and options.`,
          detail: "Discover designs using this material",
          href: `/discover?type=materials&fabric=${encodeURIComponent(name)}`,
          action: "Explore material",
        });
      }
    }
    return (
      <div className="home-showcases">
        <ShowcaseCarousel
          title="Ateliers to fall in love with"
          eyebrow="Discover our boutiques"
          items={boutiqueItems}
          href="/discover?type=boutiques"
        />
        <ShowcaseCarousel
          title="The art begins with fabric"
          eyebrow="Materials & textures"
          items={[...fabrics.values()].slice(0, 12)}
          href="/discover?type=materials"
        />
        <ShowcaseCarousel
          title="Find your next favourite"
          eyebrow="Clothing, made personal"
          items={clothing}
          href="/discover?type=designs"
        />
      </div>
    );
  } catch {
    return (
      <section className="home-showcase">
        <h2>Discover your next favourite</h2>
        <p>Explore our boutiques, designs and materials.</p>
        <a href="/discover?type=boutiques">Explore the collection →</a>
      </section>
    );
  }
}
