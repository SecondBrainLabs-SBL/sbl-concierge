# Founder handoff: understand the vision, try the product, then continue the work

Work on https://github.com/SecondBrainLabs-SBL/sbl-concierge. Read this entire brief before changing anything. First understand what I am trying to build, then run what exists and experience it yourself, and only then decide how to improve it.

## 1. My vision

I want a capable AI representative for a business, starting with Second Brain Labs. Imagine a good salesperson sitting beside a visitor, sharing their screen: understanding what they want, showing the relevant parts of the product, answering questions, and helping them actually get something done. The visitor should be able to speak naturally or type, while the agent works visibly in the same website and dashboard they are using.

The experience should feel like one continuous companion from the first visit through becoming a customer and using the product successfully. It should understand SBL, its features, pricing, customer examples and dashboard capabilities; learn the visitor's business, audience and goals; remember what has already been said; and adapt its help to that person. A recruitment agency, a finance business and a returning customer should not all receive the same pitch.

It should be proactive like a salesperson. A visitor should not have to arrive with a list of feature questions. It can start with something natural such as “Hey, what are you looking to improve: finding leads, getting replies, or booking more meetings?” As the experience develops, it should use the current page and the visitor's behavior to make its help relevant. Proactive must also mean considerate: no repeated greetings, interruptions, pressure, or dragging someone into signup when they are just exploring. The immediate approved welcome is one greeting followed by waiting; richer behavior-aware selling is a direction to develop, not something to claim is already reliable.

Showing matters as much as talking. If someone says “show me the features,” the agent should move to the relevant page or section, scroll and highlight the actual feature. If they ask for proof, it should show a real, relevant customer example. If they ask about a plan, it should point to the plan and explain why it fits their stated needs. It should not merely read the screen aloud, invent a result, give a long generic answer, or say it has shown something when the page never moved.

The intended journey is:

1. A visitor arrives and receives relevant, respectful help.
2. The agent understands the outcome they want and demonstrates the parts of SBL that matter.
3. When the visitor explicitly wants to proceed, it helps with signup/onboarding, with human-only and confirmation steps handled correctly.
4. It carries the same conversation and context into the dashboard, without starting the interview again.
5. It helps them complete a real task, such as creating and saving a campaign draft correctly from one natural request.
6. For returning customers, it continues helping with product use, support and successful outcomes, within their workspace and permissions.

Voice should be a first-class way to use this. The visitor should be able to talk, hear one relevant reply, interrupt or change direction, and continue across pages without two voices answering, repeated lines, side conversations becoming tasks, or lost context. Typed chat should be equally dependable, including ordinary Enter-to-send.

I want model judgment grounded in real context, with reusable browser actions and clear safety boundaries. Avoid building a growing collection of one-off keyword rules or scripts for every demo sentence. At the same time, do not remove consent, privacy, validation or execution safeguards in pursuit of autonomy. The agent should finish the work the visitor authorized, verify the visible result, and say honestly when it cannot finish.

There is also an engineering vision: we should be able to see whether a change actually makes this experience better. The project has traces, repeatable visitor scenarios, scorecards, judging and failure mining so we can identify causes, compare a candidate with a baseline, and eventually support a reviewed improvement loop. Passing a rehearsed demo once is not the goal. Longer term, this shared capability could serve acquisition, onboarding and support for other businesses too. SBL is the first proving ground; a generalized platform, off-site autonomy and automatic code promotion are not part of your immediate assignment.

## 2. What has been built so far

This is an existing implementation, not a request to start over. The public snapshot contains the code, specifications, tests, task records and measured reports through 2026-10-15.

The implementation includes:

- An injected chat/voice dock on sbl.so and the SBL dashboard, with visible cursor movement, highlighting and confirmation cards.
- A fast router for answering, showing, asking or handing a task to the browser-action engine; a harness that runs turns and handles interruption, refusal and failure.
- SBL site knowledge and a page index, dashboard-screen guidance, visitor memory and cross-page task continuity.
- A local Node server that proxies model calls, keeps API credentials out of the browser, applies request limits and records traces.
- Turn/consent checks, navigation restrictions, contact masking, private-password handling and workspace-scoped records.
- Unit tests, development and held-out visitor suites, founder-session replay, injected faults, scorecards, a provisional model judge and failure mining.
- An approved first-visit welcome implementation, with complete acceptance still open.

Recent fixes addressed Enter submission, stale tasks causing repeat responses, long requests losing consent evidence, campaign button guidance, explicit “show me” routing, and pointer animation stalls. They are improvements to test, not a declaration that every journey works.

The export passed 377 unit tests and built successfully. The latest real-browser check navigated to pricing and highlighted its feature comparison table. I confirmed that a basic spoken capability question answered once after an earlier repetition problem. Full voice and campaign journeys are not proven by those individual successes.

## 3. Run it and experience it yourself before editing

Read README.md and docs/START-HERE.md for the setup and current safety rules. Ask a maintainer privately for the approved test-workspace access, API/model access and Genesis tooling. Never request credentials in a public issue or commit them.

```bash
git clone https://github.com/SecondBrainLabs-SBL/sbl-concierge.git
cd sbl-concierge
nvm install
nvm use
cp .env.example .env
# Edit .env locally with your own authorized API key.
node tools/build-agent.mjs
npm test
set -a
source .env
set +a
node server.mjs
```

Use Node 24 as specified in the repo. Check http://127.0.0.1:8787/health. Load tools/sbl-local.user.js in Tampermonkey, keep only one SBL injector enabled, and open https://sbl.so. This loader fetches the local build on reload. The unpacked-extension alternative is documented, but do not enable both. Do not expose the local server publicly.

Try it as an actual visitor, not by calling the model endpoint or browser tools directly:

1. Start a fresh visit and observe whether the welcome feels natural. Wait, type, reload and return; see whether it repeats or interrupts.
2. Type “I run a recruitment agency. Can SBL help me book more meetings?” and send using Enter. Check that it submits and answers once.
3. Ask “Show me the pricing page,” then “Show me the features.” Watch the actual URL, scrolling, highlighted content and dock placement. These two actions passed the latest live check.
4. Ask “Can I see a real example from a customer like me?” Check that it shows real supporting content or honestly explains a missing match.
5. Say “I'm just exploring—don't take me to signup.” Check that the refusal is respected. Interrupt an in-progress answer and check that the old task stops.
6. Reload and ask a follow-up about your business. Check whether context survives without repeating the interview.
7. Click Talk to SBL and speak “What can you help me with?” Use an actual microphone and speaker; listen for duplication, delay and interruption behavior. A connected indicator is not proof.
8. With maintainer-approved CX-TEST access, try the campaign request below through the dock. Verify the outcome on the page, not just in the agent's answer.

> Create a LinkedIn draft called [CX-TEST] Flow test — DO NOT LAUNCH. We sell CRM to small US recruitment agencies and want demos. Leave leads and sender empty. Save the draft without hiring, launching or sending.

Do not correct the agent mid-flow and then count the run as a pass. If it needs correction, record that as a failure. A pass requires the exact name saved, the draft visibly present, leads and sender empty, no invented proof claims, and no launch, hire, payment or send. These are exploratory tests, not a list of already-working demo claims.

Stop before real signup submission or payment. Passwords are entered by the visitor through the private field; never by the agent or into chat. Consequential actions require the visitor personally answering the visible confirmation card. Never answer that card for them. Never write into another workspace or publish private dashboard traces/screenshots.

## 4. What is left, and where to start

Your immediate priority is reliable campaign draft creation from one natural request, without my correcting it. The latest full attempt created a draft but timed out before saving the requested name. Earlier behavior chose the paid Hire Profile path instead of the separate Create Campaign button. Generated campaign copy also included an unsupported 30% claim. Find the causes and verify the complete corrected flow.

Alongside that, finish real-user verification of Enter-to-send, repeated lines and navigation on both website and dashboard. Preserve the pricing/feature interactions that worked. Validate the proactive welcome under first visit, return, typing, voice, active task and refusal conditions. Do not equate an implemented safeguard with proof that its user experience is right.

Remaining measured gaps include latency and consistency: tc24 first-reaction p50 was 1565 ms versus a 1500 ms target; p95 was 3081.33 ms versus 3000 ms; decision consistency was 0.67 versus 0.90. Its held-out comparison had no row worse beyond noise versus tc9, but busy p95 regressed versus tc22. Development scenarios still included a navigation failure during model unavailability and a goodbye with too many lines. Founder replay and fault gates passed. See the reports for the complete numbers, not just these highlights.

Actual signup completion, uninterrupted voice across the full journey, full dashboard acceptance, and production rollout remain unverified or unfinished. The dashboard gate is not implemented. Independent reviews remain pending. Failure mining exists; wiring the complete improvement loop and calibrating the judge against founder labels remain separate work. Do not silently take on all future tasks at once.

## 5. How to continue and prove progress

After trying the product, read SPEC.md, docs/EXPERIENCE-PLAN.md, docs/DEMO-FIXES-2026-10-15.md and the turn-contract, fast-path, memory, failure and trace-schema documents, including Deviations. Then read AGENTS.md and .genesis/KICKOFF.md and use the approved Genesis tooling. Older design discussions include superseded permissions and behavior proposals: current safety rules and recorded approvals govern. The current first-visit welcome approval supersedes the older blanket “never speak first” note; it does not authorize unrestricted interruptions.

Report your observed starting state before editing: what worked, what failed, and which failure you will address first. Continue the existing code on a feature branch. Keep changes focused and open a PR with evidence; do not merge it yourself.

Establish a measured reference on the unchanged checkout or obtain an approved baseline privately. Historical raw tc9/tc24 runs are not public; aggregate reports are not a substitute for those inputs. Follow START-HERE for unit/build checks, detached holdout x3 and relevant dev/replay/fault runs, comparison, provisional judging and cost accounting. Never run npm test or rebuild during a suite. Keep held-out personas, E1 semantics, score definitions and targets unchanged.

The nine dimensions are speed of first reaction, efficient turn completion, correct navigation, matching/unobstructed highlights, concise output without unsolicited movement, consistent decisions, memory, visible completion/failure, and visitor control. Improve the intended dimension without making others worse beyond measured noise. Do not trade correctness for a fast filler line.

Genesis completion requires passing the applicable gates; do not self-approve independent review or invent a pass for an unimplemented gate. Keep private runtime evidence local and checkpoint at handoff.

End with exact changes, test results, suite comparisons, judged rows, costs and remaining risks. Most importantly, tell me what you personally saw working as a user, what still failed, and what is reasonable to demo. Do not call it demo-ready until the complete intended flow works without correction.
