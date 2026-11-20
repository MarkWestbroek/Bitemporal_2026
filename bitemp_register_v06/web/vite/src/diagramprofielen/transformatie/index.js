// @ts-check
/**
 * transformatie — het profiel (M2) waarin je een **regelset** schrijft (TRANS-1,
 * docs/TRANSFORMATIES.md §9.0 en §9.8).
 *
 * Besluit Mark 19-11: het metamodel van een transformatie is een M2, gewoon een profiel, en geen
 * deel van het M3. Het M3 beschrijft talen; dit ís een taal. Een concrete regelset (Mermaid →
 * use case) is een model in deze taal: hij werkt op een M1 of M0 en verwijst naar elementtypen
 * van andere profielen. Zo doet QVT het ook: het QVT-metamodel is een model in MOF, geen
 * onderdeel van MOF.
 *
 * Het profiel is optioneel: zonder dit profiel kun je niet transformeren, maar wel modelleren.
 * Daarom staat het naast de modelleerprofielen in het sidecar-project (PROF-1), en kan een
 * eenvoudige inrichting het weglaten.
 *
 *   - **transformatie** — de regelset. De regels staan in volgorde in het compartiment *regels*
 *     (volgorde = prioriteit: de eerste die past wint); wat een schrijver verder leest staat in
 *     *instellingen* (de stand van die schrijver).
 *   - **taal** — een profiel als bron of doel (bv. usecase). In het sidecar-project wordt dit een
 *     kruisverband naar dat profiel.
 *   - **formaat** — een extern formaat als bron of doel (Mermaid, BPMN-XML, Turtle), gelezen of
 *     geschreven door code die op naam wordt aangewezen.
 *   - **van** (taal of formaat → transformatie) en **naar** (transformatie → taal of formaat).
 *
 * Lezers, schrijvers en de toepasser blijven code. De omzetting van en naar het JSON-bestand
 * staat in `transformatie/regelsetModel.js`.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";

export const TRANSFORMATIE_PROFIEL_ID = "transformatie";

export const TRANSFORMATIE_TYPE = "transformatie";
export const TAAL_TYPE = "taal";
export const FORMAAT_TYPE = "formaat";
export const VAN_TYPE = "van";
export const NAAR_TYPE = "naar";
export const REGEL_VELDTYPE = "regel";
export const INSTELLING_VELDTYPE = "instelling";
export const COMP_REGELS = "regels";
export const COMP_INSTELLINGEN = "instellingen";

const KLEUR_VELD = { key: "kleur", datatype: "colour" };

/** @type {import("../../diagramcore/types/schema.js").FieldType[]} */
const fieldTypes = [
  {
    id: REGEL_VELDTYPE,
    viewer: "naam-type",
    properties: [
      { key: "naam", datatype: "string", verplicht: true },
      // Alleen weergave ("knoop → actor"); afgeleid uit bij en dan, telt niet mee bij het teruglezen.
      { key: "typeLabel", label: "samenvatting (afgeleid)", datatype: "string" },
      {
        key: "bij",
        label: "bij",
        datatype: "keuze",
        opties: [
          { waarde: "knoop", label: "knoop" },
          { waarde: "groep", label: "groep" },
          { waarde: "verbinding", label: "verbinding" },
        ],
      },
      { key: "als", label: "als: voorwaarden (JSON)", datatype: "tekst" },
      {
        key: "actie",
        label: "actie",
        datatype: "keuze",
        opties: [
          { waarde: "maak", label: "maak (een element of verbinding)" },
          { waarde: "zet", label: "zet (een eigenschap op een uiteinde)" },
          { waarde: "negeer", label: "negeer (bewust niets doen)" },
        ],
      },
      { key: "dan", label: "dan: wat de actie maakt of zet (JSON)", datatype: "tekst" },
      { key: "meld", label: "interpretatie melden", datatype: "boolean" },
      { key: "overig", label: "overige sleutels van de regel (JSON)", datatype: "tekst" },
    ],
  },
  {
    id: INSTELLING_VELDTYPE,
    viewer: "naam-type",
    properties: [
      { key: "naam", label: "sleutel", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "samenvatting (afgeleid)", datatype: "string" },
      { key: "waarde", label: "waarde (JSON)", datatype: "tekst" },
    ],
  },
];

const EINDPUNTEN = [TAAL_TYPE, FORMAAT_TYPE];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  {
    id: TRANSFORMATIE_TYPE,
    label: "Transformatie",
    omschrijving: "Een regelset: hoe een model in de ene taal of het ene formaat in het andere uitkomt. De regels staan in volgorde; de eerste die past wint.",
    kort: "TR",
    stereotype: "«transformatie»",
    shape: "class-box",
    kleur: "#fecdd3",
    properties: [
      { key: "code", label: "code (id van de regelset)", datatype: "string" },
      { key: "versie", label: "versie", datatype: "string" },
      { key: "versieIsGetal", label: "versie is een getal (1, 2, …) en geen tekst (0.8.1)", datatype: "boolean" },
      {
        key: "richting",
        label: "richting",
        datatype: "keuze",
        opties: [
          { waarde: "import", label: "import (extern formaat → model)" },
          { waarde: "export", label: "export (model → extern formaat)" },
          { waarde: "inrichting", label: "inrichting (model → artefact voor een component)" },
        ],
      },
      { key: "schrijver", label: "schrijver (de motor waarvan de instellingen de stand zijn)", datatype: "string" },
      KLEUR_VELD,
    ],
    compartments: [
      { id: COMP_REGELS, label: "regels", fieldType: REGEL_VELDTYPE },
      { id: COMP_INSTELLINGEN, label: "instellingen", fieldType: INSTELLING_VELDTYPE },
    ],
  },
  {
    id: TAAL_TYPE,
    label: "Taal",
    omschrijving: "Een profiel als bron of doel van een transformatie. De naam is het id van het profiel.",
    kort: "TAAL",
    stereotype: "«taal»",
    shape: "class-box",
    kleur: "#bae6fd",
    properties: [KLEUR_VELD],
  },
  {
    id: FORMAAT_TYPE,
    label: "Formaat",
    omschrijving: "Een extern formaat als bron of doel (Mermaid, XML, Turtle, JSON). Een lezer of schrijver in de code leest of schrijft het.",
    kort: "FMT",
    stereotype: "«formaat»",
    shape: "class-box",
    kleur: "#e2e8f0",
    properties: [KLEUR_VELD],
  },
  {
    id: VAN_TYPE,
    label: "Van (bron)",
    omschrijving: "De bron van een transformatie: een taal of een formaat.",
    kort: "van",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: EINDPUNTEN },
    doel: { elementTypes: [TRANSFORMATIE_TYPE] },
    edgePresentatie: { lijn: "solid", vorm: "recht", kleur: "#475569", markerEnd: "pijl-open" },
  },
  {
    id: NAAR_TYPE,
    label: "Naar (doel)",
    omschrijving: "Het doel van een transformatie: een taal of een formaat.",
    kort: "naar",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: [TRANSFORMATIE_TYPE] },
    doel: { elementTypes: EINDPUNTEN },
    edgePresentatie: { lijn: "solid", vorm: "recht", kleur: "#475569", markerEnd: "pijl-dicht" },
  },
];

export const transformatieDiagramType = {
  id: TRANSFORMATIE_PROFIEL_ID,
  label: "Transformatie",
  versie: "1.0.0",
  style: "uml-klassiek",
  fieldTypes,
  elementTypes,
  taakbalken: [
    { id: "maken", label: "Maken", acties: "elementTypes" },
    { id: "verbinding", label: "Verbinding", acties: "connectorTypes" },
  ],
  layouts: [],
};

let _teller = 0;

/** Nieuw (niet-connector-)element van het gegeven type. */
export function maakElement(elementTypeId) {
  const et = elementTypes.find((t) => t.id === elementTypeId);
  if (!et || et.isConnector) return null;
  _teller += 1;
  return {
    id: `tr_${Date.now()}_${_teller}`,
    naam: et.label,
    elementType: et.id,
    compartimenten: (et.compartments || []).map((c) => ({ compartmentType: c.id, velden: [] })),
    data: {},
  };
}

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerTransformatieProfiel() {
  if (!getDiagramType(TRANSFORMATIE_PROFIEL_ID)) registreerDiagramType(transformatieDiagramType);
}
