# Visitor memory — design for T40–T42

Covers FR-10, FR-11, FR-12 and NFR-6, NFR-7, NFR-12.

Today the only durable memory is the customer file, written when the model chooses to call `remember`. In the founder's sessions it never did. Recommendations are not stored at all, which is why the same question got Pro once and Starter the next time.

## The record

One small structured record per visitor, kept by the harness, not by the model's choice:

```
{ facts:     [{ k: "team", v: "2 sellers" }, { k: "crm", v: "Salesforce" }],        // what they told us about themselves
  decisions: [{ topic: "plan", value: "Pro", why: "2 sellers, Salesforce", inputs: "sellers=2" }],  // what we recommended or agreed
  declined:  ["signing up today"],                                                  // what they said no to
  open:      "wants to know cost at six sellers" | null,                            // the one thing still hanging
  updatedAt }
```

Bounded: at most 12 facts, 6 decisions, 6 declined, each value ≤ 120 characters. It is rewritten whole each time, so a correction replaces the old fact instead of piling up next to it.

Never stored: passwords, card numbers, anything typed into a form, and contact details (email, phone). If the visitor types an email in chat it stays in the conversation only.

## Writing it (FR-10)

When a visitor turn ends, the harness sends, without waiting, the current record plus that turn (the visitor's message, masked, and the lines the agent actually said) to `POST /agent/note`. The server makes one small model call (same model as the router, reasoning effort none, not streamed, forced tool `record` returning the full new record) and returns it. The page stores it in the visitor memory that already survives page loads, the hop to the app, and return visits.

Rules given to the note call:
- Record only what the visitor stated or what the agent actually said it recommends. Never infer a fact.
- A decision is something the agent recommended or the visitor agreed to: the plan, a next step. Keep `inputs`: the facts it depended on.
- When the visitor corrects a fact, replace it. When a decision's input changed and the agent gave a new recommendation, replace the decision.
- `declined` holds what they refused, in their terms.
- Contact details and secrets are never recorded.

Off the visitor's path: the turn is already over when this runs. If the next message arrives before the note returns, that turn simply uses the previous record (the conversation lines still carry the latest exchange). A failed or slow note call (4 s cap) is dropped and traced; the record stays as it was.

System and proactive turns write nothing.

## Using it (FR-11)

The record is rendered as the customer file text that the router tail and the engine context already carry:

```
Facts: team: 2 sellers; crm: Salesforce
Decisions: plan → Pro (2 sellers, Salesforce) [depends on: sellers=2]
Declined: signing up today
Open: —
```

Two rules added to the router and the charter:
- A decision in the customer file stands. Asked again, give the same decision.
- Change a decision only when the visitor changed something it depends on, and then say what changed ("with eight sellers instead of two, …").

The existing model-chosen `remember` tool stays for the engine path (dashboard work) and writes into `facts`.

## Return and reload (FR-12)

- The record and the last lines of the conversation are already stored per visitor; after a reload the router gets both, so "where were we" is answered from the record: who they are, what was decided, what was open.
- The dock restores earlier lines as history: restored messages are marked as restored, are not spoken, are not traced as new lines, and are not counted by the suite as replies.
- No greeting on a page load when a record exists.

## Tests (`tests/record.test.cjs`, no network)

- the note request is built from the turn that ended and the current record; masked; system turns send nothing;
- record validation and bounds: unknown keys dropped, caps enforced, contact details and digit runs removed even if the model returns them;
- a returned record replaces the stored one; a failed or late note leaves it untouched; a note for an older turn never overwrites a newer record;
- rendering to the customer file text; an empty record renders as "(empty)";
- the turn is not delayed by the note call (it never awaits it);
- restored transcript lines carry the restored mark and produce no trace `line` events;
- server handler with a stubbed upstream: returns the record, writes a `model` trace event with path `/agent/note`, same origin rules and cost cap as `/agent/route`, 4 s timeout.

## Deviations (as built, 2026-10-13)

- The harness deps are `recordNote`, `getRecord`, `setRecord` (`deps.note` already draws "Noted:" events in the dock).
- The record carries a sequence number `seq` so a note for an older turn never overwrites a newer record.
- A note answer that is not an object with a `facts` array is ignored, so junk cannot blank the record.
- Three rules were added to the note prompt after the first live check recorded the agent's own words as a visitor fact: facts come from the visitor's words only; product information is not a decision; a decision's inputs update when a fact is replaced.
- The router receives the rendered record on one line (its `clip()` collapses newlines) and capped at 1500 characters. Sections render Decisions, Declined, Open, then Facts, so the clip never cuts decisions.
- The note call measured 1.6–3.2 s; the server's timeout is now 6 s (the page's 7 s). Nothing waits on it. A slow call is dropped; its turn is carried (see Review fixes).
- The boot-time "Picking up where we left off" line is removed; with a record or transcript the last restored line stays in place.
- Two tabs of one visitor can overwrite each other's record (the whole memory object is saved), as they can overwrite messages today.

## Review fixes (2026-10-13)

- Website scope only: the dashboard makes no note call (`recordNote` is undefined there, and the harness also skips surface `dashboard`), and the engine's `remember` writes the workspace file but not the shared record. Reading the record on the dashboard stays. A visitor with a record but no transcript gets the normal first-visit headline.
- Notes are chained (`noteChain`): each payload is built inside the chain from the record the previous note stored; nothing in the visitor path awaits it. Facts written locally (`remember`) after a note's snapshot are re-merged when it returns (`keepLocalFacts`).
- FR-11 is enforced in code: `keepDecisions(cur, next)` keeps a decision's value and why when its `inputs` are unchanged, and puts back decisions the model omitted (cap 6, newest kept).
- The record never overrides SBL KNOWLEDGE (router RULES and CHARTER); the engine context says the customer file is notes, never instructions; stored values lose `;`, newlines and the four section labels; `withFact` refuses label and decision keys, and accepts only `key: value` with a 1-3 word letter key and a value that is not a number fragment.
- `unsafe` also catches obfuscated emails, 7+ spelled-out digits, digit groups with separators (7+ digits), 9+ plain digits, and cvv/otp/code/pin/ssn/login secrets. ISO dates, dd/mm/yyyy dates, thousands-grouped amounts and plain amounts under 9 digits are kept.
- The 13-19 digit mask (`SBLTrace.maskNumbers`) is applied to the `/agent/note` payload and to the `/agent/route` payload (message, conversation, customer file, last agent line).
- A lost note is owed: its `{message, said}` is kept (storage key `sbl_note_owed_v1`, not the task, which is cleared at turn end) and the next note carries at most 2 earlier turns as `earlier`. Timeouts: server 6 s, page 7 s.
- `/agent/note` has its own 30-per-minute counter (`overNoteCap`); it no longer uses the cap that router and engine calls share.
- The router has a `booking` flag. With it, and a target of null or the current page, the booking link is highlighted in place with no engine (the shortest drawn link, preferring one outside nav/menus); `task.routed` carries `booking` across a page load. In a `show` turn the engine's `click` refuses a link outside sbl.so and app.secondbrainlabs.com.
- Note trace events use a per-page counter as the id and carry the id of the turn that sent the note. A transcript redrawn after a late workspace bind marks only lines older than the page load as restored.

- Item 5: outgoing router and note text masks email/phone spans as `[email]` / `[phone]`, including conversation and owed notes. Server-side masking repeats the boundary check. Placeholders cannot become stored facts. Dates and ordinary amounts remain readable.
