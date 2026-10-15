# SBL Concierge

An AI sales concierge for [sbl.so](https://sbl.so) and the SBL dashboard. It answers visitors, highlights page elements, navigates, and assists with campaign setup through the visible UI.

**Development snapshot, not production-ready.** Start with [the contributor handoff](docs/START-HERE.md) and [the copy-paste continuation prompt](docs/CONTINUE-PROMPT.md). The snapshot includes the implementation, tests, specifications, task state, and historical result reports through source commit `9222ec0` (2026-10-15).

## Setup

Use Node 24 LTS (`.nvmrc`). A Node 26 run previously crashed with an uncaught HTTP/2 socket idle timeout. The local server binds to `127.0.0.1:8787`; do not expose it publicly.

```bash
git clone https://github.com/SecondBrainLabs-SBL/sbl-concierge.git
cd sbl-concierge
nvm install
nvm use
cp .env.example .env
# Edit .env locally with your own OPENAI_API_KEY. Never commit it.
node tools/build-agent.mjs
npm test
set -a
source .env
set +a
node server.mjs
```

The root package has no npm dependencies. The checked-in browser engine is bundled already; its notices are in `vendor/engine.js.LEGAL.txt`. If rebuilding that engine, use `npm ci --prefix tools/engine` and `npm run build --prefix tools/engine`.

Real model-backed chat and voice require an API key with access to the models configured in `live-config.mjs`. Check `http://127.0.0.1:8787/health` after starting the server. A healthy server or connected voice indicator does not prove a successful user conversation.

### Load the concierge

The latest founder demo used **Tampermonkey**, with [tools/sbl-local.user.js](tools/sbl-local.user.js) as a short loader for the local bundle. Install that script, keep only one SBL injector enabled, then reload SBL. Each reload fetches the freshly built `agent.js` from the local server. Browser local-network permissions may be required. Do not paste credentials into a userscript.

Alternatively, load this folder as an unpacked Chrome extension. Use only one injection method at a time. The extension and userscript have different state transport paths; test the method you intend to demonstrate.

Try “Show me the pricing page”, then “Show me the features” from pricing. Those two interactions were verified in the latest founder browser session. Other paths need their own proof.

## Current status

- Latest source-worktree unit result: **377/377 passed**.
- Live pricing navigation and feature-table highlighting worked after the latest fixes.
- Founder confirmed one spoken capability answer without repetition; full voice workflows remain unproven.
- Campaign creation **has not passed end-to-end without correction**. The latest full attempt created a draft but timed out before saving the exact requested name.
- Holdout run `tc24`: no rows worse beyond measured noise versus `tc9`; E1 latency and E6 consistency still fail targets. Busy p95 regresses versus `tc22`.
- Founder replay and injected-fault gates passed. Development scenarios still include a model-outage navigation failure and an overlong goodbye.
- Signup submission, payment, launch, outbound sending, and full voice/dashboard acceptance are not demo-ready claims.

See [latest measured results](docs/DEMO-FIXES-2026-10-15.md). Historical reports are evidence of their original build only, not proof that a fresh clone passed those runs.

## Code map

| File | Responsibility |
|---|---|
| `content.js` | Dock, text input, voice, visible confirmation UI |
| `harness.js` | Each turn, tools, execution and recovery |
| `core/router.js` | Fast answer/show/ask/do routing |
| `core/turn.js` | Turn contract and visitor consent evidence |
| `core/screens.js` | Known dashboard controls and campaign flow |
| `core/store.js`, `core/record.js` | Visit state and scoped memory |
| `cursor.js` | Pointer motion and highlights |
| `server.mjs` | Local model proxy, limits and trace handling |
| `tools/build-agent.mjs` | Build the userscript-loaded bundle |
| `tools/experience/` | Personas, runner, scoring, judge and failure mining |

## Safety and contribution rules

Read [AGENTS.md](AGENTS.md), [SPEC.md](SPEC.md), and [START-HERE.md](docs/START-HERE.md). Never change held-out personas, score targets, or E1's definition to make a change pass. Test in a real browser as a visitor would use it. Only a maintainer can grant access to the designated test workspace. Never use an arbitrary signed-in workspace for writes.

This public repository starts with a clean snapshot. Private Git history, credentials, browser profiles, raw live traces/screenshots, local stores, generated index files and an old server log were excluded. Historical local paths were replaced with placeholders. Sanitized aggregate results are in `docs/results/`; raw `var/experience` baselines are not distributed. Genesis itself and its skills are external tooling: obtain the approved version from the maintainer; do not fabricate approvals or mark tasks complete without gates.
