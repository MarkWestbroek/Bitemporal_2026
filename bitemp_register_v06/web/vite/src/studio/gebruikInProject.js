/**
 * Gebruik van een element over alle talen van het project (diagramcore/model/gebruik.js
 * `gebruikInProject`): de diagrammen van zijn eigen taal plus die van andere talen waar het als
 * verwijzing staat (model/vreemd.js; Mark 07-11). Voor "Toon gebruik" in de projectboom, het
 * cursief tonen van ongebruikte elementen en "Gebruikt op" in de inspector.
 */
import { getProfieltypen } from "./profieltypeRegistry";
import { gebruikInProject } from "../diagramcore/model/gebruik.js";

/** @param {string} profielId @param {string} elementId */
export function gebruikInHetProject(profielId, elementId) {
  const talen = getProfieltypen()
    .filter((p) => !p.klassiek && p.useStore)
    .map((p) => ({ profielId: p.id, label: p.label, diagrams: p.useStore.getState().diagrams || {} }));
  return gebruikInProject(profielId, elementId, talen);
}
