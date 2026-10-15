# Handover evidence — 2026-10-15

## Item 1 — T20-router (not fixed)

Experiment tc10 reduced core/router.js:indexOf from eight headings per page to four, retaining all 91 destinations and full section validation. Reverted: no E1 improvement beyond noise. No score definitions or personas changed. Baseline unit suite: 345/345; candidate router tests: 37/37. Genesis router gate passed; suite-e1 failed (1617.67 > 1500); independent review remains pending. Founder replay and no-worse passed.

Cache analysis uses existing model prompt/cached/ms trace fields. Across tc9 holdout: 72 router calls, 2 uncached. Nearest-rank pooled model latency p50/p95: all 1590/2463 ms, cached 1588/2194 ms, uncached 1641/3005 ms. These are model latencies, not the E1 score. The cold cohort is too small to establish a keep-warm benefit; no ping added. The trim's prefix was 42359 characters. Its holdout consumed 882298 prompt tokens including notes.

Development run: case-study request landed on /case-study/; farewell had one recorded line. No proof of an intermittent fix is claimed. Candidate judged rows (provisional): asked-vs-done 64/69 (92.8%), show-match 26/28 (92.9%), useful 68/72 (94.4%).

| Row | Baseline | Candidate | Delta | Verdict |
|---|---|---|---|---|
| E1.p50 | 1567.33 | 1617.67 | 50.33 | within noise |
| E1.p95 | 2282 | 2405.67 | 123.67 | within noise |
| E1.words | 1612.67 | 1485.33 | -127.33 | n/a |
| E1.words.p95 | 2468.67 | 2507.67 | 39 | n/a |
| E2.busy.p50 | 1988.33 | 2007 | 18.67 | within noise |
| E2.busy.p95 | 10820 | 7537.67 | -3282.33 | within noise |
| E2.calls.p50 | 1 | 1 | 0 | within noise |
| E2.calls.max | 1.33 | 1 | -0.33 | within noise |
| E3.wrongLandings | 0 | 0 | 0 | within noise |
| E4.occlusion | 0 | 0 | 0 | within noise |
| E4.match | n/a | n/a | n/a | n/a |
| E5.maxLines | 2 | 2 | 0 | within noise |
| E5.overMax | 0 | 0 | 0 | within noise |
| E5.unrequestedNav | 0 | 0 | 0 | within noise |
| E6.consistency | 1 | 1 | 0 | within noise |
| E7.recall.inSession | 1 | 1 | 0 | within noise |
| E7.recall.afterReload | 1 | 1 | 0 | within noise |
| E7.noQuestion | 0 | 0 | 0 | within noise |
| E8.silent | 0 | 0 | 0 | within noise |
| E8.late | 0 | 0 | 0 | within noise |
| E8.stranded | 0 | 0 | 0 | within noise |
| E9.afterStop | 0 | 0 | 0 | within noise |
| E9.signup | 0 | 0 | 0 | within noise |

### Cost
- holdout: {'modelEventsWithTokens': 144, 'promptTokens': 882298, 'cachedTokens': 771759, 'completionTokens': 8346}
- dev: {'modelEventsWithTokens': 82, 'promptTokens': 501389, 'cachedTokens': 441119, 'completionTokens': 5174}
- replay: {'modelEventsWithTokens': 34, 'promptTokens': 271740, 'cachedTokens': 182954, 'completionTokens': 2607}

## Item 2 — T31-allowlist (fixed; independent review pending)

harness.js:refuseDestination now gates engine navigate and all link clicks in show/do turns. Only HTTPS SBL indexed pages or on-page links, and consent-gated app destinations, proceed; credentials and nondefault ports are refused. Uses site-map offsite/handoff for known external links and the booking refusal. A refusal ends the turn with one visible explanation. tests/allowlist.test.cjs covers the engine matrix. Two old navigation test fixtures used /features/ (not indexed); replaced with indexed /whatsapp/, preserving their consent/pre-emption assertions. Fake engine now loads the actual site map. Unit suite 351/351.

tc11 holdout (3 runs, concurrency 2) and replay (1): no failed jobs or timeouts. E3, no-worse and founder-replay pass. Provisional judge: asked-vs-done 66/70 (94.3%), show-match 34/34 (100%), useful 72/72 (100%).

Real browser engine-only smoke (router intentionally returns no route; real engine/model): WhatsApp request landed on /whatsapp/ and highlighted its content; gtm.sbl.so request stayed on SBL and highlighted the footer link; booking request navigated to the homepage and highlighted Talk to an SDR expert. Dock present throughout, no off-site click. The off-site model reply used two lines and took 18.977 s to its closing line; no claim of a latency fix. Raw screenshots and results: var/experience/tc11/engine-smoke/.

| Row | Baseline | Candidate | Delta | Verdict |
|---|---|---|---|---|
| E1.p50 | 1567.33 | 1559.67 | -7.67 | within noise |
| E1.p95 | 2282 | 2573.67 | 291.67 | within noise |
| E1.words | 1612.67 | 1509 | -103.67 | n/a |
| E1.words.p95 | 2468.67 | 2574.67 | 106 | n/a |
| E2.busy.p50 | 1988.33 | 2796.33 | 808.00 | within noise |
| E2.busy.p95 | 10820 | 8062 | -2758 | within noise |
| E2.calls.p50 | 1 | 1 | 0 | within noise |
| E2.calls.max | 1.33 | 1 | -0.33 | within noise |
| E3.wrongLandings | 0 | 0 | 0 | within noise |
| E4.occlusion | 0 | 0 | 0 | within noise |
| E4.match | n/a | n/a | n/a | n/a |
| E5.maxLines | 2 | 2 | 0 | within noise |
| E5.overMax | 0 | 0 | 0 | within noise |
| E5.unrequestedNav | 0 | 0 | 0 | within noise |
| E6.consistency | 1 | 1 | 0 | within noise |
| E7.recall.inSession | 1 | 1 | 0 | within noise |
| E7.recall.afterReload | 1 | 1 | 0 | within noise |
| E7.noQuestion | 0 | 0 | 0 | within noise |
| E8.silent | 0 | 0 | 0 | within noise |
| E8.late | 0 | 0 | 0 | within noise |
| E8.stranded | 0 | 0 | 0 | within noise |
| E9.afterStop | 0 | 0 | 0 | within noise |
| E9.signup | 0 | 0 | 0 | within noise |

### Cost
- holdout: {'modelEventsWithTokens': 144, 'promptTokens': 1105454, 'cachedTokens': 992767, 'completionTokens': 8430}
- replay: {'modelEventsWithTokens': 32, 'promptTokens': 248993, 'cachedTokens': 221744, 'completionTokens': 2099}

## Item 3 — T14 cleanup experiments (partly fixed)

Genesis refuses reopening terminal T14-charter. The explicit handover scope is represented by follow-up T14-cleanup, plus T24-dev-failures and T52-gaps for items 4/5, recorded through plan reopen/add/check/approve with the user's handover as authorization. No independent-review approval was entered.

### tc12: show-turn reword guard — rejected, restored

Full deletion also lets the existing do-turn test say three lines: do turns do not have the show/end two-line close rule. The measured candidate therefore removed only the show-turn check, retaining the do-turn guard. 351 tests passed. It failed no-regression versus tc9 (E1.p50, E2.busy.p50) and versus tc11 (E1.p50, E2.busy.p95). No causal claim that the guard caused latency; it is rejected under the specified comparison rule. Provisional judge: 64/70 asked-vs-done, 33/34 show-match, 69/72 useful.

| Row | Baseline | Candidate | Delta | Verdict |
|---|---|---|---|---|
| E1.p50 | 1567.33 | 1801 | 233.67 | worse |
| E1.p95 | 2282 | 2618.67 | 336.67 | within noise |
| E1.words | 1612.67 | 1735.33 | 122.67 | n/a |
| E1.words.p95 | 2468.67 | 3057.33 | 588.67 | n/a |
| E2.busy.p50 | 1988.33 | 3348.33 | 1360.00 | worse |
| E2.busy.p95 | 10820 | 9118 | -1702 | within noise |
| E2.calls.p50 | 1 | 1 | 0 | within noise |
| E2.calls.max | 1.33 | 1 | -0.33 | within noise |
| E3.wrongLandings | 0 | 0 | 0 | within noise |
| E4.occlusion | 0 | 0 | 0 | within noise |
| E4.match | n/a | n/a | n/a | n/a |
| E5.maxLines | 2 | 2 | 0 | within noise |
| E5.overMax | 0 | 0 | 0 | within noise |
| E5.unrequestedNav | 0 | 0 | 0 | within noise |
| E6.consistency | 1 | 1 | 0 | within noise |
| E7.recall.inSession | 1 | 1 | 0 | within noise |
| E7.recall.afterReload | 1 | 1 | 0 | within noise |
| E7.noQuestion | 0 | 0 | 0 | within noise |
| E8.silent | 0 | 0 | 0 | within noise |
| E8.late | 0 | 0 | 0 | within noise |
| E8.stranded | 0 | 0 | 0 | within noise |
| E9.afterStop | 0 | 0 | 0 | within noise |
| E9.signup | 0 | 0 | 0 | within noise |

Against previous retained build tc11:
| Row | Baseline | Candidate | Delta | Verdict |
|---|---|---|---|---|
| E1.p50 | 1559.67 | 1801 | 241.33 | worse |
| E1.p95 | 2573.67 | 2618.67 | 45 | within noise |
| E1.words | 1509 | 1735.33 | 226.33 | n/a |
| E1.words.p95 | 2574.67 | 3057.33 | 482.67 | n/a |
| E2.busy.p50 | 2796.33 | 3348.33 | 552 | within noise |
| E2.busy.p95 | 8062 | 9118 | 1056 | worse |
| E2.calls.p50 | 1 | 1 | 0 | within noise |
| E2.calls.max | 1 | 1 | 0 | within noise |
| E3.wrongLandings | 0 | 0 | 0 | within noise |
| E4.occlusion | 0 | 0 | 0 | within noise |
| E4.match | n/a | n/a | n/a | n/a |
| E5.maxLines | 2 | 2 | 0 | within noise |
| E5.overMax | 0 | 0 | 0 | within noise |
| E5.unrequestedNav | 0 | 0 | 0 | within noise |
| E6.consistency | 1 | 1 | 0 | within noise |
| E7.recall.inSession | 1 | 1 | 0 | within noise |
| E7.recall.afterReload | 1 | 1 | 0 | within noise |
| E7.noQuestion | 0 | 0 | 0 | within noise |
| E8.silent | 0 | 0 | 0 | within noise |
| E8.late | 0 | 0 | 0 | within noise |
| E8.stranded | 0 | 0 | 0 | within noise |
| E9.afterStop | 0 | 0 | 0 | within noise |
| E9.signup | 0 | 0 | 0 | within noise |

### tc13: say re-ask bar — rejected, restored

Removed only the saidQuestion overlap check; all other guards were restored. Unit tests 351/351. E1.p50 is worse than tc9 beyond noise (1824.67 vs 1567.33 ms); rejected. Provisional judge: 63/69 asked-vs-done, 35/35 show-match, 69/72 useful.

| Row | Baseline | Candidate | Delta | Verdict |
|---|---|---|---|---|
| E1.p50 | 1567.33 | 1824.67 | 257.33 | worse |
| E1.p95 | 2282 | 2609.67 | 327.67 | within noise |
| E1.words | 1612.67 | 1677.33 | 64.67 | n/a |
| E1.words.p95 | 2468.67 | 2995.33 | 526.67 | n/a |
| E2.busy.p50 | 1988.33 | 4193.67 | 2205.33 | within noise |
| E2.busy.p95 | 10820 | 10165.33 | -654.67 | within noise |
| E2.calls.p50 | 1 | 1 | 0 | within noise |
| E2.calls.max | 1.33 | 1.33 | 0 | within noise |
| E3.wrongLandings | 0 | 0 | 0 | within noise |
| E4.occlusion | 0 | 0 | 0 | within noise |
| E4.match | n/a | n/a | n/a | n/a |
| E5.maxLines | 2 | 2 | 0 | within noise |
| E5.overMax | 0 | 0 | 0 | within noise |
| E5.unrequestedNav | 0 | 0 | 0 | within noise |
| E6.consistency | 1 | 1 | 0 | within noise |
| E7.recall.inSession | 1 | 0.93 | -0.07 | within noise |
| E7.recall.afterReload | 1 | 1 | 0 | within noise |
| E7.noQuestion | 0 | 0 | 0 | within noise |
| E8.silent | 0 | 0 | 0 | within noise |
| E8.late | 0 | 0 | 0 | within noise |
| E8.stranded | 0 | 0 | 0 | within noise |
| E9.afterStop | 0 | 0 | 0 | within noise |
| E9.signup | 0 | 0 | 0 | within noise |

Against previous experiment tc12:
| Row | Baseline | Candidate | Delta | Verdict |
|---|---|---|---|---|
| E1.p50 | 1801 | 1824.67 | 23.67 | within noise |
| E1.p95 | 2618.67 | 2609.67 | -9 | within noise |
| E1.words | 1735.33 | 1677.33 | -58 | n/a |
| E1.words.p95 | 3057.33 | 2995.33 | -62 | n/a |
| E2.busy.p50 | 3348.33 | 4193.67 | 845.33 | within noise |
| E2.busy.p95 | 9118 | 10165.33 | 1047.33 | within noise |
| E2.calls.p50 | 1 | 1 | 0 | within noise |
| E2.calls.max | 1 | 1.33 | 0.33 | within noise |
| E3.wrongLandings | 0 | 0 | 0 | within noise |
| E4.occlusion | 0 | 0 | 0 | within noise |
| E4.match | n/a | n/a | n/a | n/a |
| E5.maxLines | 2 | 2 | 0 | within noise |
| E5.overMax | 0 | 0 | 0 | within noise |
| E5.unrequestedNav | 0 | 0 | 0 | within noise |
| E6.consistency | 1 | 1 | 0 | within noise |
| E7.recall.inSession | 1 | 0.93 | -0.07 | within noise |
| E7.recall.afterReload | 1 | 1 | 0 | within noise |
| E7.noQuestion | 0 | 0 | 0 | within noise |
| E8.silent | 0 | 0 | 0 | within noise |
| E8.late | 0 | 0 | 0 | within noise |
| E8.stranded | 0 | 0 | 0 | within noise |
| E9.afterStop | 0 | 0 | 0 | within noise |
| E9.signup | 0 | 0 | 0 | within noise |

### tc14: prior-turn restatement guard — retained deletion

Removed the priorTurn check and its now-unused variable from harness.js:say. Unit tests 351/351, unchanged assertions. No row worse than tc9, tc13, or last retained tc11 beyond noise. Provisional judge: 64/69 asked-vs-done, 29/33 show-match, 72/72 useful.

| Row | Baseline | Candidate | Delta | Verdict |
|---|---|---|---|---|
| E1.p50 | 1567.33 | 1577.67 | 10.33 | within noise |
| E1.p95 | 2282 | 2115.33 | -166.67 | within noise |
| E1.words | 1612.67 | 1296 | -316.67 | n/a |
| E1.words.p95 | 2468.67 | 2200 | -268.67 | n/a |
| E2.busy.p50 | 1988.33 | 2589.67 | 601.33 | within noise |
| E2.busy.p95 | 10820 | 8193.67 | -2626.33 | within noise |
| E2.calls.p50 | 1 | 1 | 0 | within noise |
| E2.calls.max | 1.33 | 1 | -0.33 | within noise |
| E3.wrongLandings | 0 | 0 | 0 | within noise |
| E4.occlusion | 0 | 0 | 0 | within noise |
| E4.match | n/a | n/a | n/a | n/a |
| E5.maxLines | 2 | 2 | 0 | within noise |
| E5.overMax | 0 | 0 | 0 | within noise |
| E5.unrequestedNav | 0 | 0 | 0 | within noise |
| E6.consistency | 1 | 1 | 0 | within noise |
| E7.recall.inSession | 1 | 1 | 0 | within noise |
| E7.recall.afterReload | 1 | 1 | 0 | within noise |
| E7.noQuestion | 0 | 0 | 0 | within noise |
| E8.silent | 0 | 0 | 0 | within noise |
| E8.late | 0 | 0 | 0 | within noise |
| E8.stranded | 0 | 0 | 0 | within noise |
| E9.afterStop | 0 | 0 | 0 | within noise |
| E9.signup | 0 | 0 | 0 | within noise |

Against previous experiment tc13:
| Row | Baseline | Candidate | Delta | Verdict |
|---|---|---|---|---|
| E1.p50 | 1824.67 | 1577.67 | -247 | better |
| E1.p95 | 2609.67 | 2115.33 | -494.33 | better |
| E1.words | 1677.33 | 1296 | -381.33 | n/a |
| E1.words.p95 | 2995.33 | 2200 | -795.33 | n/a |
| E2.busy.p50 | 4193.67 | 2589.67 | -1604.00 | within noise |
| E2.busy.p95 | 10165.33 | 8193.67 | -1971.67 | within noise |
| E2.calls.p50 | 1 | 1 | 0 | within noise |
| E2.calls.max | 1.33 | 1 | -0.33 | within noise |
| E3.wrongLandings | 0 | 0 | 0 | within noise |
| E4.occlusion | 0 | 0 | 0 | within noise |
| E4.match | n/a | n/a | n/a | n/a |
| E5.maxLines | 2 | 2 | 0 | within noise |
| E5.overMax | 0 | 0 | 0 | within noise |
| E5.unrequestedNav | 0 | 0 | 0 | within noise |
| E6.consistency | 1 | 1 | 0 | within noise |
| E7.recall.inSession | 0.93 | 1 | 0.07 | within noise |
| E7.recall.afterReload | 1 | 1 | 0 | within noise |
| E7.noQuestion | 0 | 0 | 0 | within noise |
| E8.silent | 0 | 0 | 0 | within noise |
| E8.late | 0 | 0 | 0 | within noise |
| E8.stranded | 0 | 0 | 0 | within noise |
| E9.afterStop | 0 | 0 | 0 | within noise |
| E9.signup | 0 | 0 | 0 | within noise |

### tc15: ask_user duplicate-question guard — rejected, restored

Removed the priorQuestion check from ask_user, retaining tc14's prior-turn deletion. Unit tests 351/351. E1.p50 and E2.busy.p50 are worse than tc9 beyond noise; rejected. Provisional judge: 64/70 asked-vs-done, 33/35 show-match, 70/72 useful. The candidate's replay was allowed to finish; a separate replay was then run on retained tc14.

| Row | Baseline | Candidate | Delta | Verdict |
|---|---|---|---|---|
| E1.p50 | 1567.33 | 1767.33 | 200 | worse |
| E1.p95 | 2282 | 2622 | 340 | within noise |
| E1.words | 1612.67 | 1678.67 | 66 | n/a |
| E1.words.p95 | 2468.67 | 2522.67 | 54 | n/a |
| E2.busy.p50 | 1988.33 | 3907.67 | 1919.33 | worse |
| E2.busy.p95 | 10820 | 9271.33 | -1548.67 | within noise |
| E2.calls.p50 | 1 | 1 | 0 | within noise |
| E2.calls.max | 1.33 | 1 | -0.33 | within noise |
| E3.wrongLandings | 0 | 0 | 0 | within noise |
| E4.occlusion | 0 | 0 | 0 | within noise |
| E4.match | n/a | n/a | n/a | n/a |
| E5.maxLines | 2 | 2 | 0 | within noise |
| E5.overMax | 0 | 0 | 0 | within noise |
| E5.unrequestedNav | 0 | 0 | 0 | within noise |
| E6.consistency | 1 | 1 | 0 | within noise |
| E7.recall.inSession | 1 | 1 | 0 | within noise |
| E7.recall.afterReload | 1 | 1 | 0 | within noise |
| E7.noQuestion | 0 | 0 | 0 | within noise |
| E8.silent | 0 | 0 | 0 | within noise |
| E8.late | 0 | 0 | 0 | within noise |
| E8.stranded | 0 | 0 | 0 | within noise |
| E9.afterStop | 0 | 0 | 0 | within noise |
| E9.signup | 0 | 0 | 0 | within noise |

Against previous retained tc14:
| Row | Baseline | Candidate | Delta | Verdict |
|---|---|---|---|---|
| E1.p50 | 1577.67 | 1767.33 | 189.67 | worse |
| E1.p95 | 2115.33 | 2622 | 506.67 | within noise |
| E1.words | 1296 | 1678.67 | 382.67 | n/a |
| E1.words.p95 | 2200 | 2522.67 | 322.67 | n/a |
| E2.busy.p50 | 2589.67 | 3907.67 | 1318 | within noise |
| E2.busy.p95 | 8193.67 | 9271.33 | 1077.67 | worse |
| E2.calls.p50 | 1 | 1 | 0 | within noise |
| E2.calls.max | 1 | 1 | 0 | within noise |
| E3.wrongLandings | 0 | 0 | 0 | within noise |
| E4.occlusion | 0 | 0 | 0 | within noise |
| E4.match | n/a | n/a | n/a | n/a |
| E5.maxLines | 2 | 2 | 0 | within noise |
| E5.overMax | 0 | 0 | 0 | within noise |
| E5.unrequestedNav | 0 | 0 | 0 | within noise |
| E6.consistency | 1 | 1 | 0 | within noise |
| E7.recall.inSession | 1 | 1 | 0 | within noise |
| E7.recall.afterReload | 1 | 1 | 0 | within noise |
| E7.noQuestion | 0 | 0 | 0 | within noise |
| E8.silent | 0 | 0 | 0 | within noise |
| E8.late | 0 | 0 | 0 | within noise |
| E8.stranded | 0 | 0 | 0 | within noise |
| E9.afterStop | 0 | 0 | 0 | within noise |
| E9.signup | 0 | 0 | 0 | within noise |

Final item 3 verdict: partly fixed. One guard deleted (prior-turn restatement), three restored after failed comparisons (show reword, say re-ask, ask_user re-ask); do reword guard also retained because the do contract does not cap speech at two lines. Retained tc14 founder replay passes: zero silent, over-max, navigation/signup violations. No-worse passes. T14-cleanup executable gates pass; independent review remains pending.

## Item 4 — T24-dev-failures (not fixed: candidate rejected)

Trace evidence: tc8/dev/messy-first-timer turn 2e0c3182-pxvf-5 used one /agent/route call to answer the real-example request with aggregate agency statistics. tc9/dev/returner turn d59d1542-ycvg-3 emitted two farewell sentences (the case expects one line; this was not a >2-line turn). The router rules allowed both choices.

Candidate tc16 added two RULES in core/router.js: individual customer proof instead of aggregate agency results, and one sentence for simple small talk/farewells. All 351 unit tests passed. Development: the example request navigated to /case-study/jnn-group/ and highlighted The Client: JNN Group (screenshot inspected); farewell was one line, Of course, Dana—take your time. Development overMax=0. However, E1.p50=2050.67 ms on holdout is worse than tc9 beyond noise: reverted, patch retained at var/experience/tc16/candidate.patch. Only 1 of 72 router calls was uncached; mean prompt/cached tokens 14823.65/13860.74, so cache cold starts do not explain its median.

Development also had one startup failure before the first message in repeat-asker: the driver could not find the dock shadowRoot. Its scored consequences: E8.silent=1, E8.stranded=1, E6.consistency=0.8; E1 p50/p95=1719/4019 ms. This is not attributed to the prompt. Founder replay passes (zero silent/over-max/nav/signup violations). Provisional judge: 64/69 asked-vs-done, 32/35 show-match, 70/72 useful. Genesis executable gates pass against its original-baseline no-worse command, but the required tc9 comparison fails and takes precedence; no completion or promotion. Independent review remains pending.

| Row | Baseline | Candidate | Delta | Verdict |
|---|---|---|---|---|
| E1.p50 | 1567.33 | 2050.67 | 483.33 | worse |
| E1.p95 | 2282 | 2872 | 590 | within noise |
| E1.words | 1612.67 | 1757.33 | 144.67 | n/a |
| E1.words.p95 | 2468.67 | 2855.33 | 386.67 | n/a |
| E2.busy.p50 | 1988.33 | 3495.67 | 1507.33 | within noise |
| E2.busy.p95 | 10820 | 10445.67 | -374.33 | within noise |
| E2.calls.p50 | 1 | 1 | 0 | within noise |
| E2.calls.max | 1.33 | 1 | -0.33 | within noise |
| E3.wrongLandings | 0 | 0 | 0 | within noise |
| E4.occlusion | 0 | 0 | 0 | within noise |
| E4.match | n/a | n/a | n/a | n/a |
| E5.maxLines | 2 | 1.67 | -0.33 | within noise |
| E5.overMax | 0 | 0 | 0 | within noise |
| E5.unrequestedNav | 0 | 0 | 0 | within noise |
| E6.consistency | 1 | 1 | 0 | within noise |
| E7.recall.inSession | 1 | 1 | 0 | within noise |
| E7.recall.afterReload | 1 | 1 | 0 | within noise |
| E7.noQuestion | 0 | 0 | 0 | within noise |
| E8.silent | 0 | 0 | 0 | within noise |
| E8.late | 0 | 0 | 0 | within noise |
| E8.stranded | 0 | 0 | 0 | within noise |
| E9.afterStop | 0 | 0 | 0 | within noise |
| E9.signup | 0 | 0 | 0 | within noise |

## Item 5 — T52-gaps

### tc17: combined privacy, capacity and timeout candidate — rejected

core/record.js:maskContacts/request and harness.js:maskOut/noteTurn masked contact spans in route/note payloads (conversation, last line, customer file and owed notes included); server.mjs applied the boundary mask too. content.js:serverRaw used the harness visitor headers; server.mjs:limited/admit replaced global feature caps with per-visitor caps. harness.js:fastPath tried a 3.5 s first-output deadline while retaining 7 s total and the existing 9 s engine failure watchdog. Unit tests: 358/358.

Real browser contact smoke typed only proof.test@uberip.com and a synthetic phone number: outgoing route/note bodies contained placeholders, neither contact value; the follow-up highlighted the booking link and kept the dock visible. Screenshot inspected. A unit test also proved booking continuation after navigation. Tests cover honest missing-feature end execution; the model's semantic choice is still proved by live impossible-asks visits. Existing T31 engine tests cover off-site refusal. Capacity tests exercise all three endpoints and a second visitor; both transport tests verify visitor headers.

All tc17 sets completed: holdout 3, dev 1, replay 1, faults 1. Development missed E1.p50=1527 ms and E2.calls.max=5; no jobs failed or timed out. Fault replies: unavailable 14 ms, capped 4 ms, down 3868 ms, slow 12521 ms, recovered 1682 ms. Faults and founder-replay gates passed. Provisional judge: asked-vs-done 66/69 (95.7%), show-match 34/35 (97.1%), useful 71/72 (98.6%).

The mandatory tc9 comparison rejected E2.busy.p50=3933 ms (baseline 1988.33). E1.p50=1595.67 and E1.p95=3056 were within comparison noise, but both missed their absolute targets. No causal claim that the timeout caused the busy-time regression: one fallback was already triggered by the existing server first-byte deadline at 3026 ms, before the new page deadline. Preserve the failed experiment in var/experience/tc17/candidate.patch. Narrow follow-up tc18 removes the new timeout and its two tests while retaining privacy/cap fixes and booking/failure coverage.

| Row | Baseline | Candidate | Delta | Verdict |
|---|---|---|---|---|
| E1.p50 | 1567.33 | 1595.67 | 28.33 | within noise |
| E1.p95 | 2282 | 3056 | 774 | within noise |
| E1.words | 1612.67 | 1482.33 | -130.33 | n/a |
| E1.words.p95 | 2468.67 | 4351.67 | 1883.00 | n/a |
| E2.busy.p50 | 1988.33 | 3933 | 1944.67 | worse |
| E2.busy.p95 | 10820 | 12091.33 | 1271.33 | within noise |
| E2.calls.p50 | 1 | 1 | 0 | within noise |
| E2.calls.max | 1.33 | 2.33 | 1.00 | within noise |
| E3.wrongLandings | 0 | 0 | 0 | within noise |
| E4.occlusion | 0 | 0 | 0 | within noise |
| E4.match | n/a | n/a | n/a | n/a |
| E5.maxLines | 2 | 2 | 0 | within noise |
| E5.overMax | 0 | 0 | 0 | within noise |
| E5.unrequestedNav | 0 | 0 | 0 | within noise |
| E6.consistency | 1 | 1 | 0 | within noise |
| E7.recall.inSession | 1 | 1 | 0 | within noise |
| E7.recall.afterReload | 1 | 1 | 0 | within noise |
| E7.noQuestion | 0 | 0 | 0 | within noise |
| E8.silent | 0 | 0 | 0 | within noise |
| E8.late | 0 | 0 | 0 | within noise |
| E8.stranded | 0 | 0 | 0 | within noise |
| E9.afterStop | 0 | 0 | 0 | within noise |
| E9.signup | 0 | 0 | 0 | within noise |

Measurement limitation: the separate contact browser smoke overlapped the first two tc17 visits. tc18 runs without that extra browser load. The tc17 failure is retained regardless.

### tc18: privacy/caps without timeout change — retained

Unit suite 356/356. Holdout 3 runs: no row worse beyond noise versus tc9. E1.p50=1550 ms still misses 1500; in-session recall=0.9333333333333332 misses 1.0 (within comparison noise). The recall miss is terse-visitor run-2 step 6: “Which part do you mean—the outbound campaigns or inbound lead qualification?” omits the expected WhatsApp/message/channel reference. The expectation was not changed.

| Row | Baseline | Candidate | Delta | Verdict |
|---|---|---|---|---|
| E1.p50 | 1567.33 | 1550 | -17.33 | within noise |
| E1.p95 | 2282 | 2339.67 | 57.67 | within noise |
| E1.words | 1612.67 | 1365.67 | -247 | n/a |
| E1.words.p95 | 2468.67 | 2524.33 | 55.67 | n/a |
| E2.busy.p50 | 1988.33 | 2217.67 | 229.33 | within noise |
| E2.busy.p95 | 10820 | 7774.67 | -3045.33 | within noise |
| E2.calls.p50 | 1 | 1 | 0 | within noise |
| E2.calls.max | 1.33 | 1 | -0.33 | within noise |
| E3.wrongLandings | 0 | 0 | 0 | within noise |
| E4.occlusion | 0 | 0 | 0 | within noise |
| E4.match | n/a | n/a | n/a | n/a |
| E5.maxLines | 2 | 2 | 0 | within noise |
| E5.overMax | 0 | 0 | 0 | within noise |
| E5.unrequestedNav | 0 | 0 | 0 | within noise |
| E6.consistency | 1 | 1 | 0 | within noise |
| E7.recall.inSession | 1 | 0.93 | -0.07 | within noise |
| E7.recall.afterReload | 1 | 1 | 0 | within noise |
| E7.noQuestion | 0 | 0 | 0 | within noise |
| E8.silent | 0 | 0 | 0 | within noise |
| E8.late | 0 | 0 | 0 | within noise |
| E8.stranded | 0 | 0 | 0 | within noise |
| E9.afterStop | 0 | 0 | 0 | within noise |
| E9.signup | 0 | 0 | 0 | within noise |

Tc18 provisional judge: asked-vs-done 65/70 (92.9%), show-match 32/32 (100%), useful 70/72 (97.2%). Founder-replay, faults and legacy-baseline no-worse gates passed; the mandatory tc9 comparison separately passed. Fault first-line times: unavailable 6 ms, capped 4 ms, down 4056 ms, slow 16034 ms, recovered 2121 ms. Slow upstream therefore remains unfixed in the retained build. No failed jobs or driver timeouts. Overall item 5 verdict: partly fixed; privacy, booking/failure coverage and visitor caps retained; faster timeout rejected. Independent review remains pending. The development set was exercised on tc17; tc18 reran holdout, replay and faults because its only difference was restoring the timeout.

## Item 6 — T60-mine

Added tools/experience/mine.mjs:mine/markdown and tests/mine.test.cjs. Run `node tools/experience/mine.mjs var/experience/tc*` (or add `--json`). Reads steps, trace and provisional judge outputs without model calls or browser changes. Actual CLI execution over tc1–tc18: 300 run files, 2320 steps, 2001 matched trace turns, 1514 flagged steps, no missing/malformed trace warnings. Seven miner tests pass; final npm test: 363/363. No new product suite or judge needed for this offline CLI; retained product proof is tc18. Genesis gate command: `node --test tests/mine.test.cjs`.

Rows are evaluated with the unchanged scorecard on pooled set/run steps, then attributed to contributing steps. Decision groups and stop-following waits retain context. Input overlap is deduplicated; repeated visitor messages match traces in order. Ranking is frequency × severity (3: safety/stranding/driver errors; 2: response-quality/failure evidence; 1: latency/call efficiency), with severity/frequency/name tie breaks. One turn can appear in multiple clusters. Refused lines may show a guard working; injected faults are marked. These are observed evidence clusters, not proven root causes or the current build's defect count.

The literal honest regex has a false-positive example: turn3707cfbc-cfd1-1 says “I don’t see a dentistry-specific case study…” but the unchanged regex misses curly-apostrophe “don’t.” All 217 misses remain literal misses, not 217 demonstrated dishonest answers. Genesis DECISION-0646e904 records this; no held-out persona or scoring definition changed.

| Cause | Frequency | Severity | Rank | Example turn |
|---|---:|---:|---:|---|
| score:E1.p50 | 1370 | 1 | 1370 | 1efa8c8f-erp3-1 |
| expectation:honest-regex-miss | 217 | 2 | 434 | 3707cfbc-cfd1-1 |
| score:E1.p95 | 365 | 1 | 365 | 1efa8c8f-erp3-1 |
| judge:asked_vs_done | 75 | 2 | 150 | f6373594-b13h-6 |
| trace:refused-line | 55 | 2 | 110 | 1efa8c8f-erp3-1 |
| score:E2.busy.p95 | 97 | 1 | 97 | 1efa8c8f-erp3-5 |
| judge:useful | 37 | 2 | 74 | f6373594-b13h-6 |
| score:E2.calls.max | 74 | 1 | 74 | 1efa8c8f-erp3-5 |
| score:E5.unrequestedNav | 24 | 3 | 72 | 2b893a58-eoyf-1 |
| judge:show_match | 31 | 2 | 62 | 0e90741c-zikz-1 |

Raw miner output: var/experience/mine-tc1-tc18.json and .md. Examples retain their exact steps.json path and index. No T61/T62 learning-loop wiring was added.

## Consolidated tc9 comparisons

W means worse beyond measured noise; all other numeric objective cells are within noise. E1.words rows are informational and E4.match is judged separately. Values below are the scorer means rounded as its CLI prints them; full baseline/candidate/delta/verdict tables are above.

| Row | tc9 | tc10 | tc11 | tc12 | tc13 | tc14 | tc15 | tc16 | tc17 | tc18 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| E1.p50 | 1567.33 | 1617.67 | 1559.67 | 1801 **W** | 1824.67 **W** | 1577.67 | 1767.33 **W** | 2050.67 **W** | 1595.67 | 1550 |
| E1.p95 | 2282 | 2405.67 | 2573.67 | 2618.67 | 2609.67 | 2115.33 | 2622 | 2872 | 3056 | 2339.67 |
| E1.words | 1612.67 | 1485.33 | 1509 | 1735.33 | 1677.33 | 1296 | 1678.67 | 1757.33 | 1482.33 | 1365.67 |
| E1.words.p95 | 2468.67 | 2507.67 | 2574.67 | 3057.33 | 2995.33 | 2200 | 2522.67 | 2855.33 | 4351.67 | 2524.33 |
| E2.busy.p50 | 1988.33 | 2007 | 2796.33 | 3348.33 **W** | 4193.67 | 2589.67 | 3907.67 **W** | 3495.67 | 3933 **W** | 2217.67 |
| E2.busy.p95 | 10820 | 7537.67 | 8062 | 9118 | 10165.33 | 8193.67 | 9271.33 | 10445.67 | 12091.33 | 7774.67 |
| E2.calls.p50 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| E2.calls.max | 1.33 | 1 | 1 | 1 | 1.33 | 1 | 1 | 1 | 2.33 | 1 |
| E3.wrongLandings | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| E4.occlusion | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| E4.match | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| E5.maxLines | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1.67 | 2 | 2 |
| E5.overMax | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| E5.unrequestedNav | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| E6.consistency | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| E7.recall.inSession | 1 | 1 | 1 | 1 | 0.93 | 1 | 1 | 1 | 1 | 0.93 |
| E7.recall.afterReload | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| E7.noQuestion | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| E8.silent | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| E8.late | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| E8.stranded | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| E9.afterStop | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| E9.signup | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Complete suite cost ledger

21 completed suite invocations: 9 holdout invocations with 3 repetitions each, 3 development, 7 replay and 2 faults invocations with 1 repetition each. Per-set copies of summary.json are preserved as summary-<set>.json because the runner overwrites summary.json on the next set. Cached tokens are a subset of prompt tokens, not additional tokens.

| Run | Set | Prompt | Cached | Completion |
|---|---|---:|---:|---:|
| tc10 | dev | 501389 | 441119 | 5174 |
| tc10 | holdout | 882298 | 771759 | 8346 |
| tc10 | replay | 271740 | 182954 | 2607 |
| tc11 | holdout | 1105454 | 992767 | 8430 |
| tc11 | replay | 248993 | 221744 | 2099 |
| tc12 | holdout | 1105415 | 1012264 | 8475 |
| tc13 | holdout | 1115804 | 1018347 | 8488 |
| tc14 | holdout | 1104728 | 1012809 | 8251 |
| tc14 | replay | 387971 | 298938 | 3005 |
| tc15 | holdout | 1105284 | 1012811 | 8369 |
| tc15 | replay | 267104 | 221744 | 2061 |
| tc16 | dev | 633708 | 569566 | 5355 |
| tc16 | holdout | 1109664 | 997973 | 8311 |
| tc16 | replay | 248759 | 222720 | 1882 |
| tc17 | dev | 719524 | 622213 | 5804 |
| tc17 | faults | 15555 | 13859 | 100 |
| tc17 | holdout | 1175700 | 1040891 | 9197 |
| tc17 | replay | 251640 | 228355 | 1718 |
| tc18 | faults | 15550 | 14848 | 95 |
| tc18 | holdout | 1105126 | 1010098 | 8305 |
| tc18 | replay | 347229 | 272191 | 2556 |

Totals from suite summaries: prompt 13,718,635; cached 12,179,970; completion 108,628. An initial tc10 health-check launch failed before any model turn and is not counted as a completed suite.

Additional measured costs (outside runner summaries): engine browser smoke 283,103 prompt / 184,061 cached / 2,045 completion (14 model events); contact browser smoke 30,977 / 13,859 / 190 (4 model events), from visitor-filtered trace events. Nine provisional judge runs: 648 API calls, 1,586,060 input / 119,602 output tokens, including 45,636 reasoning tokens. Judge usage does not expose cached-token totals. Miner uses no model calls.

## Remaining risks

E1 still misses 1.5 s; slow-upstream response remains 16.034 s. Three within-turn guards remain because removal candidates regressed; do turns still rely on the retained reword guard rather than the show/end two-line cap. Item4 prompt changes were rejected despite fixing the measured example/farewell cases. tc16 development had a startup failure (missing dock before the first message) not diagnosed here. tc18 had one recall expectation miss. The tc11 engine-only offsite smoke stayed on-site but its closing line took18.977 s. Judged rows remain provisional pending founder labels. Independent reviews remain pending. Existing legacy no-worse gates compare the original baseline; mandatory tc9 comparisons governed retention separately.

Off-list administrative work: approved handover follow-up task records were added because terminal T14 could not reopen; navigation fixtures were corrected from unindexed /features/ to indexed /whatsapp/; stale watchdog documentation was corrected from4 s to the existing9 s. No score, target, held-out persona, founder labels, voice/dashboard acceptance work, push or merge was performed.
