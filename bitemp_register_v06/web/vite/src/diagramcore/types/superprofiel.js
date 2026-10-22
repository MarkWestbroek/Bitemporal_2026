// @ts-check
/**
 * superprofiel — M3-ingebouwde elementtypen die elk profiel erft (2026-10-20,
 * Mark; ontwerp docs/plans/2026-10-20 Notities, constraints en doorklikken —
 * het superprofiel). Zoals elk profiel er impliciet van overerft:
 *
 *   - **notitie** (model; UML Comment, EA Note): alleen tekst;
 *   - **constraint** (model; UML Constraint): specificatie tussen `{…}` in een
 *     taal (natuurlijk, OCL, CEL); lichtblauw ezelsoor;
 *   - **notitielijn** (model; Comment.annotatedElement /
 *     Constraint.constrainedElement, EA NoteLink): van notitie of constraint
 *     naar élk element van het profiel — label "Annotatie-lijn";
 *   - **diagramverwijzing** (model; Archi view reference): een object dat naar
 *     een ander diagram wijst (`data.verwijstNaar`). Een gewoon modelelement
 *     (Mark, 20-10: eenvoud), dus in de boom en op meer diagrammen te zetten.
 *
 * Regels (besluiten Mark 20-10):
 *  - **Altijd geërfd.** Een type wordt nooit weggehaald (zoals in MOF een
 *    subklasse geen geërfde eigenschap weghaalt). Een profiel mag het alleen
 *    uit het palet halen: `DiagramType.superprofiel = {constraint: {inPalet: false}}`.
 *  - **notitie, notitielijn en diagramverwijzing zijn puur M3**: de
 *    superprofielversie wint van een eigen definitie in het profiel (die
 *    beperkte de doelen van de lijn per profiel).
 *  - **constraint mag een profiel specialiseren**: heeft het profiel zelf een
 *    type `constraint` (ArchiMate: het motivatie-element; MIM: specificatie;
 *    canoniek: expressie), dan blijft dat staan.
 *  - De lijn naar een *relatie* (aan een plek 0..1 langs de lijn) is motorwerk
 *    en volgt; nu wijst hij naar elke knoop.
 *
 * In place en idempotent, zoals normaliseerErfenis; draait bij registratie en
 * (op een kopie) bij validatie. Puur.
 */

/** Waar de superprofieltypen staan in de Maken-balk. */
const GROEP = "annotatie";

/** @returns {any[]} de vier typen, vers (de lijn krijgt zijn doelen per profiel) */
export function superprofielTypen() {
  return [
    {
      id: "notitie",
      label: "Notitie",
      omschrijving: "Opmerking van de modelleur, in het model (UML Comment). Koppel hem met een annotatie-lijn aan wat hij toelicht.",
      kort: "NOT",
      shape: "note",
      taakbalkGroep: GROEP,
      minBreedte: 100,
      minHoogte: 44,
      verwijstNaar: false,
      _superprofiel: true,
      properties: [{ key: "tekst", datatype: "tekst" }, { key: "kleur", datatype: "colour" }],
    },
    {
      id: "constraint",
      label: "Constraint",
      omschrijving: "Regel die het standaardarsenaal niet kan uitdrukken (UML Constraint), tussen {…}; koppel hem met annotatie-lijnen aan wat hij beperkt (bv. {xor} tussen twee relaties).",
      kort: "{ }",
      shape: "constraint",
      taakbalkGroep: GROEP,
      minBreedte: 100,
      minHoogte: 44,
      verwijstNaar: false,
      _superprofiel: true,
      properties: [
        { key: "specificatie", label: "specificatie", datatype: "tekst" },
        {
          key: "taal",
          label: "taal",
          datatype: "keuze",
          opties: [
            { waarde: "", label: "natuurlijke taal" },
            { waarde: "OCL", label: "OCL" },
            { waarde: "CEL", label: "CEL (wat het register evalueert)" },
          ],
        },
        { key: "kleur", datatype: "colour" },
      ],
    },
    {
      id: "notitielijn",
      aard: "annotatie",
      label: "Annotatie-lijn",
      omschrijving: "Van een notitie of constraint naar het element waar hij over gaat (UML annotatedElement / constrainedElement).",
      kort: "annot",
      shape: "edge",
      icoon: "notitie",
      isConnector: true,
      taakbalkGroep: GROEP,
      beschrijving: false,
      _superprofiel: true,
      bron: { elementTypes: ["notitie", "constraint"] },
      doel: { elementTypes: [] }, // per profiel: alle knopen (vulSuperprofielAan)
      edgePresentatie: { lijn: "dash-4-4", vorm: "recht", kleur: "#94a3b8" },
    },
    {
      id: "diagramverwijzing",
      label: "Diagramverwijzing",
      omschrijving: "Verwijst naar een ander diagram (ook in een andere taal); dubbelklik opent het.",
      kort: "⧉",
      shape: "diagramverwijzing",
      taakbalkGroep: GROEP,
      beschrijving: false,
      minBreedte: 120,
      minHoogte: 44,
      _superprofiel: true,
      properties: [],
    },
  ];
}

/** Ids van de superprofieltypen. */
export const SUPERPROFIEL_IDS = ["notitie", "constraint", "notitielijn", "diagramverwijzing"];

/** Puur-M3-typen: de superprofielversie wint van een eigen definitie. */
const ALTIJD_SUPERPROFIEL = new Set(["notitie", "notitielijn", "diagramverwijzing"]);

/**
 * Voeg het superprofiel toe aan een (uitgevlakt) DiagramType — in place,
 * idempotent. Geeft de foutmeldingen (onbekende sleutel in `superprofiel`).
 * @param {any} dt
 * @returns {string[]}
 */
export function vulSuperprofielAan(dt) {
  // Een leeg profiel blijft leeg (de validatie meldt dat); het superprofiel vult geen gat.
  if (!dt || !Array.isArray(dt.elementTypes) || !dt.elementTypes.length) return [];
  const fouten = [];
  const opties = dt.superprofiel || {};
  for (const [id, o] of Object.entries(opties)) {
    if (!SUPERPROFIEL_IDS.includes(id)) fouten.push(`DiagramType "${dt.id}": superprofiel kent geen type "${id}"`);
    for (const k of Object.keys(o || {})) if (k !== "inPalet") fouten.push(`DiagramType "${dt.id}": superprofiel.${id}.${k} — alleen inPalet mag (een type wordt altijd geërfd)`);
  }
  if (dt._superprofielToegevoegd) return fouten;
  const typen = superprofielTypen();
  const lijst = [...dt.elementTypes];
  for (const t of typen) {
    const i = lijst.findIndex((e) => e?.id === t.id);
    const palet = opties[t.id]?.inPalet === false ? { inPalet: false } : {};
    if (i < 0) lijst.push({ ...t, ...palet });
    else if (ALTIJD_SUPERPROFIEL.has(t.id)) lijst[i] = { ...t, ...palet };
    else if (palet.inPalet === false) lijst[i] = { ...lijst[i], inPalet: false };
  }
  // De lijn mag naar élke knoop (en, later, naar relaties).
  const knopen = lijst.filter((e) => e && !e.isConnector && !e.isAbstract).map((e) => e.id);
  const lijn = lijst.find((e) => e.id === "notitielijn");
  lijn.doel = { elementTypes: knopen };
  lijn.bron = { elementTypes: ["notitie", "constraint"].filter((id) => knopen.includes(id)) };
  dt.elementTypes = lijst;
  Object.defineProperty(dt, "_superprofielToegevoegd", { value: true, enumerable: false, configurable: true });
  return fouten;
}

/**
 * Migratie van hernoemde typen (M3, 2026-10-20): `DiagramType.hernoemdeTypen`
 * = {oudId: nieuwId} (ArchiMate: toelichting → notitielijn). Geeft null als
 * er niets te doen is.
 * @param {Record<string, any>} elements
 * @param {Record<string, string>|undefined} hernoemd
 */
export function migreerHernoemdeTypen(elements, hernoemd) {
  if (!elements || !hernoemd || !Object.keys(hernoemd).length) return null;
  let veranderd = false;
  const uit = {};
  for (const [id, el] of Object.entries(elements)) {
    const nieuw = el && hernoemd[el.elementType];
    if (nieuw) {
      uit[id] = { ...el, elementType: nieuw };
      veranderd = true;
    } else uit[id] = el;
  }
  return veranderd ? uit : null;
}

let _teller = 0;

/**
 * Nieuw element van een superprofieltype (terugval als de `maakElement` van een
 * profiel het type niet kent). Notitie en constraint krijgen lege tekst.
 * @param {string} elementTypeId
 * @returns {Record<string, any>|null}
 */
export function maakSuperprofielElement(elementTypeId) {
  if (!SUPERPROFIEL_IDS.includes(elementTypeId) || elementTypeId === "notitielijn") return null;
  _teller += 1;
  const data = elementTypeId === "notitie" ? { tekst: "" } : elementTypeId === "constraint" ? { specificatie: "" } : {};
  return { id: `sp_${Date.now()}_${_teller}`, naam: "", elementType: elementTypeId, compartimenten: [], data };
}
