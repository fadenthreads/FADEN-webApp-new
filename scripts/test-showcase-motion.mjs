import assert from "node:assert/strict";
import test from "node:test";
import {
  showcaseGroup,
  normalizeShowcasePosition,
  showcaseGestureMoved,
} from "../apps/marketplace/lib/showcase-motion.mjs";

test("small catalogues still fill a complete loop wider than the rail", () => {
  assert.deepEqual(showcaseGroup([1]), [1]);
  assert.deepEqual(showcaseGroup([1, 2]), [1, 2, 1, 2]);
  assert.deepEqual(showcaseGroup([1, 2, 3]), [1, 2, 3, 1, 2, 3]);
  assert.deepEqual(showcaseGroup([]), []);
});
test("wrap preserves the exact fractional card phase", () => {
  const width = 1135.65625;
  for (const phase of [0, 0.25, 13.7, width - 0.25]) {
    for (const set of [-2, -1, 0, 1, 2, 3, 20]) {
      assert.ok(
        Math.abs(
          normalizeShowcasePosition(set * width + phase, width) -
            (width + phase),
        ) < 0.00001,
      );
    }
  }
});
test("loop does not accumulate pixel rounding error over 1000 wraps", () => {
  const width = 1135.65625;
  let position = width + 32.125;
  for (let i = 0; i < 1000; i++)
    position = normalizeShowcasePosition(position + width, width);
  assert.equal(position, width + 32.125);
});
test("invalid geometry cannot introduce NaN scroll positions", () => {
  assert.equal(normalizeShowcasePosition(100, 0), 0);
  assert.equal(normalizeShowcasePosition(NaN, 300), 0);
});
test("swipes and vertical drags are distinct from taps", () => {
  const start = { x: 100, y: 200 };
  assert.equal(showcaseGestureMoved(start, { x: 103, y: 204 }), false);
  assert.equal(showcaseGestureMoved(start, { x: 120, y: 200 }), true);
  assert.equal(showcaseGestureMoved(start, { x: 100, y: 225 }), true);
});
