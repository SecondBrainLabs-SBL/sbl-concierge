// Voice answer proof: on sbl.so, connect voice with a fake mic that plays a prepared WAV (speech made by macOS `say`),
// ask by voice for a signup, let the agent ask the visitor something, answer by voice, and check the answer reached the harness.
// Start the server first (see voice-check.mjs). Usage: node tools/proof/voice-answer.mjs <outDir>
// Stops the run once the answer is received; never submits anything; the signup needs a typed password, so no account can be made.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const { chromium } = createRequire(path.join(repo, "tools/capture/package.json"))("playwright");
const R = "#sbl-sales-concierge-root";
const dir = path.resolve(process.argv[2] || path.join(here, "out/voice-answer"));
fs.mkdirSync(dir, { recursive: true });
const ASK = "Hi. I would like to sign up for S B L. Please ask me whatever you need from me.";
const ANSWER = "My name is C X Test.";
const [LEAD, GAP, TAIL] = [14, 60, 15]; // seconds of silence: connect + greeting, agent working until it asks, after the answer

// One WAV: silence, ask, silence, answer, silence. Chrome plays it once (%noloop).
const wav = path.join(dir, "speech.wav");
const piece = (name, text) => { const f = path.join(dir, name); execSync(`say -o ${f} --data-format=LEI16@48000 ${JSON.stringify(text)}`); return f; };
const silence = (sec) => Buffer.alloc(48000 * 2 * sec);
const data = (f) => { const b = fs.readFileSync(f); const i = b.indexOf("data") + 8; return b.subarray(i); };
const pcm = Buffer.concat([silence(LEAD), data(piece("ask.wav", ASK)), silence(GAP), data(piece("answer.wav", ANSWER)), silence(TAIL)]);
const head = Buffer.alloc(44);
head.write("RIFF", 0); head.writeUInt32LE(36 + pcm.length, 4); head.write("WAVEfmt ", 8); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
head.writeUInt32LE(48000, 24); head.writeUInt32LE(96000, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34); head.write("data", 36); head.writeUInt32LE(pcm.length, 40);
fs.writeFileSync(wav, Buffer.concat([head, pcm]));

const out = { ok: false, acts: [], lines: [], memory: {}, checks: {} };
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sbl-voice-answer-"));
const ctx = await chromium.launchPersistentContext(profile, {
  headless: false,
  args: [`--disable-extensions-except=${repo}`, `--load-extension=${repo}`, "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${wav}%noloop`],
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir, size: { width: 1280, height: 800 } },
});
try {
  const worker = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 15000 }));
  await worker.evaluate(() => chrome.storage.local.set({ sbl_proof: true }));
  await ctx.grantPermissions(["microphone"], { origin: "https://sbl.so" }).catch(() => {});
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.addInitScript(() => { window.__acts = []; document.addEventListener("sbl-agent-action", (e) => { try { const d = JSON.parse(e.detail); window.__acts.push(`${Math.round(performance.now() / 1000)}s ${d.type}:${d.target}`); } catch {} }, true); });
  await page.goto("https://sbl.so/");
  await page.waitForTimeout(4000);
  await page.locator(`${R} .voice`).evaluate((el) => el.click());
  const t0 = Date.now();
  const snap = () => page.evaluate((root) => {
    const r = document.querySelector(root).shadowRoot;
    return { acts: window.__acts, lines: [...r.querySelectorAll(".messages .msg")].map((m) => `${m.classList.contains("user") ? "USER" : "ASSISTANT"}${m.dataset.voice ? "(voice)" : ""}: ${m.textContent}`) };
  }, R);
  let stopped = false;
  while (Date.now() - t0 < (LEAD + GAP + TAIL + 25) * 1000) {
    await page.waitForTimeout(1000);
    const s = await snap().catch(() => null);
    if (!s) break;
    Object.assign(out, s);
    if (!stopped && s.acts.some((a) => / answer:/.test(a))) { // the harness received the answer: stop the run before anything else happens
      await page.waitForTimeout(6000);
      await page.locator(`${R} .stop`).evaluate((el) => el.click()).catch(() => {});
      stopped = true; Object.assign(out, await snap());
      break;
    }
  }
  const stored = await worker.evaluate(() => chrome.storage.local.get(null));
  const hits = Object.entries(stored).filter(([, v]) => /C X Test|CX Test/i.test(JSON.stringify(v))).map(([k]) => k);
  out.memory = { keysWithSpokenAnswer: hits, asked: Object.entries(stored).some(([, v]) => /sign up/i.test(JSON.stringify(v)) && /voice|memory|turn|message/i.test(JSON.stringify(v))) };
  const has = (re) => out.lines.some((l) => re.test(l));
  out.checks = {
    spokenAskedAloud: has(/^ASSISTANT\(voice\).*\?/),
    actReturnedWhileWaiting: out.acts.some((a) => /act_waiting/.test(a)),
    agentAsked: out.acts.some((a) => / ask_user:/.test(a)),
    harnessGotSpokenAnswer: out.acts.some((a) => / answer:/.test(a)),
    spokenLinesInMemory: hits.length > 0,
    stoppedBeforeAnyAccount: stopped,
  };
  out.ok = Object.values(out.checks).every(Boolean);
  await page.screenshot({ path: path.join(dir, "end.png") });
} catch (e) { out.error = String(e.message || e).slice(0, 300); }
await ctx.close().catch(() => {});
out.video = fs.readdirSync(dir).filter((f) => f.endsWith(".webm"));
fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
process.exit(out.ok ? 0 : 1);
