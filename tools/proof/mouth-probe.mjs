// Step-3 mouth probe: does the gpt-live session speak from session.commentary.append ALONE
// (the brief's one-mouth channel), and does it speak a plain conversation item + response.create?
// Empirical, not trusting either reading. Runs twice against the SAME server shape: the caller
// decides the server's delegation config between the two runs (live-config.mjs).
//   node tools/proof/mouth-probe.mjs runA        (server WITHOUT delegation — current step-3 build)
//   node tools/proof/mouth-probe.mjs runB        (server WITH the old delegation block)
// Output: out/step3/mouth-probe-<run>.json — per channel: output transcript deltas, audio seen.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const { chromium } = createRequire(path.join(repo, "tools/capture/package.json"))("playwright");
const which = process.argv[2] || "runA";
const ROLE = process.argv[3] || "voice";
const OUT = path.join(here, `out/step3/mouth-probe-${which}`);
fs.mkdirSync(OUT, { recursive: true });
const probeRole = process.env.PROBE_ROLE || ROLE;
const toneGain = Number(process.env.PROBE_TONE === undefined ? 0.06 : process.env.PROBE_TONE);

// The server side decides the session shape; this probe measures the two channels (commentary vs
// response.create) and whether the visitor's own audio still gets transcribed and answered.
const browser = await chromium.launch({ headless: false, args: ["--use-fake-device-for-media-stream"] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
await ctx.grantPermissions(["microphone", "local-network-access"], { origin: "https://sbl.so" }).catch(() => {});
const page = await ctx.newPage();
page.on("console", (m) => { if (/error/i.test(m.text())) console.log("[console]", m.text().slice(0, 200)); });
await page.goto("https://sbl.so/", { waitUntil: "load" });
await page.waitForTimeout(2500);

const result = await page.evaluate(async ({ probeRole, toneGain }) => {
  const out = { steps: [] };
  const pc = new RTCPeerConnection();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  // Probing the mouth: a locally generated tone keeps the voice activity detection open (as Chrome's
  // fake device does) so commentary items are spoken, while the visitor's real speech never reaches
  // this session and it can never answer on its own.
  const role = probeRole; // which session shape the server builds: "voice" | "ears" | "mouth"
  let sendStream = stream;
  if (role === "mouth" || role === "voice-silent") {
    const actx = new AudioContext();
    const dest = actx.createMediaStreamDestination();
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.frequency.value = 440;
    gain.gain.value = toneGain;
    osc.connect(gain).connect(dest);
    osc.start();
    sendStream = dest.stream;
  }
  sendStream.getTracks().forEach((t) => pc.addTrack(t, sendStream));
  const dc = pc.createDataChannel("oai-events");
  const messages = [];
  dc.onmessage = (e) => { try { messages.push(JSON.parse(e.data)); } catch { messages.push({ raw: String(e.data).slice(0, 100) }); } };
  // inbound audio level, 10 Hz
  const samples = [];
  const sampler = setInterval(async () => {
    let l = 0;
    (await pc.getStats().catch(() => null))?.forEach?.((s) => { if (s.type === "inbound-rtp" && s.kind === "audio") l = Math.max(l, s.audioLevel || 0); });
    samples.push({ t: Date.now(), l });
  }, 100);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await new Promise((res) => { if (pc.iceGatheringState === "complete") return res(); pc.addEventListener("icegatheringstatechange", () => pc.iceGatheringState === "complete" && res(), { once: true }); setTimeout(res, 8000); });
  const started = Date.now();
  const r = await fetch("http://127.0.0.1:8787/session", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sdp: pc.localDescription.sdp, role, context: { surface: "website", visitor: {}, memory: {}, page: { url: location.href, title: document.title } } }),
  });
  const body = await r.json().catch(() => ({}));
  out.role = role;
  out.sessionStatus = r.status;
  out.sessionKeys = Object.keys(body || {});
  if (!r.ok) { clearInterval(sampler); return out; }
  await pc.setRemoteDescription({ type: "answer", sdp: body.transport?.sdp || body.sdp });
  const waitType = (type, ms) => new Promise((res) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (messages.some((m) => m.type === type) || Date.now() - t0 > ms) { clearInterval(iv); res(messages.some((m) => m.type === type)); }
    }, 150);
  });
  await waitType("session.started", 15000);
  out.steps.push({ at: Date.now() - started, got: "session.started" });
  out.sessionConfigEcho = body.session ? Object.keys(body.session) : null;
  out.sessionError = body.error?.message || null;
  out.echoTurnDetection = body.session?.turn_detection ?? body.session?.audio?.turn_detection ?? null;

  // --- does the visitor's own audio trigger an auto-response (the second brain)? 15 s of fake-mic silence, then speech ---
  // The fake device plays silence in this probe; speech is simulated with the conversation item below.
  // Self-answer detection = an output transcript delta with NO commentary/response.create sent.
  await new Promise((r2) => setTimeout(r2, 6000));
  out.autoResponse = {
    outputTranscriptDeltas: messages.filter((m) => m.type === "session.output_transcript.delta").length,
    outputText: messages.filter((m) => m.type === "session.output_transcript.delta").map((m) => m.delta || "").join("").slice(0, 200),
    errors: messages.filter((m) => m.type === "error").map((m) => m.error?.message || JSON.stringify(m).slice(0, 120)).slice(0, 4),
  };

  // --- channel 1: commentary.append alone ---
  messages.length = 0;
  const t1 = Date.now();
  dc.send(JSON.stringify({ event_id: crypto.randomUUID(), type: "session.commentary.append", delegation_id: null, content: "Say exactly, verbatim, to the visitor, nothing else: Hello there, this is the commentary channel." }));
  await new Promise((r2) => setTimeout(r2, 20000));
  out.commentary = {
    outputTranscriptDeltas: messages.filter((m) => m.type === "session.output_transcript.delta").length,
    outputText: messages.filter((m) => m.type === "session.output_transcript.delta").map((m) => m.delta || "").join("").slice(0, 200),
    otherTypes: [...new Set(messages.map((m) => m.type))].slice(0, 25),
    errors: messages.filter((m) => m.type === "error").map((m) => m.error?.message || JSON.stringify(m).slice(0, 120)).slice(0, 4),
  };
  out.commentary.audioMax = Math.max(0, ...samples.filter((s) => s.t > t1).map((s) => s.l));

  // --- channel 2: conversation item + response.create ---
  messages.length = 0;
  const t2 = Date.now();
  dc.send(JSON.stringify({ event_id: crypto.randomUUID(), type: "response.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: "Say exactly, verbatim, nothing else: Hi again, this is the response channel." }] } }));
  dc.send(JSON.stringify({ event_id: crypto.randomUUID(), type: "response.create" }));
  await new Promise((r2) => setTimeout(r2, 20000));
  out.responseCreate = {
    outputTranscriptDeltas: messages.filter((m) => m.type === "session.output_transcript.delta").length,
    outputText: messages.filter((m) => m.type === "session.output_transcript.delta").map((m) => m.delta || "").join("").slice(0, 200),
    otherTypes: [...new Set(messages.map((m) => m.type))].slice(0, 25),
    errors: messages.filter((m) => m.type === "error").map((m) => m.error?.message || JSON.stringify(m).slice(0, 120)).slice(0, 4),
  };
  out.responseCreate.audioMax = Math.max(0, ...samples.filter((s) => s.t > t2).map((s) => s.l));

  clearInterval(sampler);
  out.samples = samples.length;
  return out;
}, { probeRole, toneGain });

fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify(result, null, 1));
console.log(JSON.stringify(result, null, 1));
await browser.close();
