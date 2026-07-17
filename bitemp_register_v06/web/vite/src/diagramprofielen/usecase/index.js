// @ts-check
/**
 * usecase — een UML use case-profiel op de generieke diagram-motor
 * (sessie 2026-07-17). Structureel het kleinste gedragsdiagram: in essentie
 * "een class-diagram met andere symbolen" — actoren, use cases en een
 * systeemkader, verbonden met associaties, «include»/«extend» en
 * generalisatie. Geen nieuwe motor-primitieven nodig:
 *
 *   - **actor** / **use case** — eigen shapes (strekfiguur, ellips);
 *   - **systeemkader** — container (containerVoor "bevat", zoals packages):
 *     use cases erin slepen legt het lidmaatschap;
 *   - **include/extend** — gestippelde pijl met een vast «stereotype»-label
 *     via de edgeLabels-hook;
 *   - **generalisatie** — dichte driehoekspunt (actor→actor, uc→uc).
 *
 * De verbindingsregels dragen de basisvalidatie: een associatie loopt
 * tussen actor en use case, include/extend alleen tussen use cases,
 * generalisatie alleen binnen dezelfde soort.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { registreerGedragTypeIconen } from "../gedragTypeIconen.jsx";
import { registreerUseCaseShapes } from "./shapes.jsx";

export const USECASE_ID = "usecase";

const KLEUR_VELD = { key: "kleur", datatype: "colour" };

/** Vast stereotype-label («include»/«extend») midden op de lijn. */
const stereotypeLabel = (tekst) => ({
  edgeLabels: () => ({ kaal: [{ zijde: "midden", delen: [{ tekst, soort: "constraint" }] }] }),
});

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  {
    id: "actor",
    label: "Actor",
    omschrijving: "Rol buiten het systeem die ermee interacteert.",
    kort: "Actor",
    icoon: "uc-actor",
    shape: "uc-actor",
    resizebaar: false,
    properties: [],
  },
  {
    id: "usecase",
    label: "Use case",
    omschrijving: "Samenhangend stuk functionaliteit met waarde voor een actor.",
    kort: "UC",
    icoon: "uc-usecase",
    shape: "uc-ellips",
    kleur: "#e0f2fe",
    properties: [KLEUR_VELD],
  },
  {
    id: "systeem",
    label: "Systeemkader",
    omschrijving: "Systeemgrens: sleep de use cases van dit systeem erin.",
    kort: "Systeem",
    icoon: "uc-systeem",
    shape: "uc-systeem",
    // Container zoals een package: use cases erin slepen legt "bevat".
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
    id: "associatie",
    label: "Associatie",
    omschrijving: "De actor neemt deel aan de use case.",
    kort: "—",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["actor", "usecase"] },
    doel: { elementTypes: ["actor", "usecase"] },
    edgePresentatie: { lijn: "solid", vorm: "recht", kleur: "#475569" },
  },
  {
    id: "include",
    label: "Include",
    omschrijving: "De basis-use case omvat de geïncludeerde altijd.",
    kort: "«i»",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["usecase"] },
    doel: { elementTypes: ["usecase"] },
    edgePresentatie: { lijn: "dash-4-3", vorm: "recht", kleur: "#475569", markerEnd: "pijl-open" },
    hooks: stereotypeLabel("«include»"),
  },
  {
    id: "extend",
    label: "Extend",
    omschrijving: "Optionele uitbreiding die invoegt op de basis-use case.",
    kort: "«e»",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["usecase"] },
    doel: { elementTypes: ["usecase"] },
    edgePresentatie: { lijn: "dash-4-3", vorm: "recht", kleur: "#475569", markerEnd: "pijl-open" },
    hooks: stereotypeLabel("«extend»"),
  },
  {
    id: "generalisatie",
    label: "Generalisatie",
    omschrijving: "Specialisatie tussen actoren of tussen use cases.",
    kort: "▷",
    shape: "edge",
    isConnector: true,
    // Binnen dezelfde soort: actor→actor en usecase→usecase.
    verbindingsregels: [
      { bron: { elementTypes: ["actor"] }, doel: { elementTypes: ["actor"] } },
      { bron: { elementTypes: ["usecase"] }, doel: { elementTypes: ["usecase"] } },
    ],
    edgePresentatie: { lijn: "solid", vorm: "recht", kleur: "#475569", markerEnd: "driehoek" },
  },
  {
    // Lidmaatschap van het systeemkader — subtiel; het kind ligt er visueel al in.
    id: "bevat",
    label: "Bevat (systeem)",
    omschrijving: "Lidmaatschap van het systeemkader; verborgen zolang het lid erin ligt.",
    kort: "SYS ∋",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["systeem"] },
    doel: { elementTypes: ["usecase", "notitie"] },
    edgePresentatie: { lijn: "dash-4-3", vorm: "hoekig", kleur: "#cbd5e1", verbergBijNesting: true },
  },
];

export const usecaseDiagramType = {
  id: USECASE_ID,
  label: "Use case",
  style: "uml-klassiek",
  fieldTypes: [],
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
    id: `uc_${Date.now()}_${_teller}`,
    naam: et.id === "notitie" ? "" : et.label,
    elementType: et.id,
    compartimenten: [],
    data: {},
  };
  if (et.id === "notitie") element.data.tekst = "";
  return element;
}

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerUseCase() {
  registreerGedragTypeIconen();
  registreerUseCaseShapes();
  if (!getDiagramType(USECASE_ID)) {
    registreerDiagramType(usecaseDiagramType);
  }
}
