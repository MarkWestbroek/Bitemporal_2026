// @ts-check
/**
 * genereer — de metamodellen als tekst (JSON), gedeeld door het script
 * `scripts/genereer-metamodellen.mjs` en de test `metamodellen.test.js` (die eist dat de bestanden
 * in docs/metamodel/ gelijk zijn aan wat dit nu maakt). Meet de dozen met de tekenaar.
 */
import { puurUmlDiagramType } from "../../diagramprofielen/puur-uml/index.js";
import { planInhoud } from "../../diagramcore/tekenaar/inhoud.js";
import { vormVoor } from "../../diagramcore/tekenaar/vormen.js";
import { minMaatVan } from "../../diagramcore/types/shapeType.js";
import { versieVan } from "../../diagramcore/types/profielVersie.js";
import { metamodelWerkbestand } from "./metamodelWerkbestand.js";
import { m3Metamodel } from "./m3Metamodel.js";
import { PROJECT_PAKKETTEN, PROJECT_KLASSEN, PROJECT_ENUMERATIES } from "../projectMetamodel.js";

/** Bestandsnamen in docs/metamodel/, per sleutel. */
export const METAMODEL_BESTANDEN = {
  m3: "omnium-m3.studio-project.json",
  projectmetamodel: "omnium-projectmetamodel.studio-project.json",
};

/** Het projectmetamodel (studio/projectMetamodel.js) als Metamodel. */
export function projectMetamodel() {
  return {
    id: "omnium-projectmetamodel",
    naam: "Omnium projectmetamodel",
    uitleg:
      "De structuur van een Studio-project: het werkbestand (formaat studio-project) en, apart, de werkruimte per gebruiker. Alleen-lezen documentatie, gegenereerd uit studio/projectMetamodel.js (npm run metamodellen); de code is de implementatie.",
    pakketten: PROJECT_PAKKETTEN,
    klassen: PROJECT_KLASSEN,
    enumeraties: PROJECT_ENUMERATIES.map((e) => ({ ...e, uitleg: [e.uitleg, e.bron ? `Code: ${e.bron}.` : ""].filter(Boolean).join(" ") })),
  };
}

const perId = (lijst) => Object.fromEntries((lijst || []).map((t) => [t.id, t]));

/**
 * Maat van een doos zoals de tekenaar hem tekent, op de natuurlijke breedte (of de gegeven).
 * @param {Object} element
 * @param {string} [gedaante] - "kop": alleen de naam
 * @param {number} [breedte]
 */
export function tekenaarMaat(element, gedaante, breedte) {
  const descriptor = puurUmlDiagramType;
  const et = descriptor.elementTypes.find((t) => t.id === element.elementType);
  const { shapeType } = vormVoor(et.shape, et);
  const parameters = shapeType.parameters || {};
  const el = gedaante === "kop" ? { ...element, compartimenten: [] } : element;
  const p = { element: el, elementType: et, parameters, fieldTypesById: perId(descriptor.fieldTypes), compartmentTypesById: {} };
  const min = minMaatVan(shapeType, et) || { w: 0, h: 0 };
  const w = Math.ceil(breedte || Math.max(min.w, planInhoud({ ...p, breedte: Infinity }).minW));
  const h = Math.ceil(Math.max(min.h, planInhoud({ ...p, breedte: w }).h));
  return { w, h };
}

/**
 * @param {{schemaBron: string, vorigen?: Record<string, Object|null>}} p
 * @returns {Record<string, string>} per sleutel de JSON-tekst (met afsluitende regelovergang)
 */
export function genereerMetamodellen({ schemaBron, vorigen = {} }) {
  const profielVersie = versieVan(puurUmlDiagramType);
  const m3 = metamodelWerkbestand(m3Metamodel(schemaBron), { maatVan: tekenaarMaat, vorige: vorigen.m3 || null, profielVersie });
  const pm = metamodelWerkbestand(/** @type {any} */ (projectMetamodel()), { maatVan: tekenaarMaat, vorige: vorigen.projectmetamodel || null, profielVersie });
  return { m3: `${JSON.stringify(m3, null, 2)}\n`, projectmetamodel: `${JSON.stringify(pm, null, 2)}\n` };
}
