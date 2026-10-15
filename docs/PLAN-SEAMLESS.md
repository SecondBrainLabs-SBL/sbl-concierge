# Plan: seamless concierge (script tag, shell, one brain)

Acceptance test: `docs/REFERENCE-VISIT.md`, two recorded passes in a row. Decisions: HANDOFF.md "Architecture interview". Evidence: `tools/proto-nav/` prototype runs.
Sonnet builds each step in a worktree; Opus reviews each step for blockers; Claude scopes and verifies with video. Deviations go in `implementation-notes.md`.

## 1. Script tag instead of extension
- One bundle (`sbl-agent.js`) built from the existing core files, served by our server. Dev and proofs inject it on every document the way a script tag would (Playwright `addInitScript`); for the beta, SBL adds one `<script>` to WordPress and the dashboard.
- `chrome.storage` (27 call sites) → one conversation/task store on our server keyed by a visitor id (`sblv`), cached in sessionStorage. The id rides the sign-up link to the app domain (fix the `&amp;` bug seen in the prototype).
- Done when: the current features run from the bundle with no extension loaded.

## 2. Shell on sbl.so
- Talk turns the page into the shell (proven in the prototype): voice lives in the top page, site pages change inside a same-origin frame, URL/title synced.
- Fixes from the prototype: reveal the frame only after scroll is restored; Back moves inside the shell (no stacked history entries); `target=_blank` sbl.so links stay inside; the app hop is a top-level move preceded by a spoken line, then reconnect with context.
- Done when: pricing → case studies → investment study → Expandi keeps one voice session, no visible jump, Back works.

## 3. One brain, one mouth
- The acting model is the only decider. Every visitor utterance goes to it; it acts and writes every spoken line. Voice only transcribes and speaks those lines (`session.commentary.append`).
- Delete the voice's delegate; the thinker becomes an input the brain reads, never a second speaker.
- The brain loop runs in the shell and acts on the frame's document, so a page change never kills it. First task of the step: confirm the page-agent engine can drive `iframe.contentDocument`; fallback is the engine inside the frame page resuming from the server store.
- Known risk from the prototype: the voice model added its own filler on 7 of 12 request-like utterances and embellished twice. Tighten its instructions and measure; if it persists, it is the first thing reported, not hidden.
- Loop guard fix: pointing and talking never count as failures; the count resets when the visitor speaks; a new request after a stop is a new task; internal lines ("same wall", steps) never reach the visitor.

## 4. Already knows the site, and gets faster
- The whole site map and dashboard screens sit in the brain's cached prompt; a `go(page, spot)` tool navigates and points in one step, so "take me to success stories" is one step, not explore-read-click.
- Latency path, each measured on the reference visit: a short spoken acknowledgement within 2 s; arrival line prepared before the move; one-step known routes; prompt caching; a faster model later. Target from the scorecard: ≤ 2 s to first sound, ≤ 6 s of silence while working.

## 5. Prove it
- The reference visit as a spoken proof (recorded visitor lines fed as the mic), fresh logged-out browser, submit sign-up with a disposable inbox. Run twice, score the scorecard from video + audio log + event log, Opus judge, then I watch it, then you.
- Report states first what the run did NOT exercise.

## Not in this plan
Browser Use Cloud and off-site walkthroughs; hosting the server for the beta (scoped at beta prep, needed before real users); mobile; the logged-in dashboard beyond landing after sign-up.

## Hard limits in every proof
Never press Yes on a confirmation card; never launch, pause, delete or create campaigns; never connect LinkedIn; never pay; one disposable test account per reference run, logged for cleanup.
