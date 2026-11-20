// @ts-check
/**
 * profielOntwerp — trede 2 van de meta-editor (plan §8.9): een profiel
 * *tekenen* in plaats van typen — en wel conform het metamodel (§2):
 *
 *   ElementType ◆── CompartmentType ◆── FieldType, elk met eigen properties.
 *
 * Knoop- en lijnsoorten:
 *   - **Elementtype** («elementtype»): het vak "eigenschappen" beschrijft de PropertyTypes van
 *     het type; de rest van het ElementType staat in de inspector.
 *   - **Compartimenttype** («compartimenttype»): een sectie in het element;
 *     hangt via een ◆-compositie aan een Elementtype.
 *   - **Veldtype** («veldtype»): de regels in zo'n sectie; hangt via ◆ aan
 *     een Compartimenttype en heeft zijn eigen "eigenschappen" — precies
 *     FieldType 0..* PropertyType.
 *   - **Facet** en **Layoutstijl**: horen bij het DiagramType.
 *   - **compositie** (◆), **erft** (▷) en **verbindingsregel** (→): lijnen. Een verbindingsregel
 *     wordt een connector-ElementType van het doelprofiel; lijnen met dezelfde naam zijn samen
 *     één connectortype.
 *
 * **De taal is het M3** (Mark 19-11, `ontwerptaal.js`): welke eigenschappen een knoop in de
 * inspector heeft, volgt uit de metaklassen van `types/m3.js`, met de M3-naam achter `m3:`. De
 * eigenschappen van het profiel zelf (DiagramType) staan op het ontwerp-diagram (`m3Profiel`),
 * naast de shape-sets. Een paar gemak-vinkjes voor wie zelf tekent (container,
 * kardinaliteiten, richting, hiërarchie) blijven; ze gelden alleen als het M3-veld leeg is.
 *
 * `bouwProfielUitOntwerp` vertaalt de tekening naar een descriptor-kern
 * (trede 1-vorm, hooks op id); `ontwerpUitProfiel` is de omgekeerde weg —
 * een bestaande descriptor als ontwerp-diagram bekijken (en desgewenst
 * onder een nieuw id opnieuw genereren). Wat er op die rondreis nog verloren gaat, meet
 * `profielRondreis.js`.
 */

import { handlerInfo } from "../../diagramcore/types/handlerCatalogus.js";
import { AARD_CONNECTOR, AARD_ELEMENT } from "../../diagramcore/types/layoutStijl.js";
import { M3, m3PropertyTypes, naarData, uitData, naamNaarData, naamUitData } from "./ontwerptaal.js";

export const PROFIEL_ONTWERP_ID = "profiel-ontwerp";

/** Het veldtype van een regel in het vak "eigenschappen": een PropertyType. */
const EIGENSCHAP_VELDEN = [
  { key: "naam", label: "label (of de sleutel)", datatype: "string", verplicht: true },
  // Wat de knoop als type toont; wijzig je het, dan wint het boven m3:datatype.
  { key: "typeLabel", label: "datatype (getoond)", datatype: "string" },
  ...m3PropertyTypes("eigenschapDef"),
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
        ...m3PropertyTypes("elementDef"),
        // Gemak voor wie zelf tekent: kiest de lidmaatschapsrelatie als m3:containerVoor leeg is.
        { key: "container", label: "container (gemak; m3:containerVoor wint)", datatype: "boolean" },
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
      properties: m3PropertyTypes("compartimentDef"),
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
      properties: m3PropertyTypes("fieldDef"),
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
      // M3: ElementType erft van ElementType (EMOF superClass) — UML-pijl.
      id: "erft",
      label: "Erft van (▷)",
      omschrijving: "Overerving tussen elementtypen: het kind neemt shape, eigenschappen en compartimenten over.",
      kort: "▷",
      shape: "edge",
      icoon: "generalisatie",
      isConnector: true,
      bron: { elementTypes: ["elementDef"] },
      doel: { elementTypes: ["elementDef"] },
      edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569", markerEnd: "driehoek" },
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
        ...m3PropertyTypes("verbindingsregel"),
        // Gemak voor wie zelf tekent; m3:hooks, m3:properties en de hiërarchie van het profiel winnen.
        { key: "metKardinaliteiten", label: "kardinaliteiten-labels (gemak)", datatype: "boolean" },
        { key: "richtingOptie", label: "richting-vinkje → (gemak)", datatype: "boolean" },
        { key: "isHierarchie", label: "bevat-relatie, hiërarchie (gemak)", datatype: "boolean" },
      ],
    },
    {
      // M3 (18-10): DiagramType.facetten — een indeling met geordende waarden (ArchiMate: laag).
      // De naam van de node is de naam van het facet.
      id: "facetDef",
      label: "Facet",
      kort: "FAC",
      stereotype: "«facet»",
      shape: "class-box",
      kleur: "#fde68a",
      icoon: "elementtype",
      properties: m3PropertyTypes("facetDef"),
      compartments: [],
    },
    {
      // M3 (18-10): DiagramType.layoutStijlen — de weergave van de auto-layout. De naam van de
      // node is het label.
      id: "layoutStijlDef",
      label: "Layoutstijl",
      kort: "LAY",
      stereotype: "«layoutstijl»",
      shape: "class-box",
      kleur: "#a7f3d0",
      icoon: "elementtype",
      properties: m3PropertyTypes("layoutStijlDef"),
      compartments: [],
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
export function slug(tekst) {
  return (
    String(tekst || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "naamloos"
  );
}

/** Vormen die een zelf getekend elementtype mag kiezen zonder dat de vorm-registry geladen is. */
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

/** Sleutels van de gegevens van een knoop die niet in de inspector staan. */
const ID = `${M3}id`;
const LEEG = `${M3}_leeg`;
const REGELS = `${M3}_regels`;

function compVelden(el, compartmentType) {
  return (
    (el.compartimenten || []).find((c) => c.compartmentType === compartmentType)?.velden || []
  );
}

/** Een object zonder sleutels met `undefined`. */
const schoon = (obj) => Object.fromEntries(Object.entries(obj).filter(([, w]) => w !== undefined));

/** Een veld in het vak "eigenschappen" → PropertyType. */
function eigenschapVan(veld) {
  const d = veld.data || {};
  const vers = d[`${M3}key`] === undefined;
  const { key, datatype, ...rest } = uitData("eigenschapDef", d);
  const naam = naamUitData(veld);
  const getoond = d.typeLabel || "";
  return schoon({
    key: key ?? slug(veld.naam),
    label: vers ? veld.naam : naam.gezet ? naam.waarde : undefined,
    // Zelf getekend: het getoonde type is het datatype. Geladen: het M3-veld, tenzij je het
    // getoonde type hebt gewijzigd.
    datatype: vers ? (GELDIGE_DATATYPES.has(getoond) ? getoond : "string") : getoond && getoond !== (datatype ?? "") ? getoond : datatype,
    ...rest,
  });
}

/** De lijst eigenschappen uit een vak; bij een geladen knoop ook als hij leeg was. */
function lijstUit(el, soort, velden, vers) {
  if (velden.length) return velden;
  if (vers || (el.data?.[LEEG] || []).includes(soort)) return [];
  return undefined;
}

/** Elk (bron, doel)-paar van een of meer verbindingsregels, als "bron→doel". */
function parenVan(regels) {
  const lijst = (kant) => (Array.isArray(kant) ? kant : kant?.elementTypes || []);
  return regels.flatMap((r) => lijst(r.bron).flatMap((b) => lijst(r.doel).map((d) => `${b}→${d}`)));
}
/** De verbindingsregels van een connector, of zijn verkorte vorm (bron/doel). */
const regelsVan = (ct) => ct.verbindingsregels || [{ bron: ct.bron, doel: ct.doel }];
const zelfdeParen = (a, b) => JSON.stringify([...new Set(a)].sort()) === JSON.stringify([...new Set(b)].sort());

/**
 * Vertaal een getekend profiel-ontwerp naar een descriptor-kern
 * (trede 1-vorm, hooks als catalogus-id's).
 *
 * Shape-sets, de typering-standaard en de eigenschappen van het profiel zelf (`m3Profiel`) zijn
 * gegevens op diagram-niveau (géén model-elementen); ze komen als eigen velden op `state` binnen.
 *
 * Een knoop zonder `m3:id` is **zelf getekend**: dan vult de bouw aan wat een nieuw type nodig
 * heeft (korte code, kleur, een kleur-eigenschap). Een knoop met `m3:id` komt uit een profiel en
 * wordt zo letterlijk mogelijk teruggegeven.
 *
 * @param {{elements: Record<string, Object>, shapeSets?: Array, typeWeergave?: string, m3Profiel?: Record<string, any>}} state
 * @param {{id: string, label?: string}} opties
 */
export function bouwProfielUitOntwerp(state, { id, label }) {
  const els = Object.values(state?.elements || {});
  const perSoort = (soort) => els.filter((el) => el.elementType === soort);
  const defs = perSoort("elementDef");
  if (!defs.length) {
    throw new Error("Het ontwerp bevat nog geen Elementtype-nodes.");
  }
  const { id: _id, style, hierarchie: hierarchieVast, taakbalken, ...profiel } = uitData("profiel", state?.m3Profiel || {});

  // Bevat-relaties (composities): ET → CT's en CT → VT's.
  const composities = perSoort("compositie").filter((c) => c.source && c.target);
  const elementen = new Map(els.map((el) => [el.id, el]));
  const kinderenVan = (ouderId, soort) =>
    composities
      .filter((c) => c.source === ouderId && elementen.get(c.target)?.elementType === soort)
      .map((c) => elementen.get(c.target));

  const doelIdVoor = new Map();
  for (const def of defs) doelIdVoor.set(def.id, def.data?.[ID] || slug(def.naam));
  // Overerving: ▷-pijl kind → ouder (één ouder; de laatste getekende wint).
  const erftVan = new Map();
  for (const pijl of perSoort("erft")) {
    if (pijl.source && pijl.target && doelIdVoor.has(pijl.source) && doelIdVoor.has(pijl.target)) {
      erftVan.set(pijl.source, doelIdVoor.get(pijl.target));
    }
  }

  // Veldtypen (FieldTypes) van het doelprofiel: één per fieldDef-node.
  const fieldTypes = [];
  const fieldTypeIdVoor = new Map(); // fieldDef-node-id → fieldType-id
  for (const veldDef of perSoort("fieldDef")) {
    const d = veldDef.data || {};
    const { id: m3Id, ...rest } = uitData("fieldDef", d);
    const ftId = m3Id || slug(veldDef.naam);
    fieldTypeIdVoor.set(veldDef.id, ftId);
    if (fieldTypes.some((ft) => ft.id === ftId)) continue;
    const properties = compVelden(veldDef, "eigenschappen").map(eigenschapVan);
    // Elk veld heeft een naam; een zelf getekend veldtype krijgt die erbij.
    if (!m3Id && !properties.some((p) => p.key === "naam")) properties.unshift({ key: "naam", datatype: "string", verplicht: true });
    fieldTypes.push({ id: ftId, viewer: "naam-type", ...rest, properties });
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
    const vers = !d[ID];
    const { id: _etId, ...m } = uitData("elementDef", d);
    const naam = naamUitData(def);
    // CompartmentTypes: de CT-nodes die via ◆ aan dit ET hangen; hun
    // veldtype is de (eerste) VT-node die via ◆ aan de CT hangt.
    const compartments = kinderenVan(def.id, "compartimentDef").map((ct) => {
      const { id: ctId, ...ctRest } = uitData("compartimentDef", ct.data || {});
      const ctNaam = naamUitData(ct);
      const veldDef = kinderenVan(ct.id, "fieldDef")[0];
      return schoon({
        id: ctId || slug(ct.naam),
        label: ctNaam.gezet ? ctNaam.waarde : undefined,
        fieldType: veldDef ? fieldTypeIdVoor.get(veldDef.id) : fieldTypes[0].id,
        ...ctRest,
      });
    });
    const properties = compVelden(def, "eigenschappen").map(eigenschapVan);
    if (vers && !properties.some((p) => p.key === "kleur")) properties.unshift({ key: "kleur", datatype: "colour" });
    // Een geladen type zonder eigen vorm erft hem van zijn ouder (de registratie vlakt dat uit).
    const shape = vers ? (GELDIGE_SHAPES.has(m.shape) ? m.shape : "class-box") : m.shape || (erftVan.has(def.id) ? undefined : "class-box");
    const et = schoon({
      id: doelIdVoor.get(def.id),
      label: naam.gezet ? naam.waarde : def.naam,
      ...m,
      shape,
      ...(vers
        ? {
            kort: m.kort || def.naam.slice(0, 3).toUpperCase(),
            kleur: m.kleur || "#e2e8f0",
            ...(shape === "boundary" ? { achtergrond: m.achtergrond ?? true, handleStijl: m.handleStijl || "onzichtbaar" } : {}),
            ...(shape === "note" ? { handleStijl: m.handleStijl || "onzichtbaar" } : {}),
          }
        : {}),
      erft: erftVan.get(def.id),
      aard: AARD_ELEMENT.includes(m.aard) ? m.aard : undefined,
      properties: lijstUit(def, "properties", properties, vers),
      compartments: lijstUit(def, "compartments", compartments, vers),
      _containerWens: !m.containerVoor && d.container ? true : undefined,
    });
    elementTypes.push(et);
  }

  // Verbindingsregel-lijnen met dezelfde id (of naam) vormen samen één connectortype
  // met meerdere verbindingsregels (metametamodel: ConnectorType ◆ 1..*
  // Verbindingsregel) — het connectortype manifesteert zich als meerdere
  // lijnen. De gegevens van de eerste lijn winnen.
  const perConnectorType = new Map();
  perSoort("verbindingsregel")
    .filter((el) => el.source && el.target)
    .forEach((regel, i) => {
      const bron = doelIdVoor.get(regel.source);
      const doel = doelIdVoor.get(regel.target);
      if (!bron || !doel) return;
      const connectorId = regel.data?.[ID] || (slug(regel.naam) !== "naamloos" ? slug(regel.naam) : `regel-${i + 1}`);
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
    const vers = !d[ID];
    const { id: _cId, ...m } = uitData("verbindingsregel", d);
    const naam = naamUitData(eerste);
    // De regels zoals het profiel ze had (naar een abstract type, met kardinaliteiten), zolang de
    // lijnen nog precies dezelfde paren tekenen; anders wat er getekend is.
    // Paren met een type dat niet getekend is (een type uit het superprofiel) tellen daarbij niet.
    const bewaard = d[REGELS];
    const getekendeTypen = new Set(doelIdVoor.values());
    const tekenbaar = (paar) => paar.split("→").every((t) => getekendeTypen.has(t));
    const getekend = bewaard && zelfdeParen(parenVan(regelsVan(bewaard)).filter(tekenbaar), parenVan(regels))
      ? bewaard
      : regels.length === 1
        ? { bron: { elementTypes: regels[0].bron }, doel: { elementTypes: regels[0].doel } }
        : { verbindingsregels: regels };
    // Gemak-vinkjes: hooks op id plus de eigenschappen die ze tonen.
    const hooks = { ...(m.hooks || {}) };
    const properties = m.properties ? [...m.properties] : vers ? [{ key: "kleur", datatype: "colour" }] : undefined;
    const voegToe = (p) => properties && !properties.some((x) => x.key === p.key) && properties.push(p);
    if (d.metKardinaliteiten && !hooks.edgeLabels) {
      hooks.edgeLabels = "kardinaliteiten";
      voegToe({ key: "bronKardinaliteit", label: "kardinaliteit (bron)", datatype: "string" });
      voegToe({ key: "doelKardinaliteit", label: "kardinaliteit (doel)", datatype: "string" });
    }
    if (d.richtingOptie && !hooks.edgePresentatie) {
      hooks.edgePresentatie = "directioneel-pijl";
      voegToe({ key: "directioneel", label: "gericht (→ doel)", datatype: "boolean" });
    }
    const p = m.edgePresentatie || {};
    elementTypes.push(
      schoon({
        id: connectorId,
        label: naam.gezet ? naam.waarde || connectorId : eerste.naam || connectorId,
        ...m,
        kort: m.kort || (vers ? (p.markerStart === "ruit" ? "◆" : p.markerEnd === "driehoek" ? "▷" : "—") : undefined),
        // Een connector die van een knoop-type erft (Relatie → Gegevenselement) erft ook zijn vorm.
        shape: m.shape || (vers || !m.erft ? "edge" : undefined),
        isConnector: true,
        aard: AARD_CONNECTOR.includes(m.aard) ? m.aard : undefined,
        ...getekend,
        edgePresentatie: m.edgePresentatie || (vers ? { lijn: "solid", kleur: "#64748b" } : undefined),
        properties,
        hooks: Object.keys(hooks).length ? hooks : undefined,
      })
    );
  }

  // containerVoor (gemak): een ET met het container-vinkje en zonder m3:containerVoor krijgt het
  // (liefst hiërarchie-)connectortype waarvan hij bron is als lidmaatschapsrelatie.
  const bronnenVan = (ct) => regelsVan(ct).flatMap((r) => (Array.isArray(r.bron) ? r.bron : r.bron?.elementTypes || []));
  for (const et of elementTypes) {
    if (!et._containerWens) continue;
    delete et._containerWens;
    const kandidaat =
      elementTypes.find((ct) => ct.isConnector && hierarchieConnectoren.includes(ct.id) && bronnenVan(ct).includes(et.id)) ||
      elementTypes.find((ct) => ct.isConnector && bronnenVan(ct).includes(et.id));
    if (kandidaat) et.containerVoor = kandidaat.id;
  }

  // Facetten en layoutstijlen (M3, 18-10): getekende knopen → DiagramType.
  const facetten = {};
  for (const f of perSoort("facetDef")) {
    const { waarden } = uitData("facetDef", f.data || {});
    if (f.naam && Array.isArray(waarden) && waarden.length) facetten[f.naam.trim()] = waarden.map(String);
  }
  const layoutStijlen = perSoort("layoutStijlDef").map((st) => {
    const { id: stId, ...rest } = uitData("layoutStijlDef", st.data || {});
    const naam = naamUitData(st);
    return schoon({
      id: stId || slug(st.naam),
      label: naam.gezet ? naam.waarde : undefined,
      renderer: "leesvolgorde",
      ...rest,
    });
  });

  // Style-data (diagram-niveau): shape-sets + typering-standaard, pass-through.
  const shapeSets =
    Array.isArray(state?.shapeSets) && state.shapeSets.length ? state.shapeSets : null;
  // Hiërarchie: wat het profiel had wint; anders de gemak-vinkjes op de lijnen.
  const hierarchie = hierarchieVast ?? (hierarchieConnectoren.length ? (hierarchieConnectoren.length === 1 ? hierarchieConnectoren[0] : hierarchieConnectoren) : undefined);

  return schoon({
    ...profiel,
    id: slug(id),
    label: label || id,
    style: style || "uml-klassiek",
    typeWeergave: state?.typeWeergave || undefined,
    shapeSets: shapeSets || undefined,
    hierarchie,
    fieldTypes,
    elementTypes,
    facetten: Object.keys(facetten).length ? facetten : undefined,
    // `layoutStijlen: []` betekent "geen", niet "de standaard": dat onthoudt het diagram.
    layoutStijlen: layoutStijlen.length ? layoutStijlen : (state?.m3Profiel?.[LEEG] || []).includes("layoutStijlen") ? [] : undefined,
    taakbalken: taakbalken || [
      { id: "maken", label: "Maken", acties: "elementTypes" },
      { id: "verbinding", label: "Verbinding", acties: "connectorTypes" },
    ],
    // Eigen layouts (code op id) uit het profiel; anders maakt de registratie ze uit de layoutstijlen.
    layouts: profiel.layouts || [],
  });
}

/** "laag=business; aspect=actief" → {laag: "business", aspect: "actief"} (en een object blijft een object). */
export function leesFacetten(waarde) {
  if (waarde && typeof waarde === "object") return { ...waarde };
  const uit = {};
  for (const deel of String(waarde || "").split(/[;,]/)) {
    const [k, v] = deel.split("=").map((x) => x?.trim());
    if (k && v) uit[k] = v;
  }
  return uit;
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

/** Een PropertyType → een veld in het vak "eigenschappen". */
function eigenschapVeld(p) {
  const naam = p.label || p.key;
  return {
    naam,
    fieldType: "eigenschapDef",
    data: { typeLabel: p.datatype || "", ...naarData("eigenschapDef", p), ...naamNaarData(p.label, naam) },
  };
}

/** Eigen (niet-geërfde) compartimenten/eigenschappen van een uitgevlakt type. */
function eigenCompartments(et) {
  const geerfd = new Set(et._geerfd?.compartments || []);
  return (et.compartments || []).filter((ct) => !geerfd.has(ct.id));
}
function eigenProperties(et) {
  const geerfd = new Set(et._geerfd?.properties || []);
  return (et.properties || []).filter((pr) => !geerfd.has(pr.key));
}

/**
 * Wat een kind van zijn ouder erfde (een uitgevlakt type draagt de waarden van zijn ouder): die
 * hoeven niet nog eens op de knoop van het kind. Hooks en edgePresentatie zijn per sleutel
 * samengevoegd; die blijven staan.
 */
function geerfdeWaarden(et, perId) {
  const ouder = et.erft ? perId.get(et.erft) : null;
  if (!ouder) return new Set();
  const gelijk = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  return new Set(Object.keys(et).filter((k) => !["id", "label", "erft", "isAbstract", "hooks", "edgePresentatie"].includes(k) && k in ouder && gelijk(et[k], ouder[k])));
}

/** Een eindpunt of verbindingsregel zoals getekend: vóór de bereik-expansie, zonder `_`-sleutels. */
function voorExpansie(et) {
  const eindpunt = (e) => (e ? schoon({ ...Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith("_"))), elementTypes: e._voorExpansie || e.elementTypes }) : undefined);
  if (Array.isArray(et.verbindingsregels) && et.verbindingsregels.length) {
    return {
      verbindingsregels: et.verbindingsregels.map((r) => ({
        bron: Array.isArray(r.bron) ? r._bronVoorExpansie || r.bron : eindpunt(r.bron),
        doel: Array.isArray(r.doel) ? r._doelVoorExpansie || r.doel : eindpunt(r.doel),
      })),
    };
  }
  return schoon({ bron: eindpunt(et.bron), doel: eindpunt(et.doel) });
}

/** Welke lege lijsten een type had: die komen bij de bouw terug als lijst (en niet weg). */
const legeLijsten = (obj, sleutels) => {
  const leeg = sleutels.filter((k) => Array.isArray(obj[k]) && !obj[k].length);
  return leeg.length ? { [LEEG]: leeg } : {};
};

/**
 * Zet een descriptor(-kern) om in een ontwerp-diagram (elements + diagram),
 * klaar voor `laadModel` van de profiel-ontwerp-store. Werkt ook op de
 * ingebouwde profielen; functies (code) gaan niet mee, die staan alleen ter
 * informatie in het vak "implementatie".
 *
 * Zonder `prefix` krijgen de knopen een nieuw voorvoegsel per aanroep (de sandbox laadt een
 * profiel vaker naast zichzelf); mét een vast voorvoegsel zijn de id's stabiel, zodat een
 * project (het sidecar-project) bij een volgende export dezelfde elementen houdt.
 *
 * @param {Object} descriptor
 * @param {{prefix?: string}} [opties]
 * @returns {{elements: Record<string, Object>, diagrams: Record<string, Object>}}
 */
export function ontwerpUitProfiel(descriptor, { prefix: vast } = {}) {
  _ontwerpTeller += 1;
  const prefix = vast || `ow${_ontwerpTeller}`;
  const elements = {};
  const nodes = [];
  let vrijeVeldX = 60;

  const fieldTypesById = Object.fromEntries((descriptor.fieldTypes || []).map((ft) => [ft.id, ft]));
  const nodeIdVoorElementType = new Map();
  const veldDefVoorFieldType = new Map();

  // Superprofiel-typen (notitie, constraint, notitielijn, diagramverwijzing; M3 20-10) erft elk
  // profiel; ze horen niet in de tekening, net als geërfde eigenschappen.
  const eigen = (descriptor.elementTypes || []).filter((et) => !et._superprofiel);
  const perId = new Map(eigen.map((et) => [et.id, et]));
  const nietConnectoren = eigen.filter((et) => !et.isConnector);
  const connectoren = eigen.filter((et) => et.isConnector);

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
    const naam = et.label || et.id;
    elements[etNodeId] = {
      id: etNodeId,
      naam,
      elementType: "elementDef",
      compartimenten: [
        { compartmentType: "eigenschappen", velden: eigenProperties(et).map(eigenschapVeld) },
        ...(implementatieRegels.length
          ? [{ compartmentType: "implementatie", velden: implementatieRegels }]
          : []),
      ],
      data: {
        ...naarData("elementDef", et, geerfdeWaarden(et, perId)),
        [ID]: et.id,
        ...naamNaarData(et.label, naam),
        ...legeLijsten({ properties: et.properties ? eigenProperties(et) : undefined, compartments: et.compartments ? eigenCompartments(et) : undefined }, ["properties", "compartments"]),
      },
    };
    const x = 60 + kolom * 340;
    nodes.push({ elementId: etNodeId, position: { x, y: 60 } });

    eigenCompartments(et).forEach((ct, rij) => {
      const ctNodeId = `${prefix}_ct_${et.id}_${ct.id}`;
      const ctNaam = ct.label || ct.id;
      elements[ctNodeId] = {
        id: ctNodeId,
        naam: ctNaam,
        elementType: "compartimentDef",
        compartimenten: [],
        data: { ...naarData("compartimentDef", ct), ...naamNaarData(ct.label, ctNaam) },
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
          compartimenten: [{ compartmentType: "eigenschappen", velden: (ft.properties || []).map(eigenschapVeld) }],
          data: naarData("fieldDef", ft),
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

  // Veldtypen die geen compartiment gebruikt, horen ook bij het profiel: los op de rij eronder.
  for (const ft of descriptor.fieldTypes || []) {
    if (veldDefVoorFieldType.has(ft.id)) continue;
    const vtNodeId = `${prefix}_vt_${ft.id}`;
    veldDefVoorFieldType.set(ft.id, vtNodeId);
    elements[vtNodeId] = {
      id: vtNodeId,
      naam: ft.id,
      elementType: "fieldDef",
      compartimenten: [{ compartmentType: "eigenschappen", velden: (ft.properties || []).map(eigenschapVeld) }],
      data: naarData("fieldDef", ft),
    };
    nodes.push({ elementId: vtNodeId, position: { x: vrijeVeldX, y: 640 } });
    vrijeVeldX += 300;
  }

  // Overerving (M3): één ▷-pijl per kind → ouder.
  for (const et of nietConnectoren) {
    if (!et.erft || !nodeIdVoorElementType.has(et.erft)) continue;
    const id = `${prefix}_erft_${et.id}`;
    elements[id] = {
      id,
      naam: "",
      elementType: "erft",
      source: nodeIdVoorElementType.get(et.id),
      target: nodeIdVoorElementType.get(et.erft),
      compartimenten: [],
      data: {},
    };
  }

  connectoren.forEach((et, i) => {
    // Elk toegestaan (bron, doel)-paar wordt één regel-lijn; lijnen met
    // dezelfde id bundelen bij het genereren weer tot dit connectortype.
    const zoals = voorExpansie(et);
    const naam = et.label || et.id;
    const data = {
      ...naarData("verbindingsregel", et, geerfdeWaarden(et, perId)),
      [ID]: et.id,
      ...naamNaarData(et.label, naam),
      [REGELS]: zoals,
    };
    let volgnr = 0;
    for (const paar of parenVan(regelsVan(zoals))) {
      const [bronType, doelType] = paar.split("→");
      const bron = nodeIdVoorElementType.get(bronType);
      const doel = nodeIdVoorElementType.get(doelType);
      if (!bron || !doel) continue;
      volgnr += 1;
      const id = `${prefix}_regel_${i}_${volgnr}`;
      elements[id] = { id, naam, elementType: "verbindingsregel", source: bron, target: doel, compartimenten: [], data };
    }
  });

  // Facetten en layoutstijlen (M3, 18-10): één knoop per facet en per stijl, op een rij onder
  // de veldtypen — ze horen bij het DiagramType, niet bij één elementtype.
  let x2 = 60;
  for (const [naam, waarden] of Object.entries(descriptor.facetten || {})) {
    const id = `${prefix}_facet_${naam}`;
    elements[id] = { id, naam, elementType: "facetDef", compartimenten: [], data: { [`${M3}waarden`]: [...waarden] } };
    nodes.push({ elementId: id, position: { x: x2, y: 900 } });
    x2 += 300;
  }
  for (const st of descriptor.layoutStijlen || []) {
    const id = `${prefix}_stijl_${st.id}`;
    const naam = st.label || st.id;
    elements[id] = {
      id,
      naam,
      elementType: "layoutStijlDef",
      compartimenten: [],
      data: { ...naarData("layoutStijlDef", st), ...naamNaarData(st.label, naam) },
    };
    nodes.push({ elementId: id, position: { x: x2, y: 900 } });
    x2 += 300;
  }

  // Shape-sets, typering-standaard en de eigenschappen van het profiel zelf zijn gegevens op het
  // ontwerp-diagram (geen canvas-node): het shape-set-paneel bewerkt de eerste twee, en
  // `bouwProfielUitOntwerp` krijgt ze pass-through terug.
  const m3Profiel = { ...naarData("profiel", descriptor), ...legeLijsten(descriptor, ["layoutStijlen"]) };
  return {
    elements,
    diagrams: {
      ontwerp: {
        id: "ontwerp",
        naam: descriptor.label || descriptor.id,
        nodes,
        edges: [],
        ...(descriptor.shapeSets?.length ? { shapeSets: descriptor.shapeSets } : {}),
        ...(descriptor.typeWeergave ? { typeWeergave: descriptor.typeWeergave } : {}),
        ...(Object.keys(m3Profiel).length ? { m3Profiel } : {}),
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
  });
}

// Het voorbeeld heeft ook een verbindingsregel, zoals je hem zelf tekent: een lijn zonder
// m3:id, met de gemak-vinkjes voor kardinaliteiten en richting.
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
      data: {
        [`${M3}edgePresentatie`]: { lijn: "solid", vorm: "recht", kleur: "#64748b" },
        metKardinaliteiten: true,
        richtingOptie: true,
      },
    };
  }
  return ontwerp;
}
