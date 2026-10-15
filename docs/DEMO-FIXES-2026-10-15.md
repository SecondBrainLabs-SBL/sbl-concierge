# Demo fixes — 2026-10-15

Status: regression measured; partial fixes only, not a full demo-ready sign-off.

## Changes

- `content.js` composer: explicit Enter submission, preserving IME composition and suppressing held-key repeats.
- `harness.js:bg` and `core/store.js:hydrate`: use the hydrated task state so a cleared app task does not resume from the website's stale origin-local cache.
- `core/screens.js:campaignWizard`: use Create Campaign rather than paid profile hire; validate the 200-character brief first; finish by saving the exact requested name; avoid narrating each button.
- `core/turn.js:visitorSaid/reviveVisit`: preserve 800 characters of visitor evidence, matching the model-facing turn limit. Longer requests previously lost their final instructions after 240 characters. Refusal and quote-matching rules remain in force.
- `harness.js:say`: tell the model the actual evidence failure instead of falsely saying its opening line was a repetition.
- `core/router.js:RULES`: explicit show requests must choose a matching page or section, including when already on that page.
- `cursor.js:frame/moveTo`: suspended animation frames cannot hold cursor movement indefinitely; an 80 ms frame fallback and 1500 ms movement cap finish at the target.

## Live evidence

- `31dc7c0a-c7l8-2`: native Enter submitted the capability question once; one answer, answered status.
- `31dc7c0a-c7l8-3`: one natural draft request created campaign 9012 using Create Campaign without hiring a profile. It timed out before Update saved its requested name. This is a failed full-flow test, not a pass. The generated campaign content also contained an unsupported 30% claim; nothing was sent. The unfinished name dialog was cancelled after the agent stopped.
- `fa3a3387-rlor-4`: founder show-features request produced only a text list, with no action. Router defect reproduced.
- `fa3a3387-rlor-5`: initial router fix chose the feature heading, but pointer movement stalled and produced a late fallback. This is a failed test.
- `fa3a3387-rlor-6`: after cursor fix, Show me the pricing page navigated to /pricing/, highlighted Compare plans, and ended answered. DOM and screenshot verified.
- `fa3a3387-rlor-7`: exact show-features wording on pricing highlighted the comparison table and ended answered. One visible line. DOM and screenshot verified.
- New app-tab campaign retest could not be submitted: native automation lost the page accessibility tree, then coordinate input returned noWindowsAvailable. No additional campaign was created in that attempt.

Screenshots: `var/demo-2026-10-15/pricing-navigation-fixed.png`, `var/demo-2026-10-15/features-pricing-verified.png`. The earlier features-after-fix.png is stale/failed evidence and must not be used as a passing screenshot.

## Verification

- Unit suite: 377/377 pass (`var/demo-tc24c-unit.log`).
- tc23: holdout and dev finished; server crashed before replay/faults. The completed holdout comparison against tc9 has no worse rows; E1 p50 1495 ms. This was an earlier candidate, not final-build proof.
- Server crash: Node 26.8.1 uncaught ClientHttp2Stream InformationalError, socket idle timeout (UND_ERR_INFO). Restarted with installed bundled Node 24.19.0 using ignored var/start-demo-tc24.zsh. No server source change or claim that the upstream runtime defect is repaired.
- tc24: detached holdout x3, dev/replay/faults x1, concurrency 2, all finished. Zero failed jobs and driver timeouts in each set. No worse holdout rows beyond noise versus tc9 or tc23. Against tc22, busy p95 is worse: 7259.33 → 9801.33 ms. This candidate is not an across-the-board improvement.
- tc24 development failures: wrongLandings=1 (pricing request hit model unavailability), overMax=1 (returner goodbye produced two lines against a one-line expectation), consistency=0.60.
- The last native campaign retry showed inconsistent AX/screenshot state and the typed request remained unsent. No successful new full-flow proof.
- T71 dashboard gate remains unimplemented/failing; independent review remains pending. No completion approved.

## tc24 holdout comparison against tc9

| Row | Baseline | Candidate | Delta | Verdict |
|---|---|---|---|---|
| E1.p50 | 1567.33 | 1565 | -2.33 | within noise |
| E1.p95 | 2282 | 3081.33 | 799.33 | within noise |
| E1.words | 1612.67 | 1362.33 | -250.33 | n/a |
| E1.words.p95 | 2468.67 | 5084 | 2615.33 | n/a |
| E2.busy.p50 | 1988.33 | 2090.67 | 102.33 | within noise |
| E2.busy.p95 | 10820 | 9801.33 | -1018.67 | within noise |
| E2.calls.p50 | 1 | 1 | 0 | within noise |
| E2.calls.max | 1.33 | 2 | 0.67 | within noise |
| E3.wrongLandings | 0 | 0 | 0 | within noise |
| E4.occlusion | 0 | 0 | 0 | within noise |
| E4.match | n/a | n/a | n/a | n/a |
| E5.maxLines | 2 | 2 | 0 | within noise |
| E5.overMax | 0 | 0 | 0 | within noise |
| E5.unrequestedNav | 0 | 0 | 0 | within noise |
| E6.consistency | 1 | 0.67 | -0.33 | within noise |
| E7.recall.inSession | 1 | 1 | 0 | within noise |
| E7.recall.afterReload | 1 | 1 | 0 | within noise |
| E7.noQuestion | 0 | 0 | 0 | within noise |
| E8.silent | 0 | 0 | 0 | within noise |
| E8.late | 0 | 0 | 0 | within noise |
| E8.stranded | 0 | 0 | 0 | within noise |
| E9.afterStop | 0 | 0 | 0 | within noise |
| E9.signup | 0 | 0 | 0 | within noise |

## Gates

```text
FAIL e1: E1.p50=1565 (want <= 1500); E1.p95=3081.3333333333335 (want <= 3000)
PASS e2: 4 rows meet target in /path/to/sbl-concierge/var/experience/latest
PASS e3: 1 rows meet target in /path/to/sbl-concierge/var/experience/latest
PASS e4: 1 rows meet target in /path/to/sbl-concierge/var/experience/latest
PASS e5: 3 rows meet target in /path/to/sbl-concierge/var/experience/latest
FAIL e6: E6.consistency=0.6666666666666666 (want >= 0.9)
PASS e7: 3 rows meet target in /path/to/sbl-concierge/var/experience/latest
PASS e8: 3 rows meet target in /path/to/sbl-concierge/var/experience/latest
PASS e9: 2 rows meet target in /path/to/sbl-concierge/var/experience/latest
PASS no-worse: no row worse beyond noise
PASS founder-replay: 0 silent, 0 over max, 0 nav/signup violations in /path/to/sbl-concierge/var/experience/latest
PASS faults: 0 silent, 0 late, 0 honest misses, 0 unrequested navigations in /path/to/sbl-concierge/var/experience/latest
```

Genesis T71 gate was rerun and failed because dashboard is not implemented; independent review stays pending. No task completed.

## Provisional judge

Judged 72/72 say steps with gpt-5.6-luna (api calls 72, cached 0, tokens in/out 176134/12852)

| Row | pass | fail | n-a | pass rate (judged) |
|---|---|---|---|---|
| E3.asked asked_vs_done | 63 | 6 | 3 | 91.3% (63/69) |
| E4.match show_match | 30 | 1 | 41 | 96.8% (30/31) |
| useful useful | 67 | 5 | 0 | 93.1% (67/72) |

## Cost

Two candidate runs were started in this effort: tc23 stopped after holdout/dev when the server crashed; tc24 completed all four sets. Each holdout has three repetitions; other sets have one. Counts below are from preserved per-set summary.json copies; cached tokens are included in prompt tokens.

| Run/set | Prompt | Cached | Completion |
|---|---:|---:|---:|
| tc23/dev | 332136 | 297579 | 2042 |
| tc23/holdout | 1116383 | 999289 | 8596 |
| tc24/dev | 659688 | 592650 | 5004 |
| tc24/faults | 15652 | 13955 | 101 |
| tc24/holdout | 1173437 | 999060 | 8758 |
| tc24/replay | 275896 | 243942 | 2002 |

Judge tc24 usage: 176134 input / 12852 output tokens across 72 calls (separate from runner summaries).
