export function showcaseGroup<T>(items: T[]): T[];
export function normalizeShowcasePosition(
  position: number,
  width: number,
): number;
export function showcaseGestureMoved(
  start: { x: number; y: number },
  point: { x: number; y: number },
): boolean;
