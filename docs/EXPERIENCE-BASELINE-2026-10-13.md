# Experience baseline — 2026-10-13

What the concierge does today, measured. This is the "before" that every later change is compared to.

## How it was measured

- Code under test: `build/step3-one-brain` at `0131f74` plus the uncommitted edits in `../sbl-step3-wt` (bundle `sbl-agent.js` built 2026-10-12 21:32).
- Three Sonnet testers each played a visitor persona on the live `sbl.so`, typing into the dock through a small driver (`var/experience-baseline-2026-10-13/driver.mjs`). 37 turns in total.
- Yesterday's founder session was read from the server store (`founder-session-2026-10-12.json`).
- Raw outputs, per-turn JSON and screenshots: `var/experience-baseline-2026-10-13/` (local, gitignored).

Limits of this baseline:
- Typed chat only. Voice was not exercised.
- One run per persona, so there is no measure of run-to-run variance yet.
- Logged-out website only. The dashboard was not exercised.
- In the navigation persona, turns 2–12 hit the driver's 150 s ceiling. Those busy times are lower bounds and may partly be a driver artefact (the in-flight counter), not only the agent.

## Results by experience dimension

| # | Dimension | Result | Evidence |
|---|---|---|---|
| E1 | Quick acknowledgement | Mixed | First line usually 4–6 s; 12–15 s on "take me to pricing" (both times) and "which plan" |
| E2 | Finishes quickly | Fails | Typical turn 20–45 s; heavy turns 67–105 s with 14–23 model calls |
| E3 | Does what was asked | Mixed | Most "take me to X" landed correctly; "intent signals" went to an invented URL (404), then off-site to `gtm.sbl.so`, where the dock no longer exists |
| E4 | Shows, not tells | Fails | Reads out prices already on screen; pointed at "Start Trial" while talking about seats; pointed at a testimonial while talking about integrations; the dock covered the pointed element in most pricing screenshots |
| E5 | Knows when to stop | Fails | One intro message → 7 lines, 2 unrequested navigations, ~88 s. "Anything for agencies?" → 5 lines |
| E6 | Same ask, same answer | Fails | "Which plan for my agency" → Pro $189, then Starter $99 five turns later, no acknowledgement |
| E7 | Remembers the visitor | Works in session, weak after | Facts given once were reused; 3 → 8 SDRs recomputed correctly ($345). After reload the plan recommendation was not recalled. The stored customer file after two founder sessions: `facts: {}` |
| E8 | Never silent, never stranded | Fails | "Can I talk to a real person?" → no reply. "I'll type the password later" → 143 s of nothing. Off-site exit with no dock. Founder session: ~2 min silence |
| E9 | Visitor stays in control | Fails | "How do I get started" → signup page and an email ask. "Not yet" → 114 s of clicking the signup form, 23 model calls, `run failed`. "Stop" acknowledged only after the navigation had happened |

What was good: the HubSpot question (4 s, right section, right card), the Expandi comparison (3.8 s, right page), the "8 SDRs not 3" correction, explaining "tracked pilot pipeline" on the page, finding the Campaign Guide from a loose description.

## Causes found in the code and logs

1. **A turn has no end.** `core/constitution.js` tells the model to "keep working until the goal is fully achieved" and "never hand work back", with the goal defined as a started trial.
2. **Every reply is a browser-agent loop.** One action per model call, ~20k-token prompt each time (`system prompt ≈ 80.6k chars`), 3–5 s per call, in sequence.
3. **Guards reject instead of shaping.** A refused `say` shows nothing to the visitor while the model retries. Founder session 19:12–19:14: 20+ refused `say` calls in a row.
4. **Site knowledge is a frozen, unverified snapshot.** `core/site-map.js` was generated 2026-09-30: 190 pages, 5 of them product pages. `/mcp/`, `/api/`, `/faq/` are missing. The agent navigates to URLs that are not in the index and return 404.
5. **Memory is optional.** `remember` is a tool the model may call. It did not call it in the founder sessions. A recommendation is never stored as a decision.
6. **Side-speech becomes the goal.** The founder session's task goal is "I'm going to say now- So let's do one thing…" (speech meant for a meeting); every later message was appended to that task (24 steps, never closed).
7. **The harness cannot see itself.** The per-step usage line in `server.mjs` references a timer (`t0`) that an uncommitted edit removed; during this test: several hundred `/agent/chat` calls, zero usage lines. A crashed run's cause is overwritten by the next task. The server's cost cap is one global 60 calls/min, which three concurrent visitors nearly fill.
8. **The proofs do not measure the experience.** `one-brain-proof.mjs` is one scripted path; it was green the same week the founder session was bad.

## The existing self-improvement attempt

Branch `feat/rsi-browser-learning` (worktree `~/Documents/Codex/2026-10-12/v/work/sbl-rsi`, 4 commits on top of `0131f74`). It counts, per hashed page-state and action, how often an action changed the page, and re-ranks the model's proposed actions after three matching observations. Its own notes say these are action effects, not task success.

It optimises "did the click change the page". None of E1–E9 is that. It cannot tell a wanted navigation from an unwanted one (E9), and the failures above are not caused by picking the wrong element among candidates. It is kept as a candidate signal to be evaluated against the scorecard, not as the improvement loop.
