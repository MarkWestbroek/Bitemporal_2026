// @ts-check
/**
 * uml2Basis — gedeelde declaratieve bouwstenen voor de "EA-aanvulling"-
 * profielen (component & deployment, object, requirements, business/EP, XSD,
 * WSDL, composite structure, communication). Puur data + kleine helpers, geen
 * React: de descriptors blijven zo in `node --test` laadbaar.
 *
 * Wat elk van die profielen gemeen heeft, staat hier één keer:
 *   - de standaardvelden (toelichting, kleur);
 *   - notitie + notitie-lijn (EA tekent overal Notes; opdracht Mark 10-10);
 *   - het informele kader (boundary);
 *   - het vaste «stereotype»-label midden op een lijn.
 *
 * Elementtype-id's zijn een **contract** met de EA-lezer (die mapt op
 * EA-GUID en op deze id's): nooit meer wijzigen, hooguit toevoegen.
 */

/** Vrije beschrijving van het element zelf (UML: documentatie/ownedComment). */
export const TOELICHTING_VELD = { key: "toelichting", label: "Toelichting", datatype: "tekst" };
export const KLEUR_VELD = { key: "kleur", datatype: "colour" };

/**
 * Vast «stereotype»-label midden op de lijn (edgeLabels-hook). Met
 * `uitData` toont de lijn het stereotype uit `data.stereotype` (de EA-lezer
 * zet dat) en valt anders terug op het vaste label.
 * @param {string} tekst
 * @param {{uitData?: boolean}} [opties]
 */
export function stereotypeLabel(tekst, { uitData = false } = {}) {
  return {
    edgeLabels: (conn) => {
      const eigen = uitData && conn?.data?.stereotype ? `«${conn.data.stereotype}»` : tekst;
      if (!eigen) return {};
      return { kaal: [{ zijde: "midden", delen: [{ tekst: eigen, soort: "constraint" }] }] };
    },
  };
}

/** Label uit `data.stereotype` (als dat er is), anders niets. */
export const stereotypeUitData = stereotypeLabel("", { uitData: true });

/** Notitie-element (gelijk in alle profielen). */
export const NOTITIE = {
  id: "notitie",
  label: "Notitie",
  omschrijving: "Vrije notitie op het diagram.",
  kort: "NOT",
  icoon: "notitie",
  shape: "note",
  handleStijl: "onzichtbaar",
  properties: [{ key: "tekst", datatype: "tekst" }, KLEUR_VELD],
};

/** Informeel kader: groepeert visueel, geen lidmaatschap. */
export const BOUNDARY = {
  id: "boundary",
  label: "Kader",
  omschrijving: "Informeel kader: groepeert visueel, zonder betekenis in het model.",
  kort: "KADER",
  shape: "boundary",
  icoon: "kader",
  achtergrond: true,
  sleeptInhoudMee: true,
  minBreedte: 140,
  minHoogte: 90,
  handleStijl: "onzichtbaar",
  properties: [
    { key: "kleur", label: "rand", datatype: "colour" },
    { key: "achtergrondKleur", label: "achtergrond", datatype: "colour" },
  ],
};

/**
 * Notitie-lijn (UML note attachment, EA NoteLink) naar de gegeven doeltypen.
 * @param {string[]} doelen
 */
export function notitielijn(doelen) {
  return {
    id: "notitielijn",
    label: "Notitie-lijn",
    omschrijving: "Koppelt een notitie aan het element waar hij over gaat; geen modelrelatie.",
    kort: "not",
    shape: "edge",
    icoon: "notitie",
    isConnector: true,
    bron: { elementTypes: ["notitie"] },
    doel: { elementTypes: doelen },
    edgePresentatie: { lijn: "dash-4-4", vorm: "recht", kleur: "#94a3b8" },
  };
}

/**
 * Package-achtige container: `bevat`-connector (subtiel getekend, meestal
 * alleen een model-feit voor de boomordening).
 * @param {string[]} bronnen - containertypen
 * @param {string[]} doelen - wat erin mag
 * @param {string} [label]
 */
export function bevat(bronnen, doelen, label = "Bevat") {
  return {
    id: "bevat",
    label,
    omschrijving: "Lidmaatschap van een container; verborgen zolang het lid erin ligt.",
    kort: "∋",
    shape: "edge",
    icoon: "bevat",
    isConnector: true,
    bron: { elementTypes: bronnen },
    doel: { elementTypes: doelen },
    edgePresentatie: { lijn: "dash-4-3", vorm: "hoekig", kleur: "#cbd5e1", verbergBijNesting: true },
  };
}

/** Standaard UML-package (container). */
export function pakket(extra = {}) {
  return {
    id: "package",
    label: "Package",
    omschrijving: "Groepeert elementen; erin slepen legt het lidmaatschap.",
    kort: "PKG",
    stereotype: "«package»",
    shape: "package",
    kleur: "#f1f5f9",
    icoon: "package",
    containerVoor: "bevat",
    standaardDichtInBoom: true,
    properties: [TOELICHTING_VELD, KLEUR_VELD],
    ...extra,
  };
}

/** Generieke, idempotente element-fabriek: `prefix_<ts>_<n>`. */
export function maakElementFabriek(elementTypes, prefix) {
  let teller = 0;
  return (elementTypeId) => {
    const et = elementTypes.find((t) => t.id === elementTypeId);
    if (!et || et.isConnector || et.isAbstract) return null;
    teller += 1;
    const element = {
      id: `${prefix}_${Date.now()}_${teller}`,
      naam: et.id === "notitie" ? "" : et.label,
      elementType: et.id,
      compartimenten: [],
      data: {},
    };
    if (et.id === "notitie") element.data.tekst = "";
    return element;
  };
}

/** Alle concrete, niet-connector-typen van een lijst (voor doel-lijsten). */
export function knopen(elementTypes) {
  return elementTypes.filter((t) => !t.isConnector && !t.isAbstract).map((t) => t.id);
}
