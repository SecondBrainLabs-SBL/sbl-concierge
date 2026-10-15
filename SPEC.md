# Product specification — sbl-concierge-experience

> Status: draft. A coding agent must not implement product code until this specification is approved through Genesis.
> Supersedes for this effort: `docs/SPEC-v1-2026-09-30.md` (kept unchanged; its safety rules still bind, see Constraints).
> Evidence: `docs/EXPERIENCE-BASELINE-2026-10-13.md`. Plan: `docs/EXPERIENCE-PLAN.md`.

## Problem

The SBL concierge (a dock on sbl.so and the dashboard that talks, points and navigates for the visitor) does not give a good experience. Measured on 2026-10-13 over 37 visitor turns: turns take 20–105 s, the agent talks past the point of the question, pushes visitors into signup, gives different answers to the same question, goes silent, and once left the visitor on another site with no agent.

"Experience" is defined here as nine observable properties (E1–E9). Each has a number that can be measured on every turn. The product is good when those numbers meet their targets on visitors the team did not script.

Second problem: the team cannot tell whether a change made things better. Fixes have been guard rules added after each bad session and checked against one scripted path. The harness must measure itself and only keep changes that the measurement supports.

## Users

- **Visitor** on sbl.so who has not signed up: wants answers and to be shown things; may or may not want a trial.
- **Customer** in the dashboard: wants help with their campaigns. (Parity work, after the website is good.)
- **Founders (Ayush, Shubham)**: need to see, per release, whether the experience got better or worse, and to approve what ships.
- **Coding agents** working on the harness: need a scorecard to work against instead of anecdotes.

## Functional requirements

Experience (what the visitor gets):

- FR-1: Turn contract. Every visitor message opens exactly one turn. A turn ends in exactly one of: answered, one question asked, handed to a human, or an honest "I can't". After it ends the agent does nothing until the visitor acts, unless the visitor accepted an offer to continue.
- FR-2: Fast acknowledgement. The visitor sees or hears a relevant first reaction before any slow work starts.
- FR-3: Pre-emption. A new visitor message cancels the turn in progress; the agent answers the new message and takes no further action for the old one.
- FR-4: Binding refusals. "Stop", "not yet", "don't take me there", "I'm just looking" are stored for the visit. The agent does not navigate to signup, ask for an email, or repeat the declined thing until the visitor raises it again.
- FR-5: Signup and any form entry start only on an explicit visitor request for it.
- FR-6: Never silent. If a turn produces no visible output within a fixed time, or fails for any reason, the visitor gets one honest line and the turn ends. No failure path ends without a visible line.
- FR-7: Verified navigation. The agent navigates only to URLs in the current site index or to links present on the current page. It does not leave the two SBL origins without saying so first, and never to a page where the dock cannot exist.
- FR-8: Fresh site index. The index is rebuilt from the live site on a schedule, every URL is checked to load, and the build date is known to the harness. A stale or failed index is reported, not silently used.
- FR-9: Say and show from one source. When the agent states a fact from the site, the line and the highlighted element come from the same indexed section, and the dock does not cover the highlighted element.
- FR-10: Visitor memory as a mechanism. After every turn the harness itself records stated facts, decisions made (for example the plan recommended and why), refusals and the open question. It does not depend on the model choosing to save.
- FR-11: Consistent decisions. A recommendation already made is reused. It changes only when an input changed, and then the agent says what changed.
- FR-12: Return and reload. After a reload or a return visit the agent resumes from the record (who they are, what was decided, where they were) without re-greeting, re-asking, or replaying the transcript as new lines.
- FR-13: Turn opening for voice. Speech becomes a turn only when it is a complete utterance addressed to the agent. Unfinished or side speech never becomes a goal.
- FR-14: Human handoff is real or honestly absent. The agent offers a call or a person only if the mechanism exists, and says how; otherwise it says it cannot.

Measurement and improvement (what the team gets):

- FR-15: Turn trace. Every turn is recorded: what was asked, each step and its duration, every line the visitor saw and when, every page action, the final page, how the turn ended, and any error with its cause. Secrets and form values are masked.
- FR-16: Scorecard. A program computes E1–E9 from traces and screenshots. Objective rows are computed directly. Judged rows use a model judge whose agreement with founder labels is measured and reported.
- FR-17: Persona suite. A fixed set of scripted and adaptive visitor personas runs against any build: a development set and a held-out set, each run several times, plus replays of real founder sessions.
- FR-18: Change gate. A change to prompt, policy, knowledge or code is kept only if the scorecard on the held-out set does not get worse on any row beyond the measured noise, and improves the row it targeted.
- FR-19: Improvement loop. Failures in traces are grouped into causes, each proposed fix is evaluated baseline-versus-candidate through FR-18, and promotion and rollback are explicit and recorded.
- FR-20: Autonomy ladder. What the loop may promote without a human is set per class of change (index refresh, knowledge text, prompt/policy, code) and starts at "nothing"; a class moves up only on founder approval.

## Non-functional requirements

Targets are proposals for founder confirmation. p50/p95 are over the held-out persona suite, typed mode, three runs.

- NFR-1: (E1) First visible reaction p50 ≤ 1.5 s, p95 ≤ 3 s. (Today: ~5 s typical, up to 15 s.)
- NFR-2: (E2) An informational turn is complete p50 ≤ 8 s, p95 ≤ 15 s, with ≤ 3 model calls. (Today: 20–105 s, up to 23 calls.)
- NFR-3: (E3) Wrong-page, 404 and off-site landings: 0.
- NFR-4: (E4) Highlight matches the spoken line in ≥ 85% of turns that show something; highlighted element covered by the dock: 0.
- NFR-5: (E5) ≤ 2 lines per turn; unrequested navigations: 0.
- NFR-6: (E6) The same question asked again in the same visit gets the same decision in ≥ 90% of repeats.
- NFR-7: (E7) Stated facts reused correctly: 100% in session, ≥ 90% after reload; facts re-asked: 0.
- NFR-8: (E8) Turns with no visible reply: 0. Turns that end with the visitor on a page without the dock: 0.
- NFR-9: (E9) Actions taken after "stop": 0. Signup navigations or email asks without an explicit request: 0.
- NFR-10: The scorecard's noise floor (run-to-run spread on an unchanged build) is measured before any improvement is claimed, and reported next to every result.
- NFR-11: Tracing never blocks or slows the visitor's turn, and a trace store outage never breaks the dock.
- NFR-12: No password, payment detail or typed form value appears in a trace, a memory record or a model prompt.
- NFR-13: Capacity. One visitor's activity cannot exhaust another's. The cost cap is per visitor, and when the model is unavailable or out of quota the visitor is told plainly within 3 s.

## Constraints

- No product code before this spec and the plan are approved.
- Safety rules from `docs/SPEC-v1-2026-09-30.md` stay in force: consequential actions (launch, pay, delete, send, import) only through the visible confirmation card; passwords only through the private field; live writes only in the CX-TEST workspace; proofs stop before a real payment or signup submission.
- The base for all work is `build/step3-one-brain` (`0131f74`). The uncommitted edits in `../sbl-step3-wt` and the branch `feat/rsi-browser-learning` are inputs to be reviewed, not assumed.
- Model and engine stay as they are (gpt-5.6-luna via `/v1/responses`, the in-page engine) unless a spike shows a target cannot be met with them.
- Test runs spend the founders' OpenAI key. The suite must report its own cost per run.
- Site is WordPress/Elementor (full page loads) plus a Next.js dashboard on another origin.

## Non-goals

- New capabilities (research, campaign building, off-site walkthroughs). This effort makes the existing ones good.
- Automatic promotion of code changes. Code always goes through human review.
- Training a model. The loop changes prompts, policy, knowledge and code, not weights.
- Hosted production rollout. This spec ends at a pilot-ready build with a kill switch.
- Mobile.

## Acceptance criteria

- AC-1: On the held-out persona suite, typed mode, three consecutive runs, every NFR-1 to NFR-9 target is met.
- AC-2: The replay of the 2026-10-12 founder session produces no silent turn, no repeated line, and no navigation the visitor did not ask for.
- AC-3: Two live founder sessions in a row (one mostly voice) end with no blocker-severity defect, as judged by the founder.
- AC-4: A deliberately worse build (for example the turn budget removed) is rejected by the change gate, and a deliberately better one is accepted. The gate is shown to discriminate.
- AC-5: The model judge agrees with founder labels on at least 85% of a labelled set of 40 turns, for each judged row it is used on.
- AC-6: One full pass of the improvement loop is demonstrated end to end: a failure found in traces, a proposed fix, evaluation on development and held-out sets, review, promotion, and a rollback rehearsal.
- AC-7: With the model key disabled, every visitor message gets a plain line within 3 s and nothing hangs.
- AC-8: The voice suite and the dashboard suite (CX-TEST workspace) meet the same NFR-3, NFR-5, NFR-8 and NFR-9 targets.

## Risks

- **The scorecard is gamed.** A build can win latency by saying less or win "never silent" with filler. Mitigation: rows are gated together (FR-18: no row may get worse), judged rows include usefulness, and founder sessions (AC-3) stay in the acceptance bar.
- **Personas are not real visitors.** No real visitor has used this. Mitigation: replay real sessions, add every real session's failures to the suite, and treat the pilot's first traces as the real test.
- **Noise hides or fakes improvement.** The model is non-deterministic. Mitigation: NFR-10, several runs, held-out set.
- **The 1.5 s target may be unreachable** with this model and prompt size. Mitigation: spike first (plan S1); the fallback is a locally generated acknowledgement plus a relaxed target, decided by the founder on measured numbers.
- **Voice depends on undocumented behaviour** (the mouth session only speaks with a tone input). An API change breaks it. Mitigation: voice suite in the gate; typed mode must be fully good on its own.
- **The site changes under the agent.** Mitigation: FR-7 and FR-8.
- **Page content can carry instructions** (blog text, comments). Mitigation: existing "page is data" rule plus FR-7's navigation allowlist; add an injection persona to the suite.
- **Traces hold personal data** (emails, what people said). Mitigation: NFR-12, local storage only for now, retention decided before any hosted pilot.
- **Three diverged lines of code.** Mitigation: plan task T06 decides the base before any build.

## Open questions

None open. Resolved by the founder on 2026-10-13 ("all good, go ahead"):

- The nine dimensions and the NFR targets are accepted as proposed.
- Human handoff: not confirmed to exist. Until it is, FR-14 applies in its "honestly absent" form: the agent says it cannot connect a person and does not offer a call.
- The agent does not speak first, uninvited, in this release.
- First acceptance surface: website, typed mode. Voice and dashboard follow in phase 7.
- Suite cost: reported per run (T02); a smaller smoke set is added if a full run proves expensive.
