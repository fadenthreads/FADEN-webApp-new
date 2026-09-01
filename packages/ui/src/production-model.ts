export const productionStages = [
  "Fabric sourced",
  "Cutting",
  "Stitching",
  "Quality check",
  "Ready for fitting",
] as const;
export interface ProductionUpdate {
  id: string;
  sequence: number;
  stage: number;
  note: string;
  created_at: string;
  photoUrl?: string;
}
export interface ProductionCard {
  id: string;
  title: string;
  boutique: string;
  stage: number;
  updatedAt?: string;
  href?: string;
}
