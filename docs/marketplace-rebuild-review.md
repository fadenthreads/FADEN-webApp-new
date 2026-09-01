# Marketplace rebuild — review checkpoint

## Implemented in this phase

- Homepage: the Stitch hero, exact source photograph, exported logo, headline proportions, bottom gradient, two actions, search/location bar, and footer. Removed the invented featured-grid and callout sections; catalog content remains accessible through discovery.
- Boutique discovery: centered search, location, discovery tabs, sidebar filters, two-column editorial cards, verified badges, saved boutiques, ratings, and price/lead-time details.
- Design discovery: independent category/filter area and responsive masonry layout. Filters retain other query parameters; sorting and pagination use Supabase results. Added All so unclassified existing catalog items remain discoverable.
- Boutique profiles: editorial hero, atelier identity, facts, story, existing portfolio, focused mobile navigation, and fixed mobile action.
- Design details: 7/5 desktop layout, three clickable detail thumbnails with a full-image reset, description, customization choices, saved inspiration, dedicated mobile imagery, mobile pricing blocks, and fixed mobile action.
- Accessible mobile menu with Escape dismissal; visible focus rings; reduced-motion support; save error feedback; share/copy-link control; honest empty/error/image-placeholder states.
- All 87 known Stitch assets are available locally. Known source URLs resolve to preserved high-resolution assets; unknown/uploaded URLs remain unchanged.
- Body font inheritance corrected: Karla is applied on the body where its font variable is defined.

## Source corrections and intentional differences

1. **Made especially for you** (544fb94a) is an order-completion screen, not outfit creation. Its planned route is /orders/[id]/complete.
2. Desktop/mobile mockups disagree on some currencies, prices, boutique locations, and copy. Actual Supabase data remains authoritative.
3. Some source images contain text or UI baked into the raster image. They are preserved exactly, not silently replaced or AI-edited.
4. Boutique identity currently falls back to initials when a usable logo is not available. A complete media/content pass remains part of final visual sign-off.
5. Gender categories require explicit women, men, or kids catalog tags. The current seed has no gender classifications; All is the default and categories without records show an empty state.
6. Materials currently filters the design catalog by fabric, not a standalone material inventory.

## Deferred to subsequent phases

- Outfit-creation actions now enter the implemented private request wizard, carrying boutique/design context. See [request-wizard-review.md](request-wizard-review.md) for the next completed checkpoint.
- Messaging, fitting bookings, offers, orders, payments, invoices, alterations, and order completion remain deferred.
- Legal/editorial footer destinations and newsletter subscription need final content and backend wiring. No fake newsletter success state was introduced.
- Mobile provenance/process content needs verified boutique-owned data; the app does not invent sustainability claims from placeholder design copy.
- This checkpoint is a visual rebuild ready for owner review, not final pixel-perfect sign-off across every Stitch screen.

## Verification

- Desktop reference width: 1280 CSS px. Mobile reference width: 390 CSS px.
- Browser verified: home search → catalog, local image loading, card navigation, gallery switching/reset, mobile profile/detail shells, menu open/Escape close, and no horizontal page overflow on checked mobile screens.
- npm run test:marketplace runs seven HTTP/SSR regression tests against the running app and seeded local Supabase. This is not a substitute for browser interaction tests.
- Existing Supabase RLS/auth/catalog suites are retained.

## Resume point

The custom-outfit journey is now implemented. Next is consent-controlled request sharing, Studio request handling and offers, followed by customer offer comparison. Preserve existing Supabase data and use additive migrations only. Full details are in [request-wizard-review.md](request-wizard-review.md).
