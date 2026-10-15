const test = require("node:test");
const assert = require("node:assert/strict");
const cursor = require("../cursor.js");

// A deterministic stand-in for Math.random so paths are reproducible.
function seeded(values) {
  let index = 0;
  return () => values[index++ % values.length];
}

test("easing starts at rest, ends at rest, and is monotonic", () => {
  assert.equal(cursor.easeInOut(0), 0);
  assert.equal(cursor.easeInOut(1), 1);
  let previous = -1;
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const value = cursor.easeInOut(t);
    assert.ok(value >= previous, `eased value fell at t=${t}`);
    previous = value;
  }
  // Slow at the ends, fast in the middle.
  assert.ok(cursor.easeInOut(0.1) < 0.1, "should accelerate gently");
  assert.ok(cursor.easeInOut(0.9) > 0.9, "should decelerate into the target");
});

test("the path starts where the pointer is and lands exactly on the target", () => {
  const from = { x: 10, y: 10 };
  const to = { x: 400, y: 300 };
  const points = cursor.path(from, to, { random: seeded([0.3, 0.7, 0.5, 0.2]) });
  assert.deepEqual(points[0], { x: 10, y: 10 });
  assert.deepEqual(points[points.length - 1], { x: 400, y: 300 });
  assert.ok(points.length >= 16, "enough samples to animate smoothly");
});

test("the path curves rather than travelling in a straight line", () => {
  const from = { x: 0, y: 0 };
  const to = { x: 600, y: 0 };
  const points = cursor.path(from, to, { random: seeded([0.9, 0.4, 0.6, 0.1]) });
  const maxDeviation = Math.max(...points.map((point) => Math.abs(point.y)));
  assert.ok(maxDeviation > 8, `expected a bowed path, deviation was ${maxDeviation}`);
});

test("distant targets are overshot then corrected; short hops are not", () => {
  const random = seeded([0.5, 0.5, 0.5, 0.5]);
  const long = cursor.withOvershoot({ x: 0, y: 0 }, { x: 800, y: 400 }, { random });
  assert.equal(long.length, 2, "a long move has an overshoot leg and a correction");
  const firstLegEnd = long[0][long[0].length - 1];
  assert.ok(firstLegEnd.x > 800, "the first leg goes past the target");
  assert.deepEqual(long[1][long[1].length - 1], { x: 800, y: 400 }, "the correction lands on the target");

  const short = cursor.withOvershoot({ x: 0, y: 0 }, { x: 60, y: 30 }, { random });
  assert.equal(short.length, 1, "a short move goes straight to the target");
});

test("movement takes longer for greater distance, within human limits", () => {
  const near = cursor.durationFor({ x: 0, y: 0 }, { x: 50, y: 0 });
  const far = cursor.durationFor({ x: 0, y: 0 }, { x: 1400, y: 600 });
  assert.ok(far > near, "further targets take longer");
  assert.ok(near >= 320, "no instantaneous jumps");
  assert.ok(far <= 1100, "no sluggish drifting");
});

test("typing rhythm varies and pauses after punctuation", () => {
  const plan = cursor.typingPlan("Hi there, welcome.", { random: seeded([0.2, 0.8, 0.5, 0.1, 0.9]) });
  assert.equal(plan.length, "Hi there, welcome.".length);
  assert.equal(plan.map((step) => step.character).join(""), "Hi there, welcome.");
  const delays = plan.map((step) => step.delay);
  assert.ok(new Set(delays).size > 3, "delays should vary, not be uniform");
  const comma = plan.find((step) => step.character === ",");
  const letter = plan.find((step) => step.character === "e");
  assert.ok(comma.delay > letter.delay, "a pause follows punctuation");
  assert.ok(Math.min(...delays) >= 40, "no impossibly fast keystrokes");
});

test("control points sit off the straight line between the two points", () => {
  const [c1, c2] = cursor.controlPoints({ x: 0, y: 0 }, { x: 100, y: 100 }, seeded([0.6, 0.2, 0.4, 0.8, 0.3, 0.5]));
  const offLine = (point) => Math.abs(point.x - point.y) > 1;
  assert.ok(offLine(c1) || offLine(c2), "at least one control point bows the curve");
});

test("settle waits until the element holds still, and gives up at the cap", async () => {
  const readings = ["a", "b", "c", "c", "c", "c", "c"];
  let index = 0;
  assert.equal(await cursor.settle(() => readings[index++], async () => {}), true);
  assert.equal(index, 6, "stopped after three unchanged samples");
  let n = 0;
  assert.equal(await cursor.settle(() => n++, async () => {}, 10), false, "a scroll that never stops hits the cap");
  assert.equal(n, 10);
});


test("cursor frames settle even when the browser suspends animation frames", async () => {
  const prior = global.requestAnimationFrame, cancel = global.cancelAnimationFrame;
  let cancelled;
  global.requestAnimationFrame = () => 42;
  global.cancelAnimationFrame = id => { cancelled = id; };
  try {
    await Promise.race([cursor.frame(), new Promise((_, reject) => setTimeout(() => reject(new Error("animation stalled")), 500).unref())]);
    assert.equal(cancelled, 42);
  } finally { global.requestAnimationFrame = prior; global.cancelAnimationFrame = cancel; }
});
