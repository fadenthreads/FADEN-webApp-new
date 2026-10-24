import assert from "node:assert/strict";
import test from "node:test";
import { project, unproject } from "../apps/marketplace/lib/map-projection.mjs";

test("map clicks round-trip city coordinates at every supported zoom", () => {
  for (const zoom of [4, 11, 17])
    for (const [lat, lon] of [
      [0, 0],
      [17.385, 78.4867],
      [19.076, 72.8777],
      [12.9716, 77.5946],
      [-33.86, 151.2],
    ]) {
      const point = project(lat, lon, zoom);
      const actual = unproject(point.x, point.y, zoom);
      assert.ok(Math.abs(actual.lat - lat) < 1e-8);
      assert.ok(Math.abs(actual.lon - lon) < 1e-8);
    }
});
test("panning east and north moves the pin in the correct direction", () => {
  const point = project(17.385, 78.4867, 11);
  assert.ok(unproject(point.x + 100, point.y, 11).lon > 78.4867);
  assert.ok(unproject(point.x, point.y - 100, 11).lat > 17.385);
});
test("map wraps longitude and bounds polar latitude", () => {
  const point = project(0, 179, 4);
  const actual = unproject(point.x + 256, -1000, 4);
  assert.ok(actual.lon >= -180 && actual.lon < 180);
  assert.ok(actual.lat <= 85);
});
