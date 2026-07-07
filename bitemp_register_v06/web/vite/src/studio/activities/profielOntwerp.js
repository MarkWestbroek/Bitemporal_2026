// @ts-check
/**
 * profielOntwerp — trede 2 van de meta-editor (plan §8.9): een profiel
 * *tekenen* in plaats van typen — en wel conform het metamodel (§2):
 *
 *   ElementType ◆── CompartmentType ◆── FieldType, elk met eigen properties.
 *
 * Drie node-soorten plus twee connector-soorten:
 *   - **Elementtype** («elementtype»): shape/kleur/kort als properties; het
 *     compartiment "eigenschappen" beschrijft de PropertyTypes van het type.
 *   - **Compartimenttype** («compartimenttype»): een sectie in het element;
 *     hangt via een ◆-compositie aan een Elementtype.
 *   - **Veldtype** («veldtype»): de regels in zo'n sectie; hangt via ◆ aan
 *     een Compartimenttype en heeft (naast de intrinsieke naam) zijn eigen
 *     "eigenschappen" — precies FieldType 0..* PropertyType.
 *   - **compositie** (◆): de bevat-relaties hierboven.
 *   - **verbindingsregel** (→): tussen Elementtypes; wordt een
 *     connector-ElementType van het doelprofiel.
 *
 * `bouwProfielUitOntwerp` vertaalt de tekening naar een descriptor-kern
 * (trede 1-vorm, hooks op id); `ontwerpUitProfiel` is de omgekeerde weg —
 * een bestaande descriptor als ontwerp-diagram bekijken (en desgewenst
 * onder een nieuw id opnieuw genereren).
 */

import { handlerInfo } from "../../diagramcore/types/handlerCatalogus.js";

export const PROFIEL_ONTWERP_ID = "profiel-ontwerp";

const EIGENSCHAP_VELDEN = [
  { key: "naam", label: "key", datatype: "string", verplicht: true },
  { key: "typeLabel", label: "datatype (string/tekst/boolean/colour)", datatype: "string" },
];

/** @type {Object} descriptor-kern van de ontwerper zelf (hooks op id). */
export const profielOntwerpKern = {
  id: PROFIEL_ONTWERP_ID,
  label: "Profiel-ontwerp",
  style: "uml-klassiek",
  hierarchie: "compositie",
  fieldTypes: [
    { id: "eigenschapDef", viewer: "naam-type", properties: EIGENSCHAP_VELDEN },
    // Alleen-lezen regels die tonen welk Implementation-domein (hooks,
    // property-editors, resolvers — zie het metamodel) aan het type hangt.
    {
      id: "implementatieDef",
      viewer: "naam-type",
      properties: [
        { key: "naam", datatype: "string", verplicht: true },
        { key: "typeLabel", label: "handler", datatype: "string" },
        // Uit de handler-catalogus (P02); zichtbaar in het veld-detail (…).
        { key: "beschrijving", label: "beschrijving", datatype: "tekst" },
      ],
    },
  ],
  elementTypes: [
    {
      id: "elementDef",
      label: "Elementtype",
      kort: "ET",
      stereotype: "«elementtype»",
      shape: "class-box",
      kleur: "#bae6fd",
      icoon: "elementtype",
      properties: [
        { key: "kort", label: "korte code (taakbalk)", datatype: "string" },
        // Kiezers met preview (P06): de registry levert de opties.
        { key: "shape", label: "shape", datatype: "shape-keuze" },
        { key: "icoon", label: "icoon (taakbalk/boom)", datatype: "icoon-keuze" },
        { key: "doelKleur", label: "kleur van het type", datatype: "colour" },
        // Niet "stereotype": dat dataveld is de generieke per-element
        // weergave-override (ClassBox toont hem), waardoor de ET-node zelf
        // ineens «package» i.p.v. «elementtype» zou heten.
        { key: "doelStereotype", label: "stereotype van het type («…»)", datatype: "string" },
        // Boom/packages: container = drop-doel (containerVoor volgt uit de
        // bevat-verbindingsregel), standaard dicht = ingeklapt beginnen.
        { key: "container", label: "container (drop-doel, package)", datatype: "boolean" },
        { key: "standaardDichtInBoom", label: "standaard dicht in boom", datatype: "boolean" },
      ],
      compartments: [
        { id: "eigenschappen", label: "eigenschappen", fieldType: "eigenschapDef" },
        // Gevuld door ontwerpUitProfiel; puur informatief — het
        // Implementation-domein is niet tekenbaar, wel zichtbaar.
        { id: "implementatie", label: "implementatie", fieldType: "implementatieDef" },
      ],
    },
    {
      id: "compartimentDef",
      label: "Compartimenttype",
      kort: "CT",
      stereotype: "«compartimenttype»",
      shape: "class-box",
      kleur: "#ddd6fe",
      icoon: "compartimenttype",
      properties: [],
      compartments: [],
    },
    {
      id: "fieldDef",
      label: "Veldtype",
      kort: "VT",
      stereotype: "«veldtype»",
      shape: "class-box",
      kleur: "#bbf7d0",
      icoon: "veldtype",
      properties: [],
      compartments: [{ id: "eigenschappen", label: "eigenschappen", fieldType: "eigenschapDef" }],
    },
    {
      // ET ◆ CT en CT ◆ VT — de bevat-relaties van het metamodel.
      id: "compositie",
      label: "Bevat (◆)",
      kort: "◆",
      shape: "edge",
      icoon: "compositie",
      isConnector: true,
      bron: { elementTypes: ["elementDef", "compartimentDef"] },
      doel: { elementTypes: ["compartimentDef", "fieldDef"] },
      edgePresentatie: { lijn: "solid", kleur: "#7c3aed", markerStart: "ruit" },
    },
    {
      id: "verbindingsregel",
      label: "Verbindingsregel",
      kort: "→",
      shape: "edge",
      icoon: "verbindingsregel",
      isConnector: true,
      bron: { elementTypes: ["elementDef"] },
      doel: { elementTypes: ["elementDef"] },
      edgePresentatie: { lijn: "solid", kleur: "#0ea5e9" },
      properties: [
        { key: "lijn", label: "lijn (solid/dash-6-3/…)", datatype: "string" },
        { key: "vorm", label: "vorm (bezier/hoekig/recht/boom)", datatype: "string" },
        { key: "markerStart", label: "markerStart (ruit/ruit-open)", datatype: "string" },
        { key: "markerEnd", label: "markerEnd (driehoek/pijl-open/pijl-dicht/bol)", datatype: "string" },
        { key: "doelKleur", label: "lijnkleur", datatype: "colour" },
        { key: "metKardinaliteiten", label: "kardinaliteiten-labels", datatype: "boolean" },
        { key: "richtingOptie", label: "richting-vinkje (→)", datatype: "boolean" },
        { key: "isHierarchie", label: "bevat-relatie (hiërarchie, P02)", datatype: "boolean" },
      ],
    },
    {
      id: "notitie",
      label: "Notitie",
      kort: "NOT",
      shape: "note",
      icoon: "notitie",
      handleStijl: "onzichtbaar",
      properties: [{ key: "tekst", datatype: "tekst" }],
    },
  ],
  taakbalken: [
    { id: "maken", label: "Maken", acties: "elementTypes" },
    { id: "verbinding", label: "Verbinding", acties: "connectorTypes" },
  ],
  layouts: [],
};

/** "Mijn Type!" → "mijn-type" (element-/compartiment-/veldtype-id's). */
function slug(tekst) {
  return (
    String(tekst || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "naamloos"
  );
}

const GELDIGE_SHAPES = new Set([
  "class-box",
  "chip",
  "knip-box",
  "bol",
  "note",
  "rounded",
  "boundary",
  "package",
  "dmn-input-data",
  "dmn-bkm",
  "dmn-knowledge-source",
]);
const GELDIGE_DATATYPES = new Set(["string", "tekst", "boolean", "colour"]);

function compVelden(el, compartmentType) {
  return (
    (el.compartimenten || []).find((c) => c.compartmentType === compartmentType)?.velden || []
  );
}

/** "eigenschappen"-compartiment → PropertyType-lijst. */
function eigenschappenVan(el) {
  return compVelden(el, "eigenschappen").map((v) => ({
    key: slug(v.naam),
    label: v.naam,
    datatype: GELDIGE_DATATYPES.has(v.data?.typeLabel) ? v.data.typeLabel : "string",
  }));
}

/**
 * Vertaal een getekend profiel-ontwerp naar een descriptor-kern
 * (trede 1-vorm, hooks als catalogus-id's).
 *
 * @param {{elements: Record<string, Object>}} state
 * @param {{id: string, label?: string}} opties
 */
export function bouwProfielUitOntwerp(state, { id, label }) {
  const els = Object.values(state?.elements || {});
  const perSoort = (soort) => els.filter((el) => el.elementType === soort);
  const defs = perSoort("elementDef");
  if (!defs.length) {
    throw new Error("Het ontwerp bevat nog geen Elementtype-nodes.");
  }

  // Bevat-relaties (composities): ET → CT's en CT → VT's.
  const composities = perSoort("compositie").filter((c) => c.source && c.target);
  const elementen = new Map(els.map((el) => [el.id, el]));
  const kinderenVan = (ouderId, soort) =>
    composities
      .filter((c) => c.source === ouderId && elementen.get(c.target)?.elementType === soort)
      .map((c) => elementen.get(c.target));

  const doelIdVoor = new Map();
  for (const def of defs) doelIdVoor.set(def.id, slug(def.naam));

  // Veldtypen (FieldTypes) van het doelprofiel: één per fieldDef-node.
  const fieldTypes = [];
  const fieldTypeIdVoor = new Map(); // fieldDef-node-id → fieldType-id
  for (const veldDef of perSoort("fieldDef")) {
    const ftId = slug(veldDef.naam);
    if (!fieldTypeIdVoor.has(veldDef.id)) {
      fieldTypeIdVoor.set(veldDef.id, ftId);
      if (!fieldTypes.some((ft) => ft.id === ftId)) {
        fieldTypes.push({
          id: ftId,
          viewer: "naam-type",
          properties: [{ key: "naam", datatype: "string", verplicht: true }, ...eigenschappenVan(veldDef)],
        });
      }
    }
  }
  if (!fieldTypes.length) {
    // Vangnet zodat compartimenten zonder getekend veldtype toch werken.
    fieldTypes.push({
      id: "veld",
      viewer: "naam-type",
      properties: [
        { key: "naam", datatype: "string", verplicht: true },
        { key: "typeLabel", label: "type", datatype: "string" },
      ],
    });
  }

  const elementTypes = [];
  for (const def of defs) {
    const d = def.data || {};
    const shape = GELDIGE_SHAPES.has(d.shape) ? d.shape : "class-box";
    // CompartmentTypes: de CT-nodes die via ◆ aan dit ET hangen; hun
    // veldtype is de (eerste) VT-node die via ◆ aan de CT hangt.
    const compartments = kinderenVan(def.id, "compartimentDef").map((ct) => {
      const veldDef = kinderenVan(ct.id, "fieldDef")[0];
      return {
        id: slug(ct.naam),
        label: ct.naam,
        fieldType: veldDef ? fieldTypeIdVoor.get(veldDef.id) : fieldTypes[0].id,
      };
    });
    elementTypes.push({
      id: doelIdVoor.get(def.id),
      label: def.naam,
      kort: d.kort || def.naam.slice(0, 3).toUpperCase(),
      ...((d.doelStereotype ?? d.stereotype)
        ? { stereotype: d.doelStereotype ?? d.stereotype }
        : {}),
      shape,
      ...(shape === "boundary" ? { achtergrond: true, handleStijl: "onzichtbaar" } : {}),
      ...(shape === "note" ? { handleStijl: "onzichtbaar" } : {}),
      kleur: d.doelKleur || "#e2e8f0",
      ...(d.icoon ? { icoon: d.icoon } : {}),
      ...(d.standaardDichtInBoom ? { standaardDichtInBoom: true } : {}),
      ...(d.container ? { _containerWens: true } : {}),
      properties: [{ key: "kleur", datatype: "colour" }, ...eigenschappenVan(def)],
      compartments,
    });
  }

  // Verbindingsregel-lijnen met dezelfde náám vormen samen één connectortype
  // met meerdere verbindingsregels (metametamodel: ConnectorType ◆ 1..*
  // Verbindingsregel) — het connectortype manifesteert zich als meerdere
  // lijnen. Presentatie-properties van de eerste lijn winnen.
  const perConnectorType = new Map();
  perSoort("verbindingsregel")
    .filter((el) => el.source && el.target)
    .forEach((regel, i) => {
      const bron = doelIdVoor.get(regel.source);
      const doel = doelIdVoor.get(regel.target);
      if (!bron || !doel) return;
      const connectorId = slug(regel.naam) !== "naamloos" ? slug(regel.naam) : `regel-${i + 1}`;
      if (!perConnectorType.has(connectorId)) {
        perConnectorType.set(connectorId, { eerste: regel, regels: [], isHierarchie: false });
      }
      const groep = perConnectorType.get(connectorId);
      groep.regels.push({ bron: [bron], doel: [doel] });
      if (regel.data?.isHierarchie) groep.isHierarchie = true;
    });

  const hierarchieConnectoren = [];
  for (const [connectorId, { eerste, regels, isHierarchie }] of perConnectorType) {
    if (isHierarchie) hierarchieConnectoren.push(connectorId);
    const d = eerste.data || {};
    const hooks = {};
    const properties = [{ key: "kleur", datatype: "colour" }];
    if (d.metKardinaliteiten) {
      hooks.edgeLabels = "kardinaliteiten";
      properties.push(
        { key: "bronKardinaliteit", label: "kardinaliteit (bron)", datatype: "string" },
        { key: "doelKardinaliteit", label: "kardinaliteit (doel)", datatype: "string" }
      );
    }
    if (d.richtingOptie) {
      hooks.edgePresentatie = "directioneel-pijl";
      properties.push({ key: "directioneel", label: "gericht (→ doel)", datatype: "boolean" });
    }
    elementTypes.push({
      id: connectorId,
      label: eerste.naam || connectorId,
      kort: d.markerStart === "ruit" ? "◆" : d.markerEnd === "driehoek" ? "▷" : "—",
      shape: "edge",
      isConnector: true,
      ...(regels.length === 1
        ? { bron: { elementTypes: regels[0].bron }, doel: { elementTypes: regels[0].doel } }
        : { verbindingsregels: regels }),
      edgePresentatie: {
        lijn: d.lijn || "solid",
        ...(d.vorm ? { vorm: d.vorm } : {}),
        kleur: d.doelKleur || "#64748b",
        ...(d.markerStart ? { markerStart: d.markerStart } : {}),
        ...(d.markerEnd ? { markerEnd: d.markerEnd } : {}),
      },
      properties,
      ...(Object.keys(hooks).length ? { hooks } : {}),
    });
  }

  // containerVoor: een ET met het container-vinkje krijgt het (liefst
  // hiërarchie-)connectortype waarvan hij bron is als lidmaatschapsrelatie.
  const regelsVanCt = (ct) =>
    ct.verbindingsregels || [{ bron: ct.bron?.elementTypes || [], doel: ct.doel?.elementTypes || [] }];
  for (const et of elementTypes) {
    if (!et._containerWens) continue;
    delete et._containerWens;
    const kandidaat =
      elementTypes.find(
        (ct) =>
          ct.isConnector &&
          hierarchieConnectoren.includes(ct.id) &&
          regelsVanCt(ct).some((r) => r.bron.includes(et.id))
      ) ||
      elementTypes.find(
        (ct) => ct.isConnector && regelsVanCt(ct).some((r) => r.bron.includes(et.id))
      );
    if (kandidaat) et.containerVoor = kandidaat.id;
  }

  return {
    id: slug(id),
    label: label || id,
    style: "uml-klassiek",
    // 1 hierarchie-connector → string (compat), meerdere → lijstje.
    ...(hierarchieConnectoren.length
      ? { hierarchie: hierarchieConnectoren.length === 1 ? hierarchieConnectoren[0] : hierarchieConnectoren }
      : {}),
    fieldTypes,
    elementTypes,
    taakbalken: [
      { id: "maken", label: "Maken", acties: "elementTypes" },
      { id: "verbinding", label: "Verbinding", acties: "connectorTypes" },
    ],
    layouts: [],
  };
}

/**
 * De elementen die bij één ontwerp-diagram horen (P01: meerdere profielen
 * naast elkaar in de sandbox): nodes van het diagram plus de connectoren
 * waarvan beide uiteinden erop staan. Hiermee genereert de ontwerper per
 * díagram een profiel in plaats van alles samen te vegen.
 *
 * @param {{elements: Record<string, Object>, diagrams: Record<string, Object>}} state
 * @param {string} diagramId
 * @returns {Record<string, Object>}
 */
export function elementenVanDiagram(state, diagramId) {
  const diagram = state?.diagrams?.[diagramId];
  const opDiagram = new Set((diagram?.nodes || []).map((n) => n.elementId));
  const subset = {};
  for (const [id, el] of Object.entries(state?.elements || {})) {
    if (el.source && el.target) {
      if (opDiagram.has(el.source) && opDiagram.has(el.target)) subset[id] = el;
    } else if (opDiagram.has(id)) {
      subset[id] = el;
    }
  }
  return subset;
}

// ── Omgekeerde weg: bestaande descriptor → ontwerp-diagram ────────────────

let _ontwerpTeller = 0;

function eigenschapVelden(properties) {
  return (properties || [])
    .filter((p) => p.key !== "kleur")
    .map((p) => ({
      naam: p.label || p.key,
      fieldType: "eigenschapDef",
      data: { typeLabel: p.datatype || "string" },
    }));
}

/**
 * Zet een descriptor(-kern) om in een ontwerp-diagram (elements + diagram),
 * klaar voor `laadModel` van de profiel-ontwerp-store. Werkt ook op de
 * ingebouwde profielen (functie-hooks worden herkend aan hun properties:
 * bronKardinaliteit → kardinaliteiten-vinkje, directioneel → richting).
 *
 * @param {Object} descriptor
 * @returns {{elements: Record<string, Object>, diagrams: Record<string, Object>}}
 */
export function ontwerpUitProfiel(descriptor) {
  _ontwerpTeller += 1;
  const prefix = `ow${_ontwerpTeller}`;
  const elements = {};
  const nodes = [];
  let vrijeVeldX = 60;

  const fieldTypesById = Object.fromEntries((descriptor.fieldTypes || []).map((ft) => [ft.id, ft]));
  const nodeIdVoorElementType = new Map();
  const veldDefVoorFieldType = new Map();

  const nietConnectoren = (descriptor.elementTypes || []).filter((et) => !et.isConnector);
  const connectoren = (descriptor.elementTypes || []).filter((et) => et.isConnector);

  nietConnectoren.forEach((et, kolom) => {
    const etNodeId = `${prefix}_et_${et.id}`;
    nodeIdVoorElementType.set(et.id, etNodeId);
    // Implementation-domein zichtbaar maken (metamodel: ActionHook,
    // ShapeRenderer, PropertyTypeEditor, ReferenceResolver, …): hooks op het
    // type plus properties met een niet-standaard datatype (eigen editor).
    const BASIS_DATATYPES = new Set(["string", "tekst", "boolean", "colour", undefined]);
    // Naam + beschrijving uit de handler-catalogus (P02): de code zelf is
    // niet tekenbaar, maar zo is wél zichtbaar wélke handlers aan het type
    // hangen en wat ze doen (beschrijving in het veld-detail).
    const implRegel = (soort, id, context) => {
      const info = handlerInfo(soort, id);
      return {
        naam: `${soort}: ${id}${context ? ` (${context})` : ""}`,
        fieldType: "implementatieDef",
        data: { typeLabel: info.naam, beschrijving: info.beschrijving },
      };
    };
    const implementatieRegels = [
      ...Object.keys(et.hooks || {}).map((h) => implRegel("hook", h)),
      ...(et.properties || [])
        .filter((pr) => !BASIS_DATATYPES.has(pr.datatype) && !pr.referenceTypes)
        .map((pr) => implRegel("editor", pr.datatype, pr.key)),
      ...(et.properties || []).flatMap((pr) =>
        (pr.referenceTypes || []).map((rt) => implRegel("resolver", rt, pr.key))
      ),
    ];
    elements[etNodeId] = {
      id: etNodeId,
      naam: et.label || et.id,
      elementType: "elementDef",
      compartimenten: [
        { compartmentType: "eigenschappen", velden: eigenschapVelden(et.properties) },
        ...(implementatieRegels.length
          ? [{ compartmentType: "implementatie", velden: implementatieRegels }]
          : []),
      ],
      data: {
        kort: et.kort || "",
        shape: et.shape || "class-box",
        doelKleur: et.kleur || "#e2e8f0",
        ...(et.icoon ? { icoon: et.icoon } : {}),
        ...(et.stereotype ? { doelStereotype: et.stereotype } : {}),
        ...(et.containerVoor ? { container: true } : {}),
        ...(et.standaardDichtInBoom ? { standaardDichtInBoom: true } : {}),
      },
    };
    const x = 60 + kolom * 340;
    nodes.push({ elementId: etNodeId, position: { x, y: 60 } });

    (et.compartments || []).forEach((ct, rij) => {
      const ctNodeId = `${prefix}_ct_${et.id}_${ct.id}`;
      elements[ctNodeId] = {
        id: ctNodeId,
        naam: ct.label || ct.id,
        elementType: "compartimentDef",
        compartimenten: [],
        data: {},
      };
      nodes.push({ elementId: ctNodeId, position: { x, y: 330 + rij * 150 } });
      elements[`${ctNodeId}_c`] = {
        id: `${ctNodeId}_c`,
        naam: "",
        elementType: "compositie",
        source: etNodeId,
        target: ctNodeId,
        compartimenten: [],
        data: {},
      };

      const ft = fieldTypesById[ct.fieldType];
      if (!ft) return;
      if (!veldDefVoorFieldType.has(ft.id)) {
        const vtNodeId = `${prefix}_vt_${ft.id}`;
        veldDefVoorFieldType.set(ft.id, vtNodeId);
        elements[vtNodeId] = {
          id: vtNodeId,
          naam: ft.id,
          elementType: "fieldDef",
          compartimenten: [
            {
              compartmentType: "eigenschappen",
              velden: eigenschapVelden((ft.properties || []).filter((p) => p.key !== "naam")),
            },
          ],
          data: {},
        };
        nodes.push({ elementId: vtNodeId, position: { x: vrijeVeldX, y: 640 } });
        vrijeVeldX += 300;
      }
      elements[`${ctNodeId}_v`] = {
        id: `${ctNodeId}_v`,
        naam: "",
        elementType: "compositie",
        source: ctNodeId,
        target: veldDefVoorFieldType.get(ft.id),
        compartimenten: [],
        data: {},
      };
    });
  });

  connectoren.forEach((et, i) => {
    const p = et.edgePresentatie || {};
    const props = et.properties || [];
    // Elk toegestaan (bron, doel)-paar wordt één regel-lijn; lijnen met
    // dezelfde naam bundelen bij het genereren weer tot dit connectortype.
    const regels =
      Array.isArray(et.verbindingsregels) && et.verbindingsregels.length
        ? et.verbindingsregels
        : [{ bron: et.bron?.elementTypes || [], doel: et.doel?.elementTypes || [] }];
    let volgnr = 0;
    for (const regel of regels) {
      const bronnen = regel.bron?.elementTypes || regel.bron || [];
      const doelen = regel.doel?.elementTypes || regel.doel || [];
      for (const bronType of bronnen) {
        for (const doelType of doelen) {
          const bron = nodeIdVoorElementType.get(bronType);
          const doel = nodeIdVoorElementType.get(doelType);
          if (!bron || !doel) continue;
          volgnr += 1;
          const id = `${prefix}_regel_${i}_${volgnr}`;
          elements[id] = {
            id,
            naam: et.label || et.id,
            elementType: "verbindingsregel",
            source: bron,
            target: doel,
            compartimenten: [],
            data: {
              lijn: p.lijn || "solid",
              ...(p.vorm ? { vorm: p.vorm } : {}),
              ...(p.markerStart ? { markerStart: p.markerStart } : {}),
              ...(p.markerEnd ? { markerEnd: p.markerEnd } : {}),
              doelKleur: p.kleur || "#64748b",
              metKardinaliteiten: props.some((pr) => pr.key === "bronKardinaliteit"),
              richtingOptie: props.some((pr) => pr.key === "directioneel"),
              ...([].concat(descriptor.hierarchie || [])
                .map((h) => (typeof h === "string" ? h : h?.type))
                .includes(et.id)
                ? { isHierarchie: true }
                : {}),
            },
          };
        }
      }
    }
  });

  return {
    elements,
    diagrams: {
      ontwerp: {
        id: "ontwerp",
        naam: descriptor.label || descriptor.id,
        nodes,
        edges: [],
      },
    },
  };
}

// ── Standaard-layouts per profiel (PE-persistentie) ────────────────────────

/**
 * Stabiele layout-sleutel per node: elementType + naam + volgnummer.
 * ontwerpUitProfiel is deterministisch, dus de volgorde (en daarmee het
 * volgnummer bij naamgenoten, bv. twee compartimenten "velden") is stabiel
 * zolang het profiel niet wijzigt — de gegenereerde ow{n}_-ids zijn dat
 * juist níet, dus die zijn onbruikbaar als sleutel.
 */
export function layoutSleutels(elements, nodes) {
  const teller = new Map();
  return (nodes || []).map((node) => {
    const el = elements[node.elementId] || {};
    const basis = `${el.elementType || "?"}:${el.naam || ""}`;
    const n = (teller.get(basis) || 0) + 1;
    teller.set(basis, n);
    return { node, sleutel: `${basis}#${n}` };
  });
}

/** Pas een bewaarde standaard-layout ({sleutel: {x, y}}) toe op verse nodes. */
export function pasStandaardLayoutToe(elements, nodes, layout) {
  if (!layout) return nodes;
  return layoutSleutels(elements, nodes).map(({ node, sleutel }) =>
    layout[sleutel] ? { ...node, position: { ...layout[sleutel] } } : node
  );
}

/**
 * Alle (geregistreerde) profielen als ontwerp-diagrammen naast elkaar — de
 * herlaad-routine van de profiel-ontwerper. `layoutVoor(profielId)` mag een
 * bewaarde standaard-layout teruggeven (zie layoutSleutels).
 */
export function ontwerpUitAlleProfielen(descriptors, layoutVoor = null) {
  const elements = {};
  const diagrams = {};
  for (const dt of descriptors || []) {
    const ontwerp = ontwerpUitProfiel(dt);
    Object.assign(elements, ontwerp.elements);
    const basis = Object.values(ontwerp.diagrams)[0];
    const id = `ontw_${dt.id}`;
    diagrams[id] = {
      ...basis,
      id,
      naam: dt.label || dt.id,
      nodes: pasStandaardLayoutToe(ontwerp.elements, basis.nodes, layoutVoor?.(dt.id)),
    };
  }
  return { elements, diagrams };
}

/** Voorbeeld-ontwerp (het e2e-scenario): Ster (bol) ◆ Metingen ◆ meting, Planeet, "draait om". */
export function voorbeeldOntwerp() {
  return ontwerpUitProfiel({
    id: "sterrenstelsel-voorbeeld",
    label: "Voorbeeld: sterrenstelsel",
    fieldTypes: [
      {
        id: "meting",
        viewer: "naam-type",
        properties: [
          { key: "naam", datatype: "string", verplicht: true },
          { key: "eenheid", label: "eenheid", datatype: "string" },
        ],
      },
    ],
    elementTypes: [
      {
        id: "ster",
        label: "Ster",
        kort: "ST",
        shape: "bol",
        kleur: "#fde68a",
        properties: [
          { key: "kleur", datatype: "colour" },
          { key: "helderheid", label: "helderheid", datatype: "string" },
        ],
        compartments: [{ id: "metingen", label: "Metingen", fieldType: "meting" }],
      },
      {
        id: "planeet",
        label: "Planeet",
        kort: "PL",
        shape: "class-box",
        kleur: "#bbf7d0",
        properties: [{ key: "kleur", datatype: "colour" }],
        compartments: [{ id: "kenmerken", label: "Kenmerken", fieldType: "meting" }],
      },
    ],
    connectorVoorbeeld: true,
  });
}

// Het voorbeeld heeft ook een verbindingsregel; ontwerpUitProfiel leest die
// uit de descriptor — voeg hem daar toe via een kleine nabewerking.
const _voorbeeldBasis = voorbeeldOntwerp;
export function voorbeeldOntwerpMetRegel() {
  const ontwerp = _voorbeeldBasis();
  const ids = Object.values(ontwerp.elements).filter((el) => el.elementType === "elementDef");
  const ster = ids.find((el) => el.naam === "Ster");
  const planeet = ids.find((el) => el.naam === "Planeet");
  if (ster && planeet) {
    ontwerp.elements.voorbeeld_regel = {
      id: "voorbeeld_regel",
      naam: "draait om",
      elementType: "verbindingsregel",
      source: planeet.id,
      target: ster.id,
      compartimenten: [],
      data: { lijn: "solid", vorm: "recht", metKardinaliteiten: true, richtingOptie: true, doelKleur: "#64748b" },
    };
  }
  return ontwerp;
}
