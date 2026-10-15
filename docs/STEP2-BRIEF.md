# Step 2 build brief — shell on sbl.so (PLAN-SEAMLESS step 2)

Worktree: `/path/to/developer/Downloads/agentic-commerce/sbl-step2-wt`, branch `build/step2-shell`.
Read first: `docs/PLAN-SEAMLESS.md` step 2, `HANDOFF.md` interview Q5 + shell prototype lines,
`implementation-notes.md` (step 1 facts). The proven throwaway prototype is in the MAIN checkout
(untracked): `/path/to/sbl-concierge/tools/proto-nav/shell.js`
(109 lines) and `shell-run.mjs` — read both; copy its proven mechanics, don't reinvent.

## Goal (from the plan)
Talk turns the page into the shell: voice lives in the top page, site pages change inside a same-origin
frame, URL/title synced. **Done when: pricing → case studies → investment study → Expandi keeps one
voice session, no visible jump, Back works.**

Proven mechanics to reuse from `shell.js`:
- Iframe `position:fixed; inset:0; 100vw/100vh; border:0; background:#fff; z-index:2147483000;
  visibility:hidden`; `frame.src = current URL` on Talk; first load: `contentWindow.scrollTo(0, scrollY)`
  then reveal, `overflow:hidden` on `<html>`, `body.replaceChildren()`.
- URL/title sync: `history.replaceState(null,"",iframePath)` + `document.title` on every iframe load
  and on a 500 ms interval.
- Link interceptor INSIDE the iframe (capture click listener, in the iframe document):
  sbl.so `target=_blank/_top/_parent` → preventDefault + `location.assign` (stays inside);
  sbl.so same-tab → default (inside iframe); `*.secondbrainlabs.com` → preventDefault, add `sblv`
  param, **top-level** `T.location.assign` (the hop); other hosts → untouched.
- Acting on the iframe DOM from the top document works same-origin (`frame.contentDocument`):
  scrollIntoView + outline proven in the prototype (shell-1 run).
- Voice never reconnects during iframe moves: one /session, same peer connection, ≤600 ms silence
  (audio kept playing across moves in shell-1 and shell-2).

Defects to fix (confirmed on video):
1. **Blank viewport during a move** (shell-2 ~60 s frame): changing `frame.src` whites out the frame
   while the new page loads (0.6–2.5 s), voice still talking. Fix lazily — pick ONE:
   snapshot overlay (canvas screenshot of the old page shown until the new load fires) or a
   double-buffered second iframe. Preference: the snapshot overlay if it holds up on Elementor pages.
2. **Back after the hop loads a plain page** — acceptable state is: Back from the app domain returns to
   an sbl.so page that boots the bundle normally (voice auto-reconnects — step 1 already gives
   continuity); inside the shell, Back must move the iframe back through sbl.so history without
   leaving the shell. Note: iframe navigations create joint-session entries (history.length grew
   3→6 in the prototype). Implement a small shell history: intercept `popstate` (and expose the
   dock's own Back affordance if simpler), drive `frame.src` from the stack, keep top-level
   `replaceState` in sync. Exactly one history entry per move — no stacked duplicates.
3. **First reveal at scroll 0 then jump** — reveal strictly after scroll restore (prototype does
   scrollTo before reveal; keep that and assert it in the proof: `iframeScrollAtReady === scrollYBefore`).

Additional requirements beyond the prototype:
4. **Talk builds the shell** — hook into the real dock's Talk flow in `content.js`: when voice connects
   on an sbl.so page, build the shell around the current URL. If voice fails to connect, no shell.
   The dock/cursor keep working from the top document.
5. **Bundle boot rule inside the shell**: step 1 boots top-frame-only. Add guest mode: when the bundle
   boots inside `#sbl-shell-frame` (window.top !== window, frame id matches), do NOT boot dock/cursor/
   voice; instead run behavior capture and forward a compact event set (page nav, scroll depth/section,
   clicks on links/buttons, copy/select if cheap) via `postMessage` to the shell host, which feeds the
   existing digest/behavior pipeline (`core/behavior.js` shapes — reuse, don't rewrite). This keeps the
   brain's context alive as pages move.
6. **Agent navigation must not kill the shell** (the founder's "voice died on the agent's OWN navigate"
   defect): the harness `navigate` tool on sbl.so, when the shell is active, must set `frame.src`
   (same-origin) instead of `location.assign`. App-domain navigation stays top-level. Confirm where
   navigate is implemented (`harness.js`/`core/task.js`/`vendor/engine.js` tool wiring) and route it.
7. **sblv continues to ride app-bound links** via the interceptor (step 1's URL-API decoration — reuse
   `core/store.js` helpers if they exist there; keep one implementation).
8. The hop itself keeps step-1 behavior: top-level move to app.secondbrainlabs.com with `sblv`,
   voice reconnects there (already proven). A spoken line right before the hop is step 3/4 territory —
   just don't block it.

## First check (report before building)
Confirm the step-1 bundle still boots on sbl.so with no extension (rebuild `sbl-agent.js` via
`tools/build-agent.mjs`, serve from the worktree). If the boot guard from step 1 blocks the shell iframe
boot in a way guest mode can't fix, report before writing product code.

## Proof — `tools/proof/shell-proof.mjs`, output `tools/proof/out/step2/run-N`
Scripted visitor, no extension, fresh profile, bundle injected (step-1 pattern), mic + LNA granted,
record video + events:
1. Open sbl.so/pricing, scroll to ~1200, press Talk (real dock button), voice connects.
2. Click through: pricing → Success Stories (case-study listing) → investment-firm study → Expandi
   comparison (real clicks). Each move: same peer connection (`window.__pc` identity check — keep the
   prototype's identity() approach or the equivalent via events), audio gap during move ≤ 1 s, no blank
   flash on video (assert via frame sampling: no fully-white viewport frame between load start and
   reveal), URL + title synced.
3. Scroll inside the shell to a section, outline/point at a heading from the top document
   (proves same-origin control end to end).
4. Press Back (browser back) inside the shell → iframe moves back one page, still in shell, one entry
   per move (assert history length delta).
5. Click the sign-up link → top-level hop to app.secondbrainlabs.com/signup?sblv=… → voice reconnects
   with context (≥1 carried line from the shell visit).
6. Run twice (run-1, run-2); both must pass every check.
Also assert the digest gets iframe-page events (one log line showing a forwarded event landed in the
host's digest/behavior pipeline).

## Hard limits (unchanged)
Never press Yes on a confirmation card; never launch, pause, delete or create campaigns; never connect
LinkedIn; never pay; do NOT create accounts (stop before submitting sign-up). Never print `.env`.
Server env: `set -a; source /path/to/sbl-concierge/.env; set +a;
unset EXTENSION_ID; PORT=8787 node server.mjs` (run from the worktree dir). `npm test` green (142) —
add tests for the shell history stack and the boot/guest-mode rule.

## Known risks to measure, not fix (report numbers)
- Audio gap per move (target ≤ 1 s; prototype had ≤600 ms).
- First-audio after hop (prototype 5.7–6.8 s) — measure, no fix this step.
- Voice filler/embellishment — step 3's problem; note anything seen.
