import Image from "next/image";
import { MarketplaceFooter } from "../components/marketplace-footer";
import { MarketplaceHeader } from "../components/marketplace-header";
import { MarketIcon } from "../components/market-icon";

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
              <a
                className="button button--ghost"
                href="/discover?type=boutiques"
              >
                Explore Boutiques
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
      </main>
      <MarketplaceFooter />
    </div>
  );
}
