/**
 * _helpers.js — Gedeelde helpers voor importers (Mermaid, PlantUML, XMI).
 *
 * Twee functies:
 *   - mapStereotypesNaarMeta: vertaal een lijst stereotypes (lowercase) naar editor-meta
 *     (metatype, subtypes, materieel, datatype/enum/refInstantie). Ondersteunt aliassen
 *     en MIM- en bitemp-stereotypes.
 *   - promoteEntiteitAssociaties: zet directe entiteit↔entiteit-edges om naar het
 *     ASOC-patroon (relatie-node + associatieAnker + 3 edges). Zo blijven Mermaid/
 *     PlantUML-imports volledig roundtrip-stabiel via editorNaarV3Model.
 *
 * @module import/_helpers
 */

import { generateId, defaultKleur } from "../metamodel/types";

// Aliastabel: lowercase stereotype-naam → canonieke meta.
// Wordt door alle importers gebruikt; uitbreiden hier i.p.v. per importer.
const STEREOTYPE_ALIASES = {
  // entiteit
  ent: { metatype: "entiteit" },
  entiteit: { metatype: "entiteit" },
  objecttype: { metatype: "entiteit" }, // MIM

  // gegevenselement
  ge: { metatype: "gegevenselement" },
  gegevenselement: { metatype: "gegevenselement" },
  gegevensgroeptype: { metatype: "gegevenselement" }, // MIM

  // relatie
  rel: { metatype: "relatie" },
  relatie: { metatype: "relatie" },
  relatiesoort: { metatype: "relatie" }, // MIM
  relatieklasse: { metatype: "relatie" },
  associationclass: { metatype: "relatie" },

  // referentielijst-familie (zie Referentielijsten.md)
  reflijst: { metatype: "entiteit", entiteitSubtype: "referentielijst" },
  referentielijst: { metatype: "entiteit", entiteitSubtype: "referentielijst" },
  refitem: { metatype: "entiteit", entiteitSubtype: "referentielijst_item" },
  referentielijstitem: {
    metatype: "entiteit",
    entiteitSubtype: "referentielijst_item",
  },
  refitems: { metatype: "relatie", relatieSubtype: "referentielijst_items" },
  referentielijstitems: {
    metatype: "relatie",
    relatieSubtype: "referentielijst_items",
  },
  refinstantie: { isRefInstantie: true },
  referentielijstinstantie: { isRefInstantie: true },

  // datatype / enum
  datatype: { isDatatype: true },
  "gestructureerd datatype": { isDatatype: true }, // MIM
  enumeration: { isEnum: true },
  enum: { isEnum: true },

  // modifiers (geen eigen metatype)
  materieel: { isMaterieel: true },
};

/**
 * Vertaal een lijst stereotypes (lowercase, zonder `<<>>`) naar editor-meta.
 * Onbekende stereotypes worden genegeerd; default metatype is "entiteit".
 *
 * @param {string[]} stereotypes
 * @returns {{
 *   metatype: "entiteit"|"gegevenselement"|"relatie",
 *   entiteitSubtype?: string,
 *   relatieSubtype?: string,
 *   isMaterieel: boolean,
 *   isDatatype: boolean,
 *   isEnum: boolean,
 *   isRefInstantie: boolean
 * }}
 */
export function mapStereotypesNaarMeta(stereotypes) {
  const result = {
    metatype: "entiteit",
    isMaterieel: false,
    isDatatype: false,
    isEnum: false,
    isRefInstantie: false,
  };
  let metatypeExpliciet = false;
  for (const raw of stereotypes || []) {
    const key = String(raw || "").trim().toLowerCase();
    if (!key) continue;
    const m = STEREOTYPE_ALIASES[key];
    if (!m) continue;
    if (m.metatype) {
      result.metatype = m.metatype;
      metatypeExpliciet = true;
    }
    if (m.entiteitSubtype) result.entiteitSubtype = m.entiteitSubtype;
    if (m.relatieSubtype) result.relatieSubtype = m.relatieSubtype;
    if (m.isMaterieel) result.isMaterieel = true;
    if (m.isDatatype) result.isDatatype = true;
    if (m.isEnum) result.isEnum = true;
    if (m.isRefInstantie) result.isRefInstantie = true;
  }
  return { ...result, metatypeExpliciet };
}

/**
 * Promoot directe entiteit↔entiteit-edges naar het ASOC-patroon dat de editor
 * (en editorNaarV3Model) verwacht: relatie-node + associatieAnker + 3 edges
 * (bron→anker, anker→doel, anker╌╌relatie).
 *
 * Edges worden overgeslagen als ze:
 *   - generalisatie of dependency zijn (data.isGeneralization / data.isDependency)
 *   - al onderdeel zijn van een ASOC-patroon (isAssociation / isAssociationClassLink)
 *   - bron of doel niet een entiteit-node is (bijv. naar GE of relatie-node)
 *
 * Muteert `nodes` en `edges` in-place.
 *
 * @param {Array} nodes - React Flow nodes
 * @param {Array} edges - React Flow edges
 */
export function promoteEntiteitAssociaties(nodes, edges) {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const isEntiteit = (id) => nodeById.get(id)?.type === "entiteit";

  const teVerwerken = [];
  for (let idx = 0; idx < edges.length; idx++) {
    const e = edges[idx];
    if (!e || !e.source || !e.target) continue;
    if (e.data?.isGeneralization) continue;
    if (e.data?.isDependency) continue;
    if (e.data?.isAssociation) continue;
    if (e.data?.isAssociationClassLink) continue;
    if (!isEntiteit(e.source) || !isEntiteit(e.target)) continue;
    teVerwerken.push({ idx, edge: e });
  }

  // Verwerk van achteren naar voren zodat splice-indexen blijven kloppen.
  for (let i = teVerwerken.length - 1; i >= 0; i--) {
    const { idx, edge } = teVerwerken[i];
    const bron = nodeById.get(edge.source);
    const doel = nodeById.get(edge.target);
    if (!bron || !doel) continue;

    const rolnaam = (edge.data?.rolnaam || "").trim();
    const bronNaam = bron.data?.typenaam || "Bron";
    const doelNaam = doel.data?.typenaam || "Doel";
    const relatieNaam = rolnaam || `Rel_${bronNaam}_${doelNaam}`;
    const kard = edge.data?.kardinaliteit || "0..*";
    const moment = edge.data?.momentvoorkomen || "meervoudig";

    // Plaats relatie-node in het midden tussen bron en doel, iets naar onder.
    const bx = bron.position?.x ?? 0;
    const by = bron.position?.y ?? 0;
    const dx = doel.position?.x ?? 0;
    const dy = doel.position?.y ?? 0;
    const midX = (bx + dx) / 2;
    const midY = (by + dy) / 2;

    const relId = generateId("relatie");
    const ankerId = generateId("anker");

    nodes.push({
      id: relId,
      type: "relatie",
      position: { x: midX + 40, y: midY + 120 },
      data: {
        id: relId,
        typenaam: relatieNaam,
        description: "",
        metatype: "relatie",
        isMaterieel: false,
        kleur: defaultKleur("relatie"),
        velden: [],
        doelEntiteit: doelNaam,
      },
    });
    nodes.push({
      id: ankerId,
      type: "associatieAnker",
      position: { x: midX, y: midY + 20 },
      data: { relatieNaam },
    });

    const nieuweEdges = [
      // bron → anker (associatie)
      {
        id: generateId("edge"),
        source: bron.id,
        target: ankerId,
        type: "metamodel",
        data: {
          isAssociation: true,
          rolnaam: rolnaam,
          jsonRolnaam: edge.data?.jsonRolnaam || "",
          momentvoorkomen: moment,
          kardinaliteit: kard,
        },
      },
      // anker → doel (associatie)
      {
        id: generateId("edge"),
        source: ankerId,
        target: doel.id,
        type: "metamodel",
        data: {
          isAssociation: true,
          rolnaam: "",
          jsonRolnaam: "",
          momentvoorkomen: moment,
          kardinaliteit: kard,
        },
      },
      // anker ╌╌ relatie (associationClassLink)
      {
        id: generateId("edge"),
        source: ankerId,
        target: relId,
        type: "metamodel",
        data: {
          isAssociationClassLink: true,
          rolnaam: "",
          jsonRolnaam: "",
          momentvoorkomen: "",
          kardinaliteit: "",
        },
      },
    ];

    edges.splice(idx, 1, ...nieuweEdges);
  }
}
