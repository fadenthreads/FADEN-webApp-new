export function MarketplaceFooter() {
  return (
    <footer className="market-footer">
      <div className="market-footer__inner">
        <div>
          <strong>FADEN</strong>
          <small>© 2026 FADEN Atelier. All rights reserved.</small>
        </div>
        <nav aria-label="Footer navigation">
          <a href="#">The Story</a>
          <a href="#">Sustainability</a>
          <a
            href={process.env.NEXT_PUBLIC_STUDIO_URL || "http://localhost:3001"}
          >
            Boutique Portal
          </a>
          <a href="#">Terms of Service</a>
          <a href="#">Privacy Policy</a>
        </nav>
      </div>
    </footer>
  );
}
