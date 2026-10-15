// M4 voice proof: website -> "Talk to SBL" (fake mic) -> a live GPT-Live session answers.
// Start the server first: (set -a; source .env; set +a; unset EXTENSION_ID; PORT=8787 node server.mjs &)
// One JSON receipt on stdout; logs on stderr. Exit 0 only if connected and (remote audio track or an agent transcript line).
// If the live API rejects, the receipt carries ok:false and the HTTP status only.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { enableProof } from "./browser.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const { chromium } = createRequire(path.join(repo, "tools/capture/package.json"))("playwright");
const SHOT = "/private/tmp/claude-501/-Users-ayushsingh-Downloads-agentic-commerce/de473858-ef80-4848-bb35-7e1b0436e76b/scratchpad/m4/voice.png";
fs.mkdirSync(path.dirname(SHOT), { recursive: true });
const R = "#sbl-sales-concierge-root";
const out = { build: "", environment: "local-node", endpoint: "http://127.0.0.1:8787/session", source_hash: process.env.GENESIS_SOURCE_HASH || "", connected: false, remoteTrack: false, transcriptLine: false, state: null, ok: false };
let ctx;
try {
  out.build = execSync("git rev-parse --short HEAD", { cwd: repo }).toString().trim();
  // Same profile and extension as tools/proof/browser.mjs, plus a fake microphone.
  ctx = await chromium.launchPersistentContext(path.join(repo, ".browser-profile"), {
    headless: false,
    args: [`--disable-extensions-except=${repo}`, `--load-extension=${repo}`, "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
    viewport: { width: 1440, height: 900 },
  });
  await enableProof(ctx); // the dock is closed to scripts unless the proof flag is set
  await ctx.grantPermissions(["microphone", "local-network-access"], { origin: "https://sbl.so" }).catch(() => {});
  const page = ctx.pages()[0] || (await ctx.newPage());
  // The peer connection lives in the extension's isolated world, so the content script marks the host element (data-remote-track) when the agent's audio track arrives.
  page.on("response", (res) => { if (res.url().includes("127.0.0.1:8787/session")) out.sessionStatus = res.status(); });
  await page.goto("https://sbl.so/pricing/");
  await page.waitForTimeout(4000);
  const seen = await page.locator(`${R} .voice`).count();
  if (!seen) throw new Error("the concierge dock is not on the page");
  await page.locator(`${R} .voice`).evaluate((el) => el.click()); // programmatic: the proactive invite bubble can sit over the button
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(1000);
    const s = await page.evaluate((root) => {
      const r = document.querySelector(root)?.shadowRoot;
      return {
        track: document.querySelector(root)?.dataset.remoteTrack === "true",
        events: document.querySelector(root)?.dataset.liveEvents || "",
        live: r?.querySelector(".voice")?.classList.contains("live") || false,
        state: r?.querySelector(".dock")?.dataset.state || null,
        mode: r?.querySelector(".mode")?.textContent || "",
        agentLines: r?.querySelectorAll(".messages .msg.assistant[data-voice]").length || 0,
        latest: r?.querySelector(".messages .msg.assistant[data-voice]:last-of-type, .messages .msg.assistant[data-voice]")?.textContent?.slice(0, 200) || "",
      };
    }, R);
    out.connected ||= s.live;
    out.transcriptLine ||= s.agentLines > 0;
    out.state = s.state;
    out.mode = s.mode;
    out.remoteTrack ||= s.track;
    out.liveEvents = [...new Set(s.events.split(" "))].join(" ");
    if (out.connected && out.remoteTrack && out.transcriptLine) { out.latest = s.latest; break; }
    if (out.sessionStatus && out.sessionStatus >= 400) break; // rejected by the live API: stop, do not fake it
  }
  out.dockStateOk = /^(listening|speaking)$/.test(String(out.state)) || (await page.locator(`${R} .dock[data-speaking=true]`).count()) > 0;
  out.dockEvents = await page.evaluate((root) => [...document.querySelector(root).shadowRoot.querySelectorAll(".messages .event")].map((e) => e.textContent).filter((t) => !t.startsWith("Working")).slice(-4), R);
  await page.screenshot({ path: SHOT });
  out.ok = out.connected && (out.remoteTrack || out.transcriptLine);
} catch (error) {
  out.error = String(error.message || error).slice(0, 300);
  console.error(out.error);
}
await ctx?.close().catch(() => {});
console.log(JSON.stringify(out));
process.exit(out.ok ? 0 : 1);
