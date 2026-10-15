// In-page glue: bundled with page-agent into one IIFE. Talks to the Node driver only through window.__pa(method, arg).
import { PageAgent, PageAgentCore, tool } from "page-agent";
import { PageController } from "@page-agent/page-controller";
import * as z from "zod/v4";

const BLOCK = /launch|run campaign|start campaign|activate|connect (your )?linkedin|add payment|pay now|subscribe|checkout|upgrade|invite|send message|import leads/i;
const pa = (m, a) => window.__pa(m, JSON.stringify(a ?? null)).then((r) => (r ? JSON.parse(r) : null));

function makeTools(opts) {
  const t = {
    create_inbox: tool({ description: "Create a disposable email inbox (mail.tm). Returns the email address to use for signup.", inputSchema: z.object({}), execute: async () => "Inbox created: " + (await pa("create_inbox")) }),
    get_latest_email: tool({ description: "Get the latest email in the disposable inbox (subject, text, links). Polls up to 60s for one to arrive.", inputSchema: z.object({}), execute: async () => await pa("get_latest_email") }),
    fill_secret: tool({ description: "Type a stored secret (name: sbl_password) into the input at index, without you seeing the value.", inputSchema: z.object({ index: z.int().min(0), name: z.string() }),
      execute: async function ({ index, name }) { const v = await pa("secret", name); await this.pageController.inputText(index, v); return `Typed the stored secret "${name}" into input ${index} (value hidden). The field is now filled; do not fill it again, go to the next step.`; } }),
    // override: same behaviour as built-in, plus the driver-enforced safety guard
    click_element_by_index: tool({ description: "Click element by index", inputSchema: z.object({ index: z.int().min(0) }),
      execute: async function ({ index }) {
        const el = this.pageController.selectorMap.get(index)?.ref;
        const txt = el ? (el.innerText || el.value || el.getAttribute("aria-label") || el.title || "").trim().slice(0, 80) : "";
        if (txt.split(/\n/).some((l) => l.length <= 40 && BLOCK.test(l))) { await pa("blocked", { index, txt, url: location.href }); return `BLOCKED by safety limit: "${txt}" is not allowed in this task. Do not click it; finish or stop and report.`; }
        return (await this.pageController.clickElement(index)).message;
      } }),
  };
  if (opts.extras) {
    t.point_at = tool({ description: "Highlight/point at the element with this index and show a short label, without clicking.", inputSchema: z.object({ index: z.int().min(0), label: z.string() }),
      execute: async function ({ index, label }) {
        const el = this.pageController.selectorMap.get(index)?.ref; if (!el) return "no such element";
        el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect();
        const d = document.createElement("div"); d.id = "sbl-point"; d.textContent = label;
        d.style.cssText = `position:fixed;z-index:2147483647;left:${r.left - 4}px;top:${r.top - 4}px;width:${r.width + 8}px;height:${r.height + 8}px;outline:3px solid #f0f;color:#f0f;font:12px sans-serif;pointer-events:none`;
        document.body.append(d); await new Promise((r) => setTimeout(r, 1500)); d.remove();
        await pa("pointed", { index, rect: [r.left, r.top, r.width, r.height], label }); return `Pointed at element ${index} (${label}).`;
      } });
    t.confirm = tool({ description: "Show a confirmation card to the human and wait for yes/no before doing anything irreversible.", inputSchema: z.object({ title: z.string(), body: z.string() }),
      execute: async ({ title, body }) => `Human answered: ${await pa("confirm", { title, body })}` });
  }
  return t;
}

let agent, SECRET_MASK = null;
async function getAgent(opts) {
  if (agent) return agent;
  SECRET_MASK = await pa("secret", "sbl_password");
  const cfg = { transformPageContent: (c) => (SECRET_MASK ? c.split(SECRET_MASK).join("***") : c), model: opts.model, baseURL: opts.baseURL, apiKey: "local-proxy", maxSteps: opts.maxSteps, language: "en-US", transformRequestBody: (b) => ({ ...b, reasoning_effort: "none" }),
    instructions: { system: opts.system }, customTools: makeTools(opts), promptForNextTask: false,
    onAfterStep: async (a, history) => {
      const e = [...history].reverse().find((h) => h.type === "step"); if (!e) return;
      const msgs = e.rawRequest?.messages || [];
      await pa("step", { url: location.href, t: Date.now(), idx: e.stepIndex, reflection: e.reflection, action: e.action, usage: e.usage,
        sysChars: (msgs[0]?.content || "").length, userChars: (msgs[1]?.content || "").length,
        browserStateChars: ((msgs[1]?.content || "").split("<browser_state>")[1] || "").length, nMsgs: msgs.length, hasImage: JSON.stringify(msgs).includes("image_url"),
        nHist: history.filter((h) => h.type === "step").length, errors: history.filter((h) => h.type === "error" || h.type === "retry").length });
    } };
  if (opts.headless) { // no UI at all: controller without mask, no panel
    agent = new PageAgentCore({ ...cfg, pageController: new PageController({ enableMask: false }) });
    agent.addEventListener("activity", (ev) => { const d = ev.detail; if (d.type === "executing") { let rect = null; const el = d.input?.index != null && agent.pageController.selectorMap.get(d.input.index)?.ref; if (el) { const r = el.getBoundingClientRect(); rect = [r.left, r.top, r.width, r.height]; } pa("activity", { ...d, rect }); } });
  } else agent = new PageAgent(cfg);
  if (opts.sameTab) { // page-agent is single-tab: keep target=_blank links and window.open in this tab
    document.addEventListener("click", (e) => { const a = e.target.closest && e.target.closest("a[target=_blank]"); if (a) a.target = "_self"; }, true);
    window.open = (u) => { if (u) location.assign(u); return null; };
  }
  if (opts.extras) agent.onAskUser = (q) => pa("ask", q);
  window.__agent = agent; return agent;
}

async function run() {
  if (!window.__pa || window.__paRunning) return; // only the driven tab runs an agent window.__paRunning = true;
  try {
    const st = await pa("get"); if (!st || !st.active) return;
    const a = await getAgent(st.opts);
    const task = st.resume ? `${st.goal}\n\nCONTINUATION: the browser navigated/reloaded while you were working, so your memory was lost. Done so far: ${st.resume}\nContinue from the current page state; do not redo finished work.` : st.goal;
    await pa("started", { url: location.href, resumed: !!st.resume });
    const res = await a.execute(task);
    await pa("done", { success: res.success, data: res.data });
  } catch (e) { await pa("crash", String(e)); } finally { window.__paRunning = false; }
}
window.__paRun = run;
if (window.top === window) {
  const go = () => setTimeout(run, 300);
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", go) : go();
}
