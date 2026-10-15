#!/usr/bin/env node
// profielen-voor-mcp.mjs — schrijft de profielsamenvattingen (M2: element- en relatietypen,
// verbindingsregels, aanwijzingen) naar tools/omnium-mcp/profielen.json, zodat de MCP in Node
// dezelfde regelset gebruikt als de assistent in de Studio (assistentKern.profielSamenvatting).
//
// De profielen leven in modules met JSX en registreren zich bij het laden; daarom laadt dit
// script ze via Vite (ssrLoadModule) met een minimale browseromgeving.
//   node scripts/profielen-voor-mcp.mjs          (vanuit web/vite)
import { createServer } from "vite";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const hier = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(hier, "..");
const uit = path.resolve(root, "../../tools/omnium-mcp/profielen.json");

// Minimale browseromgeving voor modules die bij het laden localStorage/window aanraken.
const geheugen = new Map();
globalThis.localStorage ??= { getItem: (k) => geheugen.get(k) ?? null, setItem: (k, v) => geheugen.set(k, String(v)), removeItem: (k) => geheugen.delete(k), clear: () => geheugen.clear(), key: () => null, length: 0 };
globalThis.window ??= globalThis;
globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const server = await createServer({ root, configFile: path.join(root, "vite.config.js"), server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "error" });
try {
  const fs = await import("node:fs");
  const dir = path.join(root, "src/studio/activities");
  const activiteiten = fs.readdirSync(dir).filter((f) => /Activity\.jsx$/.test(f) && fs.readFileSync(path.join(dir, f), "utf8").includes("maakDiagramActiviteit({"));
  for (const f of activiteiten) {
    try { await server.ssrLoadModule(`/src/studio/activities/${f}`); } catch (e) { console.warn(`overgeslagen: ${f} (${e.message.split("\n")[0]})`); }
  }
  const { getProfieltypen } = await server.ssrLoadModule("/src/studio/profieltypeRegistry.js");
  const { profielSamenvatting } = await server.ssrLoadModule("/src/studio/assistent/assistentKern.js");
  const profielen = getProfieltypen()
    // Zonder de demo-profielen uit de profiel-ontwerper (dyn-…): die leven alleen in een browser.
    .filter((p) => !p.vasteDocumenten && !p.id.startsWith("dyn-") && (p.descriptor?.elementTypes || []).some((t) => t.isConnector))
    .map((p) => ({ ...profielSamenvatting(p.descriptor, p.id), naam: p.label || p.descriptor?.label || p.id }))
    .sort((a, b) => a.naam.localeCompare(b.naam));
  writeFileSync(uit, JSON.stringify({ gegenereerd: "scripts/profielen-voor-mcp.mjs", profielen }, null, 1) + "\n");
  console.log(`${profielen.length} profielen → ${path.relative(process.cwd(), uit)}`);
} finally {
  await server.close();
}
