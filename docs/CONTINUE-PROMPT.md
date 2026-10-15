# Copy-paste prompt for the next contributor

Work on https://github.com/SecondBrainLabs-SBL/sbl-concierge. This is the public snapshot of our AI sales concierge through 2026-10-15. Continue the existing implementation; do not rebuild it from scratch.

Read README.md and docs/START-HERE.md first, then the latest DEMO-FIXES report, SPEC.md, EXPERIENCE-PLAN, the turn/fast-path/memory/failure/trace docs, AGENTS.md and .genesis/KICKOFF.md. Use the maintainer-provided Genesis workflow; inherited evidence is historical, and independent review must not be self-approved.

Your first goal is to make campaign draft creation work from one natural request without me correcting the agent. Also verify and fix Enter-to-send, repeated lines, and page navigation. Test with the real browser as a user would: type into the dock, press Enter, see the page move, verify the exact saved draft name, and check that no leads/sender, launch, hiring or sending occurred. A tool success or unit test is not enough. Voice must be checked with actual mic/speaker before calling it working.

Start by reproducing the current failures in the approved CX-TEST workspace. The latest campaign attempt created a draft but timed out before saving the exact requested name. An earlier generated draft invented a 30% claim. Pricing navigation and feature-table highlighting passed the latest live check; do not regress those. The proactive welcome is implemented but still needs complete acceptance checks.

Preserve every safety rule in START-HERE. Never submit real signup/payment, never type a password, never act in another workspace, and never answer a consequential confirmation for the visitor. Get test access and your own API credentials from the maintainer securely; never commit them.

Before behavior changes, establish a measured reference on the unchanged checkout or obtain an approved baseline from the maintainer. Historical raw tc9/tc24 traces are not public. Run npm test, build, holdout x3, and relevant dev/replay/fault suites; do not rebuild during a suite. Keep score definitions, E1 semantics and held-out personas unchanged. Report exact comparisons, provisional judged rows and token costs. Keep pending gates pending. Work on a feature branch and open a PR with evidence; do not merge it yourself.

End with what worked in the real browser, what failed, what remains unsafe or unproven to demo, and the next concrete step. Do not call it demo-ready until the full intended flow passes without correction.
