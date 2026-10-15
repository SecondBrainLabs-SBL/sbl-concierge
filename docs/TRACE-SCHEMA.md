# Turn trace schema (FR-15)

One JSON object per line, appended by the server to `var/trace/YYYY-MM-DD.jsonl` (gitignored).
The page posts events to `POST /trace` (fire-and-forget, never awaited on the visitor's path). The server adds model events itself.

Common fields on every event:

| Field | Meaning |
|---|---|
| `t` | epoch ms (stamped where the event happened; the server adds `ts` = its own receive time) |
| `v` | visitor id (`sblv`) |
| `turn` | turn id: `<v8>-<tab4>-<n>` (v8 = first 8 chars of the visitor id, tab4 = a random part per tab so two tabs never collide, n = counter), a new one for every visitor message (typed or spoken), including an answer to a question |
| `k` | kind, below |

Kinds:

| `k` | Extra fields | When |
|---|---|---|
| `turn_open` | `text` (visitor message, masked, ≤ 500 chars), `mode` (`typed` \| `voice` \| `system`), `url` | a visitor message arrives |
| `line` | `text` (≤ 500), `refused` (true when a guard refused it and the visitor did not see it) | the agent says or tries to say something |
| `action` | `type` (say, point, click, navigate, fill, scroll, ask_user, human-step, confirmation, …), `target` (≤ 120) | every harness tool call, always (not only in proof mode) |
| `model` | `path`, `ms`, `status`, `prompt`, `completion`, `cached` | written by the server per upstream model call |
| `nav` | `url` | the top page or the shell frame changes URL |
| `error` | `detail` (≤ 300) | a run crashes or fails; the cause is kept |
| `turn_end` | `status` (`answered` \| `asked` \| `handed_off` \| `cannot` \| `failed` \| `preempted` \| `stopped`), `url` | the run for that turn finishes |

Rules:

- Masking: anything that was typed into a password/secret field, any form value, and anything matching the existing `mask()` in `harness.js` never appears. Emails typed by the visitor in chat are kept (they are conversation), form values are not.
- The page never waits on `/trace`. A failed post is dropped silently. The server never fails a visitor request because the trace file is unwritable.
- The page sends `X-SBL-V` and `X-SBL-Turn` headers on `/agent/chat` so the server can attach `model` events to the turn. Missing headers: the event is still written with `turn: null`.
- A turn with a `turn_open` and no `line` (non-refused) before the next `turn_open` or within the watch window is a **silent turn**.
