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

const CONTAINER_TYPES = new Set(["formulier", "groep", "rij", "lijst", "conditioneel"]);

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
    case "groep": return el.label || "Groep";
    case "rij": return el.richting === "kolom" ? "Kolom" : "Rij";
    case "lijst": return el.label || el.bron || "Lijst";
    case "conditioneel": {
      const c = el.conditie;
      if (c?.veld) return `als ${c.veld} ${c.op || "nietleeg"}${c.waarde != null && c.waarde !== "" ? " " + c.waarde : ""}`;
      return el.als ? `als ${el.als}` : "Conditioneel";
    }
    default: return el.type;
  }
}

/** Container-specifieke data-properties. */
function containerData(el, meta) {
  switch (el.type) {
    case "formulier":
      return {
        ...(meta?.doeltype ? { doeltype: meta.doeltype } : {}),
        ...(meta?.status ? { status: meta.status } : {}),
        ...(meta?.isStandaard ? { isStandaard: true } : {}),
        ...(meta?.definitieVersie ? { definitieVersie: meta.definitieVersie } : {}),
      };
    case "groep": return { ...(el.context ? { context: el.context } : {}) };
    case "rij": return { ...(el.richting ? { richting: el.richting } : {}) };
    case "lijst": return { bron: el.bron || "", ...(el.min != null ? { min: String(el.min) } : {}), ...(el.max != null ? { max: String(el.max) } : {}) };
    case "conditioneel": {
      const c = el.conditie;
      if (c) return { conditieVeld: c.veld || "", conditieOp: c.op || "nietleeg", ...(c.waarde != null ? { conditieWaarde: String(c.waarde) } : {}) };
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
      ...(el.label ? { label: el.label } : {}),
      ...(el.breedte ? { breedte: el.breedte } : {}),
      ...(el.widget ? { widget: el.widget } : {}),
      ...(el.readonly ? { readonly: true } : {}),
      volgorde: String(volgorde),
    },
  };
}

/**
 * layoutNaarFormulierModel — layout-boom + definitie-meta → coreModel.
 *
 * @param {Object} root  layout-root ({ type: "formulier", elementen: [...] })
 * @param {Object} [meta]  { naam, doeltype, status, isStandaard, definitieVersie }
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
      data: containerData(el, el.type === "formulier" ? meta : null),
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
