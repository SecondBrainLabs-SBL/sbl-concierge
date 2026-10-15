# Step 3 build brief — one brain, one mouth (PLAN-SEAMLESS step 3)

Worktree: `/path/to/developer/Downloads/agentic-commerce/sbl-step3-wt`, branch `build/step3-one-brain`.
Read first: `docs/PLAN-SEAMLESS.md` step 3, `HANDOFF.md` interview Q3 + the "evening update" (the
founder's bad session: talk-over, "same wall", do-it-yourself lines), `implementation-notes.md`.
The step-2 reviewer believed the engine cannot see the iframe; the minified `vendor/engine.js`
DISPROVES that by inspection: its DOM walker (`$e`) descends into `iframe.contentDocument`
(same-origin) and its click action computes frame offsets (`Q_`) and walks frameElement bounds.
The first task is the empirical check, not trusting either reading.

## Goal (from the plan)
The acting model is the ONLY decider. Every visitor utterance goes to it; it acts and writes every
spoken line. Voice only transcribes and speaks those lines (`session.commentary.append`).
Delete the voice's delegate; the thinker becomes an input the brain reads, never a second speaker.

## FIRST TASK (report before building) — engine in the shell frame
`tools/proof/engine-frame-check.mjs`: script-tag mode, shell built (Talk on an sbl.so page), then from
the TOP document drive the engine (PageAgent) to, in order, inside the iframe:
1. build its flat tree — assert the tree contains elements from the iframe page (e.g. pricing page
   "Compare plans" text / plan headings), not the emptied top body;
2. `point_at` an element in the iframe (our cursor/highlight shows over the iframe element);
3. `click` a link in the iframe → assert the shell moves (guest nav, URL synced, one history entry);
4. `scroll` inside the iframe; 5. `input_text` into a visible input if one is reachable (do NOT submit
anything; pick an input on sbl.so — e.g. the site email field — type, then CLEAR it).
Record video + JSON result. If ANY of these fails, STOP and report the failure detail before building
the rest of the step (the fallback per the plan: the engine runs inside the frame page resuming from
the server store — that changes the step's architecture and needs re-scoping).

## Build scope (after the first check passes)
1. **Delete the voice's delegate.** The voice model today answers on its own (gpt-live path) and
   embellishes. After this step: voice = ears+mouth only. Its ONLY output channel is
   `session.commentary.append` with lines written by the acting model. Every visitor utterance
   (transcript delta finalized) goes to the acting loop (`/agent/chat`), which decides and writes the
   line the voice speaks. Tighten voice instructions to forbid self-authored answers and screen
   description; MEASURE filler rate the way the prototype did (request-like utterances vs extra
   spoken words) and put the number in implementation-notes.md. The prototype saw 7 of 12 polluted —
   report the new number, however bad; do not hide it.
2. **The acting loop lives in the shell and acts on the frame's document.** The brain loop runs in the
   top page and its engine drives the iframe DOM (per the first check). A page move never kills the
   loop (no top-level navigation on sbl.so anymore; the hop to app is the one exception and it
   reconnects). Wire the loop's tools: navigate → `SBLSHELL.go()`, point/scroll/click/input → engine
   on `frame.contentDocument`. The loop must survive the visitor's own in-frame navigation (context
   from the digest via guest forwarding — step 2 already feeds it).
3. **Loop guard fixes** (the "same wall" defect, `core/task.js`): pointing and talking never count as
   page-progress failures; the repeat count RESETS when the visitor speaks; a new request after a
   stop is a NEW task (no resume-with-old-goal from `waiting_user`); internal lines ("same wall",
   step numbers, errors) NEVER reach the visitor (no dock line, no voice line). Keep the existing
   tests passing and add tests pinning each rule.
4. **One mouth discipline in code:** every agent-authored line is spoken exactly once (no double
   push of `session.commentary.append` + `response.create`), typed chat and voice render the same
   line from one store, and the agent never tells the visitor to do something clickable itself.
   The confirmation card stays as-is (never press Yes — proofs only show it).
5. Thinker: becomes an input to the brain (its hypothesis/opener data goes into the brain's prompt);
   it must never emit a visible/audible line itself. Delete or gate its say paths.

## Proof — `tools/proof/one-brain-proof.mjs`, output `tools/proof/out/step3/run-N`
Scripted visitor, script-tag mode, shell + voice connected, recorded:
a. Spoken request "Which plan fits me? I'm a founder doing outreach myself." → within ~2 s the
   agent's line is spoken (by voice, verbatim from the acting model), points at one plan (cursor/
   highlight on the pricing page in the shell). Assert: exactly one spoken line, no extra filler
   words beyond the authored line, no screen description.
b. "Do you have success stories? Walk me through them." → spoken "let me take you there"-type line,
   shell moves to case-study, one voice session kept, arrival line after load, points at one story.
c. Mid-sentence interrupt: "Any clients in finance?" while speaking → stops talking at once (assert
   audio stop ≤1.5 s), switches to the investment-firm study and points at it.
d. "Okay, sign me up." → shell moves, then the app hop with sblv, voice reconnects, agent asks for
   name+email BY voice, spoken answer (use the voice-answer pattern from `tools/proof/voice-answer.mjs`)
   fills the form — but DO NOT SUBMIT (stop before Start Your Free Trial). Assert no
   "fill it yourself" line anywhere.
e. Filler measurement: count request-like utterances vs spoken outputs; log extra words per turn.
Run twice (run-1, run-2), all checks green both.

## Hard limits (unchanged)
Never press Yes on a confirmation card; never launch, pause, delete or create campaigns; never connect
LinkedIn; never pay; NO account creation (stop before submit; a disposable inbox comes in step 5).
Never print `.env`. Server from the worktree with the main checkout's .env. `npm test` green (147+).

## Report
state → evidence (commits, tests, run summaries, filler numbers) → blockers → NOT-exercised list.
Claim nothing you have not seen in run output or your own frame checks of the videos.