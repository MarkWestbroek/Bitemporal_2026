// @ts-check
/**
 * labels — pure stukken van het sequence-profiel (2026-10-14): de koppen van
 * een levenslijn en het label van een bericht. Los van index.js zodat ze
 * zonder React/JSX te testen zijn.
 */

/** Het profieltype van sequence in de Studio (sequenceActivity.jsx). */
export const SEQUENCE_PROFIEL_ID = "sequence05";

/** Berichttypen van het profiel. */
export const BERICHTEN = ["synchroon", "asynchroon", "retour"];

/**
 * Koppen van een levenslijn (zie shapes.jsx). Geen keuze = de weergave van het
 * type (instantie van, bv. een ArchiMate-element), anders de rechthoek;
 * "object" dwingt de rechthoek met naam:Type af.
 */
export const KOPPEN = [
  { waarde: "object", label: "object (rechthoek)" },
  { waarde: "actor", label: "actor" },
  { waarde: "boundary", label: "boundary" },
  { waarde: "control", label: "control" },
  { waarde: "entity", label: "entity" },
  // Business-varianten (Eriksson-Penker; EA "business boundary" enz.): het
  // robustness-icoon met een schuine streep.
  { waarde: "business-boundary", label: "business boundary" },
  { waarde: "business-control", label: "business control" },
  { waarde: "business-entity", label: "business entity" },
];

/**
 * Label van een bericht (UML 2.5.1 §17.4.4): `[guard] naam(argumenten): retour`;
 * een naamloos bericht krijgt geen label.
 * Is er een operatie gekozen, dan is díe de naam (eigen label); anders komen
 * guard en retourwaarde om de (inline bewerkbare) naam heen.
 */
export function berichtLabels(conn) {
  const d = conn?.data || {};
  const guard = String(d.guard || "").trim();
  const retour = String(d.retourtype || "").trim();
  const metRetour = retour && retour.toLowerCase() !== "void";
  const voor = guard ? [{ tekst: `[${guard.replace(/^\[|\]$/g, "")}] `, soort: "constraint" }] : [];
  const op = d.operatie;
  if (op?.naam) {
    const args = d.argumenten;
    // Signaturen ("doe(x): y") niet dubbel van haakjes of retour voorzien.
    const sig = op.naam.includes("(") ? op.naam : `${op.naam}(${args || ""})`;
    const na = metRetour && !/\)\s*:/.test(sig) ? `: ${retour}` : "";
    return { kaal: [{ zijde: "midden", delen: [...voor, { tekst: sig + na, soort: "naam" }] }] };
  }
  // Een benoemd bericht is altijd een aanroep: naam(argumenten), ook leeg
  // "()" — zoals EA het toont. Staan de haakjes al in de naam, dan niet dubbel.
  const naam = String(conn?.naam || "");
  let staart = "";
  if (naam && !naam.includes("(")) staart += `(${String(d.argumenten || "").trim()})`;
  if (metRetour && !/\)\s*:/.test(naam)) staart += `: ${retour}`;
  const na = staart ? [{ tekst: staart, soort: "staart" }] : [];
  return voor.length || na.length ? { rondNaam: { voor, na } } : {};
}
