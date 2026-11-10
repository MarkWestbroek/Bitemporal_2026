// @ts-check
/**
 * adapter — FormulierDefinitie-layout ↔ formulier-profiel coreModel.
 *
 * P1 (F48): één richting — layout-boom (zoals de formulier-editor die kent,
 * met of zonder interne `_id`s) → { diagramTypeId, elements, diagrams, meta }.
 * Lossless-voorbereiding: veld- en container-volgorde landen als
 * `volgorde`-index in de data, zodat P2 de layout kan reconstrueren.
 *
 * Bron van waarheid blijft het register (zie het F48-plan §3); dit is een
 * projectie voor weergave/bewerking op de diagram-motor.
 */
import { FORMULIER_ID } from "./index.js";

const CONTAINER_TYPES = new Set(["formulier", "stap", "groep", "rij", "lijst", "conditioneel", "invoegen"]);

/**
 * Per layout-type de eigenschappen die het profiel zelf kent. De rest (bv. `uitleg`,
 * `validatie`, of iets wat later komt) gaat als JSON in `data.overig` mee en komt er bij de
 * terugweg ongeschonden weer uit (10-11). Sleutels met `_` (interne id's van de editor) niet.
 */
const BEKEND = {
  veld: ["type", "veld", "key", "label", "beschrijving", "verplicht", "elementId", "breedte", "widget", "vorm", "vormConfig", "readonly", "vasteWaarde", "kopieerNaar", "nieuwFormulier"],
  formulier: ["type", "elementen"],
  stap: ["type", "key", "label", "beschrijving", "elementen"],
  groep: ["type", "label", "context", "vorm", "vormConfig", "elementen"],
  rij: ["type", "richting", "elementen"],
  lijst: ["type", "bron", "label", "widget", "vorm", "vormConfig", "min", "max", "elementen"],
  conditioneel: ["type", "conditie", "als", "dan"],
  invoegen: ["type", "formulier"],
};

function overigData(el) {
  const bekend = new Set(BEKEND[el.type] || ["type"]);
  const rest = Object.fromEntries(Object.entries(el).filter(([k]) => !bekend.has(k) && !k.startsWith("_")));
  return Object.keys(rest).length ? { overig: JSON.stringify(rest) } : {};
}

function overigUitData(d) {
  if (!d?.overig) return {};
  try {
    const o = JSON.parse(d.overig);
    return o && typeof o === "object" && !Array.isArray(o) ? o : {};
  } catch {
    return {};
  }
}

/** Een conditiewaarde met zijn type (vinkje → true, niet "true"). */
function conditieWaardeData(waarde) {
  if (waarde == null) return {};
  const type = typeof waarde === "boolean" ? "boolean" : typeof waarde === "number" ? "number" : "";
  return { conditieWaarde: String(waarde), ...(type ? { conditieWaardeType: type } : {}) };
}

function conditieWaardeUitData(d) {
  const w = d.conditieWaarde;
  if (w == null || w === "") return undefined;
  if (d.conditieWaardeType === "boolean") return w === "true" || w === true;
  if (d.conditieWaardeType === "number" && Number.isFinite(Number(w))) return Number(w);
  return w;
}

/** Kinderen van een layout-element (`elementen` of `dan`). */
function kinderenVan(el) {
  if (!el) return [];
  if (el.type === "conditioneel") return Array.isArray(el.dan) ? el.dan : [];
  return Array.isArray(el.elementen) ? el.elementen : [];
}

/** Container-naam voor de node-titel. */
function containerNaam(el, meta) {
  switch (el.type) {
    case "formulier": return meta?.naam || "Formulier";
    case "stap": return el.label || "Stap";
    case "groep": return el.label || "Groep";
    case "rij": return el.richting === "kolom" ? "Kolom" : "Rij";
    case "lijst": return el.label || el.bron || "Lijst";
    case "invoegen": return el.formulier ? `invoegen: ${el.formulier}` : "Invoegen";
    case "conditioneel": {
      const c = el.conditie;
      if (c?.veld) return `als ${c.veld} ${c.op || "nietleeg"}${c.waarde != null && c.waarde !== "" ? " " + c.waarde : ""}`;
      return el.als ? `als ${el.als}` : "Conditioneel";
    }
    default: return el.type;
  }
}

/**
 * vorm + vormConfig (src/vormen/vormen.js) → node-data. De data van een node zijn strings,
 * dus vormConfig gaat als JSON-tekst mee; vormUitData zet hem terug.
 */
function vormData(el) {
  return {
    ...(el.vorm ? { vorm: el.vorm } : {}),
    ...(el.vormConfig != null ? { vormConfig: typeof el.vormConfig === "string" ? el.vormConfig : JSON.stringify(el.vormConfig) } : {}),
  };
}

function vormUitData(d) {
  if (!d) return {};
  let config;
  if (d.vormConfig != null && d.vormConfig !== "") {
    try { config = JSON.parse(d.vormConfig); } catch { config = d.vormConfig; } // ongeldige JSON niet weggooien
  }
  return { ...(d.vorm ? { vorm: d.vorm } : {}), ...(config !== undefined ? { vormConfig: config } : {}) };
}

/** Container-specifieke data-properties. */
function containerData(el, meta) {
  switch (el.type) {
    case "formulier":
      return {
        ...(meta?.code ? { code: meta.code } : {}),
        ...(meta?.doeltype ? { doeltype: meta.doeltype } : {}),
        ...(meta?.status ? { status: meta.status } : {}),
        ...(meta?.isStandaard ? { isStandaard: true } : {}),
        ...(meta?.definitieVersie ? { definitieVersie: meta.definitieVersie } : {}),
      };
    case "stap": return { ...(el.key ? { key: el.key } : {}), ...(el.beschrijving ? { beschrijving: el.beschrijving } : {}) };
    case "groep": return { ...(el.context ? { context: el.context } : {}), ...vormData(el) };
    case "invoegen": return { formulier: el.formulier || "" };
    case "rij": return { ...(el.richting ? { richting: el.richting } : {}) };
    case "lijst": return { bron: el.bron || "", ...(el.widget ? { widget: el.widget } : {}), ...vormData(el), ...(el.min != null ? { min: String(el.min) } : {}), ...(el.max != null ? { max: String(el.max) } : {}) };
    case "conditioneel": {
      const c = el.conditie;
      if (c) return { conditieVeld: c.veld || "", conditieOp: c.op || "nietleeg", ...conditieWaardeData(c.waarde) };
      return el.als ? { conditieVeld: String(el.als), conditieOp: "nietleeg" } : {};
    }
    default: return {};
  }
}

/** Layout-veld → compartiment-veld (fieldType "veld"). */
function naarCompVeld(el, volgorde) {
  return {
    naam: el.label || el.veld || "veld",
    fieldType: "veld",
    data: {
      veld: el.veld || "",
      ...(el.key ? { key: el.key } : {}),
      ...(el.label ? { label: el.label } : {}),
      ...(el.beschrijving ? { beschrijving: el.beschrijving } : {}),
      ...(typeof el.verplicht === "boolean" ? { verplicht: el.verplicht } : {}),
      ...(el.elementId ? { elementId: el.elementId } : {}),
      ...(el.breedte ? { breedte: el.breedte } : {}),
      ...(el.widget ? { widget: el.widget } : {}),
      ...vormData(el),
      ...(el.readonly ? { readonly: true } : {}),
      ...(el.vasteWaarde != null && el.vasteWaarde !== "" ? { vasteWaarde: String(el.vasteWaarde) } : {}),
      ...(el.kopieerNaar ? { kopieerNaar: el.kopieerNaar } : {}),
      ...(el.nieuwFormulier ? { nieuwFormulier: String(el.nieuwFormulier) } : {}),
      ...overigData(el),
      volgorde: String(volgorde),
    },
  };
}

/**
 * layoutNaarFormulierModel — layout-boom + definitie-meta → coreModel.
 *
 * @param {Object} root  layout-root ({ type: "formulier", elementen: [...] })
 * @param {Object} [meta]  { naam, code, doeltype, status, isStandaard, definitieVersie }
 * @returns {{ diagramTypeId: string, elements: Record<string, Object>, diagrams: Record<string, Object>, meta: Object|null }}
 */
export function layoutNaarFormulierModel(root, meta = {}) {
  const elements = {};
  let teller = 0;
  const vrijId = (basis) => `frm_${basis}_${(teller += 1)}`;

  /** @type {Array<{elementId: string, diepte: number, volgnr: number}>} */
  const nodesInfo = [];
  const perDiepte = {};

  function bouwContainer(el, ouderId, diepte, volgorde) {
    const id = vrijId(el.type);
    const compVelden = [];
    const subContainers = [];
    kinderenVan(el).forEach((kind, i) => {
      if (!kind) return;
      if (kind.type === "veld") compVelden.push(naarCompVeld(kind, i));
      else if (CONTAINER_TYPES.has(kind.type)) subContainers.push({ kind, i });
    });

    elements[id] = {
      id,
      naam: containerNaam(el, el.type === "formulier" ? meta : null),
      elementType: el.type,
      compartimenten: [{ compartmentType: "velden", velden: compVelden }],
      data: { ...containerData(el, el.type === "formulier" ? meta : null), ...overigData(el) },
    };

    perDiepte[diepte] = (perDiepte[diepte] || 0) + 1;
    nodesInfo.push({ elementId: id, diepte, volgnr: perDiepte[diepte] - 1 });

    if (ouderId) {
      const connId = vrijId("bevat");
      elements[connId] = {
        id: connId,
        naam: "",
        elementType: "bevat",
        source: ouderId,
        target: id,
        compartimenten: [],
        data: { volgorde: String(volgorde) },
      };
    }

    subContainers.forEach(({ kind, i }) => bouwContainer(kind, id, diepte + 1, i));
    return id;
  }

  if (root && root.type === "formulier") {
    bouwContainer(root, null, 0, 0);
  }

  // Eenvoudige boom-layout: diepte = rij (y), volgnummer = kolom (x).
  const diagramId = "frm_overzicht";
  const nodes = nodesInfo.map(({ elementId, diepte, volgnr }) => ({
    elementId,
    position: { x: 40 + volgnr * 260, y: 40 + diepte * 200 },
  }));

  return {
    diagramTypeId: FORMULIER_ID,
    elements,
    diagrams: { [diagramId]: { id: diagramId, naam: meta?.naam || "Formulier", nodes, edges: [] } },
    meta: meta && Object.keys(meta).length ? { ...meta } : null,
  };
}

/** Nummer uit een volgorde-string (fallback voor elementen zonder index). */
function volgordeVan(waarde, fallback) {
  const n = Number(waarde);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * formulierModelNaarLayout — omgekeerde richting (P2): coreModel → layout-boom
 * + definitie-meta. Volgorde wordt gereconstrueerd uit de `volgorde`-indices
 * (compartiment-velden en `bevat`-connectoren, samengevoegd per ouder);
 * elementen zonder index sorteren achteraan in aanmaakvolgorde.
 *
 * Naam-conventie terug: de node-titel van groep/lijst wordt het `label`,
 * behalve als hij gelijk is aan de default ("Groep", de bron of "Lijst").
 *
 * @param {{elements?: Record<string, Object>}} coreState
 * @returns {{ layout: Object|null, meta: Object }}
 */
export function formulierModelNaarLayout(coreState) {
  const elements = coreState?.elements || {};
  const kinderenPerOuder = {};
  for (const el of Object.values(elements)) {
    if (el.elementType !== "bevat" || !el.source || !el.target) continue;
    (kinderenPerOuder[el.source] ||= []).push({ id: el.target, volgorde: el.data?.volgorde });
  }

  const bezocht = new Set();

  function bouw(el, extraIndex) {
    if (!el || bezocht.has(el.id)) return null; // cyclus-/dubbelguard
    bezocht.add(el.id);
    const d = el.data || {};

    const compVelden = (
      (el.compartimenten || []).find((c) => c.compartmentType === "velden")?.velden || []
    ).map((v, i) => ({
      volgorde: volgordeVan(v.data?.volgorde, 1e6 + i),
      el: {
        type: "veld",
        veld: v.data?.veld || "",
        ...(v.data?.key ? { key: v.data.key } : {}),
        ...(v.data?.label ? { label: v.data.label } : {}),
        ...(v.data?.beschrijving ? { beschrijving: v.data.beschrijving } : {}),
        ...(typeof v.data?.verplicht === "boolean" ? { verplicht: v.data.verplicht } : {}),
        ...(v.data?.elementId ? { elementId: v.data.elementId } : {}),
        ...(v.data?.breedte ? { breedte: v.data.breedte } : {}),
        ...(v.data?.widget ? { widget: v.data.widget } : {}),
        ...vormUitData(v.data),
        ...(v.data?.readonly ? { readonly: true } : {}),
        ...(v.data?.vasteWaarde != null && v.data.vasteWaarde !== "" ? { vasteWaarde: v.data.vasteWaarde } : {}),
        ...(v.data?.kopieerNaar ? { kopieerNaar: v.data.kopieerNaar } : {}),
        ...(v.data?.nieuwFormulier ? { nieuwFormulier: v.data.nieuwFormulier } : {}),
        ...overigUitData(v.data),
      },
    }));

    const subs = (kinderenPerOuder[el.id] || []).map((k, i) => ({
      volgorde: volgordeVan(k.volgorde, 2e6 + i),
      el: bouw(elements[k.id], i),
    })).filter((x) => x.el);

    const kinderen = [...compVelden, ...subs].sort((a, b) => a.volgorde - b.volgorde).map((x) => x.el);

    const uit = layoutElementVan(el, d, kinderen);
    return uit ? { ...uit, ...overigUitData(d) } : null;
  }

  function layoutElementVan(el, d, kinderen) {
    switch (el.elementType) {
      case "formulier":
        return { type: "formulier", elementen: kinderen };
      case "stap":
        return {
          type: "stap",
          ...(d.key ? { key: d.key } : {}),
          ...(el.naam && el.naam !== "Stap" ? { label: el.naam } : {}),
          ...(d.beschrijving ? { beschrijving: d.beschrijving } : {}),
          elementen: kinderen,
        };
      case "invoegen":
        return { type: "invoegen", formulier: d.formulier || "" };
      case "groep":
        return {
          type: "groep",
          ...(el.naam && el.naam !== "Groep" ? { label: el.naam } : {}),
          ...(d.context ? { context: d.context } : {}),
          ...vormUitData(d),
          elementen: kinderen,
        };
      case "rij":
        return { type: "rij", ...(d.richting ? { richting: d.richting } : {}), elementen: kinderen };
      case "lijst":
        return {
          type: "lijst",
          bron: d.bron || "",
          ...(el.naam && el.naam !== "Lijst" && el.naam !== d.bron ? { label: el.naam } : {}),
          ...(d.widget ? { widget: d.widget } : {}),
          ...vormUitData(d),
          ...(d.min != null && d.min !== "" ? { min: Number(d.min) } : {}),
          ...(d.max != null && d.max !== "" ? { max: Number(d.max) } : {}),
          elementen: kinderen,
        };
      case "conditioneel":
        return {
          type: "conditioneel",
          conditie: {
            veld: d.conditieVeld || "",
            op: d.conditieOp || "nietleeg",
            ...(conditieWaardeUitData(d) !== undefined ? { waarde: conditieWaardeUitData(d) } : {}),
          },
          dan: kinderen,
        };
      default:
        return null; // notities e.d. horen niet in de layout
    }
  }

  const root = Object.values(elements).find((e) => e.elementType === "formulier");
  const layout = root ? bouw(root, 0) : null;
  const rd = root?.data || {};
  const meta = root
    ? {
        naam: root.naam || "",
        ...(rd.code ? { code: rd.code } : {}),
        ...(rd.doeltype ? { doeltype: rd.doeltype } : {}),
        ...(rd.status ? { status: rd.status } : {}),
        ...(rd.isStandaard ? { isStandaard: true } : {}),
        ...(rd.definitieVersie ? { definitieVersie: rd.definitieVersie } : {}),
      }
    : {};
  return { layout, meta };
}
