// Toegangsspraak → ODRL JSON-LD (NLGov), met de echte parser en exporter uit
// web/vite/src/toegangsspraak. Gebruik: node scripts/exporteer_odrl.mjs
import { parseBeleid } from "../../../web/vite/src/toegangsspraak/parser.js";
import { naarOdrl } from "../../../web/vite/src/toegangsspraak/odrl.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const hier = path.dirname(fileURLToPath(import.meta.url));
const tekst = fs.readFileSync(path.join(hier, "../beleid/gbo-persoon.toegangsspraak"), "utf8");
const r = parseBeleid(tekst);
if (!r.ok) { console.error(r.fouten); process.exit(1); }
const odrl = naarOdrl(r.beleid);
fs.writeFileSync(path.join(hier, "../beleid/gbo-persoon.odrl.json"), JSON.stringify(odrl, null, 2) + "\n");
console.log("beleid/gbo-persoon.odrl.json:", (odrl.permission || []).length, "permissions");
for (const p of odrl.permission) console.log(" -", p["nlgov:regelnaam"], "→", p.target?.uid, p.constraint ? JSON.stringify(p.constraint) : "");
