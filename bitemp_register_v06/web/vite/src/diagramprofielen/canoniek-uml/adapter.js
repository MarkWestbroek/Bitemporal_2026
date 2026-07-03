// @ts-check
/**
 * adapter — beeldt het bestaande UML-model (store/useModelStore.js) af op het
 * generieke diagramcore-model (read-only spiegel, fase 1).
 *
 * Twee taken:
 *  1. Elementen → core-Elementen met compartimenten (velden/afgeleid/waarden/…).
 *  2. Diagram-edges → declaratieve `presentatie` voor de core-ConnectorEdge.
 *     De classificatie-logica (compositie/associatie/ASOC/dependency/…) is een
 *     port van MetamodelEdge.jsx — dit is precies de profiel-kennis die in
 *     fase 3 opgaat in de connector-materialisatie.
 *
 * Puur en zonder store-import: neemt een state-object aan (testbaar).
 * Bekende fase-1-verschillen t.o.v. de oude editor: geen overgeërfde-velden-
 * compartiment (vergt modeltraversal), geen domein-overlay, labels niet sleepbaar
 * (bestaande labelOffsets worden wél gerespecteerd).
 */
import { CANONIEK_UML_ID } from "./index.js";

/** Type-kolomtekst voor een veld — zelfde opbouw als EntiteitNode. */
export function veldTypeLabel(v) {
  return typeLabel(v);
}

function typeLabel(v) {
  let t = v.enumNaam || v.datatypeNaam || v.type || "";
  if (!v.enumNaam && !v.datatypeNaam && v.format) t += ` «${v.format}»`;
  if (v.autoIncrement) t += " {AI}";
  if (!v.enumNaam && v.enum) t += ` {${v.enum.join("|")}}`;
  return t;
}

function veldenCompartiment(d) {
  const velden = (d.velden || []).filter((v) => (v.naam || "").trim() !== "");
  if (velden.length === 0) return null;
  return {
    compartmentType: "velden",
    velden: velden.map((v) => ({
      naam: v.naam,
      fieldType: "attribuut",
      data: { verplicht: v.verplicht !== false, afgeleid: v.afgeleid === true, typeLabel: typeLabel(v) },
    })),
  };
}

function afgeleidCompartiment(d) {
  const avs = (d.afgeleideVelden || []).filter((v) => (v.naam || "").trim() !== "");
  if (avs.length === 0) return null;
  return {
    compartmentType: "afgeleid",
    velden: avs.map((av) => ({
      naam: av.naam,
      fieldType: "afgeleidVeld",
      data: {
        afgeleid: true,
        cursief: true,
        typeLabel: av.goType || "string",
        afleidingsregel: av.afleidingsregel || "",
      },
    })),
  };
}

function regelVelden(paren) {
  return paren
    .filter(([, waarde]) => waarde !== undefined && waarde !== null && waarde !== "")
    .map(([sleutel, waarde]) => ({ naam: `${sleutel}: ${waarde}`, fieldType: "regel" }));
}

/** @returns {import("../../diagramcore/model/schema.js").Element} */
function naarCoreElement(el) {
  const d = el.data || {};
  const basis = {
    id: el.id,
    elementType: el.type,
    naam: d.klassenaam || d.typenaam || d.naam || el.naam || el.id,
    compartimenten: [],
    data: {
      kleur: d.kleur,
      abstract: d.isAbstract === true,
      materieel: d.isMaterieel === true,
      domein: el.domein || d.domein || "",
      // Verliesvrije terugreis (fase 4): de volledige oude element-data als
      // bijlage. De terug-adapter gebruikt dit als basis en overschrijft met
      // wat in 0.5 bewerkt is.
      bron: d,
    },
  };

  switch (el.type) {
    case "entiteit": {
      if (d.entiteitSubtype === "referentielijst") basis.data.stereotype = "«referentielijst»";
      else if (d.entiteitSubtype === "referentielijst_item") basis.data.stereotype = "«ref.lijst item»";
      basis.compartimenten = [veldenCompartiment(d), afgeleidCompartiment(d)].filter(Boolean);
      break;
    }
    case "gegevenselement":
    case "relatie": {
      if (el.type === "relatie" && d.relatieSubtype === "referentielijst_items") {
        basis.data.stereotype = "«ref.lijst items»";
      }
      basis.compartimenten = [veldenCompartiment(d), afgeleidCompartiment(d)].filter(Boolean);
      break;
    }
    case "enumeratie": {
      const waarden = (d.waarden || []).filter((w) => (w || "").trim() !== "");
      if (waarden.length) {
        basis.compartimenten = [
          { compartmentType: "waarden", velden: waarden.map((w) => ({ naam: w, fieldType: "waarde" })) },
        ];
      }
      break;
    }
    case "gegevenstype": {
      const val = d.validatie || {};
      const wg = d.weergave || {};
      const eigenschappen = [
        { naam: "basistype", fieldType: "eigenschap", data: { typeLabel: d.basistype || "string" } },
        ...(d.format ? [{ naam: "format", fieldType: "eigenschap", data: { typeLabel: d.format } }] : []),
      ];
      const validatie = regelVelden([
        ["pattern", val.pattern],
        ["minLength", val.minLength],
        ["maxLength", val.maxLength],
        ["minimum", val.minimum],
        ["maximum", val.maximum],
        ["multipleOf", val.multipleOf],
        ...(val.regels || []).map((r) => ["regel", r?.naam || r]),
        ["norm", d.normalisatie],
      ]);
      const weergave = regelVelden([
        ["placeholder", wg.placeholder],
        ["mask", wg.inputMask],
        ["prefix", wg.prefix],
        ["suffix", wg.suffix],
      ]);
      basis.compartimenten = [
        { compartmentType: "eigenschappen", velden: eigenschappen },
        ...(validatie.length ? [{ compartmentType: "validatie", velden: validatie }] : []),
        ...(weergave.length ? [{ compartmentType: "weergave", velden: weergave }] : []),
      ];
      break;
    }
    case "referentielijstInstantie": {
      basis.naam = d.naam || d.systeemnaam || el.id;
      basis.compartimenten = [
        {
          compartmentType: "eigenschappen",
          velden: regelVelden([
            ["systeemnaam", d.systeemnaam],
            ["omschrijving", d.omschrijving],
          ]),
        },
      ].filter((c) => c.velden.length > 0);
      break;
    }
    case "notitie": {
      basis.naam = "";
      basis.data.tekst = d.tekst || "";
      break;
    }
    case "constraint": {
      basis.naam = d.naam || el.id;
      basis.data.expressie = d.expressie || "";
      break;
    }
    default:
      break;
  }
  return basis;
}

/**
 * Declaratieve edge-presentatie — port van de classificatie in MetamodelEdge.
 * @param {Object} edge - diagram-edge uit de oude store
 * @param {Record<string, Object>} bronElements - useModelStore.elements
 */
export function presentatieVoorEdge(edge, bronElements) {
  const d = edge.data || {};
  const offs = d.labelOffsets || {};
  const bronType = bronElements[edge.source]?.type;
  const doelType = bronElements[edge.target]?.type;

  if (d.kind === "scope") {
    return { lijn: "dash-4-4", kleur: "#9ca3af", vasteKleur: true, opacity: 0.75, labels: [] };
  }
  if (d.isDependency === true) {
    return {
      lijn: "dash-6-3",
      kleur: "#64748b",
      markerEnd: "pijl-open",
      labels: [{ zijde: "midden", delen: [{ tekst: "«use»", soort: "constraint", kleur: "#7c3aed" }] }],
    };
  }
  if (d.isGeneralization === true) {
    return {
      lijn: "solid",
      kleur: "#475569",
      markerEnd: "driehoek",
      labels: [
        { zijde: "midden", delen: [{ tekst: d.mixin ? "«Mixin»" : "«Generalisatie»", soort: "constraint", kleur: "#0d9488" }] },
      ],
    };
  }
  if (d.isAssociationClassLink === true) {
    return { lijn: "dash-4-3", kleur: "#94a3b8", labels: [] };
  }

  const isAssociation = d.isAssociation === true;
  const isComposition = !isAssociation && bronType === "entiteit" && doelType === "gegevenselement";
  const isCollapsed = !isAssociation && !isComposition && (bronType === "relatie" || doelType === "relatie");

  // Host-element voor heen/terug naam-labels (direct, of relatie via het anker)
  const doelEl = bronElements[edge.target];
  const bronEl = bronElements[edge.source];
  const directHost =
    doelType === "gegevenselement" || doelType === "relatie" ? doelEl : bronType === "relatie" ? bronEl : null;
  const anker = isAssociation
    ? (doelType === "associatieAnker" ? doelEl : bronType === "associatieAnker" ? bronEl : null)
    : null;
  const relViaAnker = anker ? bronElements[anker.data?.relatieNaam] : null;
  const host = directHost || relViaAnker;

  const labels = [];
  const constraint =
    d.momentvoorkomen === "enkelvoudig" ? "{enkelvoudig}" : d.momentvoorkomen === "meervoudig" ? "{meervoudig}" : "";
  const delen = [];
  if (d.rolnaam) delen.push({ tekst: d.rolnaam, soort: "rolnaam" });
  if (d.kardinaliteit) delen.push({ tekst: d.kardinaliteit, soort: "kardinaliteit" });
  if (constraint) delen.push({ tekst: constraint, soort: "constraint" });

  let markerStart = null;
  let markerEnd = null;

  if (isComposition) {
    markerStart = "ruit";
    if (delen.length) labels.push({ zijde: "doel", offset: offs.rolnaamDst, delen });
  } else if (isAssociation || isCollapsed) {
    const bijBron = (isAssociation && doelType === "associatieAnker") || (isCollapsed && doelType === "relatie");
    if (delen.length) {
      labels.push({ zijde: bijBron ? "bron" : "doel", offset: bijBron ? offs.rolnaamSrc : offs.rolnaamDst, delen });
    }
  }

  if (
    d.directioneel === true &&
    ((isAssociation && bronType === "associatieAnker") ||
      (isCollapsed && bronType === "relatie" && doelType === "entiteit"))
  ) {
    markerEnd = "pijl-open";
  }

  if (isComposition || isAssociation || isCollapsed) {
    const isAsocEdge1 = isAssociation && doelType === "associatieAnker"; // ENT → anker
    const isAsocEdge2 = isAssociation && bronType === "associatieAnker"; // anker → ENT
    const toonHeen = !isAssociation || isAsocEdge1;
    const toonTerug = !isAssociation || isAsocEdge2;
    const heen = toonHeen ? d.naamLabelHeen || host?.data?.naamLabelHeen || "" : "";
    const terug = toonTerug ? d.naamLabelTerug || host?.data?.naamLabelTerug || "" : "";
    if (heen) labels.push({ zijde: isAsocEdge1 ? "doel" : "bron", offset: offs.heen, delen: [{ tekst: `▶ ${heen}`, soort: "naam" }] });
    if (terug) labels.push({ zijde: isAsocEdge1 ? "bron" : "doel", offset: offs.terug, delen: [{ tekst: `◀ ${terug}`, soort: "naam" }] });
  }

  return { lijn: "solid", kleur: "#64748b", markerStart, markerEnd, labels };
}

/**
 * Converteer de volledige useModelStore-state naar een diagramcore-model.
 *
 * Fase 3B: relaties worden **teruggevouwen tot connector-elementen**
 * (metamodel: Connector = Element met source/target):
 *  - de REL-node wordt het connector-element (bron via structuralEdges,
 *    doel via data.doelEntiteit), mét kardinaliteiten/naamlabels in data;
 *  - het associatieAnker verdwijnt als element — de anker-positie verhuist
 *    naar `ankerPosition` op het diagram-lidmaatschap van de connector;
 *  - de oude ASOC-/collapsed-edges vervallen (de core materialiseert ze);
 *    dependencies («use») en scope-edges blijven, behalve «use»-edges vanaf
 *    een kale connector (geen box om aan te hangen).
 *
 * @param {{elements: Record<string, Object>, structuralEdges?: Array, diagrams: Record<string, Object>}} state
 */
export function vanCanoniekModel(state) {
  const bronElements = state?.elements || {};
  const structuralEdges = state?.structuralEdges || [];

  const relIds = new Set();
  const ankerIds = new Set();
  const ankerVoorRel = new Map(); // relId → anker-element-id
  for (const el of Object.values(bronElements)) {
    if (el?.type === "relatie") relIds.add(el.id);
    if (el?.type === "associatieAnker") {
      ankerIds.add(el.id);
      if (el.data?.relatieNaam) ankerVoorRel.set(el.data.relatieNaam, el.id);
    }
  }
  const bronVoorRel = new Map(); // relId → bron-entiteit-id
  const bronEdgeVoorRel = new Map(); // relId → structural-edge (voor terugreis)
  for (const e of structuralEdges) {
    if (relIds.has(e.target) && bronElements[e.source]?.type === "entiteit") {
      bronVoorRel.set(e.target, e.source);
      bronEdgeVoorRel.set(e.target, e);
    }
  }

  const elements = {};
  for (const el of Object.values(bronElements)) {
    if (!el?.id) continue;
    if (el.type === "associatieAnker") continue; // wordt synthetische canvas-node
    const core = naarCoreElement(el);
    if (el.type === "relatie") {
      const bron = bronVoorRel.get(el.id) || null;
      const doelNaam = el.data?.doelEntiteit;
      const doel = doelNaam && bronElements[doelNaam] ? doelNaam : null;
      if (bron && doel) {
        const d = el.data || {};
        core.source = bron;
        core.target = doel;
        core.data.bronKardinaliteit =
          d.bronKardinaliteit || (d.momentvoorkomen === "meervoudig" ? "0..*" : "0..1");
        core.data.doelKardinaliteit = d.doelKardinaliteit || "0..*";
        if (d.naamLabelHeen) core.data.naamLabelHeen = d.naamLabelHeen;
        if (d.naamLabelTerug) core.data.naamLabelTerug = d.naamLabelTerug;
        if (d.directioneel) core.data.directioneel = true;
        core.data.bronEdge = bronEdgeVoorRel.get(el.id)?.data || {};
      }
      // Zonder herleidbare bron/doel blijft het een losse (wees-)box.
    }
    elements[el.id] = core;
  }

  const heeftVelden = (id) =>
    (elements[id]?.compartimenten || []).some((c) => (c.velden || []).length > 0);

  const diagrams = {};
  for (const [id, diag] of Object.entries(state?.diagrams || {})) {
    // Anker-posities op dít diagram → ankerPosition op het rel-lidmaatschap
    const relAnkerPos = new Map();
    for (const n of diag.nodes || []) {
      const bronEl = bronElements[n.elementId];
      if (bronEl?.type === "associatieAnker" && bronEl.data?.relatieNaam) {
        relAnkerPos.set(bronEl.data.relatieNaam, n.position);
      }
    }

    const nodes = (diag.nodes || [])
      .filter((n) => elements[n.elementId])
      .map((n) => {
        const ref = {
          elementId: n.elementId,
          position: n.position || { x: 0, y: 0 },
          layoutLocked: n.layoutLocked || false,
        };
        if (relAnkerPos.has(n.elementId)) ref.ankerPosition = relAnkerPos.get(n.elementId);
        return ref;
      });

    const edges = (diag.edges || [])
      .filter((e) => {
        if (ankerIds.has(e.source) || ankerIds.has(e.target)) return false;
        const raaktRel = relIds.has(e.source) || relIds.has(e.target);
        if (!raaktRel) return true;
        const isBijzonder = e.data?.isDependency === true || e.data?.kind === "scope";
        if (!isBijzonder) return false; // ASOC-/collapsed-vorm → materialisatie
        // «use»/scope vanaf een kale connector heeft geen box om aan te hangen
        const relId = relIds.has(e.source) ? e.source : e.target;
        const isConnector = !!elements[relId]?.source;
        return !isConnector || heeftVelden(relId);
      })
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle || null,
        targetHandle: e.targetHandle || null,
        hidden: e.hidden || false,
        // `bron` = de ruwe oude edge-data — nodig voor de verliesvrije
        // terugreis (rolnaam/momentvoorkomen/isGeneralization/…).
        data: { presentatie: presentatieVoorEdge(e, bronElements), bron: e.data || {} },
      }));

    diagrams[id] = {
      id,
      naam: diag.naam || id,
      diagramType: CANONIEK_UML_ID,
      nodes,
      edges,
      viewport: diag.viewport,
    };
  }

  return {
    diagramTypeId: CANONIEK_UML_ID,
    elements,
    diagrams,
    // Meta voor de terugreis (storeNaarV3Model): niet-diagramgebonden info.
    // compositieEdges: structurele ENT→kind-edges die géén relatie-bron zijn.
    // Zonder deze kopie zou een compositie waarvan het kind op geen enkel
    // diagram staat (geen presentatie-edge) verloren gaan in de spiegel.
    meta: {
      modelMeta: state?.modelMeta || null,
      domains: state?.domains || [],
      domainMeta: state?.domainMeta || {},
      compositieEdges: structuralEdges
        .filter((e) => !relIds.has(e.target))
        .map((e) => ({ id: e.id, source: e.source, target: e.target, data: e.data || {} })),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Terug-adapter (fase 4): diagramcore-model → oude storevorm, zodat de
// bewezen serialisatie (store/adapters.js: storeNaarV3Model) hergebruikt kan
// worden. Basisprincipe "spiegel + delta": de bij de heenreis bewaarde
// `data.bron` is de basis; alles wat in 0.5 bewerkt is (naam, velden,
// kleuren, kardinaliteiten, verbindingen) overschrijft dat.
// ═══════════════════════════════════════════════════════════════════════════

/** typeLabel → oude type-informatie (basistype/format of enum/datatype/ref). */
function parseTypeLabel(label, coreElements) {
  const schoon = (label || "").replace(/\s*\{[^}]*\}\s*$/g, "").trim();
  if (!schoon) return { type: "string", format: "" };
  for (const el of Object.values(coreElements || {})) {
    if (el.naam !== schoon) continue;
    if (el.elementType === "enumeratie") {
      return { type: "string", format: "", enumNaam: schoon };
    }
    if (el.elementType === "gegevenstype") {
      const b = el.data?.bron || {};
      return { type: b.basistype || "string", format: b.format || "", datatypeNaam: schoon };
    }
    if (el.elementType === "entiteit" && el.data?.stereotype === "«ref.lijst item»") {
      return { type: "integer", format: "", refItemNaam: schoon };
    }
  }
  const m = /^([\w.-]+)(?:\s*«(.+)»)?$/.exec(schoon);
  if (m) return { type: m[1], format: m[2] || "" };
  return { type: "string", format: "" };
}

/** Core-veld → oude veldvorm (bron-veld als basis, delta overschrijft). */
function veldTerug(coreVeld, coreElements, bronVelden) {
  const d = coreVeld.data || {};
  const bron = (bronVelden || []).find((v) => v.naam === coreVeld.naam) || {};
  const veld = { ...bron, naam: coreVeld.naam };
  veld.verplicht = d.verplicht !== false;
  veld.afgeleid = d.afgeleid === true;
  if (d.afleidingsregel !== undefined) {
    veld.afleidingsregel = d.afleidingsregel;
    veld.afleidingsregelTaal = bron.afleidingsregelTaal || "cel";
  }
  const huidigLabel = bron.naam !== undefined ? veldTypeLabel(bron) : null;
  const label = (d.typeLabel || "").trim();
  if ((label && label !== huidigLabel) || bron.naam === undefined) {
    delete veld.enumNaam;
    delete veld.datatypeNaam;
    delete veld.refItemNaam;
    delete veld.enum;
    Object.assign(veld, parseTypeLabel(label, coreElements));
  }
  return veld;
}

function afgeleidVeldTerug(coreVeld, bronLijst) {
  const d = coreVeld.data || {};
  const bron = (bronLijst || []).find((v) => v.naam === coreVeld.naam) || {};
  return {
    ...bron,
    naam: coreVeld.naam,
    goType: (d.typeLabel || bron.goType || "string").trim() || "string",
    afleidingsregelTaal: bron.afleidingsregelTaal || "cel",
    afleidingsregel: d.afleidingsregel !== undefined ? d.afleidingsregel : bron.afleidingsregel || "",
  };
}

function compVelden(el, compartmentType) {
  return (
    (el.compartimenten || []).find((c) => c.compartmentType === compartmentType)?.velden || []
  );
}

/**
 * Converteer het diagramcore-model terug naar de oude storevorm
 * (elements/structuralEdges/diagrams + meta), klaar voor storeNaarV3Model.
 *
 * @param {{elements: Record<string, Object>, diagrams: Record<string, Object>, viewports?: Object, meta?: Object}} coreState
 * @returns {{elements: Object, structuralEdges: Array, diagrams: Object,
 *   domains: string[], domainMeta: Object, modelMeta: Object|null,
 *   overgeslagen: string[]}}
 */
export function naarCanoniekModel(coreState) {
  const coreEls = coreState?.elements || {};
  const elements = {};
  const structuralEdges = [];
  const overgeslagen = [];
  const composities = new Map(); // "src->tgt" → {source, target, data}
  const generalisaties = []; // {id, source, target, data}
  const gebruikConnectoren = [];

  // Seed met de bij de heenreis bewaarde structurele compositie-edges
  // (laagste prioriteit: connector-elementen en ruit-edges overschrijven).
  for (const e of coreState?.meta?.compositieEdges || []) {
    composities.set(`${e.source}->${e.target}`, {
      id: e.id,
      source: e.source,
      target: e.target,
      data: e.data || {},
    });
  }

  for (const el of Object.values(coreEls)) {
    const d = el.data || {};
    const bron = d.bron || {};
    const basisVelden = () => compVelden(el, "velden").map((v) => veldTerug(v, coreEls, bron.velden));
    const basisAfgeleid = () =>
      compVelden(el, "afgeleid").map((v) => afgeleidVeldTerug(v, bron.afgeleideVelden));

    switch (el.elementType) {
      case "entiteit":
        elements[el.id] = {
          id: el.id,
          naam: el.naam,
          type: "entiteit",
          domein: d.domein || "",
          data: {
            ...bron,
            typenaam: el.naam,
            kleur: d.kleur ?? bron.kleur,
            isAbstract: d.abstract === true,
            isMaterieel: d.materieel === true,
            velden: basisVelden(),
            afgeleideVelden: basisAfgeleid(),
          },
        };
        break;
      case "gegevenselement":
        elements[el.id] = {
          id: el.id,
          naam: el.naam,
          type: "gegevenselement",
          domein: d.domein || "",
          data: {
            ...bron,
            klassenaam: el.naam,
            typenaam: bron.typenaam || el.naam,
            kleur: d.kleur ?? bron.kleur,
            isMaterieel: d.materieel === true,
            velden: basisVelden(),
            afgeleideVelden: basisAfgeleid(),
          },
        };
        break;
      case "relatie": {
        const bronKard = d.bronKardinaliteit ?? bron.bronKardinaliteit;
        elements[el.id] = {
          id: el.id,
          naam: el.naam,
          type: "relatie",
          domein: d.domein || "",
          data: {
            ...bron,
            typenaam: el.naam,
            kleur: d.kleur ?? bron.kleur,
            isMaterieel: d.materieel === true,
            doelEntiteit: el.target || bron.doelEntiteit || "",
            bronKardinaliteit: bronKard,
            doelKardinaliteit: d.doelKardinaliteit ?? bron.doelKardinaliteit,
            naamLabelHeen: d.naamLabelHeen ?? bron.naamLabelHeen,
            naamLabelTerug: d.naamLabelTerug ?? bron.naamLabelTerug,
            directioneel: d.directioneel ?? bron.directioneel,
            momentvoorkomen:
              bronKard === "0..1" || bronKard === "1" ? "enkelvoudig" : "meervoudig",
            velden: basisVelden(),
            afgeleideVelden: basisAfgeleid(),
          },
        };
        if (el.source && el.target) {
          structuralEdges.push({
            id: `se_${el.id}`,
            source: el.source,
            target: el.id,
            data: { ...(d.bronEdge || {}) },
          });
        }
        break;
      }
      case "enumeratie":
        elements[el.id] = {
          id: el.id,
          naam: el.naam,
          type: "enumeratie",
          domein: d.domein || "",
          data: { ...bron, naam: el.naam, waarden: compVelden(el, "waarden").map((v) => v.naam) },
        };
        break;
      case "gegevenstype": {
        const eigenschap = (naam) =>
          compVelden(el, "eigenschappen").find((v) => v.naam === naam)?.data?.typeLabel;
        elements[el.id] = {
          id: el.id,
          naam: el.naam,
          type: "gegevenstype",
          domein: d.domein || "",
          data: {
            ...bron,
            naam: el.naam,
            basistype: eigenschap("basistype") || bron.basistype || "string",
            format: eigenschap("format") ?? bron.format,
            // Validatie/weergave/normalisatie: bron wint (0.5 toont ze als
            // platte tekstregels; structureel bewerken is een later punt).
          },
        };
        break;
      }
      case "referentielijstInstantie":
        elements[el.id] = {
          id: el.id,
          naam: el.naam,
          type: "referentielijstInstantie",
          domein: d.domein || "",
          data: { ...bron, naam: el.naam, systeemnaam: bron.systeemnaam || el.naam },
        };
        break;
      case "notitie":
        elements[el.id] = {
          id: el.id,
          naam: el.id,
          type: "notitie",
          domein: d.domein || "",
          data: { ...bron, tekst: d.tekst || "", kleur: d.kleur ?? bron.kleur },
        };
        break;
      case "constraint":
        elements[el.id] = {
          id: el.id,
          naam: el.naam,
          type: "constraint",
          domein: d.domein || "",
          data: { ...bron, naam: el.naam, expressie: d.expressie || "", kleur: d.kleur ?? bron.kleur },
        };
        break;
      case "compositie":
        if (el.source && el.target) {
          composities.set(`${el.source}->${el.target}`, {
            source: el.source,
            target: el.target,
            data: {},
          });
        }
        break;
      case "generalisatie":
        if (el.source && el.target) {
          generalisaties.push({
            id: `gen_${el.id}`,
            source: el.source,
            target: el.target,
            data: { isGeneralization: true },
          });
        }
        break;
      case "gebruik":
        if (el.source && el.target) gebruikConnectoren.push(el);
        break;
      default:
        // Types zonder oude tegenhanger (bv. boundary/kader) gaan niet mee.
        overgeslagen.push(el.naam || el.id);
        break;
    }
  }

  // ── Diagrammen: nodes + presentatie-edges terug naar de oude vorm ──
  const diagrams = {};
  for (const [id, diag] of Object.entries(coreState?.diagrams || {})) {
    diagrams[id] = {
      id,
      naam: diag.naam || id,
      nodes: (diag.nodes || [])
        .filter((n) => elements[n.elementId])
        .map((n) => ({
          elementId: n.elementId,
          position: n.position,
          ...(n.layoutLocked ? { layoutLocked: true } : {}),
        })),
      edges: (diag.edges || []).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: "metamodel",
        ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
        ...(e.targetHandle ? { targetHandle: e.targetHandle } : {}),
        ...(e.hidden ? { hidden: true } : {}),
        data: e.data?.bron || {},
      })),
    };
    const viewport = coreState?.viewports?.[id] || diag.viewport;
    if (viewport) diagrams[id].viewport = viewport;

    // Gespiegelde composities/generalisaties uit de presentatie-edges
    for (const e of diag.edges || []) {
      const b = e.data?.bron || {};
      if (e.data?.presentatie?.markerStart === "ruit") {
        const sleutel = `${e.source}->${e.target}`;
        const bestaand = composities.get(sleutel);
        composities.set(sleutel, {
          id: bestaand?.id,
          source: e.source,
          target: e.target,
          data: { ...(bestaand?.data || {}), ...b },
        });
      }
      if (b.isGeneralization) {
        generalisaties.push({ id: e.id, source: e.source, target: e.target, data: b });
      }
    }

    // «use»-connectoren → dependency-edges op elk diagram met beide uiteinden
    const opDiagram = new Set((diag.nodes || []).map((n) => n.elementId));
    for (const conn of gebruikConnectoren) {
      if (opDiagram.has(conn.source) && opDiagram.has(conn.target)) {
        diagrams[id].edges.push({
          id: `use_${conn.id}_${id}`,
          source: conn.source,
          target: conn.target,
          type: "metamodel",
          data: { isDependency: true },
        });
      }
    }
  }

  for (const [sleutel, c] of composities) {
    // Sla composities over waarvan een uiteinde niet (meer) bestaat,
    // bv. omdat het gegevenselement in 0.5 verwijderd is.
    if (!elements[c.source] || !elements[c.target]) continue;
    structuralEdges.push({
      id: c.id || `se_${sleutel}`,
      source: c.source,
      target: c.target,
      data: c.data || {},
    });
  }

  // Generalisaties horen in het "overzicht"-diagram (daar leest
  // storeNaarV3Model ze); dedupliceer op bron→doel.
  if (!diagrams.overzicht) {
    diagrams.overzicht = { id: "overzicht", naam: "Overzicht", nodes: [], edges: [] };
  }
  const genBestaand = new Set(
    diagrams.overzicht.edges
      .filter((e) => e.data?.isGeneralization)
      .map((e) => `${e.source}->${e.target}`)
  );
  for (const g of generalisaties) {
    const sleutel = `${g.source}->${g.target}`;
    if (genBestaand.has(sleutel)) continue;
    genBestaand.add(sleutel);
    diagrams.overzicht.edges.push({
      id: g.id,
      source: g.source,
      target: g.target,
      type: "metamodel",
      data: g.data,
    });
  }

  const meta = coreState?.meta || {};
  return {
    elements,
    structuralEdges,
    diagrams,
    domains: meta.domains || [],
    domainMeta: meta.domainMeta || {},
    modelMeta: meta.modelMeta || null,
    overgeslagen,
  };
}
