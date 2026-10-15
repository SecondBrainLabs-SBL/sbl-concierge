# Turn contract — design for T10–T13

Covers FR-1, FR-3, FR-4, FR-5, FR-6 and NFR-5, NFR-8, NFR-9. Built without editing `vendor/engine.js`.
Grounded in the engine study of 2026-10-13 (spike S5): `agent.stop()` aborts the in-flight model call at once, a tool already running finishes, the run promise resolves with `success:false`, and the existing `halt` + `agent.stop()` pattern is the clean way to end a run from inside a tool.

## The shape of a turn

1. **Open.** Every visitor message opens a new turn. If a run is in progress it is cancelled first (see Pre-emption). The only exception: the message is the answer to a pending `ask_user` question, which resolves that question and continues the same task, as a new turn.
2. **First step is a line.** On the first model step of a turn the only tools offered are `say`, `ask_user` and `done` (narrowed through `onBeforeStep`, restored afterwards). The first thing the visitor gets is always a line or a question.
3. **The line declares what follows.** `say` takes a required field `then`:
   - `"end"`: this line is the whole answer. The turn ends now.
   - `"show"`: the agent will show the thing. Up to 3 more actions from `navigate`, `scroll`, `point_at`, `click` (links only), then at most one closing `say`. The turn ends on the closing `say`, on `done`, or when the 3 actions are used.
   - `"do"`: multi-step work the visitor asked for (filling a form, signing up, dashboard work). Up to 12 actions. Needs the consent evidence below.
   A second `say` in an `end` or `show` turn is the closing line and ends the turn. So a turn has at most 2 lines.
4. **End.** A turn ends as `answered`, `asked` (one `ask_user`, then the agent waits), `handed_off`, `cannot`, `failed`, `preempted` or `stopped`. After it ends the agent does nothing until the visitor acts.

Turn class is the model's judgement, stated in `then`. There is no keyword table.

## Pre-emption (FR-3)

`hear()` with a run in progress and no pending question: set `halt = { status: "preempted", silent: true }`, call `agent.stop()`, await the run, then start the new turn. The new turn's preface carries what the old turn was doing, so "use my work email instead" still works mid-form.

A turn generation number is checked in `hand()` after `await save()` and before the tool body, and in `speak`/`emit`: a tool or line belonging to a dead turn throws `AbortError` / is dropped. The `customFetch` backoff sleep becomes abortable.

A pending private field (`fill_secret`) or `human_step` is released by the same stop (both honour `ctx.signal`); the private box is closed.

Guarantee: no new action starts after the visitor's message arrives. An action already executing (a click in flight) completes.

## Never silent (FR-6)

One exit, `endTurn(kind, line)` (sets `halt`, calls `agent.stop()`); `finish()` speaks `halt.line` through `speak()`, which bypasses the say guards.

| Situation | Today | Contract |
|---|---|---|
| A guard refuses a `say` or `ask_user` | "⚠️" returned to the model, which retries unseen | The turn ends. If nothing was said this turn, the fallback line is spoken |
| `done` with text after the task has said anything earlier | text dropped | spoken if nothing was said in this turn |
| Step or time budget reached | silent | closing fallback line if nothing was said this turn; otherwise just end |
| Run crashes or model call fails | silent unless a known unavailable error | one honest line |
| No visible line 25 s after the message | nothing | fallback line, turn ends |
| Message arrives while a run is winding down, or `running` is stale | message lost | new turn always starts after the old run promise settles; `running` is cleared in one place |

Fallback lines are fixed strings, plain and short:
- nothing said yet: "Sorry, I lost my thread there. Could you ask me that again?"
- model unavailable: the existing `UNAVAILABLE` line.

Limits for now (they tighten in phase 2 once the fast path exists): no-output watchdog 25 s; `end`/`show` turn 45 s; `do` turn 120 s.

## Consent (FR-4, FR-5)

Evidence, not detection. Three things need the visitor's own words:
- navigating to, or clicking a link that leads to, `app.secondbrainlabs.com/signup` or `/login`;
- `ask_user` for an email, phone number or password-adjacent detail;
- `say` with `then: "do"`.

Each of those calls carries `because`: a short quote of what the visitor said that asks for it. The harness checks that the quote appears (case-insensitive, word-overlap ≥ 0.6 against one visitor message) in a visitor message of this visit that is later than the latest recorded refusal. No match: the call is refused, and under the rule above the turn ends rather than retrying.

A refusal is recorded when the first-step `say` carries `declined: true` (the model marks that the visitor's message declined or stopped something). It stores the time. It lasts for the visit and survives page loads (stored on the visit record next to the task).

## Charter changes (T14, after T10–T13 are green)

Removed: "Keep working until the goal is fully achieved, in this run. Never hand work back… Do the next step yourself." and the resume text "Continue from the current page" where it applies to a finished turn.
Added: the turn shape above in five lines; "after you have answered, stop and wait"; the trial is the direction of the relationship, not the goal of each turn.
Then each guard threshold that the contract makes redundant (re-word refusal within a turn, option re-listing, third identical point) is deleted one at a time, each deletion checked against the suite.

## Tests (`tests/turn.test.cjs`, `tests/consent.test.cjs`)

Unit, with the same fakes as `tests/harness.test.cjs`:
- first step offers only `say`, `ask_user`, `done`;
- `then:"end"` ends the run after one line; a second `say` in a `show` turn ends it; a third line is impossible;
- `show` budget of 3 actions ends the turn; `do` without matching `because` is refused and the turn ends with a line;
- a message during a run cancels it, no tool body of the old turn runs afterwards, the new turn starts;
- a message during a pending private field releases it and gets a reply;
- refused line → turn ends, fallback spoken once;
- crash, failed model call, budget, watchdog → exactly one line;
- `done` text spoken when this turn said nothing;
- signup navigation and email `ask_user` without evidence refused; with evidence allowed; evidence older than the latest refusal refused;
- `running` never left stale.

## Deviations (implementation, updated 2026-10-13 after review)

- `request_human_call` is offered in `show` turns and after the budget is spent (it is not an action; it is how a `handed_off` turn ends).
- Pre-emption waits for the old run to settle, but at most 8 s. The new message is stored as the task at once (before the wait), so a navigation in flight cannot lose it or resume the old goal; every save by a dead turn's run (after-step, tool tail, click) is a no-op. Stop clears the stored task at once. A late settle of a replaced run does no UI teardown and traces nothing (only the run that owns the live turn does).
- System notes and proactive thoughts are system turns: they never count as visitor words for consent, and get no watchdog, no fallback and no apology line. The raw visitor text (not the model-facing wrapper around a reply to an offer) is what is recorded as theirs.
- `done` with empty text (or the engine's stand-in "no text provided") in a turn that said nothing speaks the fallback line. A `done` that asks for their email or phone without evidence is not spoken.
- The 40-step task budget and the action budget end quietly if the turn said something; the wall ("same wall") speaks its line only if nothing was said, and never stores a question the visitor did not see.
- A pre-empting message starts a NEW task (goal = the new message) whose preface summarises the old one, except after a Stop (no preface). Cross-turn re-statement guards see only the current task; the line that answers an `ask_user` is exempt from them, and the answer clears `task.question`.
- The visit record (`visit.said` with the agent line each message answered, `lastLine`, `refusedAt`) is stored under `sbl_visit_v1` and rides on `task.visit`. A missing `then` is treated as `show`.
- The watchdog is 8 s for a turn the router opens and 25 s for a turn the engine opens (see docs/FAST-PATH.md).
- `create()` accepts `deps.limits` (`{watchdog, show, do, preempt}` in ms) so tests can shorten the timers.

New rules (replace the older text above where they differ):

- **Consent evidence (S1, tightened 2026-10-13).** The quote needs at least 2 words and at least 1 content word (a local stop list in turn.js: this/that/it/is/for/what/can/you/me/up/to/a/the/i/want ...; not `Guard.words`, whose stemming turns "this" into a word). At least 60% of ALL its words AND at least 60% of its content words must sit in the SAME one of the visitor's last 3 messages of the visit that is later than the latest refusal ("sign me up" passes against "sign me up"; "i want to sign up for it" does not pass against "i want to see it for a bit"). Or: the visitor's latest message is a bare affirmative (yes, ok, sure, go ahead, ... at most 4 words) and the agent's line just before it was a question/offer about the gated thing (signup, trial, log in, email, phone, call). Gated: signup/login URLs (parsed, so `;x`, `%73ignup`, `//signup`, userinfo count), any app.secondbrainlabs.com destination from an sbl.so page, `input_text` into an email/tel field, and a line or question asking for their email, phone or password (`say`, `ask_user`, `done`).
- **Refusals (S5).** Stop, the takeover pause, and a bare "stop / no / not now / not yet / no thanks / don't / wait / cancel" (at most 4 words) are recorded by the harness itself; the model's `declined` is no longer the only way.
- **Refused lines (S6c/d).** The first refused line in a turn returns a warning to the model; the second ends the turn. The same-turn re-word bar (0.25) applies only when no action happened since the previous line; after an action only a near-verbatim repeat (0.6) is refused. Consent gates on actions (navigate, click) still end the turn at once.
- **Failure after the first line (S11).** A crash, failed model call, deadline, wall or second refusal after the turn has spoken says exactly one line: "Sorry, I got stuck partway through that. Ask me again and I will pick it up." Never when the turn finished normally, never twice. `speak` drops a line for a turn that has already ended (except the exit's own line).
- **Time budget (B2).** Time waiting on the visitor (a pending `ask_user`, private field, human step, confirmation card) is not counted: the turn accumulates `waited` ms (carried on the snapshot across page loads; a human step that ended by a page load counts since the task was last updated) and the deadline and `msLeft` subtract it.
- **Resume (S7).** `boot()` sets the task `active` before launching; a revived turn always gets its deadline, and its watchdog if it has said nothing.
