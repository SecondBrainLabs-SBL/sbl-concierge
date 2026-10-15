// Builds a structured + prompt-ready index of every page/section on sbl.so the concierge can walk a visitor to.
// Deterministic, no LLM, no dependencies.
//   node tools/build-sitemap.mjs [--site https://sbl.so] [--out core/site-map.js] [--max 400] [--delay 300] [--concurrency 4] [--no-write]
// Discovery: sitemap XML (+ index files), /llms.txt, and the homepage's header/footer links. Every candidate must
// load (200, HTML, still on sbl.so after redirects) or it goes to `rejected`. Off-site links of the homepage and
// nav pages go to `offsite`; the "Talk to an SDR expert" booking link to `handoff`.
// Exits non-zero when the result is implausibly small (see failureReasons).
// Fetch is plain HTTP; a page whose HTML has no headings is re-read with a fresh (non-persistent) Playwright Chromium.
//
// ponytail: regex tokenizer instead of a DOM library (no new deps). It copes with WordPress/
// Elementor output; upgrade path is jsdom/linkedom if markup gets exotic.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");
const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i < 0 ? d : process.argv[i + 1] ?? true; };
const { canonPath } = createRequire(import.meta.url)("../core/router.js");
let SITE = String(arg("site", "https://sbl.so")).replace(/\/$/, "");
const DELAY = Number(arg("delay", 300)), CONC = Number(arg("concurrency", 4)), MAX_REQ = Number(arg("max", 400));
const UA = "sbl-concierge-sitemap/2.0 (+deterministic index build; contact sbl-concierge team)";
const APP_HOST = "app.secondbrainlabs.com";
const TEXT_CAP = 60000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- fetching ----------
// Polite: at most CONC requests in flight, request starts spaced >= DELAY ms apart, hard cap MAX_REQ in total.
let reqs = 0, nextSlot = 0, inflight = 0;
const waiters = [];
async function slot() {
  while (inflight >= CONC) await new Promise((r) => waiters.push(r));
  inflight++;
  const at = Math.max(Date.now(), nextSlot); nextSlot = at + DELAY;
  await sleep(at - Date.now());
}
const release = () => { inflight--; waiters.shift()?.(); };
const onSite = (u) => { try { const h = new URL(u).hostname; return h === new URL(SITE).hostname || h === "www." + new URL(SITE).hostname; } catch { return false; } };

// -> { ok, status, finalUrl, redirected, body, reason }. Redirects are followed by hand (max 5) so an off-site hop is never fetched.
export const requestCount = () => reqs;
export async function get(url, { xml = false } = {}) {
  let cur = url;
  for (let hop = 0, retry = 0; hop <= 5; ) {
    if (reqs >= MAX_REQ) return { ok: false, status: 0, reason: "request cap reached" };
    reqs++;
    await slot();
    let r;
    try { r = await fetch(cur, { redirect: "manual", headers: { "user-agent": UA, accept: xml ? "text/xml,text/plain,*/*" : "text/html,*/*" } }); }
    catch (e) { release(); if (retry++ < 1) { await sleep(1000); continue; } return { ok: false, status: 0, reason: "fetch failed: " + (e.cause?.code || e.message) }; }
    release();
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
      const next = new URL(r.headers.get("location"), cur).href;
      if (!onSite(next)) return { ok: false, status: r.status, finalUrl: next, redirected: true, reason: "redirects off-site to " + next };
      cur = next; hop++; continue;
    }
    if (r.status >= 500 && retry++ < 1) { await sleep(1000); continue; }
    const ct = r.headers.get("content-type") || "";
    const body = r.status === 200 ? await r.text() : "";
    if (r.status !== 200) return { ok: false, status: r.status, finalUrl: cur, redirected: cur !== url, reason: "HTTP " + r.status };
    if (!xml && !/html/i.test(ct)) return { ok: false, status: 200, finalUrl: cur, redirected: cur !== url, reason: "not HTML (" + ct.split(";")[0] + ")" };
    return { ok: true, status: 200, finalUrl: cur, redirected: cur !== url, body };
  }
  return { ok: false, status: 0, reason: "too many redirects" };
}

let browser;
async function render(url) {
  if (!browser) {
    const { chromium } = createRequire(path.join(repo, "tools/capture/package.json"))("playwright");
    browser = await chromium.launch({ headless: true }); // fresh, non-persistent
  }
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    return await page.content();
  } finally { await page.close(); }
}

// ---------- discovery ----------
async function sitemapUrls(url, seen = new Set()) {
  if (seen.has(url) || seen.size > 30) return [];
  seen.add(url);
  const r = await get(url, { xml: true });
  if (!r.ok) return [];
  const locs = [...r.body.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => decode(m[1]));
  if (/<sitemapindex/i.test(r.body)) {
    const out = [];
    for (const l of locs) out.push(...(await sitemapUrls(l, seen)));
    return out;
  }
  return locs;
}

const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;|&rsquo;|&lsquo;/g, "'").replace(/&ndash;|&mdash;/g, "-").replace(/&hellip;/g, "...").replace(/&[lr]dquo;/g, '"');
const clean = (s) => decode(s).replace(/\s+/g, " ").trim();

// Canonical URL of an on-site link (same rules as the router's canonPath: no query/hash, one trailing slash), else null.
export function norm(href, base = SITE + "/", site = SITE) {
  try {
    const u = new URL(href, base);
    if (!/^https?:$/.test(u.protocol)) return null;
    const host = new URL(site).hostname;
    if (u.hostname !== host && u.hostname !== "www." + host) return null;
    return site + canonPath(u.pathname);
  } catch { return null; }
}

// URLs listed in llms.txt (markdown links).
export const llmsUrls = (txt) => [...txt.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => m[1]);

const SKIP_ASSET = /\.(css|js|json|xml|xsl|txt|png|jpe?g|gif|svg|webp|ico|pdf|zip|mp4|woff2?)\/?$/i;
const SKIP_ARCHIVE = /\/(feed|comments\/feed|tag|author|category|page\/\d+|wp-(admin|json|content|includes|login\.php)|xmlrpc\.php|cdn-cgi|test-page|home)(\/|$)/i;
const LEGAL = /^\/(privacy-policy|terms-conditions|terms|terms-of-use|refund-policy|cancellation-policy|sbl-sdr-hiring-tnc|cookie-policy)\/?$/i;

// ---------- HTML -> header/footer links + heading-ordered sections ----------
const VOID = new Set("area base br col embed hr img input link meta param source track wbr path circle rect line polyline polygon use".split(" "));
const NOISE_CLASS = /(ha-post-list|ast-related|comments-area|widget-area|ast-sidebar|elementor-widget-sidebar|related-posts|cookie|offerbar|countdown)/i;
const STRUCT_ID = /^(content|main|primary|page|secondary|masthead|colophon|wrapper|root|app|__next|top|hero|headd)$|^([0-9a-f]{7}|\d+|post-\d+|menu-.*|ast-.*|wp-.*|wpr-.*|elementor.*|email-capture-\d+|hero-.*|e-n-tab-.*)$/i;

function attr(a, name) { const m = a.match(new RegExp("\\b" + name + '\\s*=\\s*"([^"]*)"', "i")) || a.match(new RegExp("\\b" + name + "\\s*=\\s*'([^']*)'", "i")); return m ? m[1] : ""; }

function parse(html) {
  const m = html.match(/<body[\s\S]*<\/body>/i);
  let b = (m ? m[0] : html).replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style|noscript|svg|template|select|iframe)\b[\s\S]*?<\/\1>/gi, " ");
  const stack = []; // {tag, id, skip, region}
  const headerLinks = [], footerLinks = [], allLinks = [], sections = [], pageNodes = [];
  let cur = null;
  const push = (o) => { cur = { level: o.level, text: o.text, anchor: o.anchor, id: o.own, nodes: [] }; sections.push(cur); };
  let headingOpen = null;
  const re = /<(\/?)([a-zA-Z][\w:-]*)([^>]*)>|([^<]+)/g;
  let t;
  while ((t = re.exec(b))) {
    if (t[4] !== undefined) {
      const txt = clean(t[4]);
      if (!txt || /^(Scroll to Top|Exclusive: Top 1%.*|Join our Community.*)$/i.test(txt)) continue; // theme boilerplate
      if (stack.some((s) => s.skip)) continue;
      if (headingOpen) { headingOpen.text += " " + txt; continue; }
      if (cur) cur.nodes.push(txt); else pageNodes.push(txt);
      continue;
    }
    const closing = !!t[1], tag = t[2].toLowerCase(), a = t[3];
    if (closing) {
      const i = stack.map((s) => s.tag).lastIndexOf(tag);
      if (i >= 0) {
        const s = stack[i];
        stack.length = i;
        if (headingOpen && headingOpen.tag === tag && s === headingOpen.entry) {
          const text = clean(headingOpen.text);
          if (text && !stack.some((x) => x.skip)) {
            const own = headingOpen.own;
            const anc = [...stack].reverse().find((x) => x.id && !STRUCT_ID.test(x.id));
            push({ level: headingOpen.level, text, own, anchor: own && !STRUCT_ID.test(own) ? own : anc ? anc.id : "" });
          }
          headingOpen = null;
        }
      }
      continue;
    }
    if (VOID.has(tag) || /\/\s*$/.test(a)) continue;
    const id = attr(a, "id") || (tag === "a" ? attr(a, "name") : "");
    const cls = attr(a, "class");
    const skip = NOISE_CLASS.test(cls) || tag === "aside";
    const isRegionTag = tag === "header" || tag === "footer" || tag === "nav";
    const region = isRegionTag && !/\bentry-|ast-archive|rank-math-breadcrumb/.test(cls) ? tag : /(site-header|elementor-location-header)/.test(cls) ? "header" : /(site-footer|elementor-location-footer)/.test(cls) ? "footer" : "";
    // header/footer/nav content is navigation, not page content
    const entry = { tag, id, skip: skip || !!region, region };
    stack.push(entry);
    if (tag === "a") {
      const h = attr(a, "href");
      if (h && !/^(mailto|tel|javascript):/i.test(h) && !h.startsWith("#") || h.startsWith("/#")) {
        allLinks.push(h);
        if (stack.some((s) => s.region === "header" || s.region === "nav")) headerLinks.push(h);
        if (stack.some((s) => s.region === "footer")) footerLinks.push(h);
      }
    }
    if (/^h[1-4]$/.test(tag) && !stack.some((s, i) => i < stack.length - 1 && s.skip)) headingOpen = { tag, level: +tag[1], text: "", own: id, entry };
  }
  return { sections, pageNodes, headerLinks, footerLinks, allLinks };
}

// ---------- meta ----------
const meta = (h, key) => {
  for (const m of h.matchAll(/<meta\b[^>]*>/gi)) {
    if (new RegExp('(?:name|property)\\s*=\\s*["\']' + key + '["\']', "i").test(m[0])) return clean(attr(m[0], "content"));
  }
  return "";
};

// ---------- proof points ----------
const PROOF = /(\$\s?\d[\d,.]*\s?[kKmMbB]?\b|\b\d[\d,.]*\s?(?:%|x\b|×|\+|k\b|K\b))/;
function proofPoints(text, max = 4) {
  const out = [];
  for (const s of text.split(/(?<=[.!?])\s+/)) {
    const m = s.match(PROOF);
    if (!m) continue;
    let q = s.trim();
    if (q.length > 180) { const i = Math.max(0, m.index - 80); q = (i ? "..." : "") + q.slice(i, i + 170).trim(); }
    if (!out.includes(q)) out.push(q);
    if (out.length >= max) break;
  }
  return out;
}

// pricing: text nodes "Starter" "$99" "/mo" ; "Enterprise" "Custom"
function plans(nodes) {
  const out = [];
  const nm = (i) => { for (let j = i - 1; j >= Math.max(0, i - 4); j--) { const n = nodes[j].replace(/[^\w &.+-]/gu, "").trim(); if (n && n.length <= 28 && !/^(mo|month|year|yr)$/i.test(n) && !/\$/.test(n)) return n; } return ""; };
  const feats = (i) => { const f = []; for (let j = i + 2; j < Math.min(nodes.length, i + 40) && f.length < 6; j++) { if (/^\$[\d,]+$/.test(nodes[j])) break; if (nodes[j - 1] === "✓") f.push(nodes[j].slice(0, 100)); } return f; };
  nodes.forEach((n, i) => {
    const m = n.match(/^\$\s?([\d,]+)$/);
    const nx = nodes[i + 2] || "";
    if (m && /^\/\s?(mo|month|yr|year)/i.test(nodes[i + 1] || "") && nx.length > 30) {
      const name = nm(i);
      if (name && !/^\w+ing\b/i.test(name) && !out.some((p) => p.name === name)) out.push({ name, price: "$" + m[1], per: nodes[i + 1].replace(/^\//, "").trim().split(" ")[0], blurb: nx.slice(0, 110), features: feats(i) });
    } else if (/^custom$/i.test(n) && /^[A-Za-z][A-Za-z &]{3,27}$/.test(nodes[i - 1] || "") && (nodes[i + 1] || "").length > 40) {
      out.push({ name: nodes[i - 1], price: "Custom", per: "", blurb: nodes[i + 1].slice(0, 110), features: [] });
    }
  });
  return out;
}

// ---------- classification ----------
// Pure function of the URL path (plus whether the sitemap/llms.txt lists it): first matching rule wins.
export function classify(url, _title, inSitemap = false) {
  const p = new URL(url).pathname.toLowerCase();
  if (p === "/") return { type: "home" };
  if (/^\/blog(\/|$)/.test(p)) return { type: "blog post", hub: /^\/blog\/?$/.test(p) || undefined };
  if (LEGAL.test(p)) return { type: "legal" };
  if (/^\/pricing\/?$/.test(p) || /^\/plans?\/?$/.test(p)) return { type: "pricing" };
  if (/^\/(case-study|customers|success-stories|stories)\/?$/.test(p)) return { type: "customer story", hub: true };
  if (/^\/(case-study|customers|success-stories|stories)\//.test(p)) return { type: "customer story" };
  if (/^\/questions\//.test(p)) return { type: "docs/help" };
  const sbl = /sbl|secondbrain|second-brain/.test(p);
  if (/(^|[-/])vs([-/]|$)|versus|alternatives\b|compar/.test(p) && !/coupon|promo|pricing|free-trial|-cost/.test(p))
    return { type: "comparison", subtype: sbl && /vs|versus/.test(p) ? "sbl-vs" : /alternatives/.test(p) ? "alternatives" : "other-vs" };
  if (/^\/(faq|questions|docs?|help|support|api|mcp|guides?)(\/|$)/.test(p)) return { type: "docs/help", hub: /^\/(questions|docs?|help)\/?$/.test(p) || undefined };
  if (/^\/(linkedin|whatsapp|email|features?|product|linkedin-comment-to-dm|sdr-profiles|signals|integrations)\/?$/.test(p)) return { type: "product/feature" };
  if (/^\/(agency|agencies|for-[\w-]+|use-cases?|solutions?)(\/|$)/.test(p)) return { type: "use case" };
  if (/^\/(about|contact|careers|affiliate-program|partners?|appsumo)\/?$/.test(p)) return { type: "company" };
  if (inSitemap && p.split("/").filter(Boolean).length >= 2) return { type: "blog post" };
  return { type: "other" };
}

// ---------- links: off-site + handoff ----------
const HANDOFF = /talk to (an )?sdr expert|book a (call|demo)/i;
// Every <a href> of the page that leaves the site: [{ text, href }] in document order (text falls back to aria-label/title).
export function externalLinks(html, site = SITE) {
  const body = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, " ");
  const out = [];
  for (const m of body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = decode(attr(m[1], "href")).trim();
    if (!/^(https?:)?\/\//i.test(href)) continue;
    let u; try { u = new URL(href.startsWith("//") ? "https:" + href : href); } catch { continue; }
    const host = new URL(site).hostname;
    if (u.hostname === host || u.hostname === "www." + host) continue;
    const text = (clean(m[2].replace(/<[^>]+>/g, " ")) || clean(attr(m[1], "aria-label")) || clean(attr(m[1], "title"))).slice(0, 80);
    out.push({ text, href: u.href });
  }
  return out;
}
// pagesHtml: [[pageUrl, html]] (homepage first). -> { offsite: [{from, text, href}], handoff: {text, href, page} | null }
export function offsiteAndHandoff(pagesHtml, site = SITE) {
  const offsite = [], seen = new Set();
  let handoff = null;
  for (const [from, html] of pagesHtml) {
    for (const l of externalLinks(html, site)) {
      if (!handoff && HANDOFF.test(l.text)) handoff = { text: l.text, href: l.href, page: from };
      if (new URL(l.href).hostname === APP_HOST) continue;
      const k = l.href; // one entry per link target: first page (homepage first) wins
      if (!seen.has(k)) { seen.add(k); offsite.push({ from, text: l.text, href: l.href }); }
    }
  }
  return { offsite, handoff };
}

// A build that looks like this must never pass as a success.
export function failureReasons(pages, site = SITE) {
  const out = [], has = (u) => pages.some((p) => p.url === site + u);
  const n = pages.filter((p) => p.type !== "blog post").length;
  if (n < 60) out.push(`only ${n} non-blog pages indexed (need at least 60)`);
  if (!has("/")) out.push("homepage missing");
  if (!has("/pricing/")) out.push("/pricing/ missing");
  return out;
}

// Rejects pages that redirect on-site to a path that is itself indexed (keeps the one that lives at the final URL).
export function dedupeRedirects(pages, rejected) {
  const own = new Set(pages.map((p) => p.url));
  return pages.filter((p) => {
    const f = p.finalUrl && norm(p.finalUrl);
    if (f && f !== p.url && own.has(f)) { rejected.push({ url: p.url, reason: "redirects to " + f + " (indexed there)" }); return false; }
    return true;
  });
}

// ---------- main ----------
async function main() {
const log = (...a) => console.error(...a);
const found = new Map(); // url -> {sitemap, nav, home, lastmod}
const add = (u, k) => { if (!u || SKIP_ASSET.test(u)) return; found.set(u, { ...(found.get(u) || {}), [k]: true }); };

log("discovering from", SITE);
const smUrls = await sitemapUrls(SITE + "/sitemap.xml");
if (!smUrls.length) for (const p of ["/sitemap_index.xml", "/wp-sitemap.xml"]) { smUrls.push(...(await sitemapUrls(SITE + p))); if (smUrls.length) break; }
for (const u of smUrls) add(norm(u), "sitemap");
const llms = await get(SITE + "/llms.txt", { xml: true });
if (llms.ok) for (const u of llmsUrls(llms.body)) add(norm(u), "sitemap"); else log("no llms.txt:", llms.reason);

const homeRes = await get(SITE + "/");
if (!homeRes.ok) { console.error("cannot fetch homepage:", homeRes.reason); process.exit(1); }
const homeP = parse(homeRes.body);
const navUrls = new Set();
for (const h of homeP.headerLinks) { const u = norm(h); if (u) { navUrls.add(u); add(u, "nav"); } }
for (const h of homeP.footerLinks) add(norm(h), "footer");
for (const h of homeP.allLinks) add(norm(h), "home");
add(SITE + "/", "sitemap");

// non-blog first, so the request cap can only ever cost blog posts
const targets = [...found.entries()].filter(([u]) => !SKIP_ARCHIVE.test(new URL(u).pathname))
  .sort((x, y) => (classify(x[0], "", !!x[1].sitemap).type === "blog post") - (classify(y[0], "", !!y[1].sitemap).type === "blog post"));
log(targets.length, "candidate URLs;", found.size - targets.length, "skipped (assets/archives)");

// fetch with a small pool; results keep discovery order
const fetched = new Array(targets.length);
let cursor = 0;
await Promise.all(Array.from({ length: CONC }, async () => {
  while (cursor < targets.length) {
    const i = cursor++, url = targets[i][0];
    fetched[i] = url === SITE + "/" ? homeRes : await get(url);
  }
}));

const pages = [], rejected = [], htmlOf = new Map();
const reject = (url, reason) => { rejected.push({ url, reason }); log("  reject", url, "-", reason); };
for (let i = 0; i < targets.length; i++) {
  const [url, f] = targets[i], r = fetched[i];
  if (!r.ok) { reject(url, r.reason === "request cap reached" ? "unchecked: request cap reached" : r.reason); continue; }
  if (!onSite(r.finalUrl)) { reject(url, "redirects off-site to " + r.finalUrl); continue; }
  let html = r.body;
  if (/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html) && !navUrls.has(url) && url !== SITE + "/") { reject(url, "noindex"); continue; }
  const canon = (html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)/i) || [])[1];
  let parsed = parse(html);
  if (!parsed.sections.length && classify(url, "", !!f.sitemap).type !== "blog post" && reqs < MAX_REQ) {
    reqs++;
    // maybe JS-rendered; ponytail: only re-render when the static HTML has no headings at all
    try { html = await render(url); parsed = parse(html); log("  rendered with Chromium:", url); } catch (e) { log("  render failed", url, e.message); }
  }
  if (url === SITE + "/" || navUrls.has(url)) htmlOf.set(url, r.body);
  const title = clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || meta(html, "og:title") || "");
  const h1 = (parsed.sections.find((s) => s.level === 1) || {}).text || "";
  const cls = classify(url, title || h1, !!f.sitemap);
  const description = meta(html, "description") || meta(html, "og:description");
  const date = (meta(html, "article:published_time") || (html.match(/"datePublished"\s*:\s*"([^"]+)"/) || [])[1] || "").slice(0, 10);
  if (!title && !parsed.sections.length) { reject(url, "empty page (no title, no headings)"); continue; }
  if (url !== SITE + "/" && !title.replace(/^\s*[|\-–]\s*(LinkedIn Outreach.*|Sbl\.so)$/i, "").trim()) { reject(url, "untitled draft page"); continue; }
  if (canon && norm(canon, SITE) && norm(canon, SITE) !== url && !/\/category\//.test(canon)) { reject(url, "canonical elsewhere: " + norm(canon, SITE)); continue; }
  const page = { url, title: title.replace(/\s*[|\-–]\s*(LinkedIn Outreach Automation.*|Sbl\.so)$/i, "").trim() || title, description, type: cls.type, status: r.status };
  if (r.redirected) page.finalUrl = r.finalUrl;
  if (cls.subtype) page.subtype = cls.subtype;
  if (cls.hub) page.hub = true;
  if (cls.type === "blog post") { page.date = date; pages.push(page); continue; }
  if (date) page.date = date;
  // sections
  const secs = [];
  const seenTxt = new Set();
  for (const s of parsed.sections) {
    const key = s.level + s.text;
    if (seenTxt.has(key)) continue;
    seenTxt.add(key);
    const body = s.nodes.filter((n) => n !== "✓" && n.length > 1).join(" ").replace(/\s+([,.;:!?)])/g, "$1");
    const sec = { heading: s.text, level: s.level, anchor: s.anchor || "", text: body.slice(0, 200).trim(), proof: proofPoints(body, cls.type === "pricing" ? 6 : 4) };
    secs.push(sec);
  }
  // drop an anchor that a wrapper shares with most sections (it is the page, not a section)
  const cnt = {}; secs.forEach((s) => s.anchor && (cnt[s.anchor] = (cnt[s.anchor] || 0) + 1));
  for (const s of secs) if (s.anchor && cnt[s.anchor] > 3 && cnt[s.anchor] > secs.length / 2) s.anchor = "";
  page.sections = secs;
  if (cls.type === "pricing") {
    const all = [...parsed.pageNodes, ...parsed.sections.flatMap((s) => s.nodes)];
    // hero plans sit in the first section's nodes / page nodes; scan in document order
    page.plans = plans(parsed.sections.length ? [...parsed.pageNodes, ...parsed.sections.flatMap((s) => [s.text, ...s.nodes])] : all);
  }
  if (cls.type === "customer story" && !cls.hub) {
    // Pages state "Client: X Industry: Y ..." in the meta description (labels run together, no separators).
    const LAB = "(?:Client|Industry|Creator Type|Offer|Campaign Theme|Offer Type|Primary CTAs?|Target Audience|Campaigns? (?:Run|Type|Objective|Style)|Campaign Objective|Product|Lead Source|Platforms? Used)";
    const field = (name) => { const m = description.match(new RegExp(name + ":\\s*(.+?)(?=" + LAB + ":|$)")); return m ? clean(m[1]) : ""; };
    const h1t = (parsed.sections.find((x) => x.level === 1) || {}).text || "";
    if (h1t.length > page.title.length) page.title = h1t.replace(/\s+\?$/, "?"); // some pages have a bare "Cold Outreach Case Study" <title>
    const ch = parsed.sections.map((x) => x.text.match(/\bClient:\s*(.+)/)).find(Boolean);
    const T = page.title.replace(/[?!.]+$/, "");
    page.customer = field("Client") || (ch && clean(ch[1])) || (T.match(/\bfor the ([A-Z][\w&' -]{2,40})$/) || [])[1] || "";
    page.businessType = field("Industry") || field("Creator Type") || (T.match(/^(?:.*?:\s*)?How (?:we \w+ )?(?:a|an) ([\w -]{3,50}?) (?:Added|Generated|Closed|Booked|Drove|Built)\b/i) || T.match(/\b(?:helped|for) (?:a|an) ([\w -]{3,50}?)(?: to | Using |\s+(?:generate|activate|build|drive|close|convert|hit|turn)\b|$)/i) || [])[1] || "";
    const res = parsed.sections.find((x) => /^\d*\.?\s*Results?\b/i.test(x.text));
    const resFull = res ? res.nodes.join(" ").replace(/\s+([,.;:!?)])/g, "$1").replace(/\s+/g, " ").trim() : "";
    if (resFull) page.results = resFull.slice(0, 300);
    // headline numbers: "<number> <noun phrase>" from the title and the Results section
    const NUM = /(?:\$\s?)?\b\d[\d,.]*[kKmM]?\+?%?(?:\s+(?:[A-Za-z-]+\s?){1,3})/g;
    page.numbers = [...new Set([...(T + ". " + resFull.slice(0, 900)).matchAll(NUM)].map((m) => m[0].trim().replace(/\s+(?:and|from|with|of|the|in|to|a|was|were|for|that|which|on)$/i, "")).filter((x) => x.length > 4 && !/^\d{4}\b/.test(x)))].slice(0, 6);
    const tp = proofPoints(page.title.replace(/[?!.]+$/, ""), 1);
    if (tp.length) page.headline = tp[0];
  }
  // purpose: meta description unless it is a tagline (too short), else the H1
  const weak = (x) => !x || x.length < 50;
  page.purpose = !weak(description) ? description : (parsed.sections.find((x) => x.level === 1)?.text) || description || page.title;
  pages.push(page);
  log(" ", cls.type.padEnd(15), url, secs.length ? `(${secs.length} sections)` : "");
}
if (browser) await browser.close();
const kept = dedupeRedirects(pages, rejected);
pages.length = 0; pages.push(...kept);
const { offsite, handoff } = offsiteAndHandoff([...htmlOf.entries()].sort((a, b) => (b[0] === SITE + "/") - (a[0] === SITE + "/")), SITE);

// ---------- text rendering ----------
// Priority order (spend the cap where the concierge needs it): home+pricing in full, product/use-case
// sections with proof, every customer story with customer/type/numbers, SBL-vs pages with headings,
// other comparison pages as title+URL, docs/help as one line. Blog posts are NOT in text (kept in pages).
const rel = (u) => u.replace(SITE, "") || "/";
const cut = (x, n) => (x.length > n ? x.slice(0, n - 1).trimEnd() + "..." : x);
function render_({ body, proofMax, maxSecs }) {
  const by = (t) => pages.filter((p) => p.type === t).sort((a, b) => a.url.localeCompare(b.url));
  const secLines = (p, { max = 99, maxLevel = 4, bodyLen = body, proof = proofMax } = {}) =>
    (p.sections || []).filter((s) => s.level <= maxLevel).slice(0, max).map((s) => {
      const t = bodyLen && s.text ? ": " + cut(s.text, bodyLen) : "";
      const shown = t.replace(/\.\.\.$/, "");
      const ps = s.proof.filter((x) => !shown.includes(x.replace(/^\.\.\./, "").slice(0, 40))).slice(0, proof).map((x) => cut(x, 140));
      const pr = ps.length ? " || " + ps.join(" | ") : "";
      return `${"  ".repeat(Math.max(0, Math.min(s.level, 4) - 1))}- ${s.heading}${s.anchor ? " (#" + s.anchor + ")" : ""}${t}${pr}`;
    });
  const head = (p, tag) => `\n[${tag || p.type}] ${rel(p.url)} - ${p.title}\n${cut(p.purpose || p.description, 220)}`;
  const out = [`SBL SITE MAP (${SITE}). Paths are relative to ${SITE}. "(#anchor)" is an element id you can scroll to at path#anchor. Sections are in page order, indented by heading level. Blog posts are not listed.`];
  for (const p of [...by("home"), ...by("pricing")]) {
    out.push(head(p));
    for (const pl of p.plans || []) out.push(`Plan: ${pl.name} ${pl.price}${pl.per ? "/" + pl.per : ""} - ${pl.blurb}${pl.features.length ? " Key: " + pl.features.join("; ") : ""}`);
    out.push(...secLines(p, { bodyLen: 200, proof: 6 }));
  }
  for (const p of [...by("product/feature"), ...by("use case")]) { out.push(head(p)); out.push(...secLines(p, { max: maxSecs, maxLevel: 3 })); }
  out.push("\nCUSTOMER STORIES (pick the one most like the visitor: customer, business type, numbers)");
  for (const p of by("customer story")) {
    if (p.hub) { out.push(`\n[customer story hub] ${rel(p.url)} - all stories`); continue; }
    const uniq = (p.numbers || []).map((x) => cut(x, 45));
    out.push(`\n[customer story] ${rel(p.url)}\nCustomer: ${p.customer || "unknown"} | Type: ${p.businessType || "unknown"} | ${cut(p.title.replace(/^.*?case study:\s*/i, ""), 120)}${p.results ? "\nResults: " + cut(p.results, 260) : ""}${uniq.length ? "\nNumbers: " + uniq.join(" | ") : ""}`);
  }
  out.push("\nSBL vs COMPETITOR PAGES (section headings show the specific differences)");
  const cmp = by("comparison");
  for (const p of cmp.filter((x) => x.subtype === "sbl-vs")) { out.push(`\n[comparison/sbl-vs] ${rel(p.url)} - ${p.title}`); out.push(...secLines(p, { maxLevel: 3, bodyLen: 0, proof: 0, max: 30 })); }
  out.push("\nOTHER COMPARISON / ALTERNATIVES PAGES (title and URL only)");
  for (const p of cmp.filter((x) => x.subtype !== "sbl-vs")) out.push(`- ${rel(p.url)} - ${p.title}`);
  out.push("\nDOCS / HELP / COMPANY / LEGAL / OTHER (title, URL, one line)");
  for (const p of [...by("docs/help"), ...by("company"), ...by("legal"), ...by("other")]) out.push(`- [${p.type}] ${rel(p.url)} - ${p.title}${p.purpose && p.purpose !== p.title ? ": " + cut(p.purpose, 110) : ""}`);
  if (handoff || offsite.length) {
    out.push("\nOFF-SITE LINKS (these leave sbl.so: never navigate the visitor's tab to them; name them instead)");
    if (handoff) out.push(`- "${handoff.text}" is the booking link (off-site, on ${rel(handoff.page)})`);
    const hosts = new Set();
    for (const o of offsite.filter((x) => (!handoff || x.href !== handoff.href) && x.text.length <= 40)) { const h = new URL(o.href).hostname; if (hosts.has(h) || hosts.size >= 15) continue; hosts.add(h); out.push(`- "${o.text}" -> ${h}`); }
  }
  return out.join("\n");
}
let text, trimmed = [];
for (const [body, proofMax, maxSecs] of [[120, 3, 40], [100, 2, 30], [80, 2, 25], [60, 1, 22], [40, 1, 20], [0, 1, 20], [0, 0, 14]]) {
  text = render_({ body, proofMax, maxSecs });
  trimmed = [body < 120 && `product/use-case section body text cut to ${body} chars`, proofMax < 3 && `product/use-case proof points cut to ${proofMax} per section`, maxSecs < 40 && `product/use-case pages limited to ${maxSecs} h1-h3 sections in text`].filter(Boolean);
  if (text.length <= TEXT_CAP) break;
}
if (text.length > TEXT_CAP) { text = text.slice(0, TEXT_CAP); trimmed.push("hard-truncated at cap"); }
trimmed.unshift("blog posts omitted from text by design (kept in pages)");

// ---------- write ----------
const counts = {};
pages.forEach((p) => (counts[p.type] = (counts[p.type] || 0) + 1));
const generatedAt = new Date().toISOString();
const data = { generatedAt, site: SITE, pages, text, rejected, offsite, handoff, counts, checked: { ok: pages.length, rejected: rejected.length } };
const js = `// GENERATED by tools/build-sitemap.mjs on ${generatedAt}. Do not edit by hand; re-run the script.
// Site index for the concierge: every page and section it can walk a visitor to.
// SBLSiteMap = { generatedAt, site, pages (structured), text (compact prompt rendering), rejected, offsite, handoff, counts, checked }.
(function attachSiteMap(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SBLSiteMap = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createSiteMapModule() {
  const SBLSiteMap = ${JSON.stringify(data, null, 1)};
  return SBLSiteMap;
});
`;
const fails = failureReasons(pages, SITE);
const outArg = arg("out", "");
const out = outArg ? path.resolve(outArg) : path.join(repo, "core/site-map.js");
if (!process.argv.includes("--no-write") && !fails.length) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, js);
  if (!outArg) {
    const dir = path.join(repo, "tools/proof/out/sitemap");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "site-map.txt"), text);
  }
}
console.log(JSON.stringify({ out: fails.length ? null : out, pages: pages.length, counts, checked: data.checked, requests: reqs, textChars: text.length, trimmed: trimmed.length ? trimmed : "nothing trimmed" }, null, 1));
if (fails.length) { console.error("BUILD FAILED, nothing written: " + fails.join("; ")); process.exit(1); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
