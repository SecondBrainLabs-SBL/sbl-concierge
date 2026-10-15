// Builds sbl-agent.js: the manifest files (plus core/store.js) concatenated in manifest order inside one IIFE,
// with the brain image inlined as a data URI. What a <script> tag loads instead of the extension.
// Usage: node tools/build-agent.mjs   (the server serves the result at GET /agent.js)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The bundle's boot decision, in one place and testable (tests/shell.test.cjs calls it with fake globals).
// The same function source is inlined into the bundle below, so this file and the bundle cannot drift.
// - "main": the top document of the two SBL origins — the full concierge (dock, voice, harness).
// - "guest": inside #sbl-shell-frame on sbl.so — step 2's shell frame: no dock/voice/harness here;
//   shell.js's guest side runs (link rules + behavior capture forwarded to the host document).
// - "none": every other frame (ads, embeds, devtools) and every foreign page — stand down.
export function bootMode() {
  const onSbl = /^https:\/\/(sbl\.so|app\.secondbrainlabs\.com)\b/.test(location.href);
  if (window.top === window) return onSbl ? "main" : "none";
  try {
    const fe = window.frameElement;
    return fe && fe.id === "sbl-shell-frame" && location.hostname === "sbl.so" ? "guest" : "none";
  } catch { return "none"; } // cross-origin parent: not ours
}

export function build() {
  const manifest = JSON.parse(fs.readFileSync(path.join(repo, "manifest.json"), "utf8"));
  const files = manifest.content_scripts[0].js; // single source of load order (the extension loads the same list)
  if (!files[0].includes("core/store.js")) throw new Error("core/store.js must be first in manifest.json: everything else may use it");
  if (!files.includes("shell.js")) throw new Error("shell.js must be in manifest.json: the bundle carries the shell");

  const brain = fs.readFileSync(path.join(repo, "assets/sbl-brain.png")).toString("base64");
  const prelude = `globalThis.SBL_BRAIN = "data:image/png;base64,${brain}";`;

  const body = files.map((f) => `\n// ---- ${f} ----\n${fs.readFileSync(path.join(repo, f), "utf8")}`).join("\n");
  const out = `// sbl-agent.js — built by tools/build-agent.mjs from the manifest.json order; do not edit, build instead.
// The bundle prelude carries what the extension got from chrome.runtime: the inline brain image.
(function () {
  // Boot rule (tools/build-agent.mjs bootMode): top document of the two SBL origins = main; inside
  // #sbl-shell-frame on sbl.so = guest (step 2's shell: content.js stands down, shell.js captures);
  // never in ad/iframe frames (the extension's manifest had all_frames:false by default), never foreign pages.
  const MODE = (${bootMode.toString()})();
  if (MODE === "none") return;
  globalThis.SBL_SHELL_GUEST = MODE === "guest";
  const __sblBoot = () => {
${prelude}${body}
  };
  // Injected at document start (init script), the parser may not have made <html> yet; a real <script> tag always has.
  if (document.documentElement) __sblBoot();
  else { const wait = setInterval(() => { if (document.documentElement) { clearInterval(wait); __sblBoot(); } }, 1); }
})();
`;
  fs.writeFileSync(path.join(repo, "sbl-agent.js"), out);
  console.log(`sbl-agent.js: ${(out.length / 1024).toFixed(0)} KB from ${files.length} files (brain image ${Math.round(brain.length * 0.75 / 1024)} KB)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) build();
