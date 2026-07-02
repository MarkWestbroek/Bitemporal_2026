// @ts-check
/**
 * canoniek-uml — het eerste diagramprofiel: het canonieke datamodel
 * (Entiteit, GE, REL, enumeraties, …) als DiagramType-configuratie.
 *
 * Fase 1 (read-only spiegel): de element-typen beschrijven wat de adapter
 * (adapter.js) uit de bestaande useModelStore afbeeldt. Let op: `relatie` en
 * `associatieAnker` staan hier nog als gewone (node-)elementen, omdat de
 * opgeslagen diagrammen de gematerialiseerde ASOC-vorm bevatten. Bij de
 * connector-materialisatie in fase 3 wordt `relatie` een echt
 * `isConnector`-type en verdwijnt het anker als apart elementtype.
 *
 * Kleuren komen overeen met defaultKleur() in umleditor/metamodel/types.js.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";

export const CANONIEK_UML_ID = "canoniek-uml";

/** @type {import("../../diagramcore/types/schema.js").FieldType[]} */
const fieldTypes = [
  { id: "attribuut", render: "naam-type" },
  { id: "afgeleidVeld", render: "naam-type" },
  { id: "waarde", render: "waarde" },
  { id: "eigenschap", render: "naam-type" },
  { id: "regel", render: "tekst" },
];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  {
    id: "entiteit",
    label: "Entiteit",
    stereotype: "«entiteit»",
    shape: "class-box",
    kleur: "#bfdbfe",
    compartments: [
      { id: "velden", label: null, fieldType: "attribuut" },
      { id: "afgeleid", label: null, fieldType: "afgeleidVeld" },
      { id: "overerving", label: null, fieldType: "attribuut" },
    ],
  },
  {
    id: "gegevenselement",
    label: "Gegevenselement",
    stereotype: "«gegevenselement»",
    shape: "class-box",
    kleur: "#bbf7d0",
    compartments: [
      { id: "velden", label: null, fieldType: "attribuut" },
      { id: "afgeleid", label: null, fieldType: "afgeleidVeld" },
    ],
  },
  {
    id: "relatie",
    label: "Relatie",
    stereotype: "«relatie»",
    shape: "class-box",
    kleur: "#ede9fe",
    compartments: [
      { id: "velden", label: null, fieldType: "attribuut" },
      { id: "afgeleid", label: null, fieldType: "afgeleidVeld" },
    ],
  },
  {
    id: "associatieAnker",
    label: "Associatie-anker",
    shape: "anker",
    handleStijl: "onzichtbaar",
  },
  {
    id: "enumeratie",
    label: "Enumeratie",
    stereotype: "«enumeratie»",
    shape: "class-box",
    kleur: "#fef3c7",
    compartments: [{ id: "waarden", label: null, fieldType: "waarde" }],
  },
  {
    id: "gegevenstype",
    label: "Gegevenstype",
    stereotype: "«gegevenstype»",
    shape: "class-box",
    kleur: "#dbeafe",
    compartments: [
      { id: "eigenschappen", label: null, fieldType: "eigenschap" },
      { id: "validatie", label: null, fieldType: "regel" },
      { id: "weergave", label: null, fieldType: "regel" },
    ],
  },
  {
    id: "referentielijstInstantie",
    label: "Referentielijst-instantie",
    stereotype: "«instantie»",
    shape: "class-box",
    kleur: "#fde68a",
    compartments: [{ id: "eigenschappen", label: null, fieldType: "eigenschap" }],
  },
  {
    id: "notitie",
    label: "Notitie",
    shape: "note",
    handleStijl: "onzichtbaar",
  },
  {
    id: "constraint",
    label: "Constraint",
    stereotype: "«constraint»",
    shape: "rounded",
    kleur: "#e0f2fe",
    handleStijl: "onzichtbaar",
  },
];

/** @type {import("../../diagramcore/types/schema.js").DiagramType} */
export const canoniekUmlDiagramType = {
  id: CANONIEK_UML_ID,
  label: "Canoniek datamodel",
  style: "uml-klassiek",
  elementTypes,
  fieldTypes,
};

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerCanoniekUml() {
  if (!getDiagramType(CANONIEK_UML_ID)) {
    registreerDiagramType(canoniekUmlDiagramType);
  }
  return canoniekUmlDiagramType;
}
