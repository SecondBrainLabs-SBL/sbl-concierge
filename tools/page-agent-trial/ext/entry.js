import { PageAgentCore } from "page-agent";
import { PageController } from "@page-agent/page-controller";
const ev = []; for (const n of ["MovePointerTo", "ClickPointer"]) window.addEventListener("PageAgent::" + n, (e) => ev.push([n, e.detail]));
const a = new PageAgentCore({ model: "gpt-5.6-luna", baseURL: "http://127.0.0.1:8899/v1", apiKey: "x", maxSteps: 6, transformRequestBody: (b) => ({ ...b, reasoning_effort: "none" }), pageController: new PageController({ enableMask: false }) });
const acts = []; a.addEventListener("activity", (e) => acts.push(e.detail));
a.execute("Click the Pricing link in the top navigation, then finish with done.").then((r) => { document.documentElement.dataset.paExt = JSON.stringify({ r: { success: r.success, data: r.data }, pointerEvents: ev, activity: acts.map((x) => x.type + ":" + (x.tool || "")), world: typeof chrome !== "undefined" && !!chrome.runtime ? "isolated-content-script" : "main" }); });
