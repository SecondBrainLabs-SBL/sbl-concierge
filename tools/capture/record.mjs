// Records what a human does in a real browser and which API calls each action causes.
// Every interaction stores the component (type, accessible name, selector, on-screen box)
// and a screenshot taken before the action lands, so an endpoint can be traced back to
// the exact control that triggered it.
import { chromium } from "playwright";
import { mkdir, appendFile, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

const SECRET_KEY = /pass|secret|token|cookie|auth|otp|credential|api[-_]?key|li_at|session/i;
const SECRET_HEADER = /^(authorization|cookie|set-cookie|x-api-key|x-csrf-token)$/i;
const MAX_STRING = 400;
const MAX_BODY = 200_000;
// A request is attributed to the most recent interaction inside this window.
const ATTRIBUTION_MS = 15_000;

function redact(value, key = "", depth = 0) {
  if (depth > 6) return "[deep]";
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (SECRET_KEY.test(key)) return "[redacted]";
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…[+${value.length - MAX_STRING}]` : value;
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item, key, depth + 1));
  if (value && typeof value === "object") {
    const out = {};
    for (const [name, item] of Object.entries(value).slice(0, 60)) {
      out[name] = SECRET_KEY.test(name) ? "[redacted]" : redact(item, name, depth + 1);
    }
    return out;
  }
  return value;
}

function redactHeaders(headers = {}) {
  const out = {};
  for (const [name, value] of Object.entries(headers)) {
    out[name] = SECRET_HEADER.test(name) ? "[redacted]" : value.slice(0, 200);
  }
  return out;
}

function parseBody(text, contentType = "") {
  if (!text) return undefined;
  if (text.length > MAX_BODY) return { truncated: true, bytes: text.length };
  // Form posts carry credentials as often as JSON does, so they are parsed
  // into fields and redacted by key rather than stored as raw text.
  if (/x-www-form-urlencoded/i.test(contentType) || (!contentType && /^[\w.[\]-]+=/.test(text))) {
    return redact(Object.fromEntries(new URLSearchParams(text)));
  }
  if (/json/i.test(contentType) || /^[[{]/.test(text.trim())) {
    try {
      return redact(JSON.parse(text));
    } catch {
      /* Fall through to text. */
    }
  }
  return redact(text);
}

// The page reports interactions through this script; it never sends field values
// for password-like inputs.
const PAGE_HOOK = `(() => {
  if (window.__sblCaptureInstalled) return;
  window.__sblCaptureInstalled = true;
  const SECRET = /pass|otp|secret|token|card|cvv|cookie/i;

  function selectorFor(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.id && /^[A-Za-z][\\w-]*$/.test(el.id)) return '#' + el.id;
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 6) {
      const testId = node.getAttribute && node.getAttribute('data-testid');
      if (testId) { parts.unshift(node.tagName.toLowerCase() + '[data-testid="' + testId + '"]'); break; }
      let part = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (parent) {
        const sameTag = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
        if (sameTag.length > 1) part += ':nth-of-type(' + (sameTag.indexOf(node) + 1) + ')';
      }
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(' > ');
  }

  function label(el) {
    const text = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder')
      || el.getAttribute('alt') || el.getAttribute('title') || el.getAttribute('name') || '').trim();
    return text.replace(/\\s+/g, ' ').slice(0, 120);
  }

  function heading(el) {
    const section = el.closest('section, main, form, dialog, [role="dialog"], [role="tabpanel"]') || document.body;
    const found = section.querySelector('h1, h2, h3, [role="heading"]');
    return found ? found.innerText.replace(/\\s+/g, ' ').trim().slice(0, 120) : '';
  }

  function describe(el) {
    const rect = el.getBoundingClientRect();
    return {
      selector: selectorFor(el),
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || undefined,
      role: el.getAttribute('role') || undefined,
      testId: (el.getAttribute && el.getAttribute('data-testid')) || undefined,
      href: el.tagName === 'A' ? el.getAttribute('href') : undefined,
      label: label(el),
      section: heading(el),
      box: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
      scroll: { x: Math.round(window.scrollX), y: Math.round(window.scrollY) },
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  }

  function report(kind, target, extra, event) {
    // Events from inside a shadow root are retargeted to the host, which hides which
    // control was used. composedPath() gives the real element (the widget's buttons).
    const deep = event?.composedPath?.()[0];
    const chosen = deep && deep.nodeType === 1 ? deep : target;
    const el = chosen && chosen.nodeType === 1 ? chosen : chosen && chosen.parentElement;
    if (!el) return;
    const actionable = el.closest('button, a, input, select, textarea, [role="button"], [role="tab"], [role="option"], label, [data-testid]') || el;
    try {
      window.__sblRecord({ kind, url: location.href, title: document.title, at: Date.now(), ...describe(actionable), ...extra });
    } catch { /* The binding disappears during navigation. */ }
  }

  let lastTarget = null;
  let lastAt = 0;
  addEventListener('pointerdown', (event) => {
    lastTarget = event.target; lastAt = Date.now();
    report('click', event.target, undefined, event);
  }, true);
  // Scripted clicks (element.click(), as the agent uses) never emit pointerdown,
  // so they are caught here and de-duplicated against real pointer input.
  addEventListener('click', (event) => {
    if (event.target === lastTarget && Date.now() - lastAt < 700) return;
    report(event.isTrusted ? 'click' : 'agent-click', event.target, undefined, event);
  }, true);
  addEventListener('change', (event) => {
    const el = event.target;
    const secret = el.type === 'password' || SECRET.test((el.name || '') + (el.id || '') + (el.getAttribute('autocomplete') || ''));
    const value = secret ? '[redacted]' : String(el.value ?? '').slice(0, 120);
    report('input', el, { value }, event);
  }, true);
  addEventListener('submit', (event) => report('submit', event.target, undefined, event), true);
})();`;

export async function startRecorder(options = {}) {
  const startUrl = options.startUrl || process.env.START_URL || "https://app.secondbrainlabs.com";
  const root = options.outDir || path.resolve("captures", new Date().toISOString().replace(/[:.]/g, "-"));
  const apiHosts = (options.apiHosts || process.env.API_HOSTS || "app.secondbrainlabs.com,api.sbl.so,sbl.so")
    .split(",").map((host) => host.trim()).filter(Boolean);
  const screenshots = path.join(root, "screenshots");
  const eventsFile = path.join(root, "events.jsonl");
  await mkdir(screenshots, { recursive: true });

  let sequence = 0;
  let current = null;
  const pending = new Map();
  const counts = { click: 0, input: 0, submit: 0, navigate: 0, request: 0, note: 0 };

  async function write(event) {
    counts[event.kind] = (counts[event.kind] || 0) + 1;
    await appendFile(eventsFile, `${JSON.stringify(event)}\n`, "utf8");
  }

  // Loading the sales-agent extension here means the agent runs in the same browser
  // that is being recorded, so its own API calls are captured alongside the human's.
  const extension = options.extensionPath || process.env.EXTENSION_PATH;
  const extensionArgs = extension
    ? [`--disable-extensions-except=${path.resolve(extension)}`, `--load-extension=${path.resolve(extension)}`]
    : [];

  const context = await chromium.launchPersistentContext(
    options.profileDir || process.env.PROFILE_DIR || path.resolve(".browser-profile"),
    { headless: false, viewport: null, args: ["--start-maximized", ...extensionArgs], ...options.launch },
  );

  await context.exposeBinding("__sblRecord", async ({ page }, detail) => {
    const id = `a${++sequence}`;
    current = { id, at: Date.now() };
    const file = path.join(screenshots, `${id}-${detail.kind}.png`);
    let shot = null;
    try {
      // Taken on pointerdown, so it shows the screen the person was looking at.
      await page.screenshot({ path: file, timeout: 4000 });
      shot = path.relative(root, file);
    } catch { /* Navigation can start before the screenshot completes. */ }
    await write({ ...detail, kind: detail.kind, id, ts: new Date().toISOString(), screenshot: shot });
  });
  await context.addInitScript(PAGE_HOOK);

  function watch(page) {
    page.on("framenavigated", async (frame) => {
      if (frame !== page.mainFrame()) return;
      await write({ kind: "navigate", id: `n${++sequence}`, ts: new Date().toISOString(), url: frame.url() });
    });
    page.on("request", (request) => {
      if (!["xhr", "fetch", "document"].includes(request.resourceType())) return;
      // Match on hostname so an allowlist entry covers any port.
      const host = (() => { try { return new URL(request.url()).hostname; } catch { return ""; } })();
      if (!apiHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) return;
      const attributed = current && Date.now() - current.at < ATTRIBUTION_MS ? current.id : null;
      pending.set(request, { startedAt: Date.now(), actionId: attributed });
    });
    page.on("response", async (response) => {
      const request = response.request();
      const meta = pending.get(request);
      if (!meta) return;
      pending.delete(request);
      const contentType = response.headers()["content-type"] || "";
      let body;
      if (/json|text/i.test(contentType)) {
        try { body = parseBody(await response.text(), contentType); } catch { body = "[unavailable]"; }
      }
      const url = new URL(request.url());
      await write({
        kind: "request",
        id: `r${++sequence}`,
        ts: new Date().toISOString(),
        actionId: meta.actionId,
        method: request.method(),
        host: url.host,
        path: url.pathname,
        query: redact(Object.fromEntries(url.searchParams)),
        resourceType: request.resourceType(),
        status: response.status(),
        durationMs: Date.now() - meta.startedAt,
        requestHeaders: redactHeaders(request.headers()),
        requestBody: parseBody(request.postData(), request.headers()["content-type"]),
        responseBody: body,
      });
    });
    page.on("requestfailed", async (request) => {
      const meta = pending.get(request);
      if (!meta) return;
      pending.delete(request);
      const url = new URL(request.url());
      await write({
        kind: "request", id: `r${++sequence}`, ts: new Date().toISOString(), actionId: meta.actionId,
        method: request.method(), host: url.host, path: url.pathname, status: null,
        failure: request.failure()?.errorText, durationMs: Date.now() - meta.startedAt,
      });
    });
  }

  context.on("page", watch);
  const page = context.pages()[0] || (await context.newPage());
  watch(page);
  if (startUrl) await page.goto(startUrl, { waitUntil: "domcontentloaded" }).catch(() => {});

  async function note(text) {
    await write({ kind: "note", id: `m${++sequence}`, ts: new Date().toISOString(), text });
  }

  async function stop() {
    await writeFile(path.join(root, "session.json"), JSON.stringify({
      startUrl, apiHosts, startedAt: new Date().toISOString(), counts,
    }, null, 2), "utf8");
    await context.close().catch(() => {});
    return { root, counts };
  }

  return { context, page, root, eventsFile, note, stop, counts };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href) {
  const recorder = await startRecorder();
  console.log(`Recording to ${recorder.root}`);
  console.log("Use the browser normally. Type a label here and press Enter to mark a flow. Ctrl+C to stop.\n");
  const input = readline.createInterface({ input: process.stdin });
  input.on("line", async (line) => {
    if (!line.trim()) return;
    await recorder.note(line.trim());
    console.log(`  marked: ${line.trim()}`);
  });
  const finish = async () => {
    const { root, counts } = await recorder.stop();
    console.log(`\nSaved ${JSON.stringify(counts)} to ${root}`);
    process.exit(0);
  };
  process.on("SIGINT", finish);
  recorder.context.on("close", finish);
}
