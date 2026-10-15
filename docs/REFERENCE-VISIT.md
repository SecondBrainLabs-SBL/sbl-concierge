# Reference visit — the acceptance test (DRAFT, founder to edit)

One spoken visit of about two minutes. Voice on the whole time. Nothing counts as working until this passes, recorded, twice in a row, and the video has been watched.
Runs on the script-tag build (sbl.so + dashboard), fresh logged-out browser. The visitor's lines are spoken (real voice, or recorded audio fed as the mic), never typed.

| ~t | Visitor does / says | Agent must | Fails if |
|---|---|---|---|
| 0:00 | Lands on sbl.so home, clicks **Pricing** (full page load), reads the plans ~10 s, presses the mic | Voice connects with one press. May open with one line about pricing; no generic "how can I help?" | Asks for a second click; opener ignores that they're on pricing |
| 0:15 | "Which plan fits me? I'm a founder doing outreach myself." | Answers within 2 s, points at one plan, says why in ≤ 2 sentences | Reads the plans aloud; "let me check the screen" |
| 0:35 | "Do you have success stories? Walk me through them." | "Let me take you there" → `/case-study/` (page load, ≤ 1 s silence) → "here we are…", scrolls, points at one story that fits a founder | Re-greets; loses the thread; "same wall"; voice dead after the load |
| 0:55 | Interrupts mid-sentence: "Any clients in finance?" | Stops talking at once. Goes to the investment-firm case study (private investment club) and points at the result. If nothing fit, it would say so plainly and offer the nearest one | Keeps talking over the visitor; loops; carries on the old walkthrough |
| 1:10 | Clicks the logo back to home **themselves** | Notices, says nothing or one short line; does not drag them back | Fights the visitor; resumes the old task |
| 1:15 | "How are you different from Expandi?" | Goes to `/linkedin/expandi-vs-sbl-linkedin-automation/`, points at two differences, short lines | Describes what's on screen; repeats a line; voice and agent both answer |
| 1:40 | "Okay, sign me up." | Takes them to sign-up (crosses to the app domain, context kept), asks name and email by voice, fills the form itself | Tells the visitor to fill it in; forgets what was said on sbl.so |
| 2:00 | Gives name and email aloud | Fills them, submits sign-up (disposable inbox), says what's left only if a human must do it (email code) | Spoken answer not understood; asks again for something already said |

## Pass line (the seamless scorecard)
All must hold across the whole visit:
- 0 clicks to get voice back after the first press; 0 re-greetings
- ≤ 2 s from the visitor finishing speaking to hearing something; ≤ 6 s of silence while the agent works; ≤ 1 s gap on a page load
- 0 overlaps (two voices, or agent over visitor); 0 lines said twice; 0 descriptions of what's on screen
- 0 technical messages ("same wall", steps, errors); 0 "do it yourself" for anything clickable
- 0 unanswered questions

Scored from the screen recording, the audio and the event log. Before reporting, list what the run did NOT exercise.

## End point (founder, 2026-10-01)
Submit sign-up with a disposable mail.tm inbox: one new test account per run, logged in HANDOFF cleanup. A human enters the email code if one is asked. Never press Yes on a confirmation card, never launch/create campaigns, never connect LinkedIn, never pay.
