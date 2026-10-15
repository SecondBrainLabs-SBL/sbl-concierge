const test = require("node:test");
const assert = require("node:assert/strict");
const { KNOWLEDGE, full, core } = require("../core/sbl-knowledge.js");

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const sourced = (o) => o.source && o.retrievedAt && ISO.test(o.retrievedAt);

test("pricing entries are public, sourced and dated", () => {
  assert.ok(KNOWLEDGE.pricing.length >= 5);
  for (const p of KNOWLEDGE.pricing) {
    assert.ok(sourced(p), p.plan);
    assert.equal(p.scope, "public");
    assert.ok(p.plan && p.price && p.period && p.includes, p.plan);
  }
});

test("every published number, claim and stale-prone fact carries source + retrievedAt", () => {
  for (const p of KNOWLEDGE.proof) assert.ok(sourced(p), p.label);
  for (const f of KNOWLEDGE.faq) assert.ok(sourced(f), f.q);
  for (const c of KNOWLEDGE.channels) assert.ok(sourced(c), c.name);
  for (const u of KNOWLEDGE.useCases) assert.ok(sourced(u), u.persona);
  for (const c of KNOWLEDGE.comingSoon) assert.ok(sourced(c), c.item);
  assert.ok(sourced(KNOWLEDGE.integrations.mcp));
  assert.ok(sourced(KNOWLEDGE.integrations.api));
  assert.equal(KNOWLEDGE.integrations.mcp.toolCount, 30);
});

test("the whole pack is given to the model: every section, no cap, no ranking", () => {
  const out = full();
  for (const part of ["ABOUT SBL", "PUBLIC PRICING", "WHO IT IS FOR", "CHANNELS", "DASHBOARD MODULES", "INTEGRATIONS", "PUBLISHED NUMBERS", "FAQ", "COMING SOON"]) assert.match(out, new RegExp(part), part);
  assert.ok(out.length > 7000, `the old 7,000-character slice is gone (${out.length})`);
  assert.equal(full(), full(), "stable, so the prompt prefix caches");
  for (const p of KNOWLEDGE.pricing) assert.ok(out.includes(p.plan), p.plan);
  for (const f of KNOWLEDGE.faq) assert.ok(out.includes(f.q), f.q);
  for (const m of KNOWLEDGE.modules) assert.ok(out.includes(m.path), m.path);
});

test("always carries the no-invention rule and the public-pricing caveat", () => {
  for (const out of [full(), core()]) {
    assert.match(out, /ABOUT SBL/);
    assert.match(out, /Never invent prices/);
    assert.match(out, /not an account quote/);
    assert.match(out, /say you don't know/);
    assert.match(out, /\$99/);
    assert.match(out, /\$189/);
    assert.match(out, /Billing page is authoritative/);
  }
});

test("coming-soon items are labelled and never listed as available", () => {
  assert.match(full(), /COMING SOON \(not available yet, never present as available\)/);
  assert.match(core(), /COMING SOON/);
  const elite = KNOWLEDGE.pricing.find((p) => p.plan === "Elite");
  assert.match(elite.includes, /COMING SOON/);
  assert.ok(KNOWLEDGE.comingSoon.some((c) => /A\/B/.test(c.item)));
});

test("the voice core is a subset: pricing, FAQ and coming soon, well under the full pack", () => {
  assert.ok(core().length < full().length / 2);
  assert.match(core(), /Campaigns|FAQ/);
  assert.doesNotMatch(core(), /DASHBOARD MODULES/);
  assert.ok(KNOWLEDGE.modules.some((m) => m.name === "Campaigns" && m.path === "/campaigns"));
});

test("G2 claim is sourced to a page that shows it", () => {
  const g2 = KNOWLEDGE.proof.find((p) => /G2/.test(p.label));
  assert.ok(!/pricing/.test(g2.source));
});
