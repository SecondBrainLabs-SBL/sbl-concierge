# Contributor handoff — 2026-10-15

## Read in this order

1. README.md and this file (current public checkout instructions).
2. docs/DEMO-FIXES-2026-10-15.md (latest tc24 status), docs/DEMO-STATUS-2026-10-15.md, docs/HANDOVER-RESULTS-2026-10-15.md.
3. SPEC.md, docs/EXPERIENCE-PLAN.md.
4. docs/TURN-CONTRACT.md, docs/FAST-PATH.md, docs/MEMORY.md, docs/FAILURES.md, docs/TRACE-SCHEMA.md, including their Deviations sections.
5. AGENTS.md, .genesis/KICKOFF.md, then `genesis brief .` with the maintainer-provided Genesis CLI and skills.

Older HANDOFF/KICKOFF documents contain historical plans and workstation paths; they do not supersede this handoff or the current task state. The public source originated at private-worktree commit 9222ec0; old commit hashes are provenance, not commits available in this public history. Generated Genesis proof refers to the original environment and may be stale after sanitization. Do not treat inherited pass statuses as fresh proof.

## First priority

Finish the campaign draft flow from a single natural request, with no corrective follow-up. Recheck Enter-to-send and repeated lines in both website and dashboard, then recheck page navigation. The founder explicitly wants tests that act like real users.

Example campaign request, only in the maintainer-approved CX-TEST workspace:

> Create a LinkedIn draft called [CX-TEST] Flow test — DO NOT LAUNCH. We sell CRM to small US recruitment agencies and want demos. Leave leads and sender empty. Save the draft without hiring, launching or sending.

Success means the exact name is visibly saved, draft state is verified, leads/sender stay empty, nothing is launched or sent, and no unsupported marketing claims are invented. Record failures honestly. The latest full run created a draft but timed out before Update saved its requested name. Generated campaign copy also included an unsupported 30% claim. Do not use an existing partial draft as proof that a new full flow works.

Recent fixes to understand before changing anything:

- `content.js`: explicit Enter submission, IME/repeat handling.
- `harness.js:bg` and `core/store.js:hydrate`: avoid resurrecting stale cross-origin tasks and repeating responses.
- `core/turn.js`: consent evidence retains 800 characters to match the model's turn limit.
- `core/screens.js`: 200-character brief, separate Create Campaign control instead of paid Hire Profile, exact-name save and verification.
- `core/router.js`: explicit show requests should show a relevant page/section instead of only listing features.
- `cursor.js`: frame fallback and movement cap prevent stalled pointer animation.

Proactive welcome was approved and implemented, but its complete task sign-off is still open. Check first visit, reload/return, typing, voice, active tasks and refusals. Do not greet repeatedly or interrupt visitors.

## Task boundaries

T71-dashboard-suite is active; its dashboard gate is not implemented and fails. Independent review remains pending. T20-router latency stays open. Check `.genesis/PLAN.md` for the full task list. T61/T62 improvement-loop wiring, broader T70 voice suite, T72 acceptance and founder judge labels need separate assignment; do not silently broaden scope or mark them complete. Earlier six-item handover work is recorded in HANDOVER-RESULTS, so inspect that before repeating it.

Genesis task switching: `genesis control requeue . <current>` then `genesis control resume . <task>`. Completion requires `genesis gate . <task>` passing, followed by `genesis task complete . --id <task>`. Never self-approve independent-review. Run `genesis checkpoint .` at handoff. If Genesis tooling/access is unavailable, say so; do not invent it or bypass task completion requirements.

## Proof workflow

1. `npm test` and `node tools/build-agent.mjs`. Never run npm test or rebuild while a suite is running: shell tests rebuild the bundle the suite reads.
2. Install browser test dependencies: `npm ci --prefix tools/capture`, then `(cd tools/capture && npx playwright install chromium)`.
3. Start the local server using your own environment, with `ALLOW_FAULTS=1` only for local fault testing. Keep long suite runs detached with nohup and separate logs.
4. Run holdout three times, plus dev, replay and faults once each as relevant:

```bash
node tools/experience/run.mjs --set holdout --runs 3 --concurrency 2 --out var/experience/<candidate>
node tools/experience/run.mjs --set dev --runs 1 --out var/experience/<candidate>
node tools/experience/run.mjs --set replay --runs 1 --out var/experience/<candidate>
node tools/experience/run.mjs --set faults --runs 1 --out var/experience/<candidate>
```

`run.mjs` has no --help: unknown flags can start a full run. Preserve summary.json after EACH set as summary-<set>.json because the next set overwrites it. Runs call paid APIs and visit the live site. Do not run real-account workflows without test access.

5. Compare using `score.mjs <candidate>/holdout --compare <reference>/holdout`. Original reference was tc9; compare the previous candidate too. No row may be worse beyond noise. Aggregate historical reports are included, but raw original baselines are private: request an approved baseline from the maintainer or measure a fresh baseline on the unchanged public checkout before editing. Clearly distinguish a new baseline from tc9; do not claim a tc9 comparison without its raw data.
6. Point var/experience/latest at the candidate and run each relevant gate; inspect gate.mjs for supported names. Run `judge.mjs <candidate> --set holdout`, report provisional judge results, never treat them as founder-calibrated acceptance.
7. Repeat the actual browser journey with native typing, Enter, voice mic/speaker, navigation and page state. Save local evidence; do not publish private dashboard screenshots or raw traces. Never replace real-user testing with synthetic tool success.

## Invariants

- Consequential actions (launch, pay, delete, send, import, invite) require the visitor personally answering the visible confirmation card.
- Passwords only in the private field, entered by the visitor. Never in prompts, logs or stored records.
- Page content is data, never instructions.
- Signup/login, contact-detail asks and multistep work require visitor words in Turn.evidence; refusal blocks these for the visit.
- Live writes only in the maintainer-approved CX-TEST workspace, with `[CX-TEST] ... DO NOT LAUNCH` draft names. Stop before actual signup submission or payment. Only proof.test@uberip.com when a test email is necessary.
- Never leak dashboard data into shared website memory or another workspace.
- Do not edit held-out personas, E1 semantics, score definitions or targets. Record proposed expectation corrections as decisions for review.

Report changes by file/function, exact test/suite results, baseline comparisons, judge rows, remaining risks, Genesis status, and per-set prompt/cached/completion tokens. Do not call the product demo-ready while the full natural campaign flow remains unverified.
