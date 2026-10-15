// What the SBL dashboard offers, screen by screen.
//
// This is the agent's map of the product: where things live, what each screen is for,
// and the exact control labels rendered there. It is derived from apps/frontend at
// origin/release/17sep26, not from guessing at the DOM at runtime.
//
// No imports and no browser APIs: the extension uses it today and apps/frontend can
// import the same file unchanged later.
(function attachScreens(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SBLScreens = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createScreens() {
  const APP = "https://app.secondbrainlabs.com";

  // Sidebar sections, with the labels the product actually renders.
  const NAVIGATION = [
    { section: "OUTREACH", items: [
      { label: "Campaigns", path: "/campaigns" },
      { label: "Workflows", path: "/workflows", badge: "NEW" },
      { label: "Chats", path: "/chat" },
      { label: "Reports", path: "/analytics" },
      { label: "Hire Profiles", path: "/hire-affiliates", ownerOnly: true },
      { label: "Contacts", path: "/users" },
    ] },
    { section: "LEAD GEN", items: [
      { label: "ICP Leads", path: "/leads" },
      { label: "Signals", path: "/signals" },
      { label: "Enrich", path: "/enrich", badge: "BETA" },
    ] },
    { section: "SETUP", items: [
      { label: "CRM", path: "/crm" },
      { label: "Knowledge Base", path: "/second-brain-manager" },
      { label: "SBL MCP", path: "/mcp-server" },
      { label: "API Integration", path: "/api-integration", planGated: true },
    ] },
    { section: "SUPPORT", items: [
      { label: "Settings", path: "/settings?tab=communication" },
    ] },
  ];

  const SCREENS = {
    campaigns: {
      path: "/campaigns",
      purpose: "List campaigns and start a new one.",
      opens: { label: "New Campaign", note: 'Empty workspace shows "Create Campaign" instead.' },
      caution: 'A saved draft first shows "You have a saved draft. Would you like to continue with it?" with Continue / Delete.',
    },
    campaignWizard: {
      path: "/campaigns/new",
      purpose: "Three-step modal that creates a campaign. For draft-only work, use the controls directly: brief, Continue, skip leads, Create Campaign, then rename. Do not point at each button or narrate each step; one opening line and one verified completion line are enough.",
      title: "Create campaign",
      steps: ["Campaign", "Leads", "Connect"],
      brief: {
        field: "Campaign brief",
        minimumCharacters: 200,
        drafting: "Write at least 200 characters before Continue, using only facts the visitor supplied. Count the brief; do not invent statistics, customers or proof to reach the minimum. If the supplied facts cannot support a useful brief, ask one question.",
        validationMessage: "Description must be at least 200 characters long",
        enhanceMinimum: 50,
        controls: ["Enhance", "Language", "Custom instruction (optional)"],
      },
      channels: ["LinkedIn", "WhatsApp Direct", "WhatsApp"],
      advance: "Continue",
      finish: "Create Campaign",
      skipLeads: "Skip for now — add leads later",
      connectStep: {
        connect: "Connect",
        hireProfile: "Hire a profile instead — skip and create campaign",
        draftOnly: 'Use the separate "Create Campaign" button to save without connecting a sender. "Hire a profile instead" is a paid-profile path, not the skip button; never choose it for a draft-only request.',
        skippedWhen: "a channel is already connected",
      },
      after: "/campaigns/{id}?tab=campaignConfig",
      complete: 'After creation, use "Edit campaign name" (the pencil), enter the requested name and save. Verify the name in the editor before saying it is created. Creating a draft does not authorize launch, leads import, profile hire or sending.',
    },
    campaignEditor: {
      path: "/campaigns/{id}",
      purpose: "Edit an existing campaign.",
      tabs: {
        campaignConfig: "Brief, persona, messages, simulator and sources (default)",
        addLeads: "Add leads to this campaign",
        channelConfig: "Sender LinkedIn accounts or WhatsApp numbers",
        sequenceBuilder: "Step graph for the outreach sequence",
      },
      forward: ["Next: Add Leads", "Next: LinkedIn Senders", "Next: Select Sender Numbers"],
      back: ["Back to Campaign Design", "Back to Add Leads", "Back to Sequence", "Edit Campaign Details"],
    },
    campaignDetails: { path: "/campaigns/{id}/details", purpose: "Per-campaign statistics." },
    icpLeads: {
      path: "/leads",
      purpose: "Build an audience by describing the ideal customer to an AI chat, then extract it.",
      tabs: { quick: "Leads - by Sbl (default)", history: "Leads History" },
      retired: ["curated"],
      examplePrompts: [
        "Find me companies with 11 to 50 employees in the SaaS industry.",
        "Get me founders, CEOs and decision makers in early stage startups based out of US",
        "Pull Heads of Marketing and CMOs in companies with 200 to 1000 employees.",
      ],
      handoff: "Import to campaign",
    },
    contacts: {
      path: "/users",
      purpose: "The contact database, bulk jobs, and LinkedIn extraction status.",
      tabs: {
        list: "Contacts",
        "bulk-upload-jobs": "Bulk Upload",
        "bulk-export-jobs": "Bulk Export",
        "linkedin-sales-navigator": "LinkedIn Search — where extraction progress is checked",
        "exclude-contacts": "Exclude Contacts",
      },
    },
    signals: {
      path: "/signals",
      purpose: "Catalogue of intent signals; run one to extract leads.",
      drilldown: ["/signals/{type}", "/signals/{type}/{signalId}"],
      handoff: "Push the extracted leads into a campaign.",
    },
    chats: { path: "/chat", purpose: "Unified inbox for prospect replies." },
    workflows: {
      path: "/workflows",
      purpose: "Multi-step sequences, built as a node graph. A workflow is a campaign in a different mode.",
      create: "New Workflow",
    },
    reports: { path: "/analytics", purpose: "Outreach reporting." },
    settings: {
      path: "/settings",
      purpose: "Account, workspace, members, persona and channels.",
      tabs: { communication: "Communication Channels — connect LinkedIn and WhatsApp", persona: "Personas", workspace: "Workspace", members: "Members", account: "Account settings" },
    },
    billing: { path: "/billing", purpose: "Plans, credits and purchases.", credits: "Remaining credits this month / Buy credits" },
    onboarding: { path: "/onboarding", purpose: "Post-signup wizard." },
    getStarted: { path: "/get-started", purpose: "Onboarding checklist; also the fallback for a permission-denied screen." },
  };

  // The wizard and the campaign editor offer the same capabilities under different
  // labels, so the agent must use the set belonging to the surface it is on.
  const LEAD_SOURCES = {
    uploadCsv: {
      aliases: ["csv", "upload csv", "spreadsheet", "csv file", "import a file"],
      group: "Import",
      wizardLabel: "Upload CSV",
      editorLabel: "Upload CSV file",
      description: "Import leads from a CSV file",
      needs: "A CSV file, then a column mapping. LinkedIn campaigns must map a LinkedIn column; WhatsApp must map Phone.",
      channels: ["LinkedIn", "WhatsApp"],
      userSupplies: "file",
    },
    manual: {
      aliases: ["manual", "add manually", "manually add", "one by one", "paste a profile"],
      group: "Import",
      wizardLabel: "Manually Add",
      editorLabel: "Add Leads Manually",
      description: "Add leads one by one",
      needs: "Full name plus a LinkedIn profile URL or WhatsApp number.",
      channels: ["LinkedIn", "WhatsApp"],
    },
    existingLeads: {
      aliases: ["existing leads", "previous audience", "reuse leads", "existing campaign leads", "past leads"],
      group: "Import",
      wizardLabel: "Existing Leads",
      editorLabel: "Existing Campaign Leads",
      description: "Reuse leads from a previous audience",
      channels: ["LinkedIn"],
      emptyState: "No previous audiences yet. Build one with ICP Leads or LinkedIn Search, then reuse it here.",
    },
    icpLeads: {
      aliases: ["icp", "icp leads", "ai leads", "ai-powered leads", "leads by sbl", "prompt leads", "quick leads", "describe my ideal customer"],
      group: "AI-Powered",
      wizardLabel: "ICP Leads",
      editorLabel: "Leads by SBL",
      description: "AI-generated leads matching your ICP",
      needs: "A description of the companies and roles to target.",
      channels: ["LinkedIn"],
    },
    linkedinSearch: {
      aliases: ["linkedin search", "sales navigator", "sales nav", "classic linkedin", "search url", "navigator search"],
      group: "AI-Powered",
      wizardLabel: "LinkedIn Search",
      editorLabel: "LinkedIn Search",
      description: "Find leads via Sales Navigator",
      needs: "A Sales Navigator or Classic LinkedIn search URL, an audience name, a connected LinkedIn profile, and a lead count.",
      searchTypes: ["Sales Navigator", "Classic LinkedIn"],
      leadRange: { min: 100, max: 1000 },
      requiresLinkedInAccount: true,
      channels: ["LinkedIn"],
      submit: "Import Leads",
    },
    commentToDm: { aliases: ["comment to dm", "comments", "commenters", "people who commented"], group: "Intent Signals", wizardLabel: "Comment to DM", editorLabel: "Comment to DM", description: "Message people who commented on a post", channels: ["LinkedIn"], planGated: true },
    likes: { aliases: ["likes", "post likes", "leads via likes", "likers", "people who liked"], group: "Intent Signals", wizardLabel: "Leads via Likes", editorLabel: "Leads via Post Likes", description: "Import prospects who liked a specific post", channels: ["LinkedIn"], planGated: true },
    hiring: { aliases: ["hiring", "companies hiring", "job posts", "hiring signal"], group: "Intent Signals", wizardLabel: "Leads via Hiring", description: "Companies hiring for a role", needs: "Role, location and a lead count.", leadRange: { min: 10, max: 100 }, channels: ["LinkedIn"], planGated: true },
    jobChange: { aliases: ["job change", "changed jobs", "new role", "job switchers"], group: "Intent Signals", wizardLabel: "Leads via Job Change", description: "People who recently changed jobs", needs: "A keyword or title and a count.", leadRange: { min: 1, max: 100 }, channels: ["LinkedIn"], planGated: true },
    funding: { aliases: ["funding", "funded companies", "funding alert", "recently funded"], group: "Intent Signals", wizardLabel: "Leads via Funding Alert", description: "Recently funded companies", needs: "Location, industry, headcount range and a company count.", leadRange: { min: 1, max: 100 }, channels: ["LinkedIn"], planGated: true },
    engagement: { aliases: ["engagement", "post engagement", "engagers", "people engaging"], group: "Intent Signals", wizardLabel: "Leads via Engagement", description: "People engaging with a profile's posts", needs: "A LinkedIn slug, profile type and how many recent posts to scan.", leadRange: { min: 1, max: 10 }, channels: ["LinkedIn"], planGated: true },
    existingSignals: { aliases: ["existing signals", "saved signals", "reuse signal"], group: "Intent Signals", wizardLabel: "Existing Signals", description: "Reuse a signal already extracted", channels: ["LinkedIn"], planGated: true },
    addLater: { aliases: ["add later", "later", "skip", "skip leads", "no leads yet", "add leads later"], group: "Import", wizardLabel: "Skip for now — add leads later", description: "Create the campaign now and add leads afterwards", channels: ["LinkedIn", "WhatsApp"] },
    api: { aliases: ["api", "api integration", "push leads via api"], group: "Import", editorLabel: "API Integration", description: "Add leads to your campaign using the SBL API.", channels: ["LinkedIn", "WhatsApp"] },
  };

  const GATING_MESSAGES = {
    signals: "Signals is not available in your current plan. Upgrade to a higher tier to unlock this feature.",
    commentToDm: "Comment to DM is not available in your current plan…",
    likeToDm: "Like to DM …",
    extraction: "Lead extraction is not enabled on your plan. Contact support to unlock this feature.",
    signalsPass: "The Signals Pass covers Signals and one LinkedIn account. Upgrade to a plan to unlock the rest of sbl.so.",
  };

  // Reference text for the model: what exists and what it is called. Knowledge to read, not a route to follow.
  function reference() {
    const nav = NAVIGATION.map((group) => `${group.section}: ${group.items.map((i) => `${i.label} ${i.path}${[i.badge, i.ownerOnly && "owner only", i.planGated && "plan-gated"].filter(Boolean).map((x) => ` (${x})`).join("")}`).join("; ")}`);
    const screens = Object.values(SCREENS).map(({ path, purpose, ...rest }) => `- ${path}: ${purpose}${Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : ""}`);
    const sources = Object.values(LEAD_SOURCES).map((x) => `- ${x.group}: ${x.wizardLabel || x.editorLabel}${x.editorLabel && x.wizardLabel && x.editorLabel !== x.wizardLabel ? ` (in the campaign editor: ${x.editorLabel})` : ""}: ${x.description}${x.needs ? `. Needs: ${x.needs}` : ""}${x.planGated ? " (plan-gated)" : ""}`);
    return [`DASHBOARD SIDEBAR (${APP}):`, ...nav, "DASHBOARD SCREENS:", ...screens, "WAYS TO ADD LEADS TO A CAMPAIGN:", ...sources, "MESSAGES THE DASHBOARD SHOWS WHEN A PLAN LACKS A FEATURE:", ...Object.values(GATING_MESSAGES).map((m) => `- ${m}`)].join("\n");
  }

  // The live editor's pencil is an unlabeled div containing an aria-hidden SVG.
  function labelCampaignControls(document, pathname) {
    if (!/^\/campaigns\/\d+\/?$/.test(pathname)) return;
    const icons = document.querySelectorAll("div.cursor-pointer > svg.lucide-square-pen");
    if (icons.length !== 1) return;
    const control = icons[0].parentElement;
    if (control.hasAttribute("aria-label") || control.hasAttribute("role")) return;
    control.setAttribute("role", "button");
    control.setAttribute("aria-label", "Edit campaign name");
  }

  return { APP, NAVIGATION, SCREENS, LEAD_SOURCES, GATING_MESSAGES, reference, labelCampaignControls };
});
