// @ts-check
/**
 * erd — Entity-Relationship-diagram met **kraaienpoten** (Information
 * Engineering-notatie) op de generieke diagram-motor.
 *
 * Uit de notatie-verkenning (`docs/plans/2026-07-17 ArchiMate en verdere
 * notaties (plan).md` §4) kwam dit eruit als de goedkoopste notatie die nog
 * ontbrak: entiteiten zijn gewoon class-boxen, dus al het werk zit in de
 * **lijn**. Precies twee dingen waren nieuw in de motor:
 *
 *   1. **vier markers** — de kraaienpoot-combinaties ‖ / ○| / |< / ○<
 *      (`kraai-een`, `kraai-nul-of-een`, `kraai-een-of-meer`,
 *      `kraai-nul-of-meer`), en
 *   2. **markers aan de bronzijde**: tot nu toe kon daar alleen een ruit
 *      staan (compositie/aggregatie). De kraaienpoot moet aan *beide*
 *      uiteinden kunnen — dat is de kern van ERD-notatie.
 *
 * Verder is dit een zuiver declaratief profiel: geen eigen shapes.
 *
 *   - **entiteit** — class-box met twee compartimenten: de **sleutel** boven
 *     de scheidingslijn (PK), de overige **kolommen** eronder. Dat is precies
 *     de klassieke ERD-doos, gratis via het bestaande compartiment-mechanisme.
 *   - **relatie** — de kraaienpootlijn. Kardinaliteit staat *per uiteinde* in
 *     `data` (`bronKardinaliteit` / `doelKardinaliteit`) en wordt via
 *     `hooks.edgePresentatie` naar de markers vertaald; `soort` maakt de lijn
 *     gestreept voor een niet-identificerende relatie.
 *   - **subtype** — supertype/subtype-hiërarchie (open driehoek), voor de
 *     ERD's die daar generalisatie in tekenen.
 *   - **domein** — container om entiteiten te groeperen (schema, bounded
 *     context), zoals het systeemkader in het use case-profiel.
 *
 * Bewust nog niet: Chen-notatie (ruiten en ovalen — een andere vormentaal),
 * afleiding uit het canoniek model (kandidaat: adapter zoals `mim12/`), en
 * DDL-import/-export.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";

export const ERD_ID = "erd";

const KLEUR_VELD = { key: "kleur", datatype: "colour" };

/**
 * Kardinaliteit per uiteinde. De waarden zijn de marker-namen zonder het
 * `kraai-`-voorvoegsel, zodat de vertaling naar de presentatie triviaal is.
 */
export const KARDINALITEIT_OPTIES = [
  { waarde: "een", label: "precies één  ‖" },
  { waarde: "nul-of-een", label: "nul of één  ○|" },
  { waarde: "een-of-meer", label: "één of meer  |<" },
  { waarde: "nul-of-meer", label: "nul of meer  ○<" },
];

const SOORT_OPTIES = [
  { waarde: "", label: "(niet aangegeven)" },
  { waarde: "identificerend", label: "identificerend" },
  { waarde: "niet-identificerend", label: "niet-identificerend (gestreept)" },
];

/**
 * `data.<sleutel>` → markernaam. Een onbekende of lege waarde levert géén
 * marker op: een half ingevulde relatie tekent dan gewoon een kale lijn in
 * plaats van een verkeerde kardinaliteit te suggereren.
 */
export function kardinaliteitMarker(waarde) {
  return KARDINALITEIT_OPTIES.some((o) => o.waarde === waarde) ? `kraai-${waarde}` : null;
}

/** @type {import("../../diagramcore/types/schema.js").FieldType[]} */
const fieldTypes = [
  {
    id: "kolom",
    viewer: "naam-type",
    properties: [
      { key: "naam", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "datatype", datatype: "string" },
      // `verplicht` zet de naam vet — de conventie van VeldRegel; hier lezen
      // we dat als NOT NULL.
      { key: "verplicht", label: "verplicht (NOT NULL)", datatype: "boolean" },
    ],
  },
];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  {
    id: "entiteit",
    label: "Entiteit",
    omschrijving: "Een ding waarover je gegevens vastlegt; de sleutel staat boven de streep.",
    kort: "ENT",
    shape: "class-box",
    kleur: "#fef9c3",
    properties: [KLEUR_VELD],
    compartments: [
      { id: "sleutel", label: null, fieldType: "kolom" },
      { id: "kolommen", label: null, fieldType: "kolom" },
    ],
  },
  {
    id: "domein",
    label: "Domein",
    omschrijving: "Groepeert entiteiten (schema, deelmodel); sleep ze erin.",
    kort: "DOM",
    shape: "boundary",
    containerVoor: "bevat",
    achtergrond: true,
    properties: [KLEUR_VELD],
  },
  {
    id: "notitie",
    label: "Notitie",
    omschrijving: "Vrije notitie op het diagram.",
    kort: "NOT",
    shape: "note",
    handleStijl: "onzichtbaar",
    properties: [{ key: "tekst", datatype: "tekst" }, KLEUR_VELD],
  },

  // ── Connectoren ────────────────────────────────────────────────────────
  {
    id: "relatie",
    label: "Relatie",
    omschrijving: "Kraaienpootlijn; zet de kardinaliteit per uiteinde in de inspector.",
    kort: "|<",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["entiteit"] },
    doel: { elementTypes: ["entiteit"] },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569" },
    properties: [
      { key: "bronKardinaliteit", label: "bij bron", datatype: "keuze", opties: KARDINALITEIT_OPTIES },
      { key: "doelKardinaliteit", label: "bij doel", datatype: "keuze", opties: KARDINALITEIT_OPTIES },
      { key: "soort", label: "soort", datatype: "keuze", opties: SOORT_OPTIES },
      { key: "bronRol", label: "rol bij bron", datatype: "string" },
      { key: "doelRol", label: "rol bij doel", datatype: "string" },
    ],
    hooks: {
      edgePresentatie: (conn) => {
        const d = conn.data || {};
        const uit = {};
        const bron = kardinaliteitMarker(d.bronKardinaliteit);
        const doel = kardinaliteitMarker(d.doelKardinaliteit);
        if (bron) uit.markerStart = bron;
        if (doel) uit.markerEnd = doel;
        // Niet-identificerend = gestreept (IE-conventie). "identificerend" en
        // "(niet aangegeven)" tekenen allebei doorgetrokken.
        if (d.soort === "niet-identificerend") uit.lijn = "dash-6-3";
        return uit;
      },
      // Rolnamen aan de uiteinden. `kaal` is wat een connector zónder velden
      // gebruikt (dat is hier altijd het geval); `bron`/`doel` vullen we mee
      // voor het geval de connector ooit gematerialiseerd wordt.
      edgeLabels: (conn) => {
        const d = conn.data || {};
        const bron = [];
        const doel = [];
        const kaal = [];
        if (d.bronRol) {
          const label = { zijde: "bron", delen: [{ tekst: d.bronRol, soort: "rolnaam" }] };
          bron.push(label);
          kaal.push(label);
        }
        if (d.doelRol) {
          const label = { zijde: "doel", delen: [{ tekst: d.doelRol, soort: "rolnaam" }] };
          doel.push(label);
          kaal.push(label);
        }
        return { bron, doel, kaal };
      },
    },
  },
  {
    id: "subtype",
    label: "Subtype",
    omschrijving: "Het subtype erft de sleutel en kolommen van het supertype (bron = subtype).",
    kort: "▷",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["entiteit"] },
    doel: { elementTypes: ["entiteit"] },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569", markerEnd: "driehoek" },
  },
  {
    id: "bevat",
    label: "Bevat (domein)",
    omschrijving: "Lidmaatschap van een domein; verborgen zolang het lid erin ligt.",
    kort: "DOM ∋",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["domein"] },
    doel: { elementTypes: ["entiteit", "domein", "notitie"] },
    edgePresentatie: { lijn: "dash-4-3", vorm: "hoekig", kleur: "#cbd5e1", verbergBijNesting: true },
  },
];

export const erdDiagramType = {
  id: ERD_ID,
  label: "ERD",
  style: "uml-klassiek",
  // Connectoren hechten aan de omtrek i.p.v. aan vier handles: dozen
  // dragen vaak veel lijnen, en die moeten kunnen uitwaaieren.
  randAanhechting: "zwevend",
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
  const element = {
    id: `erd_${Date.now()}_${_teller}`,
    naam: et.label,
    elementType: et.id,
    compartimenten: [],
    data: {},
  };
  if (et.id === "notitie") {
    element.naam = "";
    element.data.tekst = "";
  }
  return element;
}

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerErd() {
  if (!getDiagramType(ERD_ID)) {
    registreerDiagramType(erdDiagramType);
  }
}
