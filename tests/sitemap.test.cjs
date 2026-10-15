// Site index builder + checker: pure pieces only, no network (fetch is stubbed).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const fx = (n) => path.join(__dirname, "fixtures/sitemap", n);
const good = () => JSON.parse(fs.readFileSync(fx("good.json"), "utf8"));
const NOW = Date.parse("2026-10-13T00:00:00Z");
let B, C;
test.before(async () => { B = await import("../tools/build-sitemap.mjs"); C = await import("../tools/check-sitemap.mjs"); });

const TABLE = [
  ["https://sbl.so/", false, "home"],
  ["https://sbl.so/pricing/", false, "pricing"],
  ["https://sbl.so/linkedin/", true, "product/feature"],
  ["https://sbl.so/whatsapp/", true, "product/feature"],
  ["https://sbl.so/agency/", true, "use case"],
  ["https://sbl.so/linkedin/waalaxy-alternatives-linkedin-automation/", true, "comparison"],
  ["https://sbl.so/artisan/artisan-vs-sbl-comparison/", true, "comparison"],
  ["https://sbl.so/case-study/", true, "customer story"],
  ["https://sbl.so/case-study/jnn-group/", true, "customer story"],
  ["https://sbl.so/faq/", true, "docs/help"],
  ["https://sbl.so/mcp/", true, "docs/help"],
  ["https://sbl.so/api/", true, "docs/help"],
  ["https://sbl.so/questions/best-ai-sdr-alternative-human-sdr/", true, "docs/help"],
  ["https://sbl.so/affiliate-program/", true, "company"],
  ["https://sbl.so/privacy-policy/", true, "legal"],
  ["https://sbl.so/terms-conditions/", true, "legal"],
  ["https://sbl.so/refund-policy/", true, "legal"],
  ["https://sbl.so/cancellation-policy/", true, "legal"],
  ["https://sbl.so/blog/superagi-alternatives/", true, "blog post"],
  ["https://sbl.so/blog/secondbrain-vs-heyreach-linkedin-automation/", true, "blog post"],
  ["https://sbl.so/blog/", true, "blog post"],
  ["https://sbl.so/email/some-guide-post/", true, "blog post"],
  ["https://sbl.so/heyreach/", true, "other"],
];
test("classifier table", () => { for (const [u, sm, want] of TABLE) assert.equal(B.classify(u, "", sm).type, want, u); });

test("canonical URL de-duplication matches the router's canonPath", () => {
  const set = new Set(["https://sbl.so/pricing", "https://sbl.so/pricing/?x=1#a", "//www.sbl.so/pricing", "/pricing"].map((h) => B.norm(h, "https://sbl.so/", "https://sbl.so")));
  assert.deepEqual([...set], ["https://sbl.so/pricing/"]);
  assert.equal(B.norm("https://gtm.sbl.so/", "https://sbl.so/", "https://sbl.so"), null);
  assert.equal(B.norm("mailto:a@sbl.so", "https://sbl.so/", "https://sbl.so"), null);
  assert.deepEqual(B.llmsUrls("- [A](https://sbl.so/a/)\n- [](https://sbl.so/)"), ["https://sbl.so/a/", "https://sbl.so/"]);
});

test("get(): 404 and off-site redirect are not ok, with a reason; on-site redirect records finalUrl", async () => {
  const real = globalThis.fetch;
  const res = (status, headers = {}, body = "") => ({ status, headers: new Map(Object.entries(headers)), text: async () => body });
  globalThis.fetch = async (u) => {
    if (u.endsWith("/gone/")) return res(404);
    if (u.endsWith("/out/")) return res(302, { location: "https://gtm.sbl.so/" });
    if (u.endsWith("/old/")) return res(301, { location: "/new/" });
    return res(200, { "content-type": "text/html; charset=UTF-8" }, "<html></html>");
  };
  try {
    const gone = await B.get("https://sbl.so/gone/");
    assert.equal(gone.ok, false); assert.equal(gone.status, 404);
    const out = await B.get("https://sbl.so/out/");
    assert.equal(out.ok, false); assert.match(out.reason, /off-site/);
    const old = await B.get("https://sbl.so/old/");
    assert.equal(old.ok, true); assert.equal(old.finalUrl, "https://sbl.so/new/"); assert.equal(old.redirected, true);
  } finally { globalThis.fetch = real; }
});

test("dedupeRedirects rejects the source when its final URL is indexed", () => {
  const rejected = [];
  const pages = [{ url: "https://sbl.so/old/", finalUrl: "https://sbl.so/new/" }, { url: "https://sbl.so/new/" }, { url: "https://sbl.so/r/", finalUrl: "https://sbl.so/elsewhere/" }];
  assert.deepEqual(B.dedupeRedirects(pages, rejected).map((p) => p.url), ["https://sbl.so/new/", "https://sbl.so/r/"]);
  assert.equal(rejected[0].url, "https://sbl.so/old/");
});

test("off-site links and handoff from a homepage", () => {
  const html = fs.readFileSync(fx("home.html"), "utf8");
  const { offsite, handoff } = B.offsiteAndHandoff([["https://sbl.so/", html]], "https://sbl.so");
  assert.deepEqual(offsite.map((o) => [o.text, new URL(o.href).hostname]), [
    ["GTM Engineer", "gtm.sbl.so"], ["Talk to an SDR expert", "calendar.google.com"], ["Slack", "join.slack.com"], ["YouTube", "www.youtube.com"]]);
  assert.ok(offsite.every((o) => o.from === "https://sbl.so/"));
  assert.equal(handoff.text, "Talk to an SDR expert");
  assert.equal(handoff.page, "https://sbl.so/");
  assert.match(handoff.href, /^https:\/\/calendar\.google\.com\//);
  assert.equal(B.offsiteAndHandoff([["https://sbl.so/", "<a href='/x'>x</a>"]], "https://sbl.so").handoff, null);
});

test("build failure conditions", () => {
  const mk = (n, extra = []) => [...Array.from({ length: n }, (_, i) => ({ url: `https://sbl.so/p${i}/`, type: "other" })), ...extra];
  const base = [{ url: "https://sbl.so/", type: "home" }, { url: "https://sbl.so/pricing/", type: "pricing" }];
  assert.deepEqual(B.failureReasons(mk(58, base)), []);
  assert.match(B.failureReasons(mk(57, base))[0], /only 59 non-blog/);
  assert.ok(B.failureReasons(mk(70, [base[1]])).includes("homepage missing"));
  assert.ok(B.failureReasons(mk(70, [base[0]])).includes("/pricing/ missing"));
  assert.match(B.failureReasons(mk(5, [...base, ...Array.from({ length: 200 }, (_, i) => ({ url: `https://sbl.so/b${i}/`, type: "blog post" }))]))[0], /non-blog/);
});

test("check-sitemap: good index passes", () => assert.deepEqual(C.checkIndex(good(), { now: NOW }), []));
test("check-sitemap: bad indexes fail", () => {
  const has = (m, re, opts) => assert.ok(C.checkIndex(m, { now: NOW, ...opts }).some((e) => re.test(e)), re);
  let m = good(); m.pages.push({ ...m.pages[1], url: "https://sbl.so/pricing" }); has(m, /duplicate canonical/);
  m = good(); m.pages[4].type = "comparison"; has(m, /under \/blog\/ but typed "comparison"/);
  m = good(); has(m, /stale/, { now: Date.parse("2026-12-01T00:00:00Z") });
  m = good(); m.generatedAt = "nope"; has(m, /not parseable/);
  m = good(); m.pages = m.pages.filter((p) => p.url !== "https://sbl.so/agency/"); has(m, /required page missing: \/agency\//);
  m = good(); m.pages[1].sections[0].heading = "  "; has(m, /empty heading/);
});

test("check-sitemap --diff: added, removed, retyped, headings", () => {
  const a = good(), b = good();
  b.pages = b.pages.filter((p) => p.url !== "https://sbl.so/agency/");
  b.pages.push({ url: "https://sbl.so/mcp/", title: "MCP", type: "docs/help", sections: [] });
  b.pages.find((p) => p.url.includes("/blog/")).type = "other";
  b.pages[1].sections.push({ heading: "New", level: 2 });
  const d = C.diffIndex(a, b);
  assert.deepEqual(d.added, [{ path: "/mcp/", type: "docs/help" }]);
  assert.deepEqual(d.removed, [{ path: "/agency/", type: "use case" }]);
  assert.deepEqual(d.retyped, [{ path: "/blog/some-post/", from: "blog post", to: "other" }]);
  assert.deepEqual(d.sections, [{ path: "/pricing/", added: ["New"], removed: [] }]);
});
