// @ts-check
/**
 * m3Metamodel — het M3 (types/m3.js) als Metamodel voor metamodelWerkbestand, met de uitleg uit
 * schema.js (leesTypedefs). Puur: de tekst van schema.js komt als argument binnen.
 */
import { M3_KLASSEN, M3_ENUMERATIES, M3_PAKKETTEN } from "../../diagramcore/types/m3.js";
import { leesTypedefs } from "../../diagramcore/types/leesTypedefs.js";

export const M3_PROJECT_ID = "omnium-m3";
export const M3_PROJECT_NAAM = "Omnium M3";

/** Eerste zin(nen) tot een lege regel of maximaal ~400 tekens: de inspector toont alles, maar
 * een notitie van een halve pagina helpt niemand. De volledige tekst staat in schema.js. */
function kort(tekst) {
  const t = String(tekst || "").trim();
  return t.length <= 400 ? t : `${t.slice(0, t.lastIndexOf(" ", 400))} …`;
}

/**
 * @param {string} schemaBron - de tekst van diagramcore/types/schema.js
 * @returns {import("./indeling.js").Metamodel}
 */
export function m3Metamodel(schemaBron) {
  const typedefs = new Map(leesTypedefs(schemaBron).map((t) => [t.naam, t]));
  return {
    id: M3_PROJECT_ID,
    naam: M3_PROJECT_NAAM,
    uitleg:
      "Het metametamodel van Omnium: waarmee een profiel (M2) beschreven wordt. Alleen-lezen documentatie, gegenereerd uit diagramcore/types/m3.js en schema.js (npm run metamodellen); de code is de implementatie.",
    pakketten: M3_PAKKETTEN.map((p) => ({ naam: p.naam, uitleg: p.uitleg })),
    klassen: M3_KLASSEN.map((k) => {
      const t = typedefs.get(k.naam);
      const uitlegVan = (naam) => t?.eigenschappen.find((e) => e.naam === naam)?.uitleg || "";
      return {
        naam: k.naam,
        pakket: k.pakket,
        soort: k.soort,
        uitleg: kort([k.uitleg || t?.uitleg || "", k.bron ? `Code: ${k.bron}.` : ""].filter(Boolean).join(" ")),
        eigenschappen: k.eigenschappen.map((e) => ({ ...e, uitleg: kort(e.uitleg || uitlegVan(e.naam)) })),
      };
    }),
    enumeraties: M3_ENUMERATIES.map((e) => ({ ...e, uitleg: [e.uitleg, e.bron ? `Code: ${e.bron}.` : ""].filter(Boolean).join(" ") })),
  };
}
