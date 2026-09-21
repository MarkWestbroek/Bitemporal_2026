// @ts-check
/**
 * traces — de SysML-traceerrelaties als één connector met een `soort`.
 *
 * SysML kent vijf traceerbare afhankelijkheden (satisfy, verify, derive,
 * refine, trace). Notationeel zijn ze identiek — gestreepte lijn, open pijl —
 * en verschillen ze alléén in het «stereotype»-label. Vijf losse connectoren
 * zouden de "Verbinding"-balk vullen met vijf knoppen die er hetzelfde
 * uitzien; één connector met een keuze-property leest beter en is precies
 * even expressief.
 *
 * Losse module (geen `.jsx`-import) zodat de logica testbaar blijft — zie de
 * toelichting in `bpmn/sequenceFlow.js`.
 */

/** @type {{waarde: string, label: string, uitleg: string}[]} */
export const TRACE_SOORTEN = [
  {
    waarde: "satisfy",
    label: "«satisfy»",
    uitleg: "Het ontwerpelement voldoet aan de requirement.",
  },
  {
    waarde: "verify",
    label: "«verify»",
    uitleg: "Het testgeval toont aan dat aan de requirement is voldaan.",
  },
  {
    waarde: "derive",
    label: "«deriveReqt»",
    uitleg: "Deze requirement is afgeleid van een andere.",
  },
  {
    waarde: "refine",
    label: "«refine»",
    uitleg: "Verfijning: het element maakt de requirement concreter.",
  },
  {
    waarde: "trace",
    label: "«trace»",
    uitleg: "Algemene herleidbaarheid, zonder verdere betekenis.",
  },
];

export const TRACE_OPTIES = TRACE_SOORTEN.map(({ waarde, uitleg }) => ({
  waarde,
  label: `${waarde} — ${uitleg}`,
}));

/**
 * Het «stereotype»-label bij een trace-soort; `null` als de soort niet
 * (of nog niet) gekozen is — dan tekent de lijn kaal, in plaats van een
 * betekenis te suggereren die er niet is.
 *
 * @param {string} [soort]
 */
export function traceLabel(soort) {
  return TRACE_SOORTEN.find((t) => t.waarde === soort)?.label ?? null;
}

/**
 * edgeLabels-hook: het stereotype midden op de lijn.
 *
 * @param {{data?: Record<string, any>}} conn
 */
export function traceLabels(conn) {
  const tekst = traceLabel(conn?.data?.soort);
  if (!tekst) return {};
  return { kaal: [{ zijde: "midden", delen: [{ tekst, soort: "constraint" }] }] };
}
