// Rebuilds vendor/engine.js: `cd tools/engine && npm ci && npm run build`. Versions are pinned in package.json / package-lock.json.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

await build({
  entryPoints: [fileURLToPath(new URL("./entry.js", import.meta.url))],
  outfile: fileURLToPath(new URL("../../vendor/engine.js", import.meta.url)),
  bundle: true, minify: true, format: "iife", target: "chrome120", legalComments: "linked",
  banner: { js: "/* page-agent core 1.12.4 + page-controller (MIT). Built by tools/engine/build.mjs, do not edit. */" },
});
