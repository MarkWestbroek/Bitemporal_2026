/**
 * veldenlijst.js — platte veldenlijst (FieldRefs) uit de types van de schema-API.
 *
 * `bouwModelTree` levert een boom Domein → Entiteit → GE/relatie → Veld. Een
 * aantal afnemers wil daar juist de *platte* lijst van: Toegangsspraak voedt er
 * `maakVeldIndex` uit metamodel.js mee (keten-resolutie, typebewaking en
 * autocomplete), lineage doet iets vergelijkbaars.
 *
 * Collectie-velden (format "array") vallen af: dat zijn adressen van lijsten,
 * geen waarden.
 */
import { bouwModelTree, safeArray } from "./modelTree.js";

/**
 * @param {Array} types  platte types van /api/schema/model/code
 * @param {object} opties  wordt doorgegeven aan bouwModelTree (o.a. relatieDiepte)
 * @returns {Array} FieldRefs
 */
export function verzamelVelden(types, opties = {}) {
  const velden = [];
  for (const domein of bouwModelTree(types, opties)) {
    for (const ent of domein.entiteiten) {
      const pak = (knopen) => {
        for (const knoop of safeArray(knopen)) {
          const ref = knoop.ref;
          if (!ref || ref.format === "array") continue;
          velden.push(ref);
        }
      };
      pak(ent.velden);
      for (const kind of safeArray(ent.kinderen)) pak(kind.velden);
    }
  }
  return velden;
}
