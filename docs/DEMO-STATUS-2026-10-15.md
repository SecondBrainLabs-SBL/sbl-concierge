# Demo status — 2026-10-15

This supplements [the six-item handover report](HANDOVER-RESULTS-2026-10-15.md). Later founder requests expanded testing to voice, campaign creation, signup and proactive selling.

## What to demo today

| Flow | What is proved | Demo boundary |
|---|---|---|
| Proactive welcome | One first-visit question; waits while typing; no repeat on reload/return; native refusal respected | T73 remains open because replay failed and independent review is pending |
| Typed concierge | Current bundle connects; visible Send submits and refusal is answered | Use Send; Enter did not submit in the native website check |
| Voice | Founder heard the capability answer exactly once in the spoken retest | Not a full voice suite; background speech interrupted a later flow |
| Campaign draft | Campaign 9007 created and named in company 706, with no leads/channels/sends | Requires guidance; hire-profile detour was blocked, then corrected |
| Signup | Existing login works | Actual signup submission unverified; do not demo as proved |
| Launch/pay/send/import/invite | Confirmation boundary retained; no such action executed | Excluded from this proof and today's demonstrated flow |

## Real-user checks

- Current local bundle is loaded by Tampermonkey from `http://127.0.0.1:8787/agent.js`; the founder installed the short loader. No extension-management workaround was used.
- Chat connects. Founder heard voice through their actual microphone/speaker.
- First voice capability answer repeated two paraphrased engine lines (turn `31dc7c0a-50j6-2`). Dashboard-specific guidance produced one typed answer (`-5`) and one spoken answer (`-8`). Founder confirmed the spoken retest: “It answers once.” This is one tested utterance, not a passed voice suite.
- A later background voice phrase interrupted campaign creation (`-9` preempted by `-10`). Microphone subsequently off. Side-speech handling remains unverified/unreliable.
- Concierge created campaigns 9004 and 9005 in approved company 706, Second Brain Labs - 02. Readback: CREATED (status 9), no communication channels, no leads, zero queued/initiated/delivered messages. Both were manually named with `[CX-TEST] ... DO NOT LAUNCH` after the concierge stalled on naming.
- The campaign editor pencil is an unlabeled `div.cursor-pointer` with an `aria-hidden` SVG. tc21 labels the unique pencil `Edit campaign name` only on `/campaigns/<numeric-id>`. Live turn `-7` clicked it, filled the exact requested name, saved, and returned to the campaign list. Campaign 9005 now reads `[CX-TEST] Rename verified 2026-10-15 — DO NOT LAUNCH`.
- The attempted full flow selected “Hire a profile instead” rather than the separate “Create Campaign” button. A visible confirmation card blocked hiring; no approval was given. A typed correction requested the draft-only button. The concierge then saved and named campaign 9007: `[CX-TEST] Full flow 2026-10-15 — DO NOT LAUNCH`. Readback confirmed status 9, isLeadsConnected false, communicationChannels null, and every send counter zero. This remains a reliability finding, not a clean one-request pass.
- Actual signup was not verified: the signup page redirected to the existing signed-in account. No signup was submitted and no password was accessed.
- No launch, payment, import, invite or outbound send was performed.

## Candidate evidence

- tc19: rejected. Global pre-action progress suppression worsened E2.busy.p50 beyond measured noise. Patch preserved in `var/demo-2026-10-15/tc19-candidate.patch`.
- tc20: dashboard-only progress suppression plus one-answer guidance. 364 unit tests passed; all four suite sets completed. Held-out comparison has zero worse rows. It does not prove dashboard suite acceptance.
- tc21: adds narrowly scoped campaign pencil labeling. 367 unit tests passed; holdout ×3, dev ×1, replay ×1 and faults ×1 completed. No row worse than tc9 or tc20 beyond the unchanged noise comparator. E1 absolute targets still fail. Latest points to tc21; this is not full dashboard acceptance.

### tc19 versus tc9

| Row | Baseline | Candidate | Delta | Verdict |
|---|---|---|---|---|
| E1.p50 | 1567.33 | 1644.67 | 77.33 | within noise |
| E1.p95 | 2282 | 2641.67 | 359.67 | within noise |
| E1.words | 1612.67 | 1626.33 | 13.67 | n/a |
| E1.words.p95 | 2468.67 | 2681.67 | 213 | n/a |
| E2.busy.p50 | 1988.33 | 2569.67 | 581.33 | worse |
| E2.busy.p95 | 10820 | 8177.33 | -2642.67 | within noise |
| E2.calls.p50 | 1 | 1 | 0 | within noise |
| E2.calls.max | 1.33 | 1 | -0.33 | within noise |
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

Judge (provisional labels, not a gate):

| Row | pass | fail | n-a | pass rate (judged) |
|---|---|---|---|---|
| E3.asked asked_vs_done | 65 | 3 | 4 | 95.6% (65/68) |
| E4.match show_match | 29 | 1 | 42 | 96.7% (29/30) |
| useful useful | 71 | 1 | 0 | 98.6% (71/72) |

### tc20 versus tc9

| Row | Baseline | Candidate | Delta | Verdict |
|---|---|---|---|---|
| E1.p50 | 1567.33 | 1480 | -87.33 | better |
| E1.p95 | 2282 | 2073 | -209 | within noise |
| E1.words | 1612.67 | 1220.67 | -392 | n/a |
| E1.words.p95 | 2468.67 | 1798 | -670.67 | n/a |
| E2.busy.p50 | 1988.33 | 2489.67 | 501.33 | within noise |
| E2.busy.p95 | 10820 | 7250.67 | -3569.33 | within noise |
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

Judge (provisional labels, not a gate):

| Row | pass | fail | n-a | pass rate (judged) |
|---|---|---|---|---|
| E3.asked asked_vs_done | 66 | 3 | 3 | 95.7% (66/69) |
| E4.match show_match | 31 | 1 | 40 | 96.9% (31/32) |
| useful useful | 70 | 2 | 0 | 97.2% (70/72) |

## Suite costs

Prompt totals include cached tokens; cached is a subset, not an additional total. Each candidate has four set invocations: holdout ×3, dev ×1, replay ×1, faults ×1.

| Candidate | Set | Prompt | Cached | Completion |
|---|---|---:|---:|---:|
| tc19 | holdout | 1105607 | 992749 | 8405 |
| tc19 | dev | 628069 | 568219 | 4860 |
| tc19 | replay | 400298 | 354037 | 3218 |
| tc19 | faults | 15550 | 13859 | 95 |
| tc20 | holdout | 1104094 | 1011095 | 8302 |
| tc20 | dev | 628488 | 574625 | 5047 |
| tc20 | replay | 401092 | 354902 | 2994 |
| tc20 | faults | 15558 | 14848 | 103 |

## Open work

- T71 dashboard gate is not implemented; independent review is pending. Do not mark T71 complete based on the website suite.
- Complete voice suite, including side speech and interruption, is not proved.
- Actual signup and payment remain unproved.
- Proactive first-visit welcome requested by the founder is not implemented yet. A bounded plan must preserve refusal, no automatic navigation/signup, and no repeat greeting on reload/return.
- Campaign auto-generated content must be reviewed: draft 9004 contained unsupported numbers/customer proof. Draft 9005 avoided those numeric claims but its chat-flow fallback still implied results from other agencies. Draft creation is not approval of generated copy.
- Campaign screen reference currently suggests the hiring alternative; live testing showed the separate Create Campaign button is the correct draft-only path when no sender is requested.

Evidence: `var/demo-2026-10-15/trace.jsonl`, screenshots in that directory, `var/experience/tc19`, `tc20`, and pending `tc21`. Raw dashboard evidence stays local.

## Final tc21 comparison against tc9

| Row | Baseline | Candidate | Delta | Verdict |
|---|---|---|---|---|
| E1.p50 | 1567.33 | 1696 | 128.67 | within noise |
| E1.p95 | 2282 | 5033.67 | 2751.67 | within noise |
| E1.words | 1612.67 | 1533 | -79.67 | n/a |
| E1.words.p95 | 2468.67 | 5082 | 2613.33 | n/a |
| E2.busy.p50 | 1988.33 | 3698.33 | 1710.00 | within noise |
| E2.busy.p95 | 10820 | 9882 | -938 | within noise |
| E2.calls.p50 | 1 | 1 | 0 | within noise |
| E2.calls.max | 1.33 | 2 | 0.67 | within noise |
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

The separate comparison against tc20 also has zero worse rows; see `var/experience/tc21/comparison-vs-tc20.txt`. No latency improvement is claimed.

### Gates

```text
PASS no-worse: no row worse beyond noise
FAIL e1: E1.p50=1696 (want <= 1500); E1.p95=5033.666666666667 (want <= 3000)
PASS e2: 4 rows meet target in /path/to/sbl-concierge/var/experience/latest
PASS e3: 1 rows meet target in /path/to/sbl-concierge/var/experience/latest
PASS e4: 1 rows meet target in /path/to/sbl-concierge/var/experience/latest
PASS e5: 3 rows meet target in /path/to/sbl-concierge/var/experience/latest
PASS e6: 1 rows meet target in /path/to/sbl-concierge/var/experience/latest
PASS e7: 3 rows meet target in /path/to/sbl-concierge/var/experience/latest
PASS e8: 3 rows meet target in /path/to/sbl-concierge/var/experience/latest
PASS e9: 2 rows meet target in /path/to/sbl-concierge/var/experience/latest
PASS founder-replay: 0 silent, 0 over max, 0 nav/signup violations in /path/to/sbl-concierge/var/experience/latest
PASS faults: 0 silent, 0 late, 0 honest misses, 0 unrequested navigations in /path/to/sbl-concierge/var/experience/latest
FAIL dashboard: not implemented
```

Genesis `gate . T71-dashboard-suite` failed with `dash: command-failed` because dashboard is not implemented. T71 was requeued, not completed. Its independent review is pending.

### Provisional judge

| Row | pass | fail | n-a | pass rate (judged) |
|---|---|---|---|---|
| E3.asked asked_vs_done | 63 | 6 | 3 | 91.3% (63/69) |
| E4.match show_match | 33 | 1 | 38 | 97.1% (33/34) |
| useful useful | 70 | 2 | 0 | 97.2% (70/72) |

### tc21 costs

| Set | Prompt | Cached | Completion |
|---|---:|---:|---:|
| holdout | 1160932 | 1049318 | 9162 |
| dev | 627398 | 573844 | 4985 |
| replay | 424188 | 375205 | 3260 |
| faults | 15550 | 14848 | 123 |

Total for this demo follow-up: 12 completed set invocations across tc19, tc20 and tc21 (each: holdout with three repeats, dev/replay/faults with one). A tc21 start attempt exited before running because the restarted server had not survived its shell; the detached server was corrected and all four sets then ran. Judge tokens are reported in each judge.log separately.

## Refreshed mining: tc* through tc22

380 run files; 2948 steps; 2537 matched trace turns; 1876 flagged steps.

frequency × severity; ties: severity, frequency, cause. Severity 3 safety/stranding/driver errors, 2 response quality/failures, 1 latency/call efficiency. Judge labels provisional; refused lines and injected faults can be expected. Clusters are evidence, not proven root causes.

| Cause | Frequency | Severity | Rank | Fault turns | Example turn |
|---|---:|---:|---:|---:|---|
| score:E1.p50 | 1677 | 1 | 1677 | 10 | 1efa8c8f-erp3-1 |
| expectation:honest-regex-miss | 263 | 2 | 526 | 0 | 3707cfbc-cfd1-1 |
| score:E1.p95 | 433 | 1 | 433 | 14 | 1efa8c8f-erp3-1 |
| judge:asked_vs_done | 93 | 2 | 186 | 0 | f6373594-b13h-6 |
| trace:refused-line | 61 | 2 | 122 | 0 | 1efa8c8f-erp3-1 |
| score:E2.busy.p95 | 97 | 1 | 97 | 0 | 1efa8c8f-erp3-5 |
| judge:useful | 46 | 2 | 92 | 0 | f6373594-b13h-6 |
| score:E5.unrequestedNav | 25 | 3 | 75 | 0 | 2b893a58-eoyf-1 |
| score:E2.calls.max | 74 | 1 | 74 | 0 | 1efa8c8f-erp3-5 |
| judge:show_match | 34 | 2 | 68 | 0 | 0e90741c-zikz-1 |

These are ranked evidence clusters, not verified causes. Injected failures and refused lines may be expected.

## Approved proactive welcome (T73)

Founder explicitly approved: “Approve this welcome plan.” Genesis plan approval was recorded and T73 activated. The welcome is “Hey, what are you looking to improve: finding leads, getting replies, or booking more meetings?”

`core/thinker.js:firstVisitWelcome` permits one greeting only for a new website visitor, after the existing idle gate clears. A conversation or refusal cancels it. `content.js` uses the existing visitor tick and memory, shows the line without focusing the input, and does not queue it for later voice playback. `core/thinker.js:awaitingWelcome` keeps proactive work quiet until the visitor answers, including after reload. Dashboard visitors do not get this website welcome.

Unit tests: 370/370 passed. One earlier full run hit an existing 100 ms timing assertion; the isolated test file (13/13) and the complete rerun passed without changing its threshold. Browser checks below passed; tc22 regression results follow. Independent review remains pending.

### Welcome browser evidence

- Live sbl.so in fresh Chromium: one visible welcome; no navigation; no new welcome after reload or a same-visitor new tab; no model call for 30 seconds after an unanswered reload. Typing in the website email field suppressed the welcome. Clearing it and leaving the field allowed the welcome without focusing the dock input. Results: `var/demo-2026-10-15/welcome/results.json`; screenshot: `welcome/first-visit.png`.
- Native Chrome with the installed Tampermonkey loader: first-visit welcome was visible. Typed “I'm just looking. Please don't navigate or ask me to sign up.” and pressed the visible Send button. Turn `fa3a3387-5eo6-1` answered “Of course—take your time looking around.” / “I won’t navigate or ask you to sign up.”, stayed on `/`, and ended. Collapse/reopen worked; reload stayed collapsed without a repeated welcome. Screenshot: `welcome/native-refusal.png`.
- Enter-to-send did not submit in native Chrome. Direct Playwright pointer/keyboard activation also failed to reopen the dock, while native accessibility activation worked. These are not counted as passed interactions or attributed to the welcome change. Earlier smoke attempts failed on these interactions and an incorrect hidden-history visibility assertion; the final automated assertions above use the visible welcome and website typing field. No production input behavior was changed for this task.
- Voice/active-turn suppression uses the existing blocked gate and unit checks. A new real-microphone test during welcome eligibility was not performed. The founder's earlier spoken single-answer check remains the voice evidence.

### Development failures retained in tc22

The dev run completed 44 steps without driver failures or timeouts, but its scorecard fails E3.wrongLandings=1, E5.unrequestedNav=1 and E6.consistency=0.80. Turn `71fb7c0d-b74v-5` answered “can i see a real example from someone” by navigating to `/agency/`, not the expected case-study page. Turn `87aa7ec2-ixrn-6` navigated to `/pricing/` while answering a changed team-size question marked noNav. These are not fixed and no expectation was changed. E5.maxLines=2 and E5.overMax=0. The mandatory held-out comparison passes, but that is not evidence that every development case passes.

### tc22 versus tc9

| Row | Baseline | Candidate | Delta | Verdict |
|---|---|---|---|---|
| E1.p50 | 1567.33 | 1572.67 | 5.33 | within noise |
| E1.p95 | 2282 | 2656 | 374 | within noise |
| E1.words | 1612.67 | 1483 | -129.67 | n/a |
| E1.words.p95 | 2468.67 | 2302 | -166.67 | n/a |
| E2.busy.p50 | 1988.33 | 2159.67 | 171.33 | within noise |
| E2.busy.p95 | 10820 | 7259.33 | -3560.67 | within noise |
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

The comparison against tc21 also has zero worse rows under the unchanged comparator. Latest points to tc22 for evidence; it does not mean all acceptance gates pass.

### tc22 gates

```text
PASS no-worse: no row worse beyond noise
FAIL e1: E1.p50=1572.6666666666667 (want <= 1500)
PASS e2: 4 rows meet target in /path/to/sbl-concierge/var/experience/latest
PASS e3: 1 rows meet target in /path/to/sbl-concierge/var/experience/latest
PASS e4: 1 rows meet target in /path/to/sbl-concierge/var/experience/latest
PASS e5: 3 rows meet target in /path/to/sbl-concierge/var/experience/latest
PASS e6: 1 rows meet target in /path/to/sbl-concierge/var/experience/latest
PASS e7: 3 rows meet target in /path/to/sbl-concierge/var/experience/latest
PASS e8: 3 rows meet target in /path/to/sbl-concierge/var/experience/latest
PASS e9: 2 rows meet target in /path/to/sbl-concierge/var/experience/latest
FAIL founder-replay: overMax=1 in /path/to/sbl-concierge/var/experience/latest
PASS faults: 0 silent, 0 late, 0 honest misses, 0 unrequested navigations in /path/to/sbl-concierge/var/experience/latest
```

Replay fails on turn `d78d472e-et0r-5`: two campaign-start/account lines followed by a late watchdog apology, giving E5.maxLines=3 and E5.overMax=1. The welcome was not one of these lines. T73 remains open: executable replay proof failed and independent review is pending. No complete command or review approval was issued.

### tc22 costs

| Set | Prompt | Cached | Completion |
|---|---:|---:|---:|
| holdout | 1104942 | 1004828 | 8470 |
| dev | 627555 | 568219 | 4887 |
| replay | 525644 | 378904 | 3734 |
| faults | 15548 | 13859 | 93 |

This welcome candidate adds four completed set invocations (holdout ×3; dev/replay/faults ×1), bringing the demo follow-up to 16 completed set invocations across tc19–tc22. All tc22 jobs finished without driver timeouts; that does not mean every scorecard row passed.

### tc22 provisional judge

Judged 71/72 say steps with gpt-5.6-luna (api calls 71, cached 0, tokens in/out 173831/13372)

| Row | pass | fail | n-a | pass rate (judged) |
|---|---|---|---|---|
| E3.asked asked_vs_done | 62 | 6 | 3 | 91.2% (62/68) |
| E4.match show_match | 29 | 0 | 42 | 100.0% (29/29) |
| useful useful | 67 | 4 | 0 | 94.4% (67/71) |

1 step(s) failed to judge; see judge.json

The failed judgement is excluded from those rates. Judge labels remain provisional and are not a gate.

Verdict: welcome behavior implemented and browser-proved for the cases listed, but T73 is **partly complete**, with replay failure and independent review pending. No push or merge.
