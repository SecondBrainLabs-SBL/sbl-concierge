# Experience status — morning of 2026-10-14

Build: branch `plan/experience-harness`, commit 5a70ba2. Held-out personas, 3 runs, typed, website. Raw runs in `var/experience/` (baseline, tc1..tc9; `latest` → tc9).

## Scorecard: original build vs now

| Row | Baseline | Candidate | Delta | Verdict |
|---|---|---|---|---|
| E1.p50 | 5432 | 1567.33 | -3864.67 | better |
| E1.p95 | 17361 | 2282 | -15079 | better |
| E1.words | n/a | 1612.67 | n/a | n/a |
| E1.words.p95 | n/a | 2468.67 | n/a | n/a |
| E2.busy.p50 | 28007.33 | 1988.33 | -26019 | better |
| E2.busy.p95 | 120072.33 | 10820 | -109252.33 | better |
| E2.calls.p50 | 4.33 | 1 | -3.33 | better |
| E2.calls.max | 21.33 | 1.33 | -20 | better |
| E3.wrongLandings | 0.67 | 0 | -0.67 | within noise |
| E4.occlusion | 0 | 0 | 0 | within noise |
| E4.match | n/a | n/a | n/a | n/a |
| E5.maxLines | 6.33 | 2 | -4.33 | better |
| E5.overMax | 2.67 | 0 | -2.67 | better |
| E5.unrequestedNav | 0.33 | 0 | -0.33 | within noise |
| E6.consistency | 1 | 1 | 0 | within noise |
| E7.recall.inSession | 0.67 | 1 | 0.33 | better |
| E7.recall.afterReload | 0.67 | 1 | 0.33 | within noise |
| E7.noQuestion | 0 | 0 | 0 | within noise |
| E8.silent | 0.33 | 0 | -0.33 | within noise |
| E8.late | 0 | 0 | 0 | within noise |
| E8.stranded | 0 | 0 | 0 | within noise |
| E9.afterStop | 0 | 0 | 0 | within noise |
| E9.signup | 0 | 0 | 0 | within noise |

First reaction measured exactly from the trace on run tc8: first words on screen 1.26 s median / 2.82 s p95; first complete sentence (what E1 counts) 1.65 s / 3.09 s.

## Judged rows (model judge, provisional labels only)

| Row | Original | Now |
|---|---|---|
| Did what was asked | 95.7% | 91.3% |
| Highlight matches the line | 88.6% | 90.3% |
| Useful | 97.2% | 95.8% |

## Gates on the latest run

- FAIL e1: E1.p50=1567.3333333333333 (want <= 1500)
- PASS e2: 4 rows meet target
- PASS e3: 1 rows meet target
- PASS e5: 3 rows meet target
- PASS e6: 1 rows meet target
- PASS e7: 3 rows meet target
- PASS e8: 3 rows meet target
- PASS e9: 2 rows meet target
- PASS no-worse: no row worse beyond noise
- PASS founder-replay: 0 silent, 0 over max, 0 nav/signup violations
- PASS faults: 0 silent, 0 late, 0 honest misses, 0 unrequested navigations
- PASS discriminates: accepts the later build (0 rows worse) and rejects the original as a candidate (9 rows worse: E1.p50, E1.p95, E2.busy.p50, E2.busy.p95, E2.calls.p50, E2.calls.max, E5.maxLines, E5.

## How to run

```
cd sbl-experience-wt && set -a && source ../sbl-sales-agent/.env && set +a
node tools/build-agent.mjs && ALLOW_FAULTS=1 node server.mjs &
node tools/experience/run.mjs --set holdout --runs 3 --concurrency 2 --out var/experience/<name>
node tools/experience/score.mjs var/experience/<name>/holdout --compare var/experience/baseline/holdout
node tools/experience/judge.mjs var/experience/<name> --set holdout
```
