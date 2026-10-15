# Experience plan — draft for founder approval

Status: proposal. Nothing is built. Tasks below become Genesis tasks after `SPEC.md` is approved.
Requirement ids (FR/NFR/AC) refer to `SPEC.md`. Evidence: `docs/EXPERIENCE-BASELINE-2026-10-13.md`.

## The idea in five lines

1. Measure first. Build the trace, the scorecard and the persona suite before changing behaviour, so every later change has a before and after.
2. Give a turn a shape: acknowledge, answer, show one thing, stop. Most of today's failures are a turn that never ends.
3. Take the model out of the steps that do not need it. Known destinations are a lookup, not a five-call search.
4. Make knowledge and memory mechanisms the harness runs, not things the model may or may not do.
5. Only then let the harness propose its own fixes, gated by the same scorecard on visitors it has not seen.

## Order and why

| Phase | What | Why here |
|---|---|---|
| 0 | Eyes: trace, suite, scorecard, baseline | Without it, nothing after can be judged |
| S | Spikes: five questions answered with throwaway code | Each can change the design; cheap to learn now |
| 1 | Turn contract | Fixes E5, E8, E9 and removes the need for most guards |
| 2 | Fast path | Fixes E1, E2; depends on the turn contract's shape |
| 3 | Verified knowledge and showing | Fixes E3, E4 |
| 4 | Memory | Fixes E6, E7 |
| 5 | Failure paths and capacity | Closes E8 for every failure class |
| 6 | Improvement loop | Needs phases 0–5's measurements to be trustworthy |
| 7 | Voice and dashboard parity, pilot readiness | Same bar on the other surfaces |

Phases 3 and 4 are independent of each other and can run in parallel after phase 2.

## Phase 0 — Eyes (no behaviour change)

| Task | Outcome | Requirements | Scope | Gate | Risk |
|---|---|---|---|---|---|
| T01-trace | Per-turn trace written by the server as append-only JSONL; the dead per-step usage line fixed; crash cause kept; values masked | FR-15, NFR-11, NFR-12 | `server.mjs`, `harness.js`, new `core/trace.js`, tests | unit tests; a run with the trace store unwritable still answers | medium |
| T02-suite | Today's driver moved into `tools/experience/`; personas as data files: 6 development, 4 held-out (never shown to whoever writes fixes), plus a replay of the 2026-10-12 founder session; each persona runs N=3; cost per run reported | FR-17 | `tools/experience/` | suite runs end to end on the unchanged build | low |
| T03-scorecard | Program that turns traces into E1–E9. Objective rows computed (latency, calls, lines per turn, 404/off-site, silent turns, actions after stop, signup without request, repeats) | FR-16 | `tools/experience/score.mjs`, tests | unit tests on recorded traces from the baseline | low |
| T04-judge | Model judge for the judged rows (asked-vs-done, highlight matches line, usefulness). Founder labels 40 turns; agreement reported per row | FR-16, AC-5 | `tools/experience/judge.mjs` | agreement ≥ 85% per row, or the row stays human-scored | medium |
| T05-baseline | Baseline scorecard on the unchanged build with its noise floor (spread across runs) | NFR-10 | report only | report committed | low |
| T06-base | One decision on the code base: which of the uncommitted step-3 edits and the RSI branch come in. Recorded as a Genesis decision | — | none | decision recorded, founder agrees | low |

Exit: the baseline numbers exist, the noise floor is known, and a deliberately broken build scores visibly worse (first half of AC-4).

## Spikes (throwaway, each time-boxed to a day, each ends with a number and a decision)

| Spike | Question | Decides | If the answer is bad |
|---|---|---|---|
| S1-latency | How fast can a first line arrive? Measure time to first token for a small routing prompt (no page state, no site map), with and without streaming, on the current model and one smaller one | Whether NFR-1 (1.5 s) is reachable and how | Acknowledge locally from a small fixed set chosen by intent, relax NFR-1 on measured numbers |
| S2-direct | For "take me to X / show me X / what is X", can the destination and the section to highlight be chosen in one model call from the index and then executed without further model calls? Measure on the 12 navigation asks from the baseline | The design of phase 2 | Keep the loop for these but cap steps; NFR-2 relaxed |
| S3-occlusion | Can the dock reliably move off the highlighted rectangle (including inside the shell frame)? | FR-9's second half | Highlight a region the dock cannot reach, or collapse the dock while pointing |
| S4-voice-turns | Can a turn be opened only on a complete, addressed utterance? Replay the founder's audio-derived transcript and side-speech cases | FR-13 design | Push-to-talk as the default for voice |
| S5-engine | Does the in-page engine allow cancelling a run mid-step and streaming a line before the action? | FR-3, FR-2 mechanism | A thin loop of our own for informational turns; the engine stays for forms |

## Phase 1 — Turn contract (E5, E8, E9)

| Task | Outcome | Requirements | Gate | Risk |
|---|---|---|---|---|
| T10-turn | A turn state machine in the harness: open → acknowledged → acting → ended(answered / asked / handed-off / cannot). One turn per visitor message. A step and time budget per turn class. When the budget ends, the turn ends with a line | FR-1, NFR-5 | suite: lines per turn ≤ 2, unrequested navigations 0 | high |
| T11-preempt | A new visitor message cancels the running turn before its next action | FR-3, NFR-9 | suite: actions after "stop" = 0 | high |
| T12-watchdog | No visible output within the limit, a refused line, a crash or a failed model call → one honest line, turn ends. A refused `say` ends the turn; it is never retried | FR-6, NFR-8 | suite: silent turns 0; founder-session replay passes AC-2 | high |
| T13-consent | Refusals stored for the visit; signup, email asks and form entry only on explicit request | FR-4, FR-5, NFR-9 | suite: signup without request 0 | medium |
| T14-charter | Charter rewritten around the contract ("keep working until the goal is achieved" and "never hand work back" removed). Guard thresholds made redundant by T10–T12 are deleted, one at a time, each deletion gated | FR-1 | no scorecard row worse than baseline beyond noise | medium |

## Phase 2 — Fast path (E1, E2)

| Task | Outcome | Requirements | Gate | Risk |
|---|---|---|---|---|
| T20-router | First call per turn is small: classifies the turn (inform / navigate / do / chit-chat / refuse), produces the first line, and for inform/navigate names the index entry. Shape per S1 | FR-2, NFR-1 | suite: first reaction p50 ≤ 1.5 s, p95 ≤ 3 s | high |
| T21-direct | Inform/navigate turns execute from the router's answer: go to the indexed URL, highlight the indexed section. No further model call unless the page differs from the index | NFR-2 | suite: inform turn p50 ≤ 8 s, ≤ 3 calls | high |
| T22-loop-scope | The multi-step loop is used only for "do" turns (forms, dashboard work), under the turn budget | NFR-2 | suite unchanged on "do" personas | medium |

## Phase 3 — Verified knowledge and showing (E3, E4)

| Task | Outcome | Requirements | Gate | Risk |
|---|---|---|---|---|
| T30-index | Index rebuilt from the live sitemap, nav and `llms.txt`; every URL checked to load; product pages first; build date exposed; a scheduled rebuild; a failed or stale build raises a visible warning to the team | FR-8 | test: every index URL returns 200; known pages (`/mcp/`, `/api/`, `/faq/`) present | low |
| T31-allowlist | Navigation only to index URLs or links on the page; off-origin and dock-less destinations refused with a line | FR-7, NFR-3 | suite: 404 / off-site landings 0 | medium |
| T32-say-show | A site fact is stated from an index section, and the highlight is that section | FR-9, NFR-4 | judge: highlight matches line ≥ 85% | medium |
| T33-dock | Dock never covers the highlighted element (per S3) | FR-9, NFR-4 | screenshot check: occlusion 0 | low |

## Phase 4 — Memory (E6, E7)

| Task | Outcome | Requirements | Gate | Risk |
|---|---|---|---|---|
| T40-record | After each turn, off the visitor's path, the harness extracts stated facts, decisions, refusals and the open question into the visitor record | FR-10, NFR-7, NFR-12 | suite: facts reused 100% in session, re-asked 0 | medium |
| T41-decisions | A recommendation is read from the record; it changes only when an input changes, and the change is said | FR-11, NFR-6 | suite: repeat-question consistency ≥ 90% | medium |
| T42-return | Reload and return resume from the record; the transcript is restored as history, not replayed as new lines | FR-12, NFR-7 | suite: recall after reload ≥ 90%, no re-greeting | medium |

## Phase 5 — Failure paths and capacity (E8)

| Task | Outcome | Requirements | Gate | Risk |
|---|---|---|---|---|
| T50-failures | A written list of failure classes (model down, out of quota, 404, dock missing, form blocked, private field pending, unknown request, no human available), each with its line and what happens next | FR-6, FR-14, AC-7 | fault-injection run: every class produces its line within 3 s | medium |
| T51-capacity | Cost cap per visitor instead of one global cap; a second visitor is unaffected by the first | NFR-13 | 5 concurrent personas, none rate-limited by another | medium |

## Phase 6 — Improvement loop

| Task | Outcome | Requirements | Gate | Risk |
|---|---|---|---|---|
| T60-mine | Failed and low-scoring turns from traces grouped by cause, ranked by how often and how bad | FR-19 | report on the suite's traces matches a hand review | low |
| T61-propose-evaluate | A proposed fix is a versioned artefact (prompt, policy, index or knowledge change). `genesis learn propose/evaluate` runs baseline versus candidate on development and held-out sets, N runs each. Kept only under FR-18 | FR-18, FR-19, AC-4 | a planted worse candidate is rejected; a planted better one is accepted | high |
| T62-promote-rollback | Promotion and rollback are single recorded commands; a rollback is rehearsed | FR-19, AC-6 | one full pass demonstrated | medium |
| T63-ladder | Autonomy level per change class, starting at "propose only". Index refresh is the first candidate for automatic promotion | FR-20 | founder approval per level | medium |
| T64-rsi | The click-outcome ranking from `feat/rsi-browser-learning` run in shadow mode through the suite: does it move any E1–E9 row beyond noise? Keep if yes, delete if no | FR-18 | scorecard comparison | low |

## Phase 7 — Parity and pilot readiness

| Task | Outcome | Requirements | Gate | Risk |
|---|---|---|---|---|
| T70-voice-suite | Personas spoken through recorded audio, including side-speech, interruption and mishearing | FR-13, AC-8 | NFR-3/5/8/9 met in voice | high |
| T71-dashboard-suite | Personas in the CX-TEST workspace | AC-8 | NFR-3/5/8/9 met in dashboard | high |
| T72-acceptance | AC-1 to AC-8 run and reported; kill switch rehearsed | AC-1..AC-8 | all green; two founder sessions | high |

## What we do not know (and how each gets found out)

Things we know we don't know:

| Unknown | Found out by | Changes what |
|---|---|---|
| Is 1.5 s to a first line reachable with this model? | S1 | NFR-1 target or the acknowledgement design |
| Does the in-page engine let us cancel and stream? | S5 | Whether informational turns need their own thin loop |
| How noisy is the scorecard between identical runs? | T05 | How many runs every gate needs; whether small gains can be claimed at all |
| Does a model judge agree with the founders? | T04 | Which rows are automatic and which need a human |
| Does typed behaviour predict voice behaviour? | T70 | Whether voice needs its own fixes |
| Is there a human to hand off to? | Founder answer | FR-14's behaviour |
| What do the uncommitted step-3 edits and the RSI branch change in the scores? | T06, T64 | The code base |

Things we may not know we don't know, and the net that catches each kind:

| Kind of surprise | Example | Net |
|---|---|---|
| Real visitors behave unlike personas | Paste a URL, type in Hindi, ask about a competitor we have no page for, say nothing for five minutes | Every real session's trace is scored; any blocker becomes a persona before it is fixed; pilot traces reviewed daily |
| The measurement is wrong | Driver artefacts (today: suspicious 150 s timeouts in one persona), a judge that rewards fluent wrong answers | AC-4 planted good/bad builds; judge calibration; founder sessions stay in the bar |
| Fixes move the failure instead of removing it | The turn budget stops monologues but now cuts off a needed second step | No-row-worse gate on a held-out set; usefulness is a judged row |
| The scorecard gets gamed by the loop | Filler acknowledgements, terse non-answers | Rows gated together; held-out personas hidden from the proposer; a human approves each autonomy level |
| The ground shifts | sbl.so redesign, a nav link to another domain, model version change, key runs out mid-visit, a third-party script error on the page | Index link check and schedule; allowlist; model pinned and the suite run as a canary on any change; T50 fault injection |
| A second surface breaks the first | Dashboard fix regresses website | One suite, all surfaces, every change |
| Volume | Ten visitors at once, two tabs, a visitor who stays an hour | T51 concurrency run; long-session persona |
| Abuse and injection | Page text or a visitor telling the agent to do something outside its rules; anyone on the page origin spending the key | Injection persona; allowlist; per-visitor cap; hosted auth before any public pilot |
| Privacy | Traces contain emails and what people said | Masking test (NFR-12); local-only until retention is decided |
| Our own process | A coding agent declares success on a scripted path | Completion only through the gate on held-out personas; Genesis independent review on every non-low-risk task |

## How we will know it works

1. **A number per promise.** E1–E9 each have a target (NFR-1 to NFR-9) computed from traces, not from a demo.
2. **Before and after on the same test.** The baseline is frozen in phase 0; every phase reports the same table.
3. **Visitors the builder has not seen.** Four held-out personas are never read by whoever writes the fix.
4. **Repeated runs.** Three runs per persona, with the noise floor printed next to every result. A gain smaller than the noise is not a gain.
5. **The test is tested.** A planted worse build must fail and a planted better one must pass (AC-4).
6. **Real sessions outrank the suite.** The 2026-10-12 session is replayed on every change (AC-2), and two live founder sessions close the effort (AC-3).
7. **Failure is rehearsed.** Key disabled, page missing, dock missing: each must produce its line (AC-7).
8. **Every change is reversible.** Promotion and rollback are single recorded steps (AC-6), and the kill switch is rehearsed before a pilot.

What this cannot guarantee: that real visitors are satisfied. No real visitor has used the concierge. The plan ends at a build that meets its numbers on scripted and founder sessions; the pilot's first traces are the first real evidence.
