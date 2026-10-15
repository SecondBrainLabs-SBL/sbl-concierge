// Localhost OpenAI pass-through. Adds the key server-side; the page never sees it.
import http from "node:http"; import fs from "node:fs";
const env = fs.readFileSync(new URL("../../.env", import.meta.url), "utf8");
const KEY = /^OPENAI_API_KEY=(.*)$/m.exec(env)[1].trim().replace(/^["']|["']$/g, "");
const ORIGIN = /^https:\/\/([a-z0-9-]+\.)*(sbl\.so|secondbrainlabs\.com)$|^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
export function startProxy(port = 8787) {
  const stats = { calls: 0, errors: [], log: [] };
  const srv = http.createServer(async (req, res) => {
    const o = req.headers.origin || "";
    const cors = { "Access-Control-Allow-Origin": ORIGIN.test(o) ? o : "null", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST,OPTIONS", "Access-Control-Allow-Private-Network": "true", Vary: "Origin" };
    if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
    if (!ORIGIN.test(o) || req.method !== "POST" || !req.url.endsWith("/chat/completions")) { res.writeHead(403, cors); return res.end("no"); }
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks); const t0 = Date.now();
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + KEY }, body });
      const txt = await r.text(); stats.calls++;
      stats.log.push({ status: r.status, ms: Date.now() - t0, reqBytes: body.length, respBytes: txt.length, err: r.ok ? undefined : txt.slice(0, 300) });
      res.writeHead(r.status, { ...cors, "Content-Type": "application/json" }); res.end(txt);
    } catch (e) { stats.errors.push(String(e)); res.writeHead(502, cors); res.end(String(e)); }
  });
  return new Promise((ok) => srv.listen(port, "127.0.0.1", () => ok({ srv, stats })));
}
if (process.argv[1].endsWith("proxy.mjs")) { await startProxy(); console.log("proxy up"); }
