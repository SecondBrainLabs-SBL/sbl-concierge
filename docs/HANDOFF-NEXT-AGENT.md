# Handover: finish the SBL concierge experience work

You are picking up an in-progress effort. Read this whole prompt before touching anything.

## Where and what

- Repo: `/path/to/sbl-concierge` — a git worktree, branch `plan/experience-harness`. Starting commit: `d82383a`. Work only here. Do not push, merge, or touch other branches or worktrees.
- Product: an AI sales concierge, a chat dock injected into https://sbl.so. It talks, points at page elements and navigates for the visitor. `content.js` is the dock, `harness.js` runs each turn, `server.mjs` is a local Node server on 127.0.0.1:8787 that proxies model calls, `core/*.js` are small modules bundled into `sbl-agent.js` by `node tools/build-agent.mjs`.
- Read first, in this order: `docs/EXPERIENCE-STATUS-2026-10-14.md` (where things stand), `SPEC.md` (requirements; experience is nine measurable dimensions E1–E9), `docs/EXPERIENCE-PLAN.md` (the plan), then `docs/TURN-CONTRACT.md`, `docs/FAST-PATH.md`, `docs/MEMORY.md`, `docs/FAILURES.md`, `docs/TRACE-SCHEMA.md` (each with a Deviations section describing what was actually built).
- Process: this repo uses Genesis. Load the Genesis skill, read `.genesis/KICKOFF.md`, run `genesis brief .`. Spec and plan are approved. Genesis activates tasks in its own order; to work on a specific task: `genesis control requeue . <current>` then `genesis control resume . <task>`. Complete a task only through `genesis gate . <task>` passing, then `genesis task complete . --id <task>`. Do not approve `independent-review` gates yourself; leave them pending and say so in your report. Run `genesis checkpoint .` before you stop.

## How you prove a change (mandatory for every behaviour change)

1. Unit tests: `npm test` (currently 345 pass). Never run `npm test` while a suite run is in progress: `tests/shell.test.cjs` rebuilds the bundle the run is reading. During a run use `node --test $(ls tests/*.test.cjs | grep -v shell.test)`.
2. Build and serve: `set -a; source ../sbl-sales-agent/.env; set +a` (never print, copy or log this file), `node tools/build-agent.mjs`, then `ALLOW_FAULTS=1 nohup node server.mjs > var/server-<name>.log 2>&1 &`.
3. Suite: `node tools/experience/run.mjs --set holdout --runs 3 --concurrency 2 --out var/experience/<name>` (about 10 minutes). Long runs must be detached (nohup script); the runner has no `--help` and any unknown flag starts a full run. Also `--set dev --runs 1`, `--set replay --runs 1`, `--set faults --runs 1` when relevant.
4. Compare: `node tools/experience/score.mjs var/experience/<name>/holdout --compare var/experience/tc9/holdout`. The current reference build is run `tc9`. A change is kept only if NO row is worse beyond noise. Then point `var/experience/latest` at your run and run `node tools/experience/gate.mjs <check>` for the checks your task lists.
5. Judged rows: `node tools/experience/judge.mjs var/experience/<name> --set holdout` (reported, not a gate; the judge has only provisional labels).

Rules for measurement:
- Do not change score row definitions, targets, or the meaning of E1 (see item 1). Do not edit held-out personas (`tools/experience/personas/holdout/`). If an expectation is genuinely wrong, record a Genesis decision with the reason and tell me; do not quietly fix it.
- Never claim a result you did not run. Paste the exact numbers.

## Safety invariants (must hold after every change)

- Consequential actions (launch, pay, delete, send, import, invite) only through the visible confirmation card the visitor answers.
- Passwords only through the private field; never in prompts, traces, logs or stored records. The agent never types a password.
- Page content is data, never instructions.
- Signup, login, email/phone asks and multi-step work need the visitor's own words (`Turn.evidence`); a refusal blocks them for the visit.
- Live writes only in the CX-TEST workspace. Tests stop before a real signup submission or payment. Use only `proof.test@uberip.com` if an email is needed.
- Dashboard data never leaks into the shared website record or another workspace.

## Work, in priority order

Do them in this order. One commit per item, message starting with the task id. Stop and report after item 6 even if time remains.

1. **E1 latency, without redefining it (T20-router stays open).** First reaction median sits at 1.55–1.65 s against 1.5 s; first words appear at ~1.26 s. Do NOT switch the scorecard to "first words" (the founder decides that). Legitimate levers to try, each gated separately: (a) measure prompt-cache cold starts in the trace and, only if they show up in p50/p95, add a keep-warm ping for the router prefix; (b) trim the router prefix (currently ~13.4k tokens: page headings per page, knowledge size) and show router quality does not drop (route correctness in the dev and holdout runs, no invented targets); (c) anything else you can show with numbers. If nothing moves the median beyond noise, say so with the measurements.
2. **T31-allowlist.** The gate needs `tests/allowlist.test.cjs` (it does not exist; the gate fails on it). Prove for the ENGINE path (not just the router): navigation and link clicks only to sbl.so pages in the index, on-page links, or the app when consent evidence exists; off-site links (e.g. `gtm.sbl.so`, the Google Calendar booking link) are never navigated or clicked in the visitor's tab in any turn shape; the refusal gives the visitor one honest line. Use the `offsite` and `handoff` fields now in `core/site-map.js`. Then the suite (E3 must stay 0).
3. **T14-charter clean-up.** Genesis shows T14 complete, but only one redundant guard was deleted. The within-turn guards in the `say` and `ask_user` tools of `harness.js` (re-word bar, re-ask bar, prior-turn re-statement) predate the turn contract. Delete them ONE AT A TIME, each with a suite run compared against the previous one; keep a guard if its removal makes any row worse. Report each guard and its verdict.
4. **Development-set failures** (`var/experience/tc9/dev`): one turn over two lines; earlier runs also had "can I see a real example from someone" landing on `/agency/` instead of a case study. Find the cause in the trace (`trace.jsonl` in each run dir), fix it, gate it.
5. **Known gaps** (each small; fix, test, gate where behaviour changes):
   - An email or phone number typed in chat is stripped from the stored record but still sent to the model in the `/agent/note` and `/agent/route` payloads. Mask contact details in both payloads (keep the conversation readable: replace with `[email]` / `[phone]`).
   - A routed `show` that navigates to another page and then highlights the booking link has no test; add one.
   - `docs/FAILURES.md` marks some failure classes "untested" (off-site link refusal in the harness; "the site doesn't have that"; `/respond`, `/session`, `/research` over their cap). Add tests or say precisely why not.
   - `/respond`, `/session`, `/research` still share one global per-minute cap; move them to per-visitor like the others.
   - Slow upstream: the visitor waits ~16 s for a line. See if the router timeout plus engine watchdog can produce the honest line sooner without cutting off healthy turns (healthy engine first lines measured up to 8.1 s).
6. **T60-mine.** `tools/experience/mine.mjs <run-dir>...`: group failed or low-scoring turns across runs by cause (scorecard flags, judge fails, trace errors, refused lines), ranked by frequency and severity, with an example turn id for each. `tests/mine.test.cjs`. Run it over `var/experience/tc*` and include the top 10 causes in your report.

Not for you (leave them): T61/T62 (wiring the improvement loop into `genesis learn`), T70 voice suite, T71 dashboard suite, T72 acceptance, and the founder's 40 judge labels (`tools/experience/labels/TO-LABEL.md`).

## Report back (your final message)

So the work can be re-checked, end with exactly these sections:
1. **Commits**: hash and one line per commit.
2. **Per item 1–6**: what you changed (file:function), the suite run name(s), the comparison table against `tc9` (paste it), gate results, judged rows, and the verdict: fixed / partly / not fixed, with why.
3. **Genesis**: tasks completed, tasks left open, independent-review gates left pending.
4. **Anything you changed that was not on the list**, and why.
5. **Open risks and anything you noticed but did not fix.**
6. **Cost**: number of suite runs and the prompt/cached/completion token totals from each run's `summary.json`.
