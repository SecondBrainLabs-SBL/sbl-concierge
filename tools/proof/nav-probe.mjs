// Traversal probe (pre-build decision): what Chrome actually does on browser-Back inside a shell iframe.
// Variants:
//   A — ONE frame, moves by frame.src (prototype mechanics), then browser Back.
//   B — popstate override: in the popstate handler, assign frame.src from my own stack (does the assignment
//       supersede the browser's frame restoration? does it stack an extra entry?).
//   C — TWO frames (double buffer), moves alternate frames, then browser Back (which frame restores, what shows).
// Each variant: fresh context, tiny same-origin pages via route fulfillment, video for the flash question later.
// Usage: node tools/proof/nav-probe.mjs [A|B|C|all]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const { chromium } = createRequire(path.join(repo, "tools/capture/package.json"))("playwright");
const which = process.argv[2] || "all";
const OUT = path.join(here, "out/step2/nav-probe");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PAGE = (title, color) => `<!doctype html><html><head><title>${title}</title><style>body{background:${color};font:32px system-serif;padding:40px;height:3000px}</style></head><body><h1>${title}</h1><p id="scrollpos"></p><script>
  addEventListener("scroll", () => { document.getElementById("scrollpos").textContent = "scrollY=" + Math.round(scrollY); });
</script></body></html>`;

const TOP = `<!doctype html><html><head><title>Top</title></head><body><h1>Top document</h1>
<script>
  window.__boot = (window.__boot || 0) + 1; // >1 means the top document was RELOADED (the shell died)
  window.__log = [];
  const L = (type, x = {}) => window.__log.push({ t: Date.now(), type, ...x });
  addEventListener("popstate", (ev) => L("popstate", { state: JSON.stringify(ev.state), href: location.href, frameUrl: document.getElementById("sbl-shell-frame")?.contentWindow?.location.href || null, frameAlive: Boolean(document.getElementById("sbl-shell-frame")) }));
  window.__shell = function (variant) {
    const y = scrollY; L("shell_build", { y, variant });
    let a = document.createElement("iframe"); a.id = "sbl-shell-frame";
    a.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;border:0;background:#fff;z-index:9;visibility:hidden";
    let b = null, nLoads = 0, buf = null;
    const sync = () => { try { const w = a.contentWindow, l = w.location; history.replaceState({ sblShell: 1 }, "", l.pathname); document.title = w.document.title; } catch {} };
    a.onload = () => { nLoads++;
      if (nLoads === 1) { a.contentWindow.scrollTo(0, y); a.style.visibility = "visible"; document.documentElement.style.overflow = "hidden"; document.body.replaceChildren(); L("shell_ready", { iframeScrollAtReady: a.contentWindow.scrollY, y }); }
      sync(); L("iframe_loaded", { n: nLoads, url: (a.contentWindow?.location?.href || "?").slice(-30), historyLength: history.length });
    };
    document.documentElement.append(a); a.src = "/a";
    const swap = (next) => { // double buffer: next is the freshly loaded hidden frame
      next.style.visibility = "visible"; a.style.visibility = "hidden";
      const t = a; a = next; buf = t; L("swapped", { visible: a.src.slice(-12), hidden: (buf?.src || "?").slice(-12), historyLength: history.length });
    };
    window.__move = (url) => new Promise((res) => {
      L("move_start", { url: url.slice(-12), historyLength: history.length });
      const prevScroll = a.contentWindow.scrollY;
      if (variant === "C") {
        buf = buf || document.createElement("iframe");
        buf.id = "sbl-shell-frame-2"; buf.style.cssText = a.style.cssText; buf.style.visibility = "hidden";
        buf.onload = async () => { await sleep(300); swap(buf); res(); };
        if (!buf.isConnected) document.documentElement.append(buf);
        buf.src = url;
      } else {
        const waiter = () => { a.removeEventListener("load", waiter); res(); };
        a.addEventListener("load", waiter); a.src = url;
      }
      window.__lastPrevScroll = prevScroll;
    });
    window.__state = () => ({ boot: window.__boot, historyLength: history.length, href: location.href, frameAlive: Boolean(document.getElementById("sbl-shell-frame")), frameUrl: (a.contentWindow?.location?.href || null), frameVisible: a.style.visibility, bufUrl: buf ? (buf.contentWindow?.location?.href || null) : null, bufConnected: Boolean(buf?.isConnected), log: window.__log, prevScroll: window.__lastPrevScroll });
    return "built";
  };
</script></body></html>`;

async function run(variant) {
  const out = path.join(OUT, variant);
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 }, recordVideo: { dir: out, size: { width: 1100, height: 700 } } });
  await ctx.route("https://probe.local/**", (route) => {
    const p = new URL(route.request().url()).pathname;
    const body = p === "/" ? TOP : PAGE(p.slice(1).toUpperCase(), p === "/a" ? "#eef2ff" : p === "/b" ? "#ecfdf5" : "#fef2f2");
    route.fulfill({ contentType: "text/html", body });
  });
  const page = await ctx.newPage();
  await page.goto("https://probe.local/", { waitUntil: "load" });
  await page.evaluate(() => scrollTo(0, 400)); await sleep(300);
  await page.evaluate(() => window.__shell("A"));
  await sleep(1500);
  const S = () => page.evaluate(() => window.__state());
  const before = await S();
  await page.evaluate(() => window.__move("/b")); await sleep(2500);
  const afterB = await S();
  await page.evaluate(() => window.__move("/c")); await sleep(2500);
  const afterC = await S();
  // scroll inside the shell so Back's scroll restore can be judged
  await page.evaluate(() => document.getElementById("sbl-shell-frame").contentWindow.scrollTo(0, 900)); await sleep(600);
  const preBack = await S();
  const backAt = Date.now();
  await page.goBack({ timeout: 10000 }).catch((e) => console.log(variant, "back error:", e.message.split("\n")[0]));
  await sleep(4000);
  const postBack = await S();
  if (variant !== "A") { await sleep(1500); }
  const video = page.video();
  await ctx.close(); await browser.close();
  try { const from = await video.path(); if (from) fs.renameSync(from, path.join(out, "video.webm")); } catch {}
  fs.writeFileSync(path.join(out, "result.json"), JSON.stringify({ variant, before, afterB, afterC, preBack, postBack, backAt }, null, 1));
  const r = (s) => ({ boot: s.boot, hist: s.historyLength, href: s.href.split("/").pop(), frameUrl: s.frameUrl && s.frameUrl.split("/").pop(), frameVisible: s.frameVisible });
  console.log(`\n== variant ${variant} ==`);
  console.log(" build     ", JSON.stringify(r(before)));
  console.log(" after /b  ", JSON.stringify(r(afterB)));
  console.log(" after /c  ", JSON.stringify(r(afterC)));
  console.log(" preBack   ", JSON.stringify(r(preBack)), "scrollY(in frame):", postBack.prevScroll);
  console.log(" postBack  ", JSON.stringify(r(postBack)));
  console.log(" popstates ", JSON.stringify(postBack.log.filter((e) => e.type === "popstate")));
  console.log(" loads     ", JSON.stringify(postBack.log.filter((e) => e.type === "iframe_loaded" || e.type === "swapped")));
}

for (const v of which === "all" ? ["A", "B", "C"] : [which]) await run(v);
