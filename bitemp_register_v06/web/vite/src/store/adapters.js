/**
 * adapters.js — Transformatie tussen V3 model format en Zustand store format.
 *
 * v3ModelNaarStore():  V3 JSON → { elements, structuralEdges, diagrams, domains, modelMeta }
 * storeNaarV3Model():  store state → V3 JSON (roundtrip-compatibel)
 *
 * Verschil met v3ModelNaarEditor.js:
 * - Posities zitten NIET in de elementen, maar in het diagram
 * - Elementen zijn een flat Record<id, element> (snelle lookup)
 * - Eén "overzicht" diagram wordt automatisch aangemaakt met alle posities
 */
import { defaultKleur } from "@editor/metamodel/types.js";
import { DEFAULT_DIAGRAM_ID } from "./useModelStore.js";

// ─── Helpers ────────────────────────────────────────────────

/**
 * Genereer een geldige, unieke Go-constNaam voor een enum-waarde.
 * Prefixed met het enum GoType zodat constNamen cross-enum uniek zijn.
 * Bijv. enum "Status" + waarde "concept" → "StatusConcept".
 */
function maakConstNaam(enumGoType, waarde) {
  const sanitized = String(waarde).replace(/[^a-zA-Z0-9]+/g, " ").trim();
  const suffix = sanitized
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  return (enumGoType || "Enum") + (suffix || "Onbekend");
}

function goTypeNaarVeldType(goType) {
  const t = (goType || "").startsWith("*") ? goType.slice(1) : goType || "";
  switch (t) {
    case "string":
      return { type: "string", format: "" };
    case "int":
    case "int32":
    case "int64":
      return { type: "integer", format: "" };
    case "float32":
    case "float64":
      return { type: "number", format: "float64" };
    case "bool":
      return { type: "boolean", format: "" };
    case "Date":
      return { type: "string", format: "date" };
    case "time.Time":
      return { type: "string", format: "date-time" };
    default:
      return { type: "string", format: "" };
  }
}

function convertV3Veld(v3Veld, enumLookup, datatypeLookup) {
  const datatype = v3Veld.datatype
    ? datatypeLookup[v3Veld.datatype]
    : datatypeLookup[v3Veld.goType];
  const mapped = goTypeNaarVeldType(v3Veld.goType || "string");
  const type = datatype?.basistype || mapped.type;
  const format = datatype?.format || mapped.format;
  const enumBestaat = Boolean(v3Veld.enum && enumLookup[v3Veld.enum]);
  const enumWaarden = enumBestaat ? enumLookup[v3Veld.enum] : null;

  return {
    naam: v3Veld.naam,
    type,
    format,
    datatypeNaam: v3Veld.datatype || datatype?.naam || null,
    enum: enumWaarden,
    enumNaam: enumBestaat ? v3Veld.enum : null,
    refNaam: v3Veld["$ref"] || null,
    refItemNaam: v3Veld["$ref"] || v3Veld.refItemNaam || null,
    verplicht: !(v3Veld.goType || "").startsWith("*"),
    autoIncrement: false,
    description: v3Veld.description || "",
    afgeleid: v3Veld.afgeleid || false,
    afleidingsregelTaal: v3Veld.afleidingsregelTaal || "cel",
    afleidingsregel: v3Veld.afleidingsregel || "",
  };
}

function afgeleideVeldenConvert(arr) {
  return (arr || []).map((av) => ({
    naam: av.naam || "",
    description: av.description || "",
    goType: av.goType || "string",
    afleidingsregelTaal: av.afleidingsregelTaal || "cel",
    afleidingsregel: av.afleidingsregel || "",
    isWeergaveVeld: av.isWeergaveVeld || av.weergaveVeld || false,
  }));
}

// ─── V3 → Store ─────────────────────────────────────────────

/**
 * Transformeer een V3 model-object naar Zustand store format.
 *
 * @param {object} v3Full  - Volledig V3 object (met bron, model, etc.)
 * @returns {{ elements, structuralEdges, diagrams, domains, modelMeta }}
 */
export function v3ModelNaarStore(v3Full) {
  const v3Model = v3Full?.model || v3Full;
  const elements = {};
  const structuralEdges = [];
  const diagramNodes = [];  // tijdelijk: voor het overzicht-diagram
  const diagramEdges = [];

  // Lookups
  const enumLookup = {};
  (v3Model.enums || []).forEach((e) => {
    enumLookup[e.goType] = (e.waarden || []).map((w) => w.waarde);
  });
  const datatypeLookup = {};
  (v3Model.datatypes || []).forEach((dt) => {
    datatypeLookup[dt.naam] = dt;
  });

  // Domein-inferentie voor enums (zelfde logica als v3ModelNaarEditor)
  const inferredEnumDomein = {};
  const noteEnumDomein = (enumNaam, domeinKandidaat) => {
    if (!enumNaam) return;
    const domein = String(domeinKandidaat || "").trim();
    if (!domein) return;
    const bestaand = inferredEnumDomein[enumNaam] || "";
    if (!bestaand || (bestaand === "register" && domein !== "register")) {
      inferredEnumDomein[enumNaam] = domein;
    }
  };
  (v3Model.entiteiten || []).forEach((ent) => {
    const entDomein = ent?.domein || "";
    (ent?.gegevenselementen || []).forEach((ge) => {
      (ge?.velden || []).forEach((v) => noteEnumDomein(v?.enum, ge?.domein || entDomein));
    });
    (ent?.relaties || []).forEach((rel) => {
      (rel?.velden || []).forEach((v) => noteEnumDomein(v?.enum, rel?.domein || entDomein));
    });
  });

  // --- Enums ---
  (v3Model.enums || []).forEach((e, i) => {
    const id = `enum_${e.goType}`;
    elements[id] = {
      id,
      naam: e.goType,
      type: "enumeratie",
      domein: e.domein || inferredEnumDomein[e.goType] || "",
      data: {
        naam: e.goType,
        domein: e.domein || inferredEnumDomein[e.goType] || "",
        baseType: e.baseType || "string",
        waarden: (e.waarden || []).map((w) => w.waarde),
      },
    };
    diagramNodes.push({
      elementId: id,
      position: e.positie || { x: 50 + i * 220, y: 550 },
    });
  });

  // --- Datatypes ---
  (v3Model.datatypes || []).forEach((dt, i) => {
    const id = `dt_${dt.naam}`;
    elements[id] = {
      id,
      naam: dt.naam,
      type: "gegevenstype",
      domein: dt.domein || "",
      data: {
        naam: dt.naam,
        description: dt.description || "",
        domein: dt.domein || "",
        basistype: dt.basistype || "string",
        format: dt.format || "",
        validatie: dt.validatie || {},
        normalisatie: dt.normalisatie || "",
        weergave: dt.weergave || {},
      },
    };
    diagramNodes.push({
      elementId: id,
      position: dt.positie || { x: 500 + i * 280, y: 650 },
    });
  });

  // --- Referentielijst-instanties ---
  (v3Model.referentielijstInstanties || []).forEach((ri, i) => {
    const id = `refinstantie_${ri.systeemnaam}`;
    elements[id] = {
      id,
      naam: ri.naam || ri.systeemnaam,
      type: "referentielijstInstantie",
      domein: ri.domein || "",
      data: {
        systeemnaam: ri.systeemnaam || "",
        naam: ri.naam || "",
        omschrijving: ri.omschrijving || "",
      },
    };
    diagramNodes.push({
      elementId: id,
      position: ri.positie || { x: 800 + i * 280, y: 50 },
    });
  });

  // --- Entiteiten + GE's + Relaties ---
  (v3Model.entiteiten || []).forEach((ent, entIdx) => {
    // Entiteit zelf
    elements[ent.typenaam] = {
      id: ent.typenaam,
      naam: ent.typenaam,
      type: "entiteit",
      domein: ent.domein || "",
      data: {
        typenaam: ent.typenaam,
        klassenaam: ent.typenaam,
        description: ent.description || "",
        domein: ent.domein || "",
        meervoud: ent.meervoud || "",
        metatype: "entiteit",
        isMaterieel: ent.isMaterieel || false,
        entiteitSubtype: ent.entiteitSubtype || "",
        kleur: ent.kleur || defaultKleur("entiteit", ent.entiteitSubtype || ""),
        velden: [],
        afgeleideVelden: afgeleideVeldenConvert(ent.afgeleideVelden),
      },
    };
    diagramNodes.push({
      elementId: ent.typenaam,
      position: ent.positie || { x: entIdx * 500, y: 50 },
    });

    // GE's
    (ent.gegevenselementen || []).forEach((ge, geIdx) => {
      const geId = `${ent.typenaam}_${ge.naam}`;
      const velden = (ge.velden || []).map((v) => convertV3Veld(v, enumLookup, datatypeLookup));

      elements[geId] = {
        id: geId,
        naam: ge.naam,
        type: "gegevenselement",
        domein: ge.domein || ent.domein || "",
        data: {
          typenaam: geId,
          klassenaam: ge.naam,
          description: ge.description || "",
          domein: ge.domein || ent.domein || "",
          meervoud: ge.meervoud || "",
          metatype: "gegevenselement",
          isMaterieel: ge.isMaterieel || false,
          kleur: defaultKleur("gegevenselement"),
          velden,
          afgeleideVelden: afgeleideVeldenConvert(ge.afgeleideVelden),
        },
      };
      diagramNodes.push({
        elementId: geId,
        position: ge.positie || { x: entIdx * 500 - 150 + geIdx * 250, y: 300 },
      });

      // Structurele edge: entiteit → GE
      const geEdge = {
        id: ge.id || `${ent.typenaam}->${geId}`,
        source: ent.typenaam,
        target: geId,
        data: {
          rolnaam: ge.naam,
          jsonRolnaam: ge.meervoud || ge.naam.toLowerCase(),
          momentvoorkomen: ge.momentvoorkomen || "enkelvoudig",
          kardinaliteit: ge.momentvoorkomen === "meervoudig" ? "0..*" : "0..1",
        },
      };
      structuralEdges.push(geEdge);
      diagramEdges.push({
        ...geEdge,
        type: "metamodel",
        sourceHandle: ge.sourceHandle || null,
        targetHandle: ge.targetHandle || null,
      });

      // Dependency edges vanuit GE-velden (met useEdges voor handles/hidden)
      addFieldDependencyEdges(velden, geId, ge.velden || [], datatypeLookup, diagramEdges, ge.useEdges, enumLookup);
    });

    // Relaties
    (ent.relaties || []).forEach((rel) => {
      if (!elements[rel.naam]) {
        const velden = (rel.velden || []).map((v) => convertV3Veld(v, enumLookup, datatypeLookup));

        elements[rel.naam] = {
          id: rel.naam,
          naam: rel.naam,
          type: "relatie",
          domein: rel.domein || ent.domein || "",
          data: {
            typenaam: rel.naam,
            klassenaam: rel.naam,
            description: rel.description || "",
            domein: rel.domein || ent.domein || "",
            meervoud: rel.meervoud || "",
            metatype: "relatie",
            isMaterieel: rel.isMaterieel || false,
            relatieSubtype: rel.relatieSubtype || "",
            referentielijstInstantie: rel.referentielijstInstantie || "",
            kleur: defaultKleur("relatie", rel.relatieSubtype || ""),
            velden,
            afgeleideVelden: afgeleideVeldenConvert(rel.afgeleideVelden),
            doelEntiteit: rel.doelEntiteit || "",
          },
        };
        diagramNodes.push({
          elementId: rel.naam,
          position: rel.positie || { x: entIdx * 500 + 200, y: 170 },
        });

        // Dependency edges vanuit relatie-velden (met useEdges voor handles/hidden)
        addFieldDependencyEdges(velden, rel.naam, rel.velden || [], datatypeLookup, diagramEdges, rel.useEdges, enumLookup);
      }

      // Structurele edge: entiteit → relatie (eigenaar)
      const relEdge = {
        id: rel.id || `${ent.typenaam}->${rel.naam}`,
        source: ent.typenaam,
        target: rel.naam,
        data: {
          rolnaam: rel.naam,
          jsonRolnaam: rel.meervoud || rel.naam.toLowerCase(),
          momentvoorkomen: rel.momentvoorkomen || "meervoudig",
          kardinaliteit: rel.momentvoorkomen === "meervoudig" ? "0..*" : "0..1",
        },
      };
      structuralEdges.push(relEdge);
      diagramEdges.push({
        ...relEdge,
        type: "metamodel",
        sourceHandle: rel.sourceHandle || null,
        targetHandle: rel.targetHandle || null,
      });

      // Doel-edge: relatie → doel-entiteit
      if (rel.doelEntiteit) {
        diagramEdges.push({
          id: rel.doelId || `${rel.naam}->${rel.doelEntiteit}`,
          source: rel.naam,
          target: rel.doelEntiteit,
          type: "metamodel",
          sourceHandle: rel.doelSourceHandle || null,
          targetHandle: rel.doelTargetHandle || null,
          data: {
            rolnaam: `→ ${rel.doelEntiteit}`,
            jsonRolnaam: rel.doelEntiteit.toLowerCase(),
            momentvoorkomen: "meervoudig",
            kardinaliteit: "0..*",
          },
        });
      }

      // Binding edge: referentielijstInstantie → items-relatie
      if (rel.referentielijstInstantie) {
        const instantieNodeId = `refinstantie_${rel.referentielijstInstantie}`;
        diagramEdges.push({
          id: rel.instantieId || `${rel.naam}-->instantie_${rel.referentielijstInstantie}`,
          source: instantieNodeId,
          target: rel.naam,
          type: "metamodel",
          sourceHandle: rel.instantieSourceHandle || null,
          targetHandle: rel.instantieTargetHandle || null,
          data: {
            isDependency: true,
            rolnaam: `⇢ ${rel.referentielijstInstantie}`,
            jsonRolnaam: "",
            momentvoorkomen: "",
            kardinaliteit: "",
          },
        });
      }
    });
  });

  // --- Domeinen verzamelen ---
  const domeinSet = new Set();
  for (const el of Object.values(elements)) {
    if (el.domein) domeinSet.add(el.domein);
  }
  const domains = [...domeinSet].sort((a, b) => {
    if (a === "register") return -1;
    if (b === "register") return 1;
    return a.localeCompare(b);
  });

  // --- Overzicht diagram (alle elementen) ---
  const diagrams = {
    [DEFAULT_DIAGRAM_ID]: {
      id: DEFAULT_DIAGRAM_ID,
      naam: "Overzicht",
      domein: null,
      nodes: diagramNodes,
      edges: diagramEdges,
      viewport: null,  // null → fitView wordt toegepast bij eerste render
    },
  };

  // Model metadata
  const modelMeta = {
    bron: v3Full?.bron || "import",
    build_versie: v3Full?.build_versie || "",
    go_module: v3Full?.go_module || "",
    id: v3Full?.id || null,
    indiener: v3Full?.indiener || "",
    versie: v3Model?.versie || "v3",
    naam: v3Model?.naam || "",
    beschrijving: v3Model?.beschrijving || "",
  };

  return { elements, structuralEdges, diagrams, domains, domainMeta: {}, modelMeta };
}

// ─── Dependency edges helper ─────────────────────────────────

/**
 * Genereer dependency edges vanuit veld-referenties (enum, datatype, $ref).
 * Gebruikt useEdges uit het V3 model voor sourceHandle/targetHandle/hidden.
 * Deduplicatie op edge-ID voorkomt dubbele lijnen.
 */
function addFieldDependencyEdges(convertedVelden, parentId, rawVelden, datatypeLookup, edgesOut, useEdgesArr, enumLookup = {}) {
  // Bouw lookup: edge-ID → useEdge info (hidden, handles)
  const useEdgeMap = {};
  (useEdgesArr || []).forEach((ue) => {
    if (ue.id && !useEdgeMap[ue.id]) useEdgeMap[ue.id] = ue;
  });

  const seen = new Set();
  (rawVelden || []).forEach((v, i) => {
    if (v.enum && enumLookup[v.enum]) {
      const edgeId = `${parentId}-->${v.enum}`;
      if (!seen.has(edgeId)) {
        seen.add(edgeId);
        const ue = useEdgeMap[edgeId];
        edgesOut.push({
          id: edgeId,
          source: parentId,
          target: `enum_${v.enum}`,
          type: "metamodel",
          sourceHandle: ue?.sourceHandle || null,
          targetHandle: ue?.targetHandle || null,
          hidden: ue?.hidden || false,
          data: { isDependency: true, rolnaam: "", jsonRolnaam: "", momentvoorkomen: "", kardinaliteit: "" },
        });
      }
    }
    const dtNaam = v.datatype || (datatypeLookup[v.goType] ? v.goType : null);
    if (dtNaam) {
      const edgeId = `${parentId}--dt-->${dtNaam}`;
      if (!seen.has(edgeId)) {
        seen.add(edgeId);
        const ue = useEdgeMap[edgeId];
        edgesOut.push({
          id: edgeId,
          source: parentId,
          target: `dt_${dtNaam}`,
          type: "metamodel",
          sourceHandle: ue?.sourceHandle || null,
          targetHandle: ue?.targetHandle || null,
          hidden: ue?.hidden || false,
          data: { isDependency: true, rolnaam: "", jsonRolnaam: "", momentvoorkomen: "", kardinaliteit: "" },
        });
      }
    }
    const refNaam = v["$ref"] || v.refItemNaam || null;
    if (refNaam) {
      const edgeId = `${parentId}--ref-->${refNaam}`;
      if (!seen.has(edgeId)) {
        seen.add(edgeId);
        const ue = useEdgeMap[edgeId];
        edgesOut.push({
          id: edgeId,
          source: parentId,
          target: refNaam,
          type: "metamodel",
          sourceHandle: ue?.sourceHandle || null,
          targetHandle: ue?.targetHandle || null,
          hidden: ue?.hidden || false,
          data: { isDependency: true, rolnaam: "", jsonRolnaam: "", momentvoorkomen: "", kardinaliteit: "" },
        });
      }
    }
  });
}

// ─── Store → V3 Export ──────────────────────────────────────

// --- Inverse helpers ---

/**
 * Vertaal een store-veld terug naar V3Veld-formaat.
 * Inverse van convertV3Veld().
 */
function veldNaarV3(veld) {
  const v3 = { naam: veld.naam };

  // GoType afleiden uit type/format
  v3.goType = veldTypeNaarGoType(veld.type, veld.format, veld.verplicht);

  if (veld.verplicht === false && !v3.goType.startsWith("*")) {
    v3.goType = "*" + v3.goType;
  }
  // Verplicht true → geen pointer prefix
  if (veld.verplicht) {
    v3.goType = v3.goType.replace(/^\*/, "");
  }

  if (veld.enumNaam) v3.enum = veld.enumNaam;
  if (veld.datatypeNaam) v3.datatype = veld.datatypeNaam;
  if (veld.refItemNaam) v3["$ref"] = veld.refItemNaam;
  if (veld.description) v3.description = veld.description;
  if (veld.afgeleid) {
    v3.afgeleid = true;
    if (veld.afleidingsregelTaal) v3.afleidingsregelTaal = veld.afleidingsregelTaal;
    if (veld.afleidingsregel) v3.afleidingsregel = veld.afleidingsregel;
  }

  return v3;
}

/**
 * Inverse van goTypeNaarVeldType(): vertaal store type+format terug naar Go type.
 */
function veldTypeNaarGoType(type, format, verplicht) {
  if (format === "date") return "Date";
  if (format === "date-time") return "time.Time";
  switch (type) {
    case "integer": return "int";
    case "number": return format === "float64" ? "float64" : "float64";
    case "boolean": return "bool";
    case "string":
    default:
      return "string";
  }
}

/**
 * Vertaal store afgeleideVelden terug naar V3AfgeleidVeld[].
 */
function afgeleideVeldenNaarV3(arr) {
  return (arr || []).filter((av) => av.naam).map((av) => {
    const v3 = { naam: av.naam, goType: av.goType || "string" };
    if (av.description) v3.description = av.description;
    if (av.afleidingsregelTaal) v3.afleidingsregelTaal = av.afleidingsregelTaal;
    if (av.afleidingsregel) v3.afleidingsregel = av.afleidingsregel;
    if (av.isWeergaveVeld) v3.isWeergaveVeld = true;
    return v3;
  });
}

/**
 * Haal de positie van een element uit het overzicht-diagram.
 */
function elementPositie(diagrams, elementId) {
  const overzicht = diagrams?.[DEFAULT_DIAGRAM_ID];
  if (!overzicht) return undefined;
  const node = (overzicht.nodes || []).find((n) => n.elementId === elementId);
  return node?.position || undefined;
}

/**
 * Haal edge handle-data op uit het overzicht-diagram.
 */
function diagramEdgeData(diagrams, edgeId) {
  const overzicht = diagrams?.[DEFAULT_DIAGRAM_ID];
  if (!overzicht) return {};
  return (overzicht.edges || []).find((e) => e.id === edgeId) || {};
}

/**
 * Verzamel useEdges (dependency-edge layout) voor een element uit het diagram.
 * Zoekt alle dependency-edges die vanuit sourceId vertrekken en retourneert
 * ze als V3UseEdge-objecten (doel, id, sourceHandle, targetHandle, hidden).
 */
function collectUseEdges(diagrams, sourceId) {
  const overzicht = diagrams?.[DEFAULT_DIAGRAM_ID];
  if (!overzicht) return [];
  const depEdges = (overzicht.edges || []).filter(
    (e) => e.source === sourceId && e.data?.isDependency
  );
  if (!depEdges.length) return [];
  const seen = new Set();
  return depEdges.map((e) => {
    const ue = { doel: (e.target || "").replace(/^(enum_|dt_)/, ""), id: e.id };
    if (e.sourceHandle) ue.sourceHandle = e.sourceHandle;
    if (e.targetHandle) ue.targetHandle = e.targetHandle;
    if (e.hidden) ue.hidden = true;
    return ue;
  }).filter((ue) => {
    const key = JSON.stringify(ue);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// --- Main export: storeNaarV3Model ---

/**
 * Transformeer de Zustand store state naar V3 model JSON.
 * Inverse van v3ModelNaarStore().
 *
 * @param {object} state  - Volledige store state (elements, structuralEdges, diagrams, modelMeta)
 * @returns {object}        V3-compatibel model object
 */
export function storeNaarV3Model(state) {
  const { elements, structuralEdges = [], diagrams = {}, modelMeta } = state;

  // --- Groepeer elementen per type ---
  const entiteiten = [];
  const geElementen = {};   // id → element
  const relaties = {};      // id → element
  const enums = [];
  const datatypes = [];
  const refInstanties = [];

  for (const el of Object.values(elements)) {
    switch (el.type) {
      case "entiteit":
        entiteiten.push(el);
        break;
      case "gegevenselement":
        geElementen[el.id] = el;
        break;
      case "relatie":
        relaties[el.id] = el;
        break;
      case "enumeratie":
        enums.push(el);
        break;
      case "gegevenstype":
        datatypes.push(el);
        break;
      case "referentielijstInstantie":
        refInstanties.push(el);
        break;
    }
  }

  // --- Bouw parent → children lookup vanuit structuralEdges ---
  const kinderen = {};  // entiteitId → [{ edge, childEl }]
  for (const edge of structuralEdges) {
    const child = geElementen[edge.target] || relaties[edge.target];
    if (child) {
      if (!kinderen[edge.source]) kinderen[edge.source] = [];
      kinderen[edge.source].push({ edge, child });
    }
  }

  // --- Enums → V3 ---
  const v3Enums = enums.map((el) => {
    const goType = el.data?.naam || el.naam;
    const v3 = {
      goType,
      baseType: el.data?.baseType || "string",
      waarden: (el.data?.waarden || []).map((w) => ({
        constNaam: maakConstNaam(goType, w),
        waarde: w,
      })),
    };
    if (el.domein) v3.domein = el.domein;
    const pos = elementPositie(diagrams, el.id);
    if (pos) v3.positie = pos;
    return v3;
  });

  // --- Datatypes → V3 ---
  const v3Datatypes = datatypes.map((el) => {
    const d = el.data || {};
    const v3 = {
      naam: d.naam || el.naam,
      basistype: d.basistype || "string",
    };
    if (d.description) v3.description = d.description;
    if (d.format) v3.format = d.format;
    if (el.domein) v3.domein = el.domein;

    // Validatie: alleen als er waarden in zitten
    const val = d.validatie || {};
    const heeftValidatie = val.pattern || val.minLength != null || val.maxLength != null ||
      val.minimum != null || val.maximum != null || val.multipleOf != null ||
      val.foutmelding || (val.voorbeelden && val.voorbeelden.length) ||
      (val.regels && val.regels.length);
    if (heeftValidatie) v3.validatie = val;

    if (d.normalisatie) v3.normalisatie = d.normalisatie;

    const weer = d.weergave || {};
    const heeftWeergave = weer.placeholder || weer.inputMask || weer.prefix || weer.suffix;
    if (heeftWeergave) v3.weergave = weer;

    const pos = elementPositie(diagrams, el.id);
    if (pos) v3.positie = pos;
    return v3;
  });

  // --- ReferentielijstInstanties → V3 ---
  const v3RefInstanties = refInstanties.map((el) => {
    const d = el.data || {};
    const v3 = { systeemnaam: d.systeemnaam || el.naam };
    if (d.naam) v3.naam = d.naam;
    if (d.omschrijving) v3.omschrijving = d.omschrijving;
    if (el.domein) v3.domein = el.domein;
    const pos = elementPositie(diagrams, el.id);
    if (pos) v3.positie = pos;
    return v3;
  });

  // --- Entiteiten → V3 (met geneste GE's en relaties via structuralEdges) ---
  const gebruikteRelaties = new Set();

  const v3Entiteiten = entiteiten.map((ent) => {
    const d = ent.data || {};
    const v3Ent = {
      typenaam: d.typenaam || ent.naam,
      meervoud: d.meervoud || "",
    };
    if (d.description) v3Ent.description = d.description;
    if (ent.domein) v3Ent.domein = ent.domein;
    if (d.entiteitSubtype) v3Ent.entiteitSubtype = d.entiteitSubtype;
    if (d.isMaterieel) v3Ent.isMaterieel = true;
    if (d.kleur) v3Ent.kleur = d.kleur;

    const pos = elementPositie(diagrams, ent.id);
    if (pos) v3Ent.positie = pos;

    const afgeleid = afgeleideVeldenNaarV3(d.afgeleideVelden);
    if (afgeleid.length) v3Ent.afgeleideVelden = afgeleid;

    // Verwerk kinderen (GE's en relaties)
    const kids = kinderen[ent.id] || [];
    const v3GEs = [];
    const v3Rels = [];

    for (const { edge, child } of kids) {
      const cd = child.data || {};
      const edgeData = edge.data || {};
      const diagEdge = diagramEdgeData(diagrams, edge.id);

      if (child.type === "gegevenselement") {
        const v3GE = {
          naam: cd.klassenaam || child.naam,
          meervoud: cd.meervoud || edgeData.jsonRolnaam || "",
          momentvoorkomen: edgeData.momentvoorkomen || "enkelvoudig",
        };
        if (cd.description) v3GE.description = cd.description;
        if (child.domein && child.domein !== ent.domein) v3GE.domein = child.domein;
        if (cd.isMaterieel) v3GE.isMaterieel = true;

        const gePos = elementPositie(diagrams, child.id);
        if (gePos) v3GE.positie = gePos;

        // Velden
        const velden = (cd.velden || []).map(veldNaarV3);
        if (velden.length) v3GE.velden = velden;

        const geAfgeleid = afgeleideVeldenNaarV3(cd.afgeleideVelden);
        if (geAfgeleid.length) v3GE.afgeleideVelden = geAfgeleid;

        // Edge handle informatie bewaren voor roundtrip
        if (diagEdge.sourceHandle) v3GE.sourceHandle = diagEdge.sourceHandle;
        if (diagEdge.targetHandle) v3GE.targetHandle = diagEdge.targetHandle;

        // UseEdges: dependency-edge layout (handles + hidden) bewaren
        const geUseEdges = collectUseEdges(diagrams, child.id);
        if (geUseEdges.length) v3GE.useEdges = geUseEdges;

        v3GEs.push(v3GE);
      } else if (child.type === "relatie") {
        if (gebruikteRelaties.has(child.id)) {
          // Relatie al verwerkt via andere entiteit; voeg alleen de structurele info toe
          v3Rels.push(buildV3Relatie(child, edgeData, diagEdge, diagrams, ent.domein));
        } else {
          gebruikteRelaties.add(child.id);
          v3Rels.push(buildV3Relatie(child, edgeData, diagEdge, diagrams, ent.domein));
        }
      }
    }

    if (v3GEs.length) v3Ent.gegevenselementen = v3GEs;
    if (v3Rels.length) v3Ent.relaties = v3Rels;

    return v3Ent;
  });

  // --- Stel het V3 model samen ---
  const v3Model = {
    versie: modelMeta?.versie || "v3",
  };
  if (modelMeta?.naam) {
    v3Model.naam = modelMeta.naam;
  } else if (modelMeta?.bron) {
    v3Model.naam = "IDE export";
  }
  if (modelMeta?.beschrijving) {
    v3Model.beschrijving = modelMeta.beschrijving;
  }
  if (v3Datatypes.length) v3Model.datatypes = v3Datatypes;
  if (v3Enums.length) v3Model.enums = v3Enums;
  if (v3RefInstanties.length) v3Model.referentielijstInstanties = v3RefInstanties;
  v3Model.entiteiten = v3Entiteiten;

  // Wrap in het top-level formaat dat de API verwacht
  return {
    versie: modelMeta?.versie || "v3",
    bron: "ide",
    build_versie: modelMeta?.build_versie || "",
    go_module: modelMeta?.go_module || "",
    indiener: modelMeta?.indiener || "IDE",
    model: v3Model,
  };
}

/**
 * Bouw een V3Relatie object vanuit een store-element + edge data.
 */
function buildV3Relatie(child, edgeData, diagEdge, diagrams, parentDomein) {
  const cd = child.data || {};
  const v3Rel = {
    naam: cd.klassenaam || child.naam,
    meervoud: cd.meervoud || edgeData.jsonRolnaam || "",
    momentvoorkomen: edgeData.momentvoorkomen || "meervoudig",
    doelEntiteit: cd.doelEntiteit || "",
  };
  if (cd.description) v3Rel.description = cd.description;
  if (child.domein && child.domein !== parentDomein) v3Rel.domein = child.domein;
  if (cd.relatieSubtype) v3Rel.relatieSubtype = cd.relatieSubtype;
  if (cd.referentielijstInstantie) v3Rel.referentielijstInstantie = cd.referentielijstInstantie;
  if (cd.isMaterieel) v3Rel.isMaterieel = true;

  const relPos = elementPositie(diagrams, child.id);
  if (relPos) v3Rel.positie = relPos;

  const velden = (cd.velden || []).map(veldNaarV3);
  if (velden.length) v3Rel.velden = velden;

  const afgeleid = afgeleideVeldenNaarV3(cd.afgeleideVelden);
  if (afgeleid.length) v3Rel.afgeleideVelden = afgeleid;

  // Edge handles voor roundtrip
  if (diagEdge.sourceHandle) v3Rel.sourceHandle = diagEdge.sourceHandle;
  if (diagEdge.targetHandle) v3Rel.targetHandle = diagEdge.targetHandle;

  // UseEdges: dependency-edge layout (handles + hidden) bewaren
  const relUseEdges = collectUseEdges(diagrams, child.id);
  if (relUseEdges.length) v3Rel.useEdges = relUseEdges;

  return v3Rel;
}

/**
 * Exporteer de volledige store state als IDE JSON (model + diagrammen + meta).
 * Dit is het "IDE export" format, niet het V3 API format.
 */
export function exportStoreAsJson(state) {
  return {
    _format: "ide-v1",
    modelMeta: state.modelMeta,
    elements: state.elements,
    structuralEdges: state.structuralEdges,
    diagrams: state.diagrams,
    domains: state.domains,
    domainMeta: state.domainMeta || {},
  };
}

/**
 * Importeer een eerder geëxporteerde IDE JSON.
 */
export function importStoreFromJson(json) {
  if (json?._format !== "ide-v1") {
    throw new Error("Onbekend export-format. Verwacht _format: 'ide-v1'.");
  }
  return {
    elements: json.elements || {},
    structuralEdges: json.structuralEdges || [],
    diagrams: json.diagrams || {},
    domains: json.domains || [],
    domainMeta: json.domainMeta || {},
    modelMeta: json.modelMeta || null,
  };
}
