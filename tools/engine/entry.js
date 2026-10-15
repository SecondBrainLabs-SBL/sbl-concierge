// Headless page-agent core (MIT, derived from Browser Use) as a content-script global. No UI is bundled into use:
// the controller runs with enableMask:false and our own cursor draws everything the visitor sees.
import { PageAgentCore, tool } from "@page-agent/core";
import { PageController } from "@page-agent/page-controller";
import * as z from "zod/v4";

globalThis.SBLEngine = { PageAgentCore, PageController, tool, z };
