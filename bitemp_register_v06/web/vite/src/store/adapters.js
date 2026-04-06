/**
 * adapters.js — Transformatie tussen V3 model format en Zustand store format.
 *
 * v3ModelNaarStore():  V3 JSON → { elements, structuralEdges, diagrams, domains, modelMeta }
 * storeNaarV3Model():  store state → V3 JSON (TODO: implementeren in Fase 4)
 *
 * Verschil met v3ModelNaarEditor.js:
 * - Posities zitten NIET in de elementen, maar in het diagram
 * - Elementen zijn een flat Record<id, element> (snelle lookup)
 * - Eén "overzicht" diagram wordt automatisch aangemaakt met alle posities
 */
import { defaultKleur } from "@editor/metamodel/types.js";
import { DEFAULT_DIAGRAM_ID } from "./useModelStore.js";

// ─── Helpers ────────────────────────────────────────────────

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
  const enumWaarden = v3Veld.enum ? enumLookup[v3Veld.enum] || null : null;

  return {
    naam: v3Veld.naam,
    type,
    format,
    datatypeNaam: v3Veld.datatype || datatype?.naam || null,
    enum: enumWaarden,
    enumNaam: v3Veld.enum || null,
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

      // Dependency edges vanuit GE-velden
      addFieldDependencyEdges(velden, geId, ge.velden || [], datatypeLookup, diagramEdges);
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

        // Dependency edges vanuit relatie-velden
        addFieldDependencyEdges(velden, rel.naam, rel.velden || [], datatypeLookup, diagramEdges);
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
  };

  return { elements, structuralEdges, diagrams, domains, modelMeta };
}

// ─── Dependency edges helper ─────────────────────────────────

function addFieldDependencyEdges(convertedVelden, parentId, rawVelden, datatypeLookup, edgesOut) {
  (rawVelden || []).forEach((v, i) => {
    const cv = convertedVelden[i];
    if (v.enum) {
      edgesOut.push({
        id: `${parentId}-->${v.enum}`,
        source: parentId,
        target: `enum_${v.enum}`,
        type: "metamodel",
        data: { isDependency: true, rolnaam: "", jsonRolnaam: "", momentvoorkomen: "", kardinaliteit: "" },
      });
    }
    const dtNaam = v.datatype || (datatypeLookup[v.goType] ? v.goType : null);
    if (dtNaam) {
      edgesOut.push({
        id: `${parentId}--dt-->${dtNaam}`,
        source: parentId,
        target: `dt_${dtNaam}`,
        type: "metamodel",
        data: { isDependency: true, rolnaam: "", jsonRolnaam: "", momentvoorkomen: "", kardinaliteit: "" },
      });
    }
    const refNaam = v["$ref"] || v.refItemNaam || null;
    if (refNaam) {
      edgesOut.push({
        id: `${parentId}--ref-->${refNaam}`,
        source: parentId,
        target: refNaam,
        type: "metamodel",
        data: { isDependency: true, rolnaam: "", jsonRolnaam: "", momentvoorkomen: "", kardinaliteit: "" },
      });
    }
  });
}

// ─── Store → V3 Export ──────────────────────────────────────

/**
 * Exporteer de volledige store state als IDE JSON (model + diagrammen + meta).
 * Dit is het "IDE export" format, niet het V3 API format.
 * V3 API export (storeNaarV3Model) komt in Fase 4.
 */
export function exportStoreAsJson(state) {
  return {
    _format: "ide-v1",
    modelMeta: state.modelMeta,
    elements: state.elements,
    structuralEdges: state.structuralEdges,
    diagrams: state.diagrams,
    domains: state.domains,
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
    modelMeta: json.modelMeta || null,
  };
}
