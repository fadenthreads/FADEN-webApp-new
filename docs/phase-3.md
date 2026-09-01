# Phase 3 — Marketplace discovery and catalog

## Delivered

### Marketplace experience

- Stitch-aligned editorial homepage with working search and navigation
- Boutique, design, and material discovery tabs
- Search by title or boutique, with location, occasion, and service filters
- Responsive boutique result cards with verification, rating, services, pricing, and lead time
- Responsive design catalog with boutique, material, price, and creation-time information
- Boutique profile with hero, trust signals, services, availability, atelier story, and signature designs
- Design detail with image gallery, price, materials, occasions, techniques, customisable elements, and boutique navigation
- Protected saved-design and saved-boutique collection
- Customer save/remove controls that redirect unauthenticated visitors through sign-in

### Boutique Studio

- Protected portfolio route
- Owner-only visibility of draft catalog items
- Create draft or published portfolio designs
- Publish and unpublish portfolio pieces
- Seeded Aarya Studio draft for immediate local testing

### Supabase catalog

- `boutique_profiles` for rich public atelier presentation
- `designs` with lifecycle status, pricing, lead times, media, filtering dimensions, and customisation options
- `saved_boutiques` and `saved_designs` with owner-only RLS
- GIN indexes for occasion, material, and tag discovery
- Partial published-content index and boutique/city indexes
- Security-definer membership helper used only for authorization checks
- Public catalog policies expose only published designs from verified, published boutiques
- Boutique members can manage only their own catalog
- Admin catalog access continues to require AAL2

## Local sample catalog

The local database seeds four verified ateliers and four published designs, including Studio Vanya and the Antique Gold Zardosi Lehenga from the supplied Stitch screens. Aarya Studio remains in review and its sample portfolio design remains private to the seeded owner.

## Verification

```bash
npm run supabase:test
npm run test:auth
npm run test:catalog
npm run check
npm run format:check
npm audit --omit=dev
```

The catalog smoke test confirms:

- Anonymous visitors see exactly the published catalog
- Boutique owners can read their own drafts
- Customers cannot modify catalog entries
- Customers can save and remove published designs

## Deferred to later phases

- Custom outfit request wizard and boutique offer comparison
- Payments, checkout, refunds, settlements, and invoices
- Production milestones, fittings, and approvals
- Courier booking, shipment tracking, and delivery
- Reviews, messaging, disputes, and advanced analytics
