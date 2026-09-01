import type { ProductionUpdate, ProductionCard } from "@faden/ui";
export const sampleProgress: ProductionUpdate[] = [
  {
    id: "sample-stitching",
    sequence: 3,
    stage: 3,
    note: "Sample update: structural seams are taking shape. This demonstrates a boutique progress note, not an actual production job.",
    created_at: "2026-08-31T08:00:00Z",
    photoUrl: "/stitch-assets/asset-013.jpg",
  },
  {
    id: "sample-cutting",
    sequence: 2,
    stage: 2,
    note: "Sample update: the pattern has been laid out for cutting, following the approved silhouette.",
    created_at: "2026-08-30T08:00:00Z",
  },
  {
    id: "sample-fabric",
    sequence: 1,
    stage: 1,
    note: "Sample update: ivory silk selected for its soft drape. This original Stitch image illustrates the material story.",
    created_at: "2026-08-29T08:00:00Z",
    photoUrl: "/stitch-assets/asset-053.jpg",
  },
];
export const sampleProductionOrders: ProductionCard[] = [
  {
    id: "DEMO-8921",
    title: "Bespoke evening gown",
    boutique: "Atelier Maison",
    stage: 3,
    updatedAt: "2026-08-31T08:00:00Z",
    href: "/preview/journey",
  },
  {
    id: "DEMO-8944",
    title: "Bespoke Tweed Jacket",
    boutique: "Sample Atelier",
    stage: 2,
    updatedAt: "2026-08-30T08:00:00Z",
  },
  {
    id: "DEMO-8902",
    title: "Linen Summer Trouser",
    boutique: "Sample Atelier",
    stage: 4,
    updatedAt: "2026-08-31T08:00:00Z",
  },
];
