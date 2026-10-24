// Keep a complete set wider than the viewport, even for a two-item catalogue.
export function showcaseGroup(items) {
  if (items.length < 2) return items;
  return Array.from(
    { length: Math.ceil(4 / items.length) },
    () => items,
  ).flat();
}

export function normalizeShowcasePosition(position, width) {
  if (!Number.isFinite(position) || !Number.isFinite(width) || width <= 0)
    return 0;
  return width + ((((position - width) % width) + width) % width);
}

export function showcaseGestureMoved(start, point) {
  return Math.hypot(point.x - start.x, point.y - start.y) > 8;
}
