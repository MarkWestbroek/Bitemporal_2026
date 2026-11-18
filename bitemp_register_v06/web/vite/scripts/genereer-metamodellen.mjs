/**
 * genereer-metamodellen — schrijft de alleen-lezen modellen van het M3 (en straks het
 * projectmetamodel) als Studio-werkbestand naar docs/metamodel/ (plan docs/plans/2026-11-15, stap 3).
 *
 *   npm run metamodellen        bijwerken (de layout in het bestaande bestand blijft staan)
 *   npm test                    metamodellen.test.js faalt als het bestand achterloopt
 *
 * De maat van elke doos komt uit de tekenaar (planInhoud, zoals het canvas meet), op de
 * natuurlijke breedte: een metaklasse met lange attributen wordt breder, niet afgeknipt.
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { genereerMetamodellen, METAMODEL_BESTANDEN } from "../src/studio/metamodellen/genereer.js";

const lees = (rel) => fs.readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const pad = (bestand) => fileURLToPath(new URL(`../../../docs/metamodel/${bestand}`, import.meta.url));

fs.mkdirSync(fileURLToPath(new URL("../../../docs/metamodel/", import.meta.url)), { recursive: true });
const vorigen = Object.fromEntries(
  Object.entries(METAMODEL_BESTANDEN).map(([sleutel, bestand]) => [sleutel, fs.existsSync(pad(bestand)) ? JSON.parse(fs.readFileSync(pad(bestand), "utf8")) : null]),
);
const uit = genereerMetamodellen({ schemaBron: lees("../src/diagramcore/types/schema.js"), vorigen });
for (const [sleutel, tekst] of Object.entries(uit)) {
  const bestand = pad(METAMODEL_BESTANDEN[sleutel]);
  const was = fs.existsSync(bestand) ? fs.readFileSync(bestand, "utf8") : null;
  fs.writeFileSync(bestand, tekst);
  console.log(`${METAMODEL_BESTANDEN[sleutel]}: ${was === tekst ? "ongewijzigd" : was ? "bijgewerkt" : "nieuw"}`);
}
