export function MarketplaceFooter() {
  return (
    <footer className="market-footer">
      <div className="market-footer__inner">
        <div>
          <strong>FADEN</strong>
          <small>© 2026 FADEN Atelier. All rights reserved.</small>
        </div>
        <nav aria-label="Footer navigation">
          <a href="/help">Help</a>
          <a href="/contact">Contact</a>
          <a
            href={process.env.NEXT_PUBLIC_STUDIO_URL || "http://localhost:3001"}
          >
            Boutique Portal
          </a>
          <a href="/terms">Terms of Service</a>
          <a href="/privacy">Privacy Policy</a>
          <a href="/shipping-policy">Shipping</a>
          <a href="/refund-policy">Refunds</a>
        </nav>
      </div>
    </footer>
  );
}
