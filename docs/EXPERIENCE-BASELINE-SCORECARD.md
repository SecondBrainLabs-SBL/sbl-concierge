# Baseline scorecard — 2026-10-13

Build: commit c0bf48c (step-3 code plus tracing only; no behaviour change). Held-out personas, 3 runs, typed, website. Raw runs: `var/experience/baseline/` (local).
Noise is the spread between the three runs of the same build. A later change smaller than the noise is not a change.

| Row | Value per run | Mean | Target | Pass | Noise (max-min) |
|---|---|---|---|---|---|
| E1.p50 First reaction p50 (ms) | 5997, 5030, 5269 | 5432 | <= 1500 | FAIL | 967 |
| E1.p95 First reaction p95 (ms) | 25571, 15787, 10725 | 17361 | <= 3000 | FAIL | 14846 |
| E2.busy.p50 Busy p50, inform/navigate (ms) | 37420, 27385, 19217 | 28007.33 | <= 8000 | FAIL | 18203 |
| E2.busy.p95 Busy p95, inform/navigate (ms) | 123037, 122890, 114290 | 120072.33 | <= 15000 | FAIL | 8747 |
| E2.calls.p50 Model calls p50 | 6, 4, 3 | 4.33 | <= 3 | FAIL | 3 |
| E2.calls.max Model calls max | 28, 21, 15 | 21.33 | <= 3 | FAIL | 13 |
| E3.wrongLandings Wrong landings (miss, 4xx/5xx, off-site) | 1, 0, 1 | 0.67 | <= 0 | FAIL | 1 |
| E4.occlusion Highlight covered by dock (steps) | 0, 0, 0 | 0 | <= 0 | pass | 0 |
| E4.match Highlight matches line (judged) | n/a, n/a, n/a | n/a | >= 0.85 | n/a | n/a (judged row, not computed here) |
| E5.maxLines Lines per turn, max | 8, 7, 4 | 6.33 | <= 2 | FAIL | 4 |
| E5.overMax Steps over maxLines | 2, 3, 3 | 2.67 | <= 0 | FAIL | 1 |
| E5.unrequestedNav Unrequested navigations (noNav) | 0, 1, 0 | 0.33 | <= 0 | FAIL | 1 |
| E6.consistency Decision groups that agree | 1, 1, 1 | 1 | >= 0.9 | pass | 0 |
| E7.recall.inSession Recall in session | 0.60, 0.60, 0.80 | 0.67 | >= 1 | FAIL | 0.20 |
| E7.recall.afterReload Recall after reload | 1, 1, 0 | 0.67 | >= 0.9 | FAIL | 1 |
| E7.noQuestion Re-asked facts (noQuestion violated) | 0, 0, 0 | 0 | <= 0 | pass | 0 |
| E8.silent Silent turns | 0, 1, 0 | 0.33 | <= 0 | FAIL | 1 |
| E8.stranded Stranded turns (no dock at end) | 0, 0, 0 | 0 | <= 0 | pass | 0 |
| E9.afterStop Actions after stop (steps) | 0, 0, 0 | 0 | <= 0 | pass | 0 |
| E9.signup Signup/email ask without request | 0, 0, 0 | 0 | <= 0 | pass | 0 |

## Founder session replay (1 run)

At step 4 ("ok what's intent signals") the agent clicked a link to `gtm.sbl.so`, a page with no dock. The runner did not yet recover from that, so the remaining 12 steps did not run. Scored as one stranded turn; the replay is re-run with recovery for later comparisons.

## Cost of this baseline

| Set | Runs | Prompt tokens | of which cached | Completion tokens |
|---|---|---|---|---|
| Held-out (4 personas) | 3 | 12.17M | 9.34M | 86k |
| Founder replay | 1 | 0.24M | 0.20M | 2k |
| Development (6 personas) | 1 | 1.90M | 1.49M | 13k |
