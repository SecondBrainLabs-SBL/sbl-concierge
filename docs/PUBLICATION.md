# Public snapshot provenance

Published from source-worktree commit 9222ec0 on 2026-10-15. This is a new Git history containing the current tracked implementation, tests, specifications and task records, not the private repository's historical objects.

Export-only changes: current README, contributor handoff and continuation prompt; Node 24 hint; checked-in local userscript loader; sanitized aggregate results; broader local-secret/log ignores; local home paths replaced with placeholders and historical disposable test emails normalized. Product behavior is unchanged by this export. Generated Genesis indexes/dashboard, archived Genesis v1 state and an old server log are omitted. Raw var data, browser profiles, credentials and screenshots are not included.

Verification of this export: 377/377 unit tests passed; bundle build passed. Gitleaks reviewed two false positives: a deleted-symbol assertion and the local storage key sbl_thinker_v1. Exact file/line/rule fingerprints are documented in .gitleaksignore; no broader secret rules are disabled. No live suite was repeated solely for the documentation/export operation. tc24 and earlier results are historical and explicitly labeled.

Genesis CLI/skills and private raw baseline data are not bundled. Obtain approved tooling and test-workspace access from a maintainer. This is not a production deployment or demo-ready acceptance.
