# Harness direction — founder feedback and research, 2026-09-30

Status: **discussion only. Nothing was built or changed in the product code.** No go has been given yet.

Sources for this file: the founder's voice transcript and iPad video (feedback on the build), the investor meeting transcript, four research passes (browser-agent SDKs, memory and self-improvement, competitors, an audit of the current code), and the Browser Use docs the founder pasted.

## 1. What the founder wants

- **A super-intelligent harness, not a chatbot and not a wrapper.** One box that can do anything, anywhere on SBL, the way Claude Code, Codex, Instinct and Meta's Muse can do anything on a computer.
- **No hard-coded rules.** No personas, timers, goal tables or scripted routes. Even "this customer runs a lot of campaigns" must be something the agent notices, not something we code.
- **Context is the core.** Load everything about SBL (site, dashboard, knowledge base, success stories). Keep a file per customer; it can start empty.
- **Adapts to each customer continuously.** It builds and revises hypotheses from what the person does, and decides the next move toward the goal (free trial for a new visitor; success and retention for a customer).
- **Acts like a salesperson sharing a screen.** It scrolls, points, highlights, moves between pages, picks the proof that fits the person, and never reads out what is already on screen.
- **Proactive but not annoying.** A companion, not pressure. When to speak is the model's judgement, not a timer.
- **Goes beyond the page when needed.** It can open another tab, walk through a competitor's site (Expandi), research, or create an asset (an SDR profile banner) and come back.
- **Delegated judgement.** Like a trusted employee: it may offer a discount, offer a founder call, type a password or make a payment if the customer wants that, within limits the business sets.
- **Use proven tools.** Don't reinvent browser control. The founder named Browser Use and is fine with the cost.
- **MVP:** a narrow slice that works properly and has an aha moment, shipped fast. Not end to end.

## 2. What the demo showed

In the investor demo the text side correctly said "looks like you're comparing pricing". The founder said yes, and the voice agent replied "What does your business sell?"

The founder's verdict: it doesn't have the right context, and it talks instead of showing. When asked for a pricing recommendation it should have gone to the plan, highlighted "this is the one", offered a success story from a similar customer, then moved to account setup.

## 3. What the code audit found

The founder is right. The model is boxed in by fixed structure:

| Problem | Where |
|---|---|
| Goal table decides the objective per page and is sent as a "deterministic strong default" | `core/goals.js`, prompt in `live-config.mjs` |
| Keyword classifiers and fixed weights infer persona and intent | `core/behavior.js` |
| Timers decide when it speaks (20 s, 60 s, 10 s dwell, max 3 per path) | `content.js` `maybeProactive` |
| Scripted macros for the campaign flow; the prompt spells out the route | `prepare_campaign` and friends, `TOOL_RULES` |
| One page action per turn, six tool rounds, and the turn dies on navigation | `content.js` `modelTurn` |
| The model sees little of the page: trimmed to 3,000 chars, controls dropped, no vision | `pageContext`, `live-config.mjs` |
| SBL knowledge is a keyword-ranked 7,000-char slice | `core/sbl-knowledge.js` |
| Voice context updates are rejected ("must not exceed 500 tokens"), the likely cause of the demo failure | `sendLiveEvent` |

Roughly 1,400 lines plus most of the prompt should be replaced. Roughly 1,700 lines are worth keeping: the cursor, the dock, voice, the confirmation card and the local server.

## 4. Can we use Browser Use?

Browser Use drives Chromium through the Chrome DevTools Protocol (CDP). That decides where it can run.

| Form | Works for | Does not work for |
|---|---|---|
| **Open-source Browser Use on a browser we launch** (`cdp_url`, or its "real browser" mode on a local Chrome) | Our own demos and proofs | Real customers: their Chrome does not expose CDP |
| **Browser Use Cloud** (`use_cloud=True`, profile sync, live streaming URL) | Anything outside the customer's tab: competitor walkthroughs, research, creating assets. A few cents per browser-hour plus model cost + 20% | Acting on the customer's own page. They would watch a stream; their tab would not move. For the dashboard we would have to send customer login cookies to a third party, and LinkedIn login would happen in a remote browser |
| **Browser Use's logic running inside the page** (`alibaba/page-agent`, MIT; its README credits Browser Use for its DOM processing and prompt) | The customer's own tab, from a script tag, with nothing leaving their browser | Other sites' tabs. Unverified: reliability on our dashboard and behaviour across full page navigations |

Useful things in the Browser Use docs: custom tools (`@tools.action`) so our highlight, confirmation card and ask-the-human steps can plug in; `extend_system_message` for loading SBL context; `allowed_domains`; `sensitive_data`; and its own model `ChatBrowserUse`, which it claims is 3–5x faster (vendor claim). Its prompting guide says specific tasks work better than open-ended ones, which is worth remembering against "no rules".

**Recommendation: one brain, two sets of hands.** In the customer's tab, the in-page port. Outside their tab, Browser Use Cloud streamed into a panel. The alternative, cloud-only with the stream as the product, is simpler on the public website but brings the session and LinkedIn problems to the dashboard beta.

## 5. The design (the founder's shape)

1. **Load all of SBL once**, in full and cached: every page and section of the site, every dashboard screen, the knowledge base. Give it to both voice and the acting model.
2. **A Browser Use–derived engine sees and acts.** Our cursor and highlight make it visible.
3. **One loop, the model decides, and it survives page changes.** No goal table, timers or macros.
4. **One file per customer**, empty at first, which the agent writes to itself.

What stays as enforcement: the confirmation card before consequential actions, the human-only moments (passwords/OTP, captcha/Google choice, LinkedIn login, per DECISION-a19e7906, unless the founder changes it), and limits the business sets (for example a maximum discount, payment only on the user's yes).

## 6. Research notes

- **Memory:** a markdown file per customer is enough. Mem0, Zep/Graphiti, Letta and GraphRAG are overkill for short visits. The whole site fits in a cached prompt, so no retrieval is needed.
- **Self-improvement:** per-customer learning is the notes file plus a rewrite at session end. Learning across customers (which angles convert) needs hundreds of outcomes; log outcomes now, build that later.
- **Proactive timing:** the model cannot be called every second, so a cheap filter batches events and wakes it at natural boundaries; the model then chooses to speak or stay silent.
- **Self-written tools** inside a customer session are a security risk. The safe version is a delegate tool to a server-side worker.
- **Competitors:** Foyer already ships voice plus scroll-and-highlight. Karumi, Naoma and Storylane do agent-driven demos in a separate streamed browser. Nobody found runs one continuous agent with memory from anonymous visitor through signup into doing the customer's first real task. That is the white space.
- Most research came from search results and vendor pages; prices, star counts and competitor claims are unverified.

## 7. Positioning and launch (investor meeting)

- **Category:** "Instinct or Muse, but for your business": a business agent, not a personal assistant. "Front desk" sounded too low-level; "super intelligent agent" was preferred over "AI". Name and one-liner are still open.
- **Scope:** acquisition, onboarding/experience, support/retention. One shared engine, offered as separate products (a sales agent, a support agent), like car variants on one chassis.
- **Launch:** a quiet beta inside the SBL dashboard for the ~500 weekly users for about a week, with a line such as "Want this for your own brand? Talk to us." Listen to how users describe it and use their words.
- **Investor's caution:** test thoroughly before release and know the downside if it goes wrong.
- **Later:** the harness is sold to other B2B and e-commerce companies.

## 8a. Founder decisions (2026-09-30, after the summary)

- **Engine:** in-page plus Browser Use Cloud. Try Browser Use itself first and judge whether it impresses.
- **MVP scope:** everything discussed, not a thin slice of capability. The flow the MVP must prove: the agent speaks first, based on the visitor's behaviour → shows them the website → gets them signed up → brings them into the dashboard.
- **Authority:** the agent does whatever is possible by clicking on the site, including discounts, payments and passwords. This widens DECISION-a19e7906, which kept passwords human-only. What stays human is only what the agent physically cannot do: captcha, OTP or email-verification links, and 2FA.
- **Behaviour understanding:** use strong existing tools (open source or paid) to track what the visitor does, and a strong model to work out what to do. Different behaviour must produce a visibly different opener, not a generic "what are you looking for?".
- **Model:** run on our own OpenAI model for now; move to Browser Use's model later. The Browser Use account is on the free tier, so its model and its cloud browser are unavailable until credits are added.
- **Measurement:** the plan must show whether things genuinely improved against the current build.

## 8b. Plan

**Step 0 — Baseline (before changing anything).** Write a fixed set of visitor scenarios and a scorecard, run them on the current build, and record video.

Scenarios (each a scripted visitor in the proof browser):
1. Lingers on pricing, hovers two plans, clicks nothing.
2. Scrolls the homepage fast to the bottom and back.
3. Reads a success story end to end.
4. Returns for a second visit after viewing pricing the first time.
5. Asks "how are you different from Expandi?"
6. Says "recommend a plan", then "okay, sign me up".
7. Shows no sign of wanting to talk (short visit, steady reading).
8. Existing customer with several campaigns opens the dashboard.

Scorecard per run:
- **Opener fit:** does the first line reference what this visitor actually did? (Scored by an Opus judge from the recording and event log, and by the founder's eye.)
- **Difference:** are the openers for scenarios 1–4 and 8 clearly different from each other?
- **Show, not tell:** did it move the page (scroll, point, navigate) when it answered?
- **Continuity:** did it keep going after each page change without being asked?
- **Completion:** did the visitor end up signed up and in the dashboard? Steps, time, wrong clicks.
- **Restraint:** did it stay quiet in scenario 7?

**Step 1 — Browser Use trial.** Run open-source Browser Use against our proof Chrome with the full SBL context loaded, on the action half of the scenarios (walk the site, sign up with a disposable inbox, reach the dashboard, start a campaign). Compare against the baseline on completion, steps, time and wrong clicks. This is the "is it impressive?" checkpoint for the founder.

**Step 2 — The harness.**
- Full SBL context loaded once into voice and the acting model.
- In-page Browser Use–derived engine for the customer's tab, with our cursor and highlight.
- One loop that survives page changes and reconnects voice.
- Browser Use Cloud in a panel for off-site work (Expandi walkthrough, research).
- A file per customer that the agent writes to.
- Passwords are filled locally from what the customer provides and masked from the model and the logs. Payments happen on the customer's yes. Discounts apply where the site has a coupon field.

**Step 3 — It speaks first.** Rich behaviour capture in the page (candidate: rrweb, the open-source recorder behind PostHog's session replay; PostHog itself if the founder wants the analytics dashboards). A strong model turns the event stream into a hypothesis and decides whether, when and how to open.

**Step 4 — Prove the flow.** Fresh browser: behaviour-based opener → site walkthrough → signup → onboarding → dashboard greeting that carries the context. Re-run all eight scenarios and put the scorecard next to the baseline.

**Step 5 — Dashboard beta prep**, once the founder is impressed.

Proof limits that still hold: test signups use a disposable inbox; live writes only in workspace 706 [CX-TEST]; proofs stop before a real payment click unless the founder sanctions a specific test payment.

## 8. Open decisions (as of the summary; items 1–3 are now answered in 8a)

1. **Engine:** in-page port plus Browser Use Cloud (recommended), or cloud-only with a stream?
2. **MVP slice:** website salesperson first, or the visitor → signup → first campaign continuity first? Given the launch plan, the proof should run on the dashboard as well as the website.
3. **Authority limits:** what may the agent do on the business's behalf (discounts, payments, typing passwords)? Discounts need a real coupon mechanism.
4. **Genesis:** this replaces the approved M6/M7 plan. Record it as a decision and reopen the plan once the founder says go.

## 9. Proposed next step (awaiting go)

A one-day spike on five tasks: pricing walkthrough, success story, signup, start a campaign, find a campaign's stats. Run three contenders side by side: open-source Browser Use on our proof Chrome, the in-page port, and Browser Use Cloud. Choose on evidence. It costs a small amount in model calls.

The earlier known-broken list in `HANDOFF.md` (typed chat, voice context cap, continue after navigation, guided journey) still stands; most of it is replaced by the new loop rather than patched.
