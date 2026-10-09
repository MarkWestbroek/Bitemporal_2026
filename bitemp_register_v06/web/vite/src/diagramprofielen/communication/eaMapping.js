// @ts-check
/**
 * eaMapping — Sparx EA → communication-profiel. EA noemt het diagram nog
 * "Collaboration" (Diagram_Type). Deelnemers zijn Object_Type "Object"
 * (soms "Sequence", zoals op sequence-diagrammen); elk bericht is in EA een
 * eigen connector (Connector_Type "Sequence"/"Collaboration") met `SeqNo`
 * en `Name`; de lezer vouwt alle berichten tussen hetzelfde paar samen tot
 * één `link` met berichtregels (naam = SeqNo, typeLabel = "→ Name" of
 * "← Name" naar de richting t.o.v. de link). Puur data; id's zijn een
 * contract (EA-GUID → id — voor de link: de GUID van het eerste bericht).
 */

export const EA_DIAGRAM_TYPES = ["Collaboration", "Communication"];

/** @type {{objectType: string, stereotype?: string, elementType: string, opmerking?: string}[]} */
export const OBJECTEN = [
  { objectType: "Object", elementType: "object", opmerking: "Classifier → klassifierLabel" },
  { objectType: "Sequence", elementType: "object" },
  { objectType: "Actor", elementType: "actor" },
  { objectType: "Class", elementType: "object", opmerking: "klasse als rol; naam → klassifierLabel" },
  { objectType: "Note", elementType: "notitie" },
  { objectType: "Text", elementType: "notitie" },
  { objectType: "Boundary", elementType: "boundary" },
];

/** @type {{connectorType: string, stereotype?: string, elementType: string, opmerking?: string}[]} */
export const CONNECTOREN = [
  { connectorType: "Sequence", elementType: "link", opmerking: "één connector per bericht → samenvouwen per paar; SeqNo → naam, Name → typeLabel" },
  { connectorType: "Collaboration", elementType: "link" },
  { connectorType: "Association", elementType: "link", opmerking: "kale link zonder berichten" },
  { connectorType: "NoteLink", elementType: "notitielijn" },
];

export const RAND_ELEMENTEN = [];
export const CONTAINERS = [];

/**
 * Vouw EA-berichten tussen hetzelfde (ongeordende) paar samen tot links.
 * @param {{id: string, source: string, target: string, seqNo?: string|number, naam?: string, soort?: string}[]} berichten
 * @returns {{id: string, source: string, target: string, berichten: {naam: string, typeLabel: string, soort?: string}[]}[]}
 */
export function vouwBerichtenTotLinks(berichten) {
  const perPaar = new Map();
  for (const b of berichten) {
    const sleutel = [b.source, b.target].sort().join("|");
    if (!perPaar.has(sleutel)) perPaar.set(sleutel, { id: b.id, source: b.source, target: b.target, berichten: [] });
    const link = perPaar.get(sleutel);
    const heen = b.source === link.source;
    link.berichten.push({
      naam: String(b.seqNo ?? link.berichten.length + 1),
      typeLabel: `${heen ? "→" : "←"} ${b.naam || ""}`.trim(),
      ...(b.soort ? { soort: b.soort } : {}),
    });
  }
  const volg = (s) => String(s).split(".").map((n) => Number(n) || 0);
  for (const link of perPaar.values()) {
    link.berichten.sort((a, b) => {
      const x = volg(a.naam);
      const y = volg(b.naam);
      for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
        const d = (x[i] || 0) - (y[i] || 0);
        if (d) return d;
      }
      return 0;
    });
  }
  return [...perPaar.values()];
}
