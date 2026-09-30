// Tekent model/gbo-persoon — v3-model.json als SVG met dezelfde tekenaar als
// Studio en de render-API (web/vite/src/diagramsvg). Gebruik: node scripts/render_diagram.mjs
import { renderDiagramSvg } from "../../../web/vite/src/diagramsvg/index.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const hier = path.dirname(fileURLToPath(import.meta.url));
const model = JSON.parse(fs.readFileSync(path.join(hier, "../model/gbo-persoon — v3-model.json"), "utf8"));
const svg = renderDiagramSvg({ taal: "v3", model, domein: "gbo", theme: "light", richting: "LR" });
fs.writeFileSync(path.join(hier, "../model/gbo-persoon.svg"), svg);
console.log("model/gbo-persoon.svg", svg.length, "bytes");
