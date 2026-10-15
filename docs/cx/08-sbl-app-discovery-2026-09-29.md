# SBL application discovery — 29 September 2026

Read-only product discovery in the user’s authenticated Codex in-app browser. Campaign and workspace context were inspected; no campaign was created, edited, launched, resumed, ended or deleted. No message, import, enrichment job, purchase, credential or permission change was submitted. Workspace navigation was restored to the original Second Brain Labs workspace. Customer names, contact details, message contents and key prefixes are intentionally omitted from this report.

## Coverage and evidence standard

Seven workspace entries were visible, including two with the same display name. Campaign lists were inspected in the original workspace and Second Brain Labs - 02. The other five were inventoried, not exhaustively explored. Every main sidebar product family was opened, with selected detail/form/settings views. This is broad UI discovery, not a backend audit, a test of every record or proof that every visible action works. Initial loading states were distinguished from settled content where relevant.

| Surface inspected | Observed UI | CX implication |
|---|---|---|
| `/campaigns` in two workspaces | Different existing campaign inventories; Created, Running, Paused and Ended states; search, recommended, archive view, performance and state-specific controls | Resolve workspace by stable ID, not display name. Read state before proposing an action. A returning user with active work should not receive a first-campaign pitch |
| New Campaign dialog | Three steps: Campaign, Leads, Connect; brief template; Enhance; custom instructions; LinkedIn, WhatsApp Direct and WhatsApp; language; Continue | Consult on outcome and channel, then use existing creation capabilities. Form inspected only; no submission |
| One existing running campaign’s detail view | Reachouts, connections, accepted invitations, replies, response rate, failed actions, human intervention; insight cards included “No Insights Yet” | Explain measured state and missing evidence; do not fabricate conversion causes from empty cards |
| Existing campaign Actions menu | Pause Campaign, Edit Campaign Flow, Edit/Add Leads, Update Sender Profiles, Run for New Leads, Turn on conversations, End campaign | These are different risk/action contracts. “Run for New Leads” is not harmless navigation |
| Campaign configuration | Personas, Outreach Sequence, Chat Flow, Smart Follow-ups, Files & Links; warm-up sequence; new/connected lead branches; variables; preview simulator; Sources and Ask AI | Reuse existing controls and configuration model; concierge should orchestrate, not rebuild a second editor |
| `/workflows` | Empty state in original workspace; describes workflows as campaign graphs of LinkedIn actions | Offer to explain or help configure a workflow only for a relevant user goal; empty workflows does not mean empty account |
| `/chat` | Search Leads; existing conversation list and pin/unpin controls; selected-user chat area; download control | Triage intervention and summarize permitted conversations. No private conversation was opened or message sent in this pass |
| `/analytics` | Date filters, outreach/acceptance/reply/opportunity/pipeline labels; campaign performance and engagement; lead insight, estimated conversions, qualitative insight cards | Reuse reporting. Distinguish observed metrics, model estimates and absent insights. Do not label estimated conversions as realized sales |
| `/users` and Bulk Upload tab | Contact columns include tags, channel identifiers, status; Bulk Upload, Bulk Export, LinkedIn Search, Exclude Contacts; import entry | Prepare scoped imports, show counts/status and prevent duplicate or live-send side effects. Contact rows were not copied into planning knowledge |
| `/leads` | Natural-language ICP discovery with example prompts; minimum-character indicator; LinkedIn sourcing note; phone/email integrations described as coming soon in this module | Ground audience capture in this module’s current scope. Do not confuse it with separate enrichment capabilities |
| `/signals` and hiring dialog | Post likes, comments, hiring, job change, funding and engagement; four further signals marked coming soon; hiring asks role, location and number of leads | Offer specific supported signal workflows, clarify required inputs and cost before running. No extraction started |
| `/enrich` | Single lead/CSV; identity fields; work email, phone, current role, company overview, recent activity, buying signals, personalization and background fields; custom questions; depth; recent enrichments | Enrichment is its own workflow. Initial view showed a disabled run control and contacts-access requirement; settled eligibility and execution were not validated |
| `/crm` and existing board | Existing Kanban workspace/board with campaign association and ten columns; populated prospect cards, chat links, add prospect/column and settings | Board state can guide follow-up. Do not invent API support for moving cards before verifying it |
| `/second-brain-manager` and Add Source menu | Existing sources with types/statuses; add PDF/TXT, URLs, plain text and Q&A | Reuse source management where suitable, but keep tenant campaign knowledge separate from approved public product knowledge |
| `/mcp-server` | Existing external-tool setup; keys inherit account permissions; masked key rows and last-used dates; company ID; GitHub setup link | A concrete integration surface exists. Do not create new credentials during discovery or embed account-wide keys in the website |
| `/api-integration` | Embedded REST docs for campaigns, users, conversations, intervention, generation, update, message sending and add-user; Webhooks tab | Validate and reuse documented interfaces. Reading documentation is not executing endpoints |
| `/settings?tab=communication` | WhatsApp Direct, WhatsApp Meta, LinkedIn; both connected and disconnected LinkedIn senders; quotas, reconnect and scheduling controls | Diagnose sender readiness before recommending more campaigns. Reconnection requires the legitimate user flow |
| `/settings?tab=workspace` | Workspace settings, create workspace and delete workspace controls | Workspace management belongs in capability inventory; permission and specific confirmation required for mutations |
| `/settings?tab=members` | Member list and Add Member/row actions | Do not infer owner rights from page access; invitation/permission changes need scoped authority |
| `/settings?tab=persona` | Existing personas with tone and communication-style fields | Reuse persona configuration; brand concierge identity and outbound sender personas are distinct concepts |
| `/hire-affiliates` | Profile quantity presets and custom quantity; optional location add-on; price summary; payment CTA; projected outreach/replies/meetings/pipeline | Explain actual quote and add-ons. Forecasts are labelled projections, not guaranteed outcomes. Never purchase from a mere calculator interaction |
| `/billing` | “Choose Your Growth Plan,” current plan shown as Free Active, Contact Support | This account view is not a universal pricing catalogue. Need authorized offer/eligibility data to quote other users accurately |

## High-value observed differences from the earlier plan

- SBL already has public MCP/API documentation and an authenticated key-management surface. The extension repo alone understated the wider company’s existing capabilities.
- Both inspected workspaces already contained campaigns; a campaign-empty assumption is invalid for these sessions.
- Multiple workspace entries can share a display name. IDs, role and workspace selection must be explicit in action receipts and confirmation.
- Sender connectivity is mixed within a workspace. “You have a LinkedIn connection” is too coarse; the chosen sender matters.
- Existing product analytics already include estimated conversions and qualitative insight cards. The CX product should explain/reuse them before proposing another analytics engine.
- Knowledge-source ingestion and several conversational/generative interfaces already exist. Add orchestration and context continuity around them instead of duplicating their screens.
- At the time inspected, the profile calculator displayed ten profiles at $59 each/month with a $65 comparison and an optional $15/profile/month location add-on. This is an observed contextual quote, not a permanent promise or an authorization to buy.

## Boundaries still requiring implementation discovery

Actual backend contracts, repo locations, deployment setup, identity/session bridge, analytics stack, permission enforcement, action idempotency, deletion semantics and full offer eligibility were not verified. Campaign detail UI and documented tools do not establish A2A compatibility. Mobile, new-user signup completion, every workspace, hidden roles, imports, billing settlement and actual outbound delivery remain untested in this read-only pass.

Browser interaction itself surfaced the need for fresh state and verification: some clicks did not produce the intended navigation; semantic keyboard navigation resolved the workspace and creation-dialog inspection. This is not sufficient evidence of an SBL product defect, but reinforces the plan’s preference for verified APIs and bounded UI fallbacks.

## User decisions supplied during discovery

- The future agent should execute consequential actions after specific confirmation, including deletion when requested and supported. It should not refuse merely because the action is consequential.
- The pilot covers useful outcomes/continued usage, website signup/demo conversion, and support resolution.
- Dashboard pricing and eligibility take precedence. Public pricing may be explained, but promotional claims require an actual authoritative offer. No invented discount or implied universal entitlement.

See the [public-site discovery](07-sbl-public-site-discovery-2026-09-29.md) for 213 discovered URLs, 20 read pages and the public user journey.
