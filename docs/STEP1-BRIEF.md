# Step 1 build brief — script tag instead of extension (PLAN-SEAMLESS step 1)

You are building in the worktree `/path/to/developer/Downloads/agentic-commerce/sbl-step1-wt`, branch
`build/step1-script-tag`. Commit there when done. Read `docs/PLAN-SEAMLESS.md` (step 1) and
`HANDOFF.md` "Architecture interview" Q1 first. Keep `implementation-notes.md` updated with any deviation.

## Goal (from the plan)
One bundle (`sbl-agent.js`) built from the existing core files, served by our server. Dev/proofs inject it
on every document the way a script tag would (Playwright `addInitScript`). `chrome.storage` (27 call
sites) → one conversation/task store on our server keyed by a visitor id (`sblv`), cached in
sessionStorage. The id rides the sign-up link to the app domain. **Done when: the current features run
from the bundle with no extension loaded.**

## Facts about the code (verified)
- Load order in `manifest.json` (files share globals, classic scripts — no imports):
  `cursor.js, core/memory.js, core/behavior.js, core/thinker.js, core/overlays.js, core/controls.js,
  core/screens.js, core/actions.js, core/sbl-knowledge.js, core/site-map.js, core/task.js,
  core/guard.js, core/constitution.js, vendor/engine.js, harness.js, content.js`
- `chrome.storage` call sites: `content.js` 22, `background.js` 4, `core/behavior.js` 1.
  Keys in use: MEMORY_KEY, ACCOUNT_KEY, FILE_KEY, READ_KEY, POS_KEY, THINKER_KEY, VISITOR_KEY,
  sbl_proof flag, and the per-tab running task (background.js, chrome.storage.session).
- `background.js` today does three things: (a) proxies every server call from the extension origin
  (`chrome.runtime.sendMessage("concierge-fetch")` in content.js line ~11), so the Local Network Access
  prompt never hits the page; (b) stores the running task per tab; (c) exists as the service worker.
- `content.js` line ~66: `chrome.runtime.getURL("assets/sbl-brain.png")` for the orb — needs a
  replacement when there is no extension.
- `server.mjs`: `isAllowed(origin)` currently only allows `chrome-extension://` origins and pins to the
  first extension that calls. CORS exists (`corsHeaders`). Server must now also accept the page origins
  `https://sbl.so` and `https://app.secondbrainlabs.com`. Keep the pinning for extension use working if
  trivial; the script-tag path is the priority. `unset EXTENSION_ID` when running the server.
- Server start (main checkout .env): `set -a; source .env; set +a; unset EXTENSION_ID; PORT=8787 node server.mjs`
- 137 tests: `npm test`. Tests must stay green.

## Build scope (keep it lazy — no new frameworks)
1. **Bundle**: `tools/build-agent.mjs` — plain Node script (no deps) that concatenates the 16 files in
   manifest order inside one IIFE, inlines the brain image as a data URI, writes `sbl-agent.js`. Server
   serves it at `GET /agent.js` (JS content-type; CORS as below). Size: site-map.js is ~720 KB — fine for
   dev; note the number.
2. **Store adapter**: one small module `core/store.js` loaded first-ish in the bundle. API mirrors what
   the call sites need (get/set/remove/onChanged-style), with two backends:
   - `chrome.storage` when available → the extension keeps working unchanged.
   - Otherwise → server-backed visitor store: `GET/PUT /store` carrying `sblv`, write-through cached in
     `sessionStorage` so a same-tab reload reads local. Keep one JSON blob per visitor on the server
     (last-write-wins); add a size cap (reuse the 80 KB readJson limit logic or similar).
   Per-visitor durable state (memory, account, file, read digests, thinker state, visitor capture state)
   → server store. Per-tab cosmetic state (dock position, per-tab running task, sbl_proof flag) →
   sessionStorage. `onChanged` cross-tab sync only needs to work within one tab in script-tag mode; keep
   the extension behavior intact.
3. **Visitor id `sblv`**: generated once, stored in a first-party cookie on sbl.so (1 year, `path=/`) so
   it survives restarts and is shared across tabs; on the app domain, take it from the `?sblv=` URL param
   and also set it as a cookie there for continuity. Use `crypto.randomUUID()`.
4. **Link decoration**: wherever the agent handles/follows links to `app.secondbrainlabs.com`, append
   `sblv` with the `URL` API (never string concat — this is the `&amp;sblv` bug fix).
5. **Server**: add `GET/PUT /store` (origin allow-list: the two page origins; keep extension pin logic),
   serve `/agent.js`, and stop the "extension only" rejection for page origins on /respond, /session,
   /agent/chat, /research. Keep CAP_PER_MIN. The old extension path keeps working.
6. **Proof** `tools/proof/script-tag.mjs`: Playwright Chromium, NO extension loaded, `addInitScript`
   with the bundle, fresh profile:
   a. sbl.so home → dock/orb appears → click through to pricing (full load) → dock reappears and state
      (memory/context) survives — verify the server store was hit (server log line per /store call).
   b. Sign-up link to app.secondbrainlabs.com carries `?sblv=<id>` (assert), app page loads the bundle,
      state continuity from the URL id (log line).
   c. Voice: connect once (mic granted via Playwright), one utterance answered — reuse the pattern in
      `tools/proof/voice-check.mjs`. Record video + events into `tools/proof/out/step1/`. Run twice.
   d. Log lines in the run: sblv value, each /store hit, each /session hit.

## First check (report it before anything else)
Page-origin fetch to `http://127.0.0.1:8787` from `https://sbl.so` may trip Chrome's Local Network Access
prompt or be blocked. Probe it in the proof browser immediately; if blocked, find the smallest mitigation
(Playwright launch arg; else report back — do not build around it). Record the result in
implementation-notes.md.

## Hard limits (apply to every proof run)
Never press Yes on a confirmation card; never launch, pause, delete or create campaigns; never connect
LinkedIn; never pay; do not create accounts in this step (the proof stops before submitting sign-up).
Never print secrets from `.env`.

## Deliverables
- Commits on `build/step1-script-tag` in the worktree (small, one concern each).
- `tools/proof/out/step1/` with two run dirs (video.webm, events.jsonl, summary.json).
- `implementation-notes.md` updated: LNA probe result, any deviation from this brief, what the proof did
  NOT exercise.
- `npm test` green (137 existing; add one small test for the store adapter).