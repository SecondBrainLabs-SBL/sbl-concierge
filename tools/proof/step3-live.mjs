// Step 3 live questions. Usage: node tools/proof/step3-live.mjs <a|b|c|d> --out <dir>   (needs the local server on :8787)
import fs from "node:fs"; import path from "node:path"; import { createHash } from "node:crypto"; import { fileURLToPath } from "node:url";
import { launch, ROOT_ID } from "./browser.mjs";
const here = path.dirname(fileURLToPath(import.meta.url)), repo = path.resolve(here, "../..");
const mode = process.argv[2], OUT = path.resolve(process.argv[process.argv.indexOf("--out") + 1]);
const extId = [...createHash("sha256").update(repo).digest("hex").slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");
fs.rmSync(path.join(repo, ".browser-profile/Default/Local Extension Settings", extId), { recursive: true, force: true });
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), rnd = (a, b) => a + Math.random() * (b - a);
const t0 = Date.now(), rel = () => +((Date.now() - t0) / 1000).toFixed(1);
const log = { mode, events: [], respond: [], invites: [], actions: [] };
const ev = (e, d = {}) => { log.events.push({ t: rel(), e, ...d }); console.log(rel(), e, JSON.stringify(d).slice(0, 200)); };
const ctx = await launch({ recordVideo: { dir: OUT, size: { width: 1440, height: 900 } } });
for (const o of ["https://sbl.so"]) await ctx.grantPermissions(["local-network-access"], { origin: o }).catch(() => {});
ctx.on("request", (r) => {
  if (!/:8787\/respond/.test(r.url()) || r.method() !== "POST") return;
  let j = {}; try { j = JSON.parse(r.postData() || "{}"); } catch {}
  const c = j.context || {};
  log.respond.push({ t: rel(), mode: j.mode, page: c.page?.url, moments: c.moments, digest: c.digest, said: c.history });
});
await ctx.addInitScript(() => { window.__acts = []; document.addEventListener("sbl-agent-action", (e) => { try { const d = JSON.parse(e.detail); window.__acts.push(d.type + ":" + d.target); } catch {} }); });
const tabs = [];
const open = async (url) => { const p = tabs.length ? await ctx.newPage() : ctx.pages()[0] || (await ctx.newPage()); tabs.push(p); await p.goto(url, { waitUntil: "load" }); return p; };
const R = `#${ROOT_ID}`;
const inviteOf = (p) => p.evaluate((id) => { const r = document.getElementById(id)?.shadowRoot, i = r?.querySelector(".invite"); return i?.classList.contains("show") ? i.querySelector(".invite-say").textContent.trim() : null; }, ROOT_ID).catch(() => null);
const actsOf = (p) => p.evaluate(() => (window.__acts || [])).catch(() => []);
const seen = new Map();
const watch = async () => { for (const [i, p] of tabs.entries()) { const s = await inviteOf(p); if (s && seen.get(i) !== s) { seen.set(i, s); log.invites.push({ t: rel(), tab: i, text: s, words: s.split(/\s+/).length }); ev("invite", { tab: i, text: s }); } if (!s) seen.delete(i); } };
const mouse = { x: 700, y: 450 };
const active = async (p) => { // human-ish: drift, small scroll, hover
  await p.mouse.move(Math.max(30, Math.min(1400, mouse.x += rnd(-120, 120))), Math.max(30, Math.min(860, mouse.y += rnd(-80, 80))), { steps: 12 });
  if (Math.random() < 0.5) await p.mouse.wheel(0, rnd(-250, 350));
};
const until = async (cond, maxMs, p, step = 1500) => { const s = Date.now(); while (Date.now() - s < maxMs) { await watch(); if (await cond()) return true; if (p) await active(p); await sleep(step); } return false; };
const run = async () => {
  if (mode === "a") {
    const p = await open("https://sbl.so/pricing/");
    if (!(await until(async () => !!(await inviteOf(p)), 120000, p))) return ev("no-opener");
    await sleep(1500); await p.locator(`${R} .invite-say`).click(); ev("accepted-clicked", { url: p.url() });
    const base = (await actsOf(p)).length; let n = 0;
    for (let i = 0; i < 40; i++) { await sleep(2000);
      const a = await actsOf(p); if (a.length > n) { ev("actions", { new: a.slice(Math.max(n, 0)) }); n = a.length; }
      log.actions = a; const u = p.url();
      if (!/^https:\/\/sbl\.so\//.test(u)) { ev("LEFT-SBL-SO-abort", { u }); await p.goto("https://sbl.so/pricing/"); break; }
      if (await p.locator(`${R} .approval.show`).count()) { ev("approval-card-shown-not-touched"); break; } }
    ev("final", { url: p.url(), actions: await actsOf(p), base });
    await p.screenshot({ path: path.join(OUT, "a-end.png") });
  }
  if (mode === "b") {
    const p = await open("https://sbl.so/pricing/");
    if (!(await until(async () => !!(await inviteOf(p)), 120000, p))) return ev("no-opener");
    await sleep(1200); await p.locator(`${R} .invite-x`).click(); const td = rel(), nr = log.respond.length; ev("dismissed", { respondBefore: nr });
    await until(async () => false, 125000, p, 2500);
    ev("end", { respondAfterDismiss: log.respond.length - nr, invitesAfter: log.invites.filter((i) => i.t > td).map((i) => ({ at: +(i.t - td).toFixed(1), text: i.text })), respondTimes: log.respond.slice(nr).map((r) => +(r.t - td).toFixed(1)) });
  }
  if (mode === "c") {
    const A = await open("https://sbl.so/pricing/"), B = await open("https://sbl.so/case-study/");
    await A.bringToFront(); let dis = null; const s = Date.now();
    while (Date.now() - s < 125000) {
      for (const [i, p] of tabs.entries()) { await p.bringToFront(); for (let k = 0; k < 3; k++) { await active(p); await watch(); await sleep(1500); }
        if (!dis && (await inviteOf(p))) { await sleep(1200); await p.locator(`${R} .invite-x`).click(); dis = { t: rel(), tab: i, text: seen.get(i), resp: log.respond.length }; ev("dismissed-in-tab", dis); } }
    }
    ev("end", { respondTotal: log.respond.length, perTab: Object.fromEntries(tabs.map((p, i) => [i, log.respond.filter((r) => (r.page || "").includes(i ? "case-study" : "pricing")).length])) });
  }
  if (mode === "d") {
    const p = await open("https://sbl.so/pricing/");
    if (!(await until(async () => !!(await inviteOf(p)), 120000, p))) return ev("no-opener");
    await sleep(1200); await p.locator(`${R} .invite-x`).click(); ev("dismissed");
    { const l = await p.locator(`${R} .launcher`).boundingBox(); await p.mouse.move(l.x + l.width / 2, l.y + l.height / 2, { steps: 10 }); await p.mouse.click(l.x + l.width / 2, l.y + l.height / 2); await sleep(1500); ev("panel", { open: await p.locator(`${R} .panel.open`).count() }); }
    await p.locator(`${R} details summary`).click(); await sleep(800); const msg = p.locator(`${R} .msg.assistant`).first(); await msg.click({ clickCount: 3 }); await sleep(1200); await p.keyboard.press("Meta+c"); ev("dock-transcript-selected+copied", { sel: await p.evaluate((id) => String(document.getElementById(id).shadowRoot.getSelection?.() || getSelection()), ROOT_ID) });
    const inp = p.locator(`${R} .input-row input`); await inp.click(); await inp.fill("zzqq-input-copy-test"); await p.keyboard.press("Meta+a"); await sleep(1000); await p.keyboard.press("Meta+c"); await inp.fill(""); ev("input-copied");
    await p.locator(`${R} .launcher`).click({ force: true }).catch(() => {}); await sleep(800);
    await p.locator("h1").first().click({ clickCount: 3 }); await sleep(1500); await p.keyboard.press("Meta+c"); ev("page-h1-selected+copied-control");
    const nr = log.respond.length; await until(async () => log.respond.length > nr + 0, 150000, p, 2000); await sleep(3000);
    ev("end", { newRespond: log.respond.slice(nr).map((r) => ({ t: r.t, moments: r.moments, digestTail: (r.digest || []).slice(-8) })) });
  }
};
try { await run(); } catch (e) { ev("ERROR", { m: String(e.message).slice(0, 300) }); }
fs.writeFileSync(path.join(OUT, "log.json"), JSON.stringify(log, null, 1));
await Promise.all(tabs.map((p) => p.video()?.path().catch(() => null))).catch(() => {});
await ctx.close();
