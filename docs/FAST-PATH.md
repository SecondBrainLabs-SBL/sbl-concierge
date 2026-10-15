# Fast path — design for T20–T22

Covers FR-2, NFR-1, NFR-2, and gives FR-7 (verified navigation) for routed turns.
Grounded in spike S1 (2026-10-13): a small streamed call on gpt-5.6-luna, reasoning effort none, 5.2k-token prompt with product knowledge, gets the end of a first sentence out in 1.23 s p50 / 1.69 s p95 with a warm prompt cache and invented no paths in 36 tries. The engine cannot stream (spike S5), so this is a separate call made before the engine.

## Flow of a turn

1. `hear()` opens the turn (as today) and at once calls the router: `POST /agent/route` (streamed).
2. The router's `line` is shown as soon as its first sentence is complete, through the same `speak()` every line uses. That is the turn's first line.
3. The router's decision then drives the rest:

| `then` | What happens | Engine calls |
|---|---|---|
| `end` | The turn ends, answered. | 0 |
| `show` + `target` | The harness navigates to `target` and highlights `section`, itself. The turn ends. | 0 |
| `show` without a usable target | Handed to the engine as a `show` turn that has already said its line. | as today |
| `ask` | The line is a question. The turn ends as asked; the answer opens the next turn. | 0 |
| `do` | Handed to the engine as a `do` turn that has already said its line (consent evidence checked first, as today). | as today |
| router failed, timed out (3 s to first byte, 6 s total) or returned something unusable | The engine runs the turn exactly as today. Nothing is lost. | as today |

The turn contract is unchanged: one turn per message, at most two lines, pre-emption, single exit, consent evidence. A routed turn is the same turn object with `then` set by the router.

## The router call

Server, `POST /agent/route`: same origin rules as `/agent/chat`. Request body from the page:

```
{ message, url, title, conversation: last 6 lines, customerFile, refusedRecently: bool, lastAgentLine }
```

The server builds the prompt:
- **Stable prefix** (cached): role and rules (below), `SBLKnowledge.full()`, and a compact index of the non-blog pages of `core/site-map.js`: one line per page (`path — title — 8-word description`) followed by its section headings.
- **Tail** (changes per call): the current page's own index entry with section text (so "what is this part about" can be answered from where the visitor is), the conversation, the customer file, the message.

Model call: `/v1/responses`, `stream: true`, model `BACKEND_MODEL`, `reasoning: { effort: "none" }`, `store: false`, one forced function tool `route` whose arguments are, in this order so the line streams first:

```
{ line: string (≤ 30 words, spoken text),
  then: "end" | "show" | "ask" | "do",
  target: string | null   (a path from the index, or null to stay on this page),
  section: string | null  (a section heading of the target page, copied from the index),
  declined: boolean,
  because: string | null  (quote of the visitor, required for "do", for a signup/login target and for asking contact details) }
```

Rules given to the router (short):
- Answer what the visitor just said. The conversation is context, not the question.
- `show` when the answer lives on a page of the site: name the page and the section. `end` for small talk, for a question about the page they are on that the section text answers, for something the site does not have (say so plainly), and when they asked not to be moved.
- `target` and `section` are copied from the index, never composed. No matching page: `target` null.
- If the visitor is on a page and asks about "this" or "that part", the answer is about the current page.
- A person, a call, a demo: the line names the "Talk to an SDR expert" booking link; `then: "show"`, `target` the page that has it, `section` null. Never ask for a phone number.
- `do` only when the visitor asked for multi-step work (sign up, fill, create), with `because`.
- Facts and prices only from the knowledge. Unknown: say so.

The server relays the model's stream to the page as server-sent events: `{"line": "<text so far>"}` as argument deltas arrive (parse the partial JSON for the `line` string value), then one `{"route": {...}}` with the full parsed arguments, then end. It writes a `model` trace event (path `/agent/route`, ms to first line, total ms, tokens, turn id).

Page side: script-tag mode reads the stream with `fetch` and a reader. Extension mode cannot stream through the background proxy in a few lines: there the call is made non-streamed (the server accepts `stream: false` and answers with the final JSON), which is still one small call instead of several large ones.

## Executing a routed `show` in the harness (no model)

1. Validate `target`: it must be a path present in `SBLSiteMap.pages` (exact after normalising the trailing slash). Not present: treat the route as unusable and hand the turn to the engine. This is FR-7 for routed turns: an invented path cannot be navigated.
2. Consent: a signup/login/app target goes through the existing `Turn.gatedUrl` + evidence check.
3. If the visitor is already on `target`, do not navigate.
4. Navigate with the existing navigate machinery (shell `go()` in shell mode, `location.assign` otherwise). The turn rides the task record across the load, as it does today; on the next page `boot()` sees a routed turn with a pending `section` and finishes it without starting the engine.
5. Highlight: find the element for `section`: the index anchor id if the section has one, else the first heading (h1–h4) whose text matches the section heading (case-insensitive, whitespace-normalised, prefix match on the first 40 characters). Point at it with the existing cursor/`point_at` machinery, including the dock-avoidance it has. Not found: skip the highlight; the visitor is on the right page.
6. End the turn as answered. Trace `action` events for navigate and point as the engine tools do.

## Budgets after this lands

- No-output watchdog: 25 s → 8 s.
- `end`/`show` turn time: 45 s → 20 s.
- First step narrowing for engine-run turns stays.

## What this does not do

- No keep-warm ping for the prompt cache yet. The first call after the cache goes cold costs about 2.5 s to first token; how long the cache lasts is unmeasured. Add a ping only if the suite shows cold starts hurting p95.
- No router for the dashboard yet: when the surface is the dashboard the router is skipped and the engine runs the turn.
- The engine path is unchanged, so `do` turns are as slow per step as before.

## Tests (`tests/router.test.cjs`, no network)

- prompt builder: stable prefix identical across calls; tail carries the current page's sections; blog pages excluded;
- partial-JSON `line` extraction from argument deltas (escapes, unicode, a delta that splits an escape sequence);
- server handler with a stubbed upstream stream: relays line events then the route, writes the model trace event, honours `stream: false`, rejects other origins, times out cleanly;
- harness with a fake router: `end` → one line, no engine created; `show` + valid target → navigate + point, no engine created, turn ends answered; invented target → engine fallback with the line already said and no second opening line; `do` without evidence → refused per the turn contract; router timeout → engine runs as before; a new message during a routed turn pre-empts it (no navigation after the message arrives); a routed `show` across a page load finishes on the next page without an engine;
- section lookup: anchor id, heading text match, no match.

## Deviations (implementation, 2026-10-13)

- **Index size.** The prefix is about 14.2k tokens, not the spike's 5.2k (the spike indexed paths and 6-word titles only; this one adds headings). To keep it there: titles clipped to 70 characters, description to 8 words (dropped when it repeats the title), headings of level 1-2 only, at most 8 per page, clipped to 50 characters. A `section` may be that clipped form or the full heading; validation returns the full heading. The current page's own entry in the tail carries all its sections with text (about 3.5k characters).
- **Long lines.** The first complete sentence is spoken as the turn's line while the stream runs; if the final line has more, the remainder is spoken as the turn's second line: at once for end/ask, for a show only after the navigation/highlight succeeded (across a page load it rides `task.routed.rest` and is spoken on the landing page). On a handoff to the engine the unsaid remainder is dropped. A first sentence that asks for contact details waits for the route and its evidence.
- **`ask`** ends the turn as `asked` without setting `awaiting: "answer"`, so the visitor's reply is a new routed turn (not a resumed engine question).
- **`do` without evidence** does not speak the router's line; the engine opens the turn as an ordinary engine-opened turn (its consent gate governs) and any preview is dropped. (A first sentence already streamed before the route arrived stays said: it cannot be unsaid.) With evidence it goes to the engine as a `do` turn. A `show` whose target is missing or invalid goes to the engine as a `show` turn with `turn.opened` set: `Turn.guide` quotes the said line and the first step is not narrowed.
- **`show` with `target: null` and a valid `section`** (of the page the visitor is on) highlights on this page without navigating.
- **Watchdog.** 8 s only for a turn the router opens. A turn the engine opens (dashboard, system/proactive, wrapped offer reply, answer to an engine question, resume, or a handoff with nothing spoken) gets 25 s (`Turn.ENGINE_WATCHDOG_MS`; `limits.engineWatchdog` in tests, falling back to `limits.watchdog`). A resumed routed turn gets none. `loaded()` (resume and `go(true)`) races the turn's death, so a newer message does not wait behind a page load.
- **Page-side cap** on the route call is 7 s (`limits.route`), above the server's 3 s first byte / 6 s total, so the server answers first. Server timeouts read `ROUTE_FIRST_MS` / `ROUTE_TOTAL_MS` (tests shorten them).
- **Routed navigation** is its own small function (not the `navigate` tool): the same shell `go()` / `location.assign` machinery, the task record carries `task.routed = { section, anchor }`, and `boot()` finishes the turn with it without an engine. The highlight stays lit until the next action or message (the engine path clears it when its run ends).
- **`modelEvent`** (trace-log.mjs) takes an optional `firstMs`, written only when present.
- **Not covered by a unit test:** a gated (signup/login) routed target, because the index holds only sbl.so paths; the check (`Turn.gatedUrl` + evidence) is in the code and would apply to an app URL.
- **Review fixes (2026-10-13).** A message with a wrapper (`hear(text, mode, raw)` with `raw !== text`, a reply to an offer) is not routed. A declined route or a bare refusal is treated as `then: "end"`: line spoken, nothing moves. The preview is not drawn for text matching `Turn.asksContact` (no "?" needed) and is dropped at a handoff with nothing spoken; content.js `dropPreview` restores the previous big line. A routed show sets `then: "show"` and arms its deadline before pointing, and the highlight is raced against the turn's death. The route payload (message, conversation, customer file) goes through `mask()`. Navigation resolves against `https://sbl.so`. `task.routed` is `{ section, anchor, target, rest? }`: on landing, if the page is not `target` (after `canonPath`) nothing is highlighted and the turn ends with "That page did not open as expected. Ask me again and I will take another route." The index leaves out `/blog/` paths; the rules name CUSTOMER FILE as data. The server writes a non-200 status in the `model` event when the upstream reports `response.failed`. The experience driver counts `/agent/route` as a model call, keeps the preview out of the agent lines, and records `firstWordsMs` (scorecard info row `E1.words`, `E1.words.p95`; no target).

- Item 5: booking continuation across navigation is covered in `tests/router.test.cjs`. The shorter silent-router timer was tested in tc17 and rejected with that candidate; the existing 7 s page deadline remains.
