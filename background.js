// Server calls run here (extension origin) so Chrome's Local Network Access prompt never hits the page.
const BASE = "http://127.0.0.1:8787";
const PATHS = ["/health", "/respond", "/session", "/research", "/research/cancel", "/agent/chat", "/agent/route", "/agent/note", "/trace"];
const MAX_BODY = 512 * 1024;

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type !== "concierge-fetch" || sender.id !== chrome.runtime.id) return;
  const body = msg.body === undefined ? undefined : JSON.stringify(msg.body);
  if (!PATHS.includes(msg.path) || (body && body.length > MAX_BODY)) {
    reply({ ok: false, status: 400, body: { error: "Blocked request" } });
    return;
  }
  fetch(BASE + msg.path, {
    method: msg.method || "GET",
    headers: body ? { "Content-Type": "application/json", ...Object.fromEntries(Object.entries(msg.headers || {}).filter(([k]) => /^X-SBL-(V|Turn|Fault)$/.test(k)).map(([k, v]) => [k, String(v).slice(0, 64)])) } : undefined,
    body,
    signal: AbortSignal.timeout(60_000),
  })
    .then(async (r) => reply({ ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) }))
    .catch((e) => reply({ ok: false, status: 0, body: { error: `Server unreachable: ${e.name}` } }));
  return true; // async reply
});

// The running task, one per tab (the tab id is only known here). storage.session outlives the service worker but not the browser,
// and the content script owns the ~10 minute expiry (core/task.js), so this only stores.
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type !== "task" || sender.id !== chrome.runtime.id || sender.tab?.id == null) return;
  const key = `task:${sender.tab.id}`;
  if (msg.op === "put") chrome.storage.session.set({ [key]: msg.task }).then(() => reply({ ok: true }));
  else if (msg.op === "clear") chrome.storage.session.remove(key).then(() => reply({ ok: true }));
  else chrome.storage.session.get(key).then((r) => reply({ ok: true, task: r[key] || null }));
  return true;
});
chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove(`task:${tabId}`));
