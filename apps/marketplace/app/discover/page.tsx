import Image from "next/image";
import { MarketplaceFooter } from "../../components/marketplace-footer";
import { MarketplaceHeader } from "../../components/marketplace-header";
import { SaveButton } from "../../components/save-button";
import { MarketIcon } from "../../components/market-icon";
import { formatInr } from "../../lib/catalog";
import { stitchImage } from "../../lib/stitch-assets";
import { getSupabaseServerClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";
type Parameters = {
  city?: string;
  occasion?: string;
  q?: string;
  service?: string;
  type?: string;
  category?: string;
  fabric?: string;
  style?: string;
  color?: string;
  boutique?: string;
  price?: string;
  sort?: string;
  page?: string;
};

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Parameters>;
}) {
  const p = await searchParams;
  const type = ["boutiques", "designs", "materials"].includes(p.type ?? "")
    ? p.type!
    : "boutiques";
  const isBoutiques = type === "boutiques";
  const page = Math.min(20, Math.max(1, Number.parseInt(p.page ?? "1") || 1));
  const supabase = await getSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: saved } = auth.user
    ? await supabase
        .from(isBoutiques ? "saved_boutiques" : "saved_designs")
        .select("*")
        .eq("user_id", auth.user.id)
    : { data: [] };
  const savedIds = new Set(
    (saved ?? []).map((item) =>
      "boutique_id" in item ? item.boutique_id : item.design_id,
    ),
  );
  function href(updates: Record<string, string>) {
    const query = new URLSearchParams();
    Object.entries({ ...p, ...updates }).forEach(([key, value]) => {
      if (value && key !== "page") query.set(key, value);
    });
    if (updates.page) query.set("page", updates.page);
    return `/discover?${query}`;
  }
  const hidden = (exclude: string[]) =>
    Object.entries(p)
      .filter(([key, value]) => value && ![...exclude, "page"].includes(key))
      .map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ));
  let bq = supabase
    .from("boutiques")
    .select(
      "id,slug,name,description,city,boutique_profiles!inner(hero_image_url,services,specialties,minimum_price_paise,lead_time_min_weeks,lead_time_max_weeks,rating,review_count)",
      { count: "exact" },
    )
    .eq("is_published", true)
    .eq("status", "verified");
  if (p.q) bq = bq.ilike("name", `%${p.q.slice(0, 100)}%`);
  if (p.city) bq = bq.ilike("city", `%${p.city.slice(0, 100)}%`);
  if (p.service) bq = bq.contains("boutique_profiles.services", [p.service]);
  if (p.occasion) {
    const matching = await supabase
      .from("designs")
      .select("boutique_id")
      .eq("status", "published")
      .contains("occasions", [p.occasion]);
    bq = bq.in(
      "id",
      (matching.data ?? []).map((design) => design.boutique_id),
    );
  }
  bq =
    p.sort === "rating"
      ? bq
          .order("boutique_profiles(rating)", { ascending: false })
          .order("name")
      : bq.order("name");
  let dq = supabase
    .from("designs")
    .select(
      "id,slug,title,primary_image_url,base_price_paise,materials,occasions,tags,boutiques!inner(name,slug,city)",
      { count: "exact" },
    )
    .eq("status", "published");
  if (p.q)
    dq = dq.ilike(
      type === "materials" ? "description" : "title",
      `%${p.q.slice(0, 100)}%`,
    );
  if (p.city) dq = dq.ilike("boutiques.city", `%${p.city.slice(0, 100)}%`);
  if (p.occasion) dq = dq.contains("occasions", [p.occasion]);
  if (p.fabric) dq = dq.contains("materials", [p.fabric]);
  if (p.category) dq = dq.contains("tags", [p.category.toLowerCase()]);
  if (p.style) dq = dq.contains("techniques", [p.style]);
  if (p.color) dq = dq.contains("tags", [p.color]);
  if (p.boutique) dq = dq.eq("boutiques.slug", p.boutique);
  if (p.price && Number.isFinite(Number(p.price)) && Number(p.price) > 0)
    dq = dq.lte("base_price_paise", Number(p.price) * 100);
  dq =
    p.sort === "price-low"
      ? dq.order("base_price_paise")
      : p.sort === "price-high"
        ? dq.order("base_price_paise", { ascending: false })
        : dq
            .order("is_featured", { ascending: false })
            .order("published_at", { ascending: false });
  const [boutiqueResult, designResult, options] = await Promise.all([
    isBoutiques
      ? bq.range(0, page * 12 - 1)
      : Promise.resolve({ data: [], count: 0, error: null }),
    !isBoutiques
      ? dq.range(0, page * 12 - 1)
      : Promise.resolve({ data: [], count: 0, error: null }),
    supabase
      .from("boutiques")
      .select("name,slug")
      .eq("is_published", true)
      .eq("status", "verified")
      .order("name"),
  ]);
  const boutiques = [...(boutiqueResult.data ?? [])];
  const designs = designResult.data ?? [];
  const count = isBoutiques ? boutiqueResult.count : designResult.count;
  const error = isBoutiques ? boutiqueResult.error : designResult.error;

  return (
    <div
      className={`market-page ${isBoutiques ? "stitch-boutiques" : "stitch-designs"}`}
    >
      <MarketplaceHeader active={type} />
      <main className="discovery-page">
        {isBoutiques || type === "materials" ? (
          <header className="discovery-heading">
            <h1>
              {type === "materials"
                ? "Discover the Materials"
                : "Discover the Atelier"}
            </h1>
            <form action="/discover" className="discovery-search" method="get">
              {hidden(["q", "city", "type"])}
              <input type="hidden" name="type" value={type} />
              <label>
                <span>Search</span>
                <div className="search-line">
                  <input
                    defaultValue={p.q}
                    name="q"
                    placeholder="Search across Boutiques, Designs, Materials"
                  />
                  <button aria-label="Search" type="submit">
                    <MarketIcon name="search" />
                  </button>
                </div>
              </label>
              <label>
                <span>Location</span>
                <div className="search-line">
                  <MarketIcon name="pin" />
                  <input
                    defaultValue={p.city}
                    name="city"
                    placeholder="Hyderabad"
                  />
                </div>
              </label>
            </form>
            <nav className="discovery-tabs" aria-label="Discovery type">
              {["boutiques", "designs", "materials"].map((item) => (
                <a
                  aria-current={type === item ? "page" : undefined}
                  className={type === item ? "is-active" : ""}
                  href={`/discover?type=${item}`}
                  key={item}
                >
                  {item}
                </a>
              ))}
            </nav>
          </header>
        ) : null}
        {!isBoutiques && (
          <section
            className="design-discovery-controls"
            aria-label="Design filters"
          >
            <div className="category-row">
              <nav aria-label="Design category">
                {["All", "Women", "Men", "Kids"].map((category) => (
                  <a
                    className={
                      (p.category ?? "All") === category ? "is-active" : ""
                    }
                    aria-current={
                      (p.category ?? "All") === category ? "page" : undefined
                    }
                    href={href({
                      category: category === "All" ? "" : category,
                    })}
                    key={category}
                  >
                    {category}
                  </a>
                ))}
              </nav>
              <span>
                Exploring: <strong>{p.category ?? "All"} designs</strong>
              </span>
            </div>
            <form action="/discover" method="get" className="design-filter-row">
              {hidden([
                "occasion",
                "style",
                "price",
                "boutique",
                "color",
                "fabric",
                "type",
              ])}
              <input type="hidden" name="type" value={type} />
              <label>
                <span className="sr-only">Occasion</span>
                <select name="occasion" defaultValue={p.occasion ?? ""}>
                  <option value="">Occasion</option>
                  {[
                    "Bridal",
                    "Wedding",
                    "Festive",
                    "Casual",
                    "Evening",
                    "Workwear",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Style</span>
                <select name="style" defaultValue={p.style ?? ""}>
                  <option value="">Style</option>
                  {[
                    "Draping",
                    "Tailoring",
                    "Hand embroidery",
                    "Zero-waste cutting",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Price</span>
                <select name="price" defaultValue={p.price ?? ""}>
                  <option value="">Price</option>
                  <option value="20000">Under ₹20,000</option>
                  <option value="40000">Under ₹40,000</option>
                  <option value="60000">Under ₹60,000</option>
                </select>
              </label>
              <label>
                <span className="sr-only">Boutique</span>
                <select name="boutique" defaultValue={p.boutique ?? ""}>
                  <option value="">Boutique</option>
                  {options.data?.map((x) => (
                    <option key={x.slug} value={x.slug}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Color</span>
                <select name="color" defaultValue={p.color ?? ""}>
                  <option value="">Color</option>
                  {["gold", "terracotta", "charcoal", "burgundy"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Fabric</span>
                <select name="fabric" defaultValue={p.fabric ?? ""}>
                  <option value="">Fabric</option>
                  {["Silk", "Wool", "Organic linen"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <button className="button button--primary" type="submit">
                Apply
              </button>
              <a className="filter-reset" href={`/discover?type=${type}`}>
                Reset
              </a>
            </form>
          </section>
        )}
        <section
          className={isBoutiques ? "discovery-layout" : "design-results"}
        >
          {isBoutiques && (
            <aside className="filters-panel">
              <details open>
                <summary>Filters</summary>
                <form action="/discover" method="get">
                  {hidden(["occasion", "service", "type"])}
                  <input type="hidden" name="type" value={type} />
                  <a className="filter-reset" href="/discover?type=boutiques">
                    Reset
                  </a>
                  <fieldset>
                    <legend>Occasion</legend>
                    {["Bridal", "Festive", "Casual"].map((x) => (
                      <label key={x}>
                        <input
                          type="radio"
                          name="occasion"
                          value={x}
                          defaultChecked={p.occasion === x}
                        />
                        {x}
                      </label>
                    ))}
                  </fieldset>
                  <fieldset>
                    <legend>Services</legend>
                    {["Home fitting", "Video consultation", "Rush orders"].map(
                      (x) => (
                        <label key={x}>
                          <input
                            type="radio"
                            name="service"
                            value={x}
                            defaultChecked={p.service === x}
                          />
                          {x}
                        </label>
                      ),
                    )}
                  </fieldset>
                  <button className="button button--ghost button--full">
                    Apply filters
                  </button>
                </form>
              </details>
            </aside>
          )}
          <div className="discovery-results">
            <div className="results-toolbar">
              <span>
                {error
                  ? "Catalog unavailable"
                  : `Showing ${isBoutiques ? boutiques.length : designs.length} of ${count ?? 0} ${type}`}
              </span>
              <form action="/discover">
                {hidden(["sort", "type"])}
                <input name="type" type="hidden" value={type} />
                <label>
                  Sort by:{" "}
                  <select
                    aria-label="Sort results"
                    name="sort"
                    defaultValue={p.sort ?? ""}
                  >
                    <option value="">Recommended</option>
                    {isBoutiques ? (
                      <option value="rating">Highest rated</option>
                    ) : (
                      <>
                        <option value="price-low">Price: low to high</option>
                        <option value="price-high">Price: high to low</option>
                      </>
                    )}
                  </select>
                </label>
                <button aria-label="Apply sorting" type="submit">
                  ↗
                </button>
              </form>
            </div>
            {error ? (
              <div className="empty-state" role="alert">
                <h2>We couldn’t load the atelier.</h2>
                <p>Please try again in a moment.</p>
                <a className="button button--ghost" href={href({})}>
                  Try again
                </a>
              </div>
            ) : isBoutiques ? (
              <div className="boutique-results-grid">
                {boutiques.map((b) => (
                  <article className="boutique-result" key={b.id}>
                    <div className="boutique-result__image">
                      <a href={`/boutiques/${b.slug}`}>
                        <Image
                          src={stitchImage(b.boutique_profiles.hero_image_url)}
                          alt={`${b.name} atelier`}
                          fill
                          sizes="(max-width: 760px) 100vw, 40vw"
                          unoptimized
                        />
                      </a>
                      <span className="catalog-badge">✓ Verified</span>
                      <SaveButton
                        entityId={b.id}
                        kind="boutique"
                        initialSaved={savedIds.has(b.id)}
                        returnPath={href({})}
                        compact
                      />
                    </div>
                    <a href={`/boutiques/${b.slug}`}>
                      <div className="boutique-result__heading">
                        <h2>{b.name}</h2>
                        <span>★ {b.boutique_profiles.rating}</span>
                      </div>
                      <p>{b.description}</p>
                    </a>
                    <div className="tag-row">
                      {b.boutique_profiles.services.map((x) => (
                        <span key={x}>{x}</span>
                      ))}
                    </div>
                    <div className="boutique-result__footer">
                      <div>
                        <strong>
                          {b.boutique_profiles.minimum_price_paise
                            ? `${formatInr(b.boutique_profiles.minimum_price_paise)} onwards`
                            : "Price on request"}
                        </strong>
                        <small>
                          {b.boutique_profiles.lead_time_min_weeks}–
                          {b.boutique_profiles.lead_time_max_weeks} weeks
                        </small>
                      </div>
                      <a
                        className="button button--primary"
                        href={`/boutiques/${b.slug}`}
                      >
                        View Atelier
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="design-masonry">
                {designs.map((d, index) => (
                  <article
                    className={`masonry-card masonry-card--${index % 4}`}
                    key={d.id}
                  >
                    <div className="masonry-card__image">
                      <a href={`/designs/${d.slug}`}>
                        <Image
                          src={stitchImage(d.primary_image_url)}
                          alt={d.title}
                          fill
                          sizes="(max-width: 760px) 100vw, (max-width: 1023px) 50vw, 33vw"
                          unoptimized
                        />
                        <span className="masonry-card__cta">
                          Customize This Design
                        </span>
                      </a>
                      <SaveButton
                        entityId={d.id}
                        kind="design"
                        initialSaved={savedIds.has(d.id)}
                        returnPath={href({})}
                        compact
                      />
                    </div>
                    <a
                      className="masonry-card__copy"
                      href={`/designs/${d.slug}`}
                    >
                      <div>
                        <h2>{d.title}</h2>
                        <p>{d.boutiques.name}</p>
                      </div>
                      <span>From {formatInr(d.base_price_paise)}</span>
                    </a>
                  </article>
                ))}
              </div>
            )}
            {!error && count === 0 && (
              <div className="empty-state">
                <h2>No exact matches yet.</h2>
                <p>Try a broader search or clear the filters.</p>
                <a
                  className="button button--ghost"
                  href={`/discover?type=${type}`}
                >
                  Clear filters
                </a>
              </div>
            )}
            {!error &&
              (count ?? 0) >
                (isBoutiques ? boutiques.length : designs.length) && (
                <a
                  className="discover-more"
                  href={href({ page: String(page + 1) })}
                >
                  Discover more {type}
                </a>
              )}
          </div>
        </section>
      </main>
      <MarketplaceFooter />
    </div>
  );
}
