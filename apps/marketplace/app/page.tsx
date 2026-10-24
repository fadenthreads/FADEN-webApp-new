import Image from "next/image";
import { Suspense } from "react";
import { MarketplaceFooter } from "../components/marketplace-footer";
import { MarketplaceHeader } from "../components/marketplace-header";
import { MarketIcon } from "../components/market-icon";
import { HomeShowcases } from "../components/home-showcases";

export const dynamic = "force-dynamic";

export default function MarketplaceHome() {
  return (
    <div className="market-page stitch-home">
      <MarketplaceHeader />
      <main>
        <section className="stitch-hero">
          <Image
            className="stitch-hero__image"
            src="/stitch-assets/asset-027.jpg"
            alt="Bespoke bridal couture in a sculptural, sunlit atelier"
            fill
            priority
            sizes="100vw"
            unoptimized
          />
          <div className="stitch-hero__veil" />
          <div className="stitch-hero__content">
            <h1>
              Made for you.
              <br />
              Designed around you.
            </h1>
            <p>
              Discover talented boutiques, create your perfect outfit and follow
              every detail from first idea to final fitting.
            </p>
            <div className="hero-actions">
              <a className="button button--primary" href="/create">
                Create My Outfit <MarketIcon name="arrow" />
              </a>
              <a className="button button--ghost" href="#explore">
                Explore FADEN
              </a>
            </div>
            <form action="/discover" className="stitch-hero__search">
              <input type="hidden" name="type" value="designs" />
              <label>
                <MarketIcon name="search" />
                <input
                  name="q"
                  aria-label="Search designs"
                  placeholder="Wedding lehenga, Custom suit, Sherwani..."
                />
                <button type="submit" aria-label="Search">
                  <MarketIcon name="arrow" />
                </button>
              </label>
              <label>
                <MarketIcon name="pin" />
                <input
                  name="city"
                  aria-label="Location"
                  placeholder="Near Hyderabad"
                />
              </label>
            </form>
          </div>
        </section>
        <section
          className="explore-paths"
          id="explore"
          aria-labelledby="explore-heading"
        >
          <div className="explore-paths__heading">
            <p className="eyebrow">Explore FADEN</p>
            <h2 id="explore-heading">
              A little inspiration. Something entirely you.
            </h2>
            <p>
              Find an atelier, discover a design, or begin with a beautiful
              fabric.
            </p>
          </div>
          <nav className="explore-paths__grid" aria-label="Explore collections">
            {[
              {
                type: "boutiques",
                title: "Boutiques",
                text: "Meet independent ateliers and find your creative match.",
                action: "Find your atelier",
              },
              {
                type: "designs",
                title: "Clothing",
                text: "Discover silhouettes to inspire your next made-for-you piece.",
                action: "Browse clothing",
              },
              {
                type: "materials",
                title: "Materials",
                text: "Explore fabrics and textures through boutique designs.",
                action: "Discover materials",
              },
            ].map((category, index) => (
              <a
                key={category.type}
                href={`/discover?type=${category.type}`}
                className="explore-path"
              >
                <span className="explore-path__number">0{index + 1}</span>
                <h3>{category.title}</h3>
                <p>{category.text}</p>
                <span className="explore-path__action">
                  {category.action}
                  <span aria-hidden="true">↗</span>
                </span>
              </a>
            ))}
          </nav>
        </section>
        <Suspense
          fallback={
            <section className="home-showcase" aria-label="Loading collections">
              <p>Discover our boutiques, fabrics and clothing…</p>
            </section>
          }
        >
          <HomeShowcases />
        </Suspense>
      </main>
      <MarketplaceFooter />
    </div>
  );
}
