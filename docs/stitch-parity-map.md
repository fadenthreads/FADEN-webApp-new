# FADEN Stitch parity map

The design source of truth is Stitch project `6846067379333241152`, **Faden: Luxury Fashion Marketplace**. Each screen below has an exact screenshot and HTML export under `design-reference/stitch/`; implementation should be compared at both its exported desktop or mobile viewport and normal responsive widths.

Status legend: **existing** means a functional route already existed before the parity rebuild; **missing** means it must be added; **variant** means the same responsive route must reproduce the dedicated mobile reference.

## Customer marketplace

| Stitch screen                 | Screen ID  | Intended route             | Baseline                                                                            |
| ----------------------------- | ---------- | -------------------------- | ----------------------------------------------------------------------------------- |
| Homepage – Faden              | `df643552` | `/`                        | rebuilt; owner review pending                                                       |
| Made Especially for You       | `544fb94a` | `/orders/[id]/complete`    | rehearsal-gated implementation; aftercare actions and owner visual approval pending |
| Discovery / Search            | `fe249012` | `/discover?type=boutiques` | rebuilt; owner review pending                                                       |
| Design Discovery              | `561619ad` | `/discover?type=designs`   | rebuilt; owner review pending                                                       |
| Boutique Profile              | `fc946e97` | `/boutiques/[slug]`        | rebuilt; owner review pending                                                       |
| Design Detail                 | `25f8a743` | `/designs/[slug]`          | rebuilt; owner review pending                                                       |
| Create Outfit – Occasion      | `0ae7ec1c` | `/create/occasion`         | implemented; owner review pending                                                   |
| Create Outfit – Inspiration   | `91566231` | `/create/inspiration`      | implemented; owner review pending                                                   |
| Create Outfit – Your Style    | `f83619e5` | `/create/style`            | implemented; owner review pending                                                   |
| Create Outfit – Measurements  | `f40e28f2` | `/create/measurements`     | implemented; owner review pending                                                   |
| Create Outfit – Budget & Date | `3b9a1e7e` | `/create/budget`           | implemented; owner review pending                                                   |
| Your Offers                   | `8dfb0427` | `/offers`                  | implemented; owner review pending                                                   |
| Compare Offers                | `766aa5a2` | `/offers/compare`          | implemented; owner review pending                                                   |
| Secure Your Order             | `5fa34159` | `/orders/secure?id=…`      | test checkout implemented; webhook/capture/visual verification pending              |
| Design Approval               | `414d2098` | `/orders/[id]/approval`    | implemented; owner visual sign-off pending                                          |
| Your Outfit Journey           | `f6ce212b` | `/journey/[id]`            | rehearsal progress notes/photos implemented; visual sign-off pending                |

### Customer mobile references

| Stitch screen             | Screen ID  | Responsive route       |
| ------------------------- | ---------- | ---------------------- |
| Boutique Profile – Mobile | `7b9829a8` | `/boutiques/[slug]`    |
| Design Detail – Mobile    | `49e3f977` | `/designs/[slug]`      |
| Inspiration – Mobile      | `a2447934` | `/create/inspiration`  |
| Measurements – Mobile     | `df10961d` | `/create/measurements` |
| Budget & Date – Mobile    | `472ffcda` | `/create/budget`       |
| Your Offers – Mobile      | `943c22f6` | `/offers`              |
| Outfit Journey – Mobile   | `daf8cc55` | `/journey/[id]`        |

## Boutique Studio

Studio is served on port `3001` in local development.

| Stitch screen                    | Screen ID  | Intended route          | Baseline                                               |
| -------------------------------- | ---------- | ----------------------- | ------------------------------------------------------ |
| Boutique Overview – Aarya Studio | `25a57628` | `/`                     | rebuilt with real accessible metrics and session data  |
| Boutique Overview – Mobile       | `31b92f17` | `/`                     | responsive adaptation; 390px layout checked            |
| Portfolio Management             | `f1e93535` | `/portfolio`            | rebuilt; filters, editor and guarded publish/archive   |
| Customization Settings           | `fa3bbb01` | `/customizations`       | missing                                                |
| Custom Request Detail            | `6270143f` | `/requests/[id]`        | implemented; owner review pending                      |
| Create Offer                     | `47e2d1cb` | `/offers/new`           | implemented; owner review pending                      |
| Offer Detail                     | `caf17354` | customer `/offers/[id]` | implemented; customer-facing source                    |
| Production Queue                 | `d5e7c589` | `/production`           | rehearsal board implemented; staff assignment deferred |
| Production Queue – Mobile        | `29aac4f9` | `/production`           | responsive cards implemented; owner review pending     |
| Order Detail                     | `f03b6a5f` | `/orders/[id]`          | commercial snapshot only; production layout pending    |
| Boutique Analytics               | `b559a5a2` | `/analytics`            | missing                                                |

## FADEN Admin

Admin is served on port `3002` in local development.

| Stitch screen                   | Screen ID  | Intended route                 | Baseline                   |
| ------------------------------- | ---------- | ------------------------------ | -------------------------- |
| Platform Overview – Faden Admin | `aba91d2b` | `/`                            | existing, rebuild required |
| Platform Overview – Mobile      | `a907252b` | `/`                            | variant                    |
| Boutique Management             | `50e1c833` | `/boutiques`                   | missing                    |
| Boutique Verification           | `13a979b0` | `/boutiques/[id]/verification` | missing                    |
| Orders Management               | `1f0561e1` | `/orders`                      | missing                    |
| Settlements                     | `dcd75503` | `/settlements`                 | missing                    |
| Dispute Detail                  | `c3c9c9ef` | `/disputes/[id]`               | missing                    |
| Dispute Detail – Mobile         | `91708f4b` | `/disputes/[id]`               | variant                    |
| Audit Log                       | `9ba77d63` | `/audit`                       | missing                    |
| Platform Configuration          | `f8d1dd0f` | `/settings`                    | missing                    |

## Reference-only assets

| Stitch item                 | Screen ID  | Use                                  |
| --------------------------- | ---------- | ------------------------------------ |
| Faden Logo                  | `5bc54959` | Wordmark/logo reference              |
| Faden Marketplace Prototype | `fe87c34a` | Navigation and interaction reference |

## Fidelity gate for every screen

1. Use the exact Stitch source image from `design-reference/stitch/assets`, not a generated substitute or low-resolution thumbnail.
2. Match hierarchy, content order, typography, colors, spacing, image crop, borders, and responsive behavior.
3. Preserve functional data and workflows behind the screen; static Stitch HTML is a visual reference, not application logic.
4. Verify desktop at `1280px` CSS width and mobile at `390px` CSS width against the exported screenshot.
5. Check keyboard focus, semantic labels, contrast, empty/loading/error states, and reduced-motion behavior before marking parity complete.
