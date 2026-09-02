import type { PublicReadiness } from "@faden/integrations";

export type ReadinessPresentation = {
  label: string;
  modifier: "live" | "enabled" | "configured" | "missing";
  message: string;
  icon: string;
};

export function getReadinessPresentation(
  readiness: PublicReadiness,
): ReadinessPresentation;
