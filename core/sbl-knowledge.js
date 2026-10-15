// What the concierge knows about SBL (sbl.so, Second Brain Labs), as curated data plus a
// prompt builder. Public facts were read from sbl.so on RETRIEVED and from the product
// discovery notes in docs/cx/07 and 08. Anything that can go stale (prices, counts,
// numbers) carries source + retrievedAt. Dashboard/account pricing is authoritative and is
// deliberately NOT in this pack.
//
// The whole pack is given to the model every run (about 3k tokens): no retrieval, no ranking.
(function attachKnowledge(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SBLKnowledge = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createKnowledgeModule() {
  const RETRIEVED = "2026-09-30";
  const SITE = "https://sbl.so";
  const src = (path) => SITE + path;

  const KNOWLEDGE = {
    overview: {
      name: "SBL (Sbl.so, Second Brain Labs)",
      what: "An autonomous AI SDR for outreach. It finds leads, runs personalized LinkedIn and WhatsApp campaigns, chats with replies, follows up and books meetings. Dashboard: app.secondbrainlabs.com.",
      audience: "Founders, sales teams and agencies (also creators, coaches, recruiters, healthcare and services businesses).",
      promise: "Outbound that books meetings without hiring an SDR: AI holds the conversation, hands off to a human when it is unsure, and sends from managed SDR profiles instead of the customer's own LinkedIn account.",
      source: src("/"),
      retrievedAt: RETRIEVED,
    },

    modules: [
      { name: "Campaigns", path: "/campaigns", what: "List and create campaigns (states: Created, Running, Paused, Ended).", can: "New Campaign wizard (Campaign, Leads, Connect; brief of 200+ characters, Enhance, language, custom instructions); pause, edit flow, edit/add leads, update sender profiles, run for new leads, end." },
      { name: "Campaign editor", path: "/campaigns/{id}", what: "Per-campaign configuration.", can: "Personas, Outreach Sequence (warm-up, new vs connected leads, variables), Chat Flow, Smart Follow-ups, Files & Links, Sources, preview simulator." },
      { name: "Workflows", path: "/workflows", what: "Campaign graphs of LinkedIn actions (marked NEW).", can: "Build or view action workflows." },
      { name: "Chats", path: "/chat", what: "Unified inbox of prospect replies.", can: "Search leads, read and reply to conversations, pin, handle human-intervention requests." },
      { name: "Reports", path: "/analytics", what: "Outreach analytics.", can: "Filter by date; see outreach, acceptance, reply, opportunity and pipeline figures, lead insights and estimated conversions (estimates, not realised sales)." },
      { name: "Contacts", path: "/users", what: "All contacts with tags, channel ids and status.", can: "Bulk upload/export, LinkedIn search import, exclude contacts." },
      { name: "ICP Leads", path: "/leads", what: "Describe the ideal customer in plain language and AI finds matches.", can: "Prompt-based lead discovery." },
      { name: "Signals", path: "/signals", what: "Intent-signal lead sources.", can: "Post likes, comments, hiring, job change, funding, engagement; some further signals are shown as coming soon; may be plan-gated." },
      { name: "Enrich", path: "/enrich", what: "Lead enrichment (BETA).", can: "Enrich one lead or a CSV with work email, phone, role, company, activity and custom questions." },
      { name: "CRM", path: "/crm", what: "Built-in Kanban pipeline linked to campaigns.", can: "Move prospects between columns, add prospects and columns." },
      { name: "Knowledge Base", path: "/second-brain-manager", what: "Sources the campaign AI answers from.", can: "Add PDF/TXT, URLs, plain text and Q&A." },
      { name: "SBL MCP", path: "/mcp-server", what: "API keys for the MCP server.", can: "Create and revoke keys (keys inherit account permissions); shows company ID." },
      { name: "API Integration", path: "/api-integration", what: "REST docs and Webhooks tab (plan-gated).", can: "Read API docs, add webhooks." },
      { name: "Hire Profiles", path: "/hire-affiliates", what: "Rent managed LinkedIn SDR profiles (owner only).", can: "Choose quantity and optional location add-on; a price summary and projected outcomes are shown. Projections are not guarantees." },
      { name: "Settings", path: "/settings", what: "Communication (WhatsApp Direct, WhatsApp Meta, LinkedIn senders, quotas, reconnect, schedule), Workspace, Members, Persona tabs.", can: "Connect senders, set working hours, manage members and personas." },
      { name: "Billing", path: "/billing", what: "Plan, credits and purchases for THIS account.", can: "Authoritative source for what this user pays and is eligible for." },
    ],

    channels: [
      { name: "LinkedIn", what: "Lead generation, Sales Navigator/Recruiter import, AI chats, cloned-voice notes and rich media (images, videos, PDFs), warm-up sequences (likes, profile visits, connection requests), Comment-to-DM, smart follow-ups, analytics, built-in CRM, unified inbox, auto sender rotation.", limits: "Per profile per day: up to 75 new connections and 200 messages to 1st connections (as published; the FAQ suggests starting lower: 15-20 invites/day on accounts under 3 months, 25 on standard, 30-40 on established).", source: src("/linkedin/"), retrievedAt: RETRIEVED },
      { name: "WhatsApp", what: "Two paths: personalized outbound campaigns, and AI qualification of inbound chats (website widget, click-to-WhatsApp ads, Meta lead ads). Multilingual; runs via official Meta Business Solution Providers; conversation costs are included in SBL pricing.", source: src("/whatsapp/"), retrievedAt: RETRIEVED },
      { name: "Email", what: "Separate offer: pre-warmed mailboxes for cold email. LinkedIn page says email automation is coming soon; do not substitute it for a LinkedIn or WhatsApp workflow.", source: src("/email/"), retrievedAt: RETRIEVED },
    ],

    useCases: [
      { persona: "Founders", promise: "Run a full outbound motion without hiring an SDR; book meetings while you build; your personal account stays clean.", source: src("/"), retrievedAt: RETRIEVED },
      { persona: "Sales teams", promise: "Fill every rep's calendar on autopilot; AI handles replies, objections and follow-up; two-way CRM sync.", source: src("/"), retrievedAt: RETRIEVED },
      { persona: "Agencies", promise: "Scale outreach across clients for one flat fee: a separate workspace per client on every plan, one unified inbox, per-client reports, clients invited free, a seat that comes with a sender profile option, rented profiles at $65/mo.", detail: "Typical setup per active client as published: 1 seat + 3-5 rented profiles. Published example: 1 seat + 3 profiles = $234/mo.", source: src("/agency/"), retrievedAt: RETRIEVED },
      { persona: "Existing HeyReach users", promise: "Add SBL to qualify replies, draft, follow up and book, with Draft Mode approval before any send. Invite-only add-on.", source: src("/heyreach/"), retrievedAt: RETRIEVED },
      { persona: "Developers / external agents", promise: "Drive campaigns from Claude, Codex or n8n via MCP, or from your own systems via REST API and webhooks.", source: src("/mcp/"), retrievedAt: RETRIEVED },
    ],

    // Public published pricing only. The account's own Billing page is authoritative.
    pricing: [
      { plan: "Starter", price: "$99", period: "month", includes: "7-day free trial, no card. 2 outreach seats (extra $39/mo), unlimited workspaces, 1,000 ICP-matched leads/mo, LinkedIn Signals on your own posts, AI replies in 100+ languages, LinkedIn + WhatsApp, rich media, unlimited Sales Navigator extraction, 2 team members, MCP/API/static webhooks, priority support.", source: src("/pricing/"), retrievedAt: RETRIEVED, scope: "public" },
      { plan: "Pro", price: "$189", period: "month", includes: "Everything in Starter plus 4 seats (extra $39/mo), 2,000 premium leads/mo, premium Signals (job changes, funding, competitor monitoring), cloned-voice rich media, built-in CRM with export, custom webhooks, 10 team members. Marked 'Best Value'.", source: src("/pricing/"), retrievedAt: RETRIEVED, scope: "public" },
      { plan: "Elite", price: "$997", period: "month", includes: "COMING SOON, invite only (email team@sbl.so). Custom seats, 500 hyper-curated leads, LinkedIn only, per-prospect personalized journeys/decks. Not generally available.", source: src("/pricing/"), retrievedAt: RETRIEVED, scope: "public" },
      { plan: "Extra outreach seat", price: "$39", period: "seat/month", includes: "Additional outreach seat on Starter or Pro; agency page: one login for a teammate or client, unlimited workspaces, inbox and CRM.", source: src("/agency/"), retrievedAt: RETRIEVED, scope: "public" },
      { plan: "SDR Profile (rented LinkedIn profile)", price: "$65", period: "profile/month", includes: "Pre-warmed managed sender profile; $59 each for more than 10 profiles (pricing page). The SDR-profiles page headlines $59/mo. An optional location add-on was observed at $15/profile/mo in the dashboard calculator (not a public price).", source: src("/pricing/"), retrievedAt: RETRIEVED, scope: "public" },
      { plan: "Enterprise", price: "Custom", period: "n/a", includes: "Contact team@sbl.so for custom workflow, volume or compliance needs.", source: src("/pricing/"), retrievedAt: RETRIEVED, scope: "public" },
      { plan: "Pre-warmed email mailbox", price: "$6", period: "mailbox/month", includes: "Cold-email mailboxes, no domain purchase or warm-up wait (separate offer).", source: src("/email/"), retrievedAt: RETRIEVED, scope: "public" },
      { plan: "HeyReach reply add-on", price: "$59", period: "seat/month", includes: "Launch offer 'lock in $59/seat, price rises after launch'. Invite form; never imply instant access.", source: src("/heyreach/"), retrievedAt: RETRIEVED, scope: "public" },
    ],
    pricingNotes: [
      "Published pricing is not an account quote. The dashboard Billing page decides what a given user pays and is eligible for.",
      "Public pages differ on SDR profiles: the homepage says unlimited SDR profiles are included; the pricing page prices profiles at $65 ($59 above 10); the SDR page says $59. Scope of each bundle is unclear, so say so instead of picking one.",
      "Guarantee: pages advertise a 90% money-back guarantee with terms and conditions; details not on the pages read.",
    ],

    integrations: {
      mcp: {
        toolCount: 30, version: "v0.2.4", source: src("/mcp/"), retrievedAt: RETRIEVED,
        endpoint: "https://mcp.sbl.so/mcp (Streamable HTTP, beta, bearer key). Claude Desktop bundle (.mcpb) also available. claude.ai web custom connectors are NOT compatible (they need OAuth).",
        families: ["read/inspect campaigns and conversations", "create and edit campaigns", "run/end campaigns", "replies and human intervention", "lead import via CSV (up to 20MB), Sales Navigator, post engagement, AI prompt leads"],
        safety: "Nothing launches, sends or bills without an explicit approval step; AI prompt lead approval is the billable action (default 10, max 100 leads).",
        commands: ["/sbl", "/sbl-create", "/sbl-optimize", "/sbl-triage", "/sbl-playbook", "/sbl-retro"],
      },
      api: {
        source: src("/api/"), retrievedAt: RETRIEVED, base: "https://api.sbl.so",
        capabilities: "REST + JSON, bearer token (30-day lifetime), cursor pagination; list/get/update/generate campaigns, list campaign users and conversations, human-intervention list, send message, add user. 429 responses carry Retry-After.",
      },
      webhooks: {
        source: src("/api/"), retrievedAt: RETRIEVED,
        events: ["connection_request_sent", "connection_request_accepted", "message_sent", "prospect_replied", "message_failed", "lead_action_needed", "custom_data"],
        note: "Configured in the app under API Integration > Webhooks; static webhooks on Starter, custom on Pro.",
      },
      native: ["HubSpot", "Salesforce", "Pipedrive", "Slack", "Notion", "Zapier", "n8n", "Make"],
    },

    comingSoon: [
      { item: "A/B testing (up to 10 message variants)", source: src("/linkedin/"), retrievedAt: RETRIEVED },
      { item: "Elite plan ($997/mo, invite only)", source: src("/pricing/"), retrievedAt: RETRIEVED },
      { item: "Email automation inside the LinkedIn/WhatsApp platform", source: src("/linkedin/"), retrievedAt: RETRIEVED },
      { item: "MCP commands /sbl-leads and /sbl-ab", source: src("/mcp/"), retrievedAt: RETRIEVED },
      { item: "Extra signal types in the dashboard Signals module (phone/email enrichment inside ICP Leads too)", source: "docs/cx/08-sbl-app-discovery-2026-09-29.md", retrievedAt: "2026-09-29" },
    ],

    // Where a person can actually be booked: the homepage "Talk to an SDR expert" button
    // (the "Book a 15-min demo" link resolves to signup, so it is not used). content.js
    // carries a copy of this url (it does not load this file); tests keep them equal.
    booking: { label: "Talk to an SDR expert", url: "https://calendar.app.google/wKKmN8iMM6xaa9326", email: "team@sbl.so", source: src("/"), retrievedAt: RETRIEVED },

    faq: [
      { q: "Is there a free trial?", a: "Yes: 7 days, no credit card, cancel anytime.", source: src("/faq/"), retrievedAt: RETRIEVED },
      { q: "Is my LinkedIn account safe?", a: "Outreach runs on managed sender profiles with human-like pacing, warm-up and auto-rotation; the site claims 0 bans across 50M+ messages. That is the company's claim, not a guarantee.", source: src("/"), retrievedAt: RETRIEVED },
      { q: "Do I need Sales Navigator?", a: "No. A standard LinkedIn account works; Sales Navigator or Recruiter searches can be imported.", source: src("/"), retrievedAt: RETRIEVED },
      { q: "Will the AI make things up?", a: "It is designed not to: if it lacks the information it ends the chat or flags Human Intervention, and you answer once.", source: src("/faq/"), retrievedAt: RETRIEVED },
      { q: "How do I add leads?", a: "CSV, Sales Navigator, Comment to DM, Post Likes, manual entry, or Leads by SBL (describe the ideal customer).", source: src("/faq/"), retrievedAt: RETRIEVED },
      { q: "Can one lead be in two campaigns?", a: "Not at the same time; end the first campaign for that lead first.", source: src("/faq/"), retrievedAt: RETRIEVED },
      { q: "Can I pause without losing progress?", a: "Yes: pause outreach only, outreach and AI replies, or sequences; resume where you left off.", source: src("/faq/"), retrievedAt: RETRIEVED },
      { q: "How are credits counted?", a: "Each successful outreach action (for example a connection request) is one credit; lead generation has a separate pool; limits vary by plan.", source: src("/faq/"), retrievedAt: RETRIEVED },
      { q: "Where do I get help?", a: "FAQ and campaign guide on sbl.so, team@sbl.so, and a Slack community; a human SDR expert can be booked from the homepage.", source: src("/"), retrievedAt: RETRIEVED },
    ],

    // Company claims as published, not independently verified. Counters marked 'so far in 2026'
    // move daily; the homepage counters render as 0 in a text scrape, so only the agency page
    // values are recorded.
    proof: [
      { label: "Teams/companies using SBL", value: "5,000+", source: src("/"), retrievedAt: RETRIEVED },
      { label: "Messages sent", value: "50M+ with 0 account bans (claim)", source: src("/"), retrievedAt: RETRIEVED },
      { label: "G2 rating", value: "4.7/5", source: src("/"), retrievedAt: RETRIEVED },
      { label: "Countries", value: "10+", source: src("/"), retrievedAt: RETRIEVED },
      { label: "Reply rate (aggregate claim)", value: "40%", source: src("/agency/"), retrievedAt: RETRIEVED },
      { label: "Booked meetings, claim vs other tools", value: "15-25% vs 2-5%", source: src("/"), retrievedAt: RETRIEVED },
      { label: "Meetings from people who never replied to the first message", value: "74%", source: src("/"), retrievedAt: RETRIEVED },
      { label: "Median lead-to-meeting time", value: "11 days", source: src("/"), retrievedAt: RETRIEVED },
      { label: "Agency workspaces in 2026 so far: messages / replies / meetings / pipeline", value: "571,168 / 228,468 / 38,459 / $38.5M (avg deal $1k)", source: src("/agency/"), retrievedAt: RETRIEVED },
      { label: "Customer example: Cialdini Institute", value: "spend $2,000/mo, pipeline added $9,000", source: src("/pricing/"), retrievedAt: RETRIEVED },
      { label: "Customer example: Topmate", value: "spend $800/mo, added $4,500", source: src("/pricing/"), retrievedAt: RETRIEVED },
    ],
  };

  const RULES =
    "RULES: Never invent prices, discounts or availability. Public pricing below is published " +
    "marketing pricing, not an account quote; the user's dashboard Billing page is authoritative. " +
    "Coming-soon items are never offered as available. Site numbers are company claims, not guarantees. " +
    "If something is not covered here, say you don't know and offer to check the dashboard or ask the team (team@sbl.so).";

  const line = (s) => "- " + s;
  const stamp = (o) => ` [${o.source.replace(SITE, "sbl.so")}, ${o.retrievedAt}]`;

  // Each section: renderer + tags it answers. Topic words are matched against tags.
  const SECTIONS = {
    pricing: {
      render: () =>
        "PUBLIC PRICING (published, scope=public, not a quote):\n" +
        KNOWLEDGE.pricing.map((p) => line(`${p.plan}: ${p.price}/${p.period === "n/a" ? "custom" : p.period}. ${p.includes}${stamp(p)}`)).join("\n") + "\n" +
        KNOWLEDGE.pricingNotes.map(line).join("\n"),
    },
    useCases: {
      render: () => "WHO IT IS FOR:\n" + KNOWLEDGE.useCases.map((u) => line(`${u.persona}: ${u.promise}${u.detail ? " " + u.detail : ""}`)).join("\n"),
    },
    channels: {
      render: () => "CHANNELS:\n" + KNOWLEDGE.channels.map((c) => line(`${c.name}: ${c.what}${c.limits ? " " + c.limits : ""}`)).join("\n"),
    },
    modules: {
      render: () => "DASHBOARD MODULES (app.secondbrainlabs.com):\n" + KNOWLEDGE.modules.map((m) => line(`${m.name} ${m.path}: ${m.what} ${m.can}`)).join("\n"),
    },
    integrations: {
      render: () => {
        const i = KNOWLEDGE.integrations;
        return "INTEGRATIONS:\n" + [
          `MCP: ${i.mcp.toolCount} tools (${i.mcp.version}); ${i.mcp.families.join("; ")}. ${i.mcp.endpoint} ${i.mcp.safety} Commands: ${i.mcp.commands.join(", ")}.${stamp(i.mcp)}`,
          `API: ${i.api.base}. ${i.api.capabilities}${stamp(i.api)}`,
          `Webhooks: ${i.webhooks.events.join(", ")}. ${i.webhooks.note}`,
          `Native: ${i.native.join(", ")}.`,
        ].map(line).join("\n");
      },
    },
    trust: {
      render: () => "PUBLISHED NUMBERS (company claims):\n" + KNOWLEDGE.proof.map((p) => line(`${p.label}: ${p.value}${stamp(p)}`)).join("\n"),
    },
    faq: {
      render: () => "FAQ:\n" + KNOWLEDGE.faq.map((f) => line(`${f.q} ${f.a}`)).join("\n"),
    },
    comingSoon: {
      render: () => "COMING SOON (not available yet, never present as available):\n" + KNOWLEDGE.comingSoon.map((c) => line(c.item)).join("\n"),
    },
  };

  function overviewText() {
    const o = KNOWLEDGE.overview;
    return `ABOUT SBL: ${o.name}. ${o.what} For: ${o.audience} Promise: ${o.promise}`;
  }

  // The acting model gets all of it, always in this order, so the prompt prefix is identical every run and caches.
  const ORDER = ["pricing", "useCases", "channels", "modules", "integrations", "trust", "faq", "comingSoon"];
  const full = () => [RULES, overviewText(), ...ORDER.map((id) => SECTIONS[id].render())].join("\n\n");
  // The voice model's session instructions: what people ask about most. It reaches the rest through act().
  const core = () => [RULES, overviewText(), SECTIONS.pricing.render(), SECTIONS.faq.render(), SECTIONS.comingSoon.render()].join("\n\n");

  return { KNOWLEDGE, full, core };
});
