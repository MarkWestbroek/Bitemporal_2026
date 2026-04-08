/**
 * Metamodel types — weerspiegelt de structuur van de MetaRegistry / schema-API.
 *
 * Drie metatypes:
 *   - entiteit:         hoofdobject met eigen ID (bijv. A, B)
 *   - gegevenselement:  attribuutgroep onder een entiteit (bijv. A_U, B_X)
 *   - relatie:          verbinding tussen twee entiteiten (bijv. Rel_A_B)
 *
 * Momentvoorkomen bepaalt of er op enig formeel tijdstip maximaal één (enkelvoudig)
 * of meerdere (meervoudig) instanties van een GE/relatie bij een entiteit kunnen bestaan.
 */

// === Basis enums ===

export const METATYPES = ["entiteit", "gegevenselement", "relatie"];

/**
 * Subtypes voor entiteiten.
 * Een referentielijst is een entiteit die een benoemde verzameling items voorstelt.
 * Een referentielijst_item is een entiteit die de items in een referentielijst beschrijft.
 * Zie Referentielijsten.md voor het volledige ontwerp.
 */
export const ENTITEIT_SUBTYPES = ["", "referentielijst", "referentielijst_item"];

/**
 * Subtypes voor relaties.
 * Een referentielijst_items relatie koppelt items aan een referentielijst.
 */
export const RELATIE_SUBTYPES = ["", "referentielijst_items"];

export const MOMENTVOORKOMENS = ["enkelvoudig", "meervoudig"];

/**
 * Beschikbare veldtypen, gebaseerd op OAS 3.1 / Go type mapping
 * zoals de schema-API ze retourneert.
 */
export const VELDTYPEN = [
  { type: "string", format: "", label: "Tekst" },
  { type: "string", format: "date", label: "Datum" },
  { type: "string", format: "date-time", label: "Datum+Tijd" },
  { type: "integer", format: "", label: "Geheel getal" },
  { type: "number", format: "float64", label: "Decimaal getal" },
  { type: "boolean", format: "", label: "Boolean" },
];

// === Datastructuren ===

/**
 * Een enumeratie — een benoemd lijstje van toegestane waarden.
 * Wordt als apart blok weergegeven op het canvas.
 */
// { id, naam, waarden: string[] }

/**
 * Een attribuut/veld binnen een representatietype.
 */
// { naam, type, format?, enum?, verplicht, autoIncrement?, description? }

/**
 * Een representatietype (entiteit, gegevenselement of relatie).
 * Dit wordt een node op het canvas.
 */
// { id, typenaam, description?, metatype, isMaterieel?, kleur?, velden: Attribuut[] }

/**
 * Een relatie-edge tussen twee types op het canvas.
 * Bij entiteit→GE: de "bezit" relatie (parent→child)
 * Bij relatie-type: de twee FK's naar de twee entiteiten
 */
// {
//   id, bronType, doelType,
//   rolnaam?, jsonRolnaam?,
//   momentvoorkomen: "enkelvoudig"|"meervoudig",
//   kardinaliteit?: "0..1"|"1"|"0..*"|"1..*"
// }

/**
 * Beschikbare talen voor afleidingsregels.
 * CEL (Common Expression Language) is de aanbevolen keuze:
 * - Go: github.com/google/cel-go
 * - JS: cel-js (npm)
 * - Niet-Turing-compleet, veilig, deterministisch
 * Alternatieven: Expr, JsonLogic, eigen pseudo-code.
 */
export const AFLEIDINGSTALEN = [
  { value: "cel", label: "CEL (Common Expression Language)" },
  { value: "expr", label: "Expr" },
  { value: "jsonlogic", label: "JsonLogic" },
  { value: "pseudo", label: "Pseudo-code" },
];

// === Helper functies ===

/** Genereer een simpele unieke ID */
let _idCounter = 0;
export function generateId(prefix = "node") {
  _idCounter += 1;
  return `${prefix}_${Date.now()}_${_idCounter}`;
}

/** Default kleur per metatype (en optioneel subtype) */
export function defaultKleur(metatype, subtype = "") {
  // Referentielijst-subtypes krijgen eigen kleuren
  if (subtype === "referentielijst") return "#fef3c7";       // amber-100 (goudgeel)
  if (subtype === "referentielijst_item") return "#fde68a";   // amber-200
  if (subtype === "referentielijst_items") return "#fcd34d";  // amber-300

  switch (metatype) {
    case "entiteit":
      return "#bfdbfe"; // blauw
    case "gegevenselement":
      return "#bbf7d0"; // groen
    case "relatie":
      return "#ede9fe"; // paars
    default:
      return "#f1f5f9"; // grijs
  }
}

/** Maak een leeg type-object, optioneel met subtype voor referentielijsten */
export function maakLeegType(metatype = "entiteit", subtype = "") {
  return {
    id: generateId(metatype),
    typenaam: "",
    meervoud: "",
    description: "",
    domein: "",
    metatype,
    isMaterieel: false, // standaard formeel; materieel is optioneel
    kleur: defaultKleur(metatype, subtype),
    velden: [],
    // Subtypes voor referentielijsten (leeg = gewoon entiteit/relatie)
    ...(metatype === "entiteit" && subtype ? { entiteitSubtype: subtype } : {}),
    ...(metatype === "relatie" && subtype ? { relatieSubtype: subtype } : {}),
  };
}

/** Maak een leeg veld */
export function maakLeegVeld() {
  return {
    naam: "",
    type: "string",
    format: "",
    enum: null,
    verplicht: true,
    autoIncrement: false,
    description: "",
    afgeleid: false,
    afleidingsregelTaal: "cel",
    afleidingsregel: "",
  };
}

/** Maak een leeg afgeleid veld */
export function maakLeegAfgeleidVeld() {
  return {
    naam: "",
    description: "",
    goType: "string",
    afleidingsregelTaal: "cel",
    afleidingsregel: "",
    isWeergaveVeld: false,
  };
}

/** Maak een lege enumeratie */
export function maakLegeEnumeratie() {
  return {
    id: generateId("enum"),
    naam: "",
    domein: "",
    waarden: [""],
  };
}

/** Maak een leeg gegevenstype (custom datatype) */
export function maakLeegGegevenstype() {
  return {
    id: generateId("datatype"),
    naam: "",
    description: "",
    domein: "",
    basistype: "string",
    format: "",
    validatie: {
      pattern: "",
      minLength: null,
      maxLength: null,
      minimum: null,
      maximum: null,
      multipleOf: null,
      voorbeelden: [],
      foutmelding: "",
      regels: [],
    },
    normalisatie: "",
    weergave: {
      placeholder: "",
      inputMask: "",
      prefix: "",
      suffix: "",
    },
  };
}

/**
 * Maak een complete referentielijst-set: drie nodes (lijst, item, items-relatie) + twee edges.
 * De "+ Referentielijst" knop in de toolbar gebruikt dit om in één klik alles aan te maken.
 *
 * Retourneert { nodes: [...], edges: [...] } die aan de editor state toegevoegd kunnen worden.
 */
export function maakReferentielijstSet() {
  // 1. Referentielijst (entiteit-subtype)
  const lijst = {
    ...maakLeegType("entiteit", "referentielijst"),
    typenaam: "",
    description: "Referentielijst",
  };

  // 2. Referentielijst-item (entiteit-subtype)
  const item = {
    ...maakLeegType("entiteit", "referentielijst_item"),
    typenaam: "",
    description: "Referentielijst-item",
  };

  // 3. Referentielijst-items (relatie-subtype)
  const items = {
    ...maakLeegType("relatie", "referentielijst_items"),
    typenaam: "",
    description: "Koppeling referentielijst → items",
  };

  // Edges: lijst → items-relatie (owner) en items-relatie → item (doel)
  const edgeLijstNaarItems = {
    id: generateId("edge"),
    source: lijst.id,
    target: items.id,
    type: "metamodel",
    data: {
      rolnaam: "",
      jsonRolnaam: "",
      momentvoorkomen: "meervoudig",
      kardinaliteit: "0..*",
    },
  };

  const edgeItemsNaarItem = {
    id: generateId("edge"),
    source: items.id,
    target: item.id,
    type: "metamodel",
    data: {
      rolnaam: "",
      jsonRolnaam: "",
      momentvoorkomen: "meervoudig",
      kardinaliteit: "0..*",
    },
  };

  return {
    nodes: [
      { data: lijst, type: "entiteit" },
      { data: item, type: "entiteit" },
      { data: items, type: "relatie" },
    ],
    edges: [edgeLijstNaarItems, edgeItemsNaarItem],
  };
}

/**
 * Maak een referentielijst-instantie node.
 * Een instantie vertegenwoordigt een specifieke referentielijst (bijv. "Landenlijst")
 * als record van de generieke Referentielijst-klasse.
 *
 * Retourneert een node data-object dat als "referentielijstInstantie" node
 * aan de editor state toegevoegd kan worden.
 */
export function maakReferentielijstInstantie() {
  return {
    id: generateId("refinstantie"),
    systeemnaam: "",
    naam: "",
    omschrijving: "",
  };
}

/**
 * Bouw de VELDTYPEN-lijst dynamisch op: primitieve types + custom datatypes + enumeraties + referentielijst_items.
 * Referentielijst_item types verschijnen als keuzetype, vergelijkbaar met enumeraties.
 * @param {Array} datatypeNodes - React Flow nodes met type === "gegevenstype"
 * @param {Array} enumNodes - React Flow nodes met type === "enumeratie"
 * @param {Array} refItemNodes - Entiteit-nodes met entiteitSubtype === "referentielijst_item"
 * @returns {Array} veldtypen array met { type, format, label, isCustom?, isEnum?, isRefItem?, ... }
 */
export function bouwVeldtypen(datatypeNodes = [], enumNodes = [], refItemNodes = []) {
  const custom = datatypeNodes.map((n) => ({
    type: n.data.basistype || "string",
    format: n.data.format || "",
    label: n.data.naam || n.data.format || "(naamloos)",
    datatypeNaam: n.data.naam || "",
    isCustom: true,
  }));
  const enums = enumNodes.map((n) => ({
    type: "string",
    format: "",
    label: n.data.naam,
    isEnum: true,
    enumNaam: n.data.naam,
    enumWaarden: n.data.waarden || [],
  }));
  // Referentielijst_item entiteiten als keuzetype (vergelijkbaar met enumeratie/datatype)
  const refItems = refItemNodes.map((n) => ({
    type: "integer",
    format: "",
    label: `${n.data.typenaam || "(naamloos)"} (ref.lijst)`,
    refItemNaam: n.data.typenaam || "",
    isRefItem: true,
  }));
  return [...VELDTYPEN, ...custom, ...enums, ...refItems];
}

/**
 * Converteer schema-API response naar editor nodes + edges.
 * Dit is de brug tussen de backend MetaRegistry en de visuele editor.
 */
export function schemaResponseNaarEditor(schemaResponse) {
  const types = schemaResponse?.types || [];
  const datatypes = schemaResponse?.datatypes || [];
  const nodes = [];
  const edges = [];
  const enumNodes = [];

  // Datatypes → nodes
  datatypes.forEach((dt, i) => {
    nodes.push({
      id: `dt_${dt.naam}`,
      type: "gegevenstype",
      position: { x: 50 + i * 280, y: 650 },
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
    });
  });

  // Eerste pass: maak nodes voor elk type
  const typeMap = {};
  let col = 0;
  const entiteiten = types.filter((t) => t.metatype === "entiteit");
  const overige = types.filter((t) => t.metatype !== "entiteit");

  // Positioneer entiteiten bovenaan
  entiteiten.forEach((t, i) => {
    const node = {
      id: t.typenaam,
      type: "entiteit",
      position: { x: i * 350, y: 50 },
      data: {
        typenaam: t.typenaam,
        description: t.description || "",
        domein: t.domein || "",
        metatype: t.metatype,
        isMaterieel: t.isMaterieel || false,
        kleur: t.kleur || defaultKleur(t.metatype),
        velden: (t.velden || []).map((v) => ({
          naam: v.naam,
          type: v.type,
          format: v.format || "",
          enum: v.enum || null,
          verplicht: v.verplicht,
          autoIncrement: v.autoIncrement || false,
          description: v.description || "",
          afgeleid: v.afgeleid || false,
          afleidingsregelTaal: v.afleidingsregelTaal || "cel",
          afleidingsregel: v.afleidingsregel || "",
        })),
      },
    };
    nodes.push(node);
    typeMap[t.typenaam] = node;
  });

  // Positioneer GE's en relaties eronder
  overige.forEach((t, i) => {
    const metatype = t.metatype === "relatie" ? "relatie" : "gegevenselement";
    const node = {
      id: t.typenaam,
      type: metatype,
      position: { x: i * 280, y: 350 },
      data: {
        typenaam: t.typenaam,
        description: t.description || "",
        domein: t.domein || "",
        metatype,
        isMaterieel: t.isMaterieel || false,
        kleur: t.kleur || defaultKleur(metatype),
        velden: (t.velden || []).map((v) => ({
          naam: v.naam,
          type: v.type,
          format: v.format || "",
          enum: v.enum || null,
          verplicht: v.verplicht,
          autoIncrement: v.autoIncrement || false,
          description: v.description || "",
          afgeleid: v.afgeleid || false,
          afleidingsregelTaal: v.afleidingsregelTaal || "cel",
          afleidingsregel: v.afleidingsregel || "",
        })),
      },
    };
    nodes.push(node);
    typeMap[t.typenaam] = node;
  });

  // Tweede pass: maak edges op basis van onderliggende relaties
  entiteiten.forEach((t) => {
    (t.onderliggende || []).forEach((child) => {
      const childMeta = types.find((x) => x.typenaam === child.doeltype);
      edges.push({
        id: `${t.typenaam}->${child.doeltype}`,
        source: t.typenaam,
        target: child.doeltype,
        type: "metamodel",
        data: {
          rolnaam: child.rolnaam,
          jsonRolnaam: child.jsonRolnaam,
          momentvoorkomen: child.momentvoorkomen,
          kardinaliteit:
            child.momentvoorkomen === "enkelvoudig" ? "0..1" : "0..*",
        },
      });
    });
  });

  // Relatie-types: maak ook edge naar secondaire entiteit
  types
    .filter((t) => t.metatype === "relatie" && t.secondaireEntiteitIDKolom)
    .forEach((t) => {
      // Zoek de secondaire entiteit op basis van de FK kolom
      const secondaireEntiteit = entiteiten.find((e) => {
        const prefix = t.secondaireEntiteitIDKolom.replace("_id", "");
        return e.typenaam.toLowerCase() === prefix.toLowerCase();
      });
      if (secondaireEntiteit) {
        edges.push({
          id: `${t.typenaam}->${secondaireEntiteit.typenaam}`,
          source: t.typenaam,
          target: secondaireEntiteit.typenaam,
          type: "metamodel",
          data: {
            rolnaam: `→ ${secondaireEntiteit.typenaam}`,
            jsonRolnaam: t.secondaireEntiteitIDKolom,
            momentvoorkomen: "meervoudig",
            kardinaliteit: "0..*",
          },
        });
      }
    });

  return { nodes, edges };
}

/**
 * Exporteer editor-state als een plat metamodel JSON object
 * (geschikt voor verdere verwerking, bijv. naar MetaRegistry-formaat of XMI).
 */
export function editorNaarMetamodel(nodes, edges) {
  const types = nodes
    .filter((n) => ["entiteit", "gegevenselement", "relatie"].includes(n.type))
    .map((n) => ({
      typenaam: n.data.typenaam,
      description: n.data.description,
      domein: n.data.domein,
      metatype: n.type,
      isMaterieel: n.data.isMaterieel,
      kleur: n.data.kleur,
      velden: n.data.velden,
    }));

  const relaties = edges
    .filter((e) => e.type === "metamodel")
    .map((e) => ({
      bronType: e.source,
      doelType: e.target,
      rolnaam: e.data?.rolnaam || "",
      jsonRolnaam: e.data?.jsonRolnaam || "",
      momentvoorkomen: e.data?.momentvoorkomen || "enkelvoudig",
      kardinaliteit: e.data?.kardinaliteit || "0..1",
    }));

  const enumeraties = nodes
    .filter((n) => n.type === "enumeratie")
    .map((n) => ({
      goType: n.data.naam,
      domein: n.data.domein,
      baseType: n.data.baseType || "string",
      waarden: (n.data.waarden || []).map((w) => ({
        constNaam: n.data.naam + w.replace(/[^a-zA-Z0-9_]/g, ""),
        waarde: w,
      })),
    }));

  const datatypes = nodes
    .filter((n) => n.type === "gegevenstype")
    .map((n) => ({
      naam: n.data.naam,
      description: n.data.description,
      domein: n.data.domein,
      basistype: n.data.basistype,
      format: n.data.format,
      validatie: n.data.validatie,
      normalisatie: n.data.normalisatie,
      weergave: n.data.weergave,
    }));

  return { types, relaties, enumeraties, datatypes };
}

function veldNaarV3(veld) {
  const enumNaam = veld.enumNaam || null;
  const datatypeNaam = veld.datatypeNaam || null;
  let goType = "string";

  if (enumNaam) {
    goType = enumNaam;
  } else if (datatypeNaam) {
    goType = datatypeNaam;
  } else if (veld.type === "integer") {
    goType = "int";
  } else if (veld.type === "number") {
    goType = "float64";
  } else if (veld.type === "boolean") {
    goType = "bool";
  } else if (veld.type === "string" && veld.format === "date") {
    goType = "Date";
  } else if (veld.type === "string" && veld.format === "date-time") {
    goType = "time.Time";
  }

  if (veld.verplicht === false && !goType.startsWith("*")) {
    goType = `*${goType}`;
  }

  const result = {
    naam: veld.naam,
    goType,
    enum: enumNaam || undefined,
    datatype: datatypeNaam || undefined,
    "$ref": veld.refNaam || undefined,
    description: veld.description || undefined,
  };
  if (veld.afgeleid) {
    result.afgeleid = true;
    result.afleidingsregelTaal = veld.afleidingsregelTaal || "cel";
    result.afleidingsregel = veld.afleidingsregel || "";
  }
  return result;
}

function afgeleideVeldNaarV3(av) {
  return {
    naam: av.naam,
    description: av.description || undefined,
    goType: av.goType || "string",
    afleidingsregelTaal: av.afleidingsregelTaal || "cel",
    afleidingsregel: av.afleidingsregel || "",
    isWeergaveVeld: av.isWeergaveVeld || av.weergaveVeld || false,
  };
}

function sanitizeConstSuffix(value = "") {
  return String(value)
    .replace(/[^a-zA-Z0-9_]/g, "")
    .replace(/^[0-9]+/, "");
}

function geNaamVanTypenaam(entiteitNaam, geTypenaam) {
  const prefix = `${entiteitNaam}_`;
  if (geTypenaam?.startsWith(prefix)) {
    return geTypenaam.slice(prefix.length);
  }
  return geTypenaam;
}

function vindReferentielijstInstantieBinding(relatieNodeId, relData, edges, nodesById) {
  const bindingEdge = (edges || []).find((e) => {
    if (e.type !== "metamodel" || e.data?.isDependency !== true) return false;
    const sourceNode = nodesById[e.source];
    const targetNode = nodesById[e.target];
    return (
      (e.target === relatieNodeId && sourceNode?.type === "referentielijstInstantie") ||
      (e.source === relatieNodeId && targetNode?.type === "referentielijstInstantie")
    );
  });

  const instantieNodeId = bindingEdge
    ? bindingEdge.source === relatieNodeId
      ? bindingEdge.target
      : bindingEdge.source
    : null;
  const instantieNode = instantieNodeId ? nodesById[instantieNodeId] : null;

  return {
    naam: relData?.referentielijstInstantie || instantieNode?.data?.systeemnaam || undefined,
    edgeId: bindingEdge?.id || undefined,
    sourceHandle: bindingEdge?.sourceHandle || undefined,
    targetHandle: bindingEdge?.targetHandle || undefined,
  };
}

/**
 * Verzamel «use» dependency edges (naar enums, datatypes, refs) vanuit een
 * bron-node, en retourneer die edges waarvoor tenminste één handle afwijkt
 * van de default (null) of die verborgen zijn (hidden). De doel-naam wordt
 * afgeleid van het target-node-id (zonder enum_/dt_ prefix).
 */
function verzamelUseEdges(bronNodeId, edges) {
  const depEdges = edges.filter(
    (e) =>
      e.type === "metamodel" &&
      e.data?.isDependency === true &&
      e.source === bronNodeId
  );
  const seen = new Set();
  const useEdges = depEdges
    .filter((e) => e.sourceHandle || e.targetHandle || e.hidden)
    .map((e) => {
      let doel = e.target;
      if (doel.startsWith("enum_")) doel = doel.slice(5);
      else if (doel.startsWith("dt_")) doel = doel.slice(3);
      return {
        doel,
        id: e.id || undefined,
        sourceHandle: e.sourceHandle || undefined,
        targetHandle: e.targetHandle || undefined,
        hidden: e.hidden || undefined,
      };
    })
    .filter((ue) => {
      const key = JSON.stringify(ue);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return useEdges.length > 0 ? useEdges : undefined;
}

/**
 * Exporteer editor-state als V3 model (codegen-ready) zonder flowState.
 */
export function editorNaarV3Model(nodes, edges, opts = {}) {
  const entiteitNodes = nodes.filter((n) => n.type === "entiteit");
  const geNodesById = Object.fromEntries(
    nodes
      .filter((n) => n.type === "gegevenselement")
      .map((n) => [n.id, n])
  );
  const relNodesById = Object.fromEntries(
    nodes
      .filter((n) => n.type === "relatie")
      .map((n) => [n.id, n])
  );
  const nodesById = Object.fromEntries((nodes || []).map((n) => [n.id, n]));

  const enums = nodes
    .filter((n) => n.type === "enumeratie")
    .map((n) => ({
      goType: n.data.naam,
      domein: n.data.domein || undefined,
      baseType: n.data.baseType || "string",
      positie: n.position ? { x: n.position.x, y: n.position.y } : undefined,
      waarden: (n.data.waarden || [])
        .map((w) => (w || "").trim())
        .filter(Boolean)
        .map((w) => ({
          constNaam: `${n.data.naam}${sanitizeConstSuffix(w) || "Waarde"}`,
          waarde: w,
        })),
    }));

  const datatypes = nodes
    .filter((n) => n.type === "gegevenstype")
    .map((n) => ({
      naam: n.data.naam,
      description: n.data.description || undefined,
      domein: n.data.domein || undefined,
      basistype: n.data.basistype || "string",
      format: n.data.format || undefined,
      positie: n.position ? { x: n.position.x, y: n.position.y } : undefined,
      validatie: n.data.validatie || undefined,
      normalisatie: n.data.normalisatie || undefined,
      weergave: n.data.weergave || undefined,
    }));

  const entiteiten = entiteitNodes.map((ent) => {
    const outgoing = edges.filter(
      (e) =>
        e.type === "metamodel" &&
        e.source === ent.id &&
        e.data?.isDependency !== true
    );

    const geEdges = outgoing.filter((e) => geNodesById[e.target]);
    const relEdges = outgoing.filter((e) => relNodesById[e.target]);

    const gegevenselementen = geEdges.map((e) => {
      const geNode = geNodesById[e.target];
      // Primair: afleiden uit typenaam; fallback naar klassenaam zodat nieuw-aangemaakte GE's
      // die nog geen typenaam hebben, maar wel een klassenaam, correct geëxporteerd worden.
      const geNaam = geNaamVanTypenaam(ent.data.typenaam, geNode.data.typenaam) || geNode.data.klassenaam || "";
      return {
        naam: geNaam,
        description: geNode.data.description || undefined,
        domein: geNode.data.domein || undefined,
        meervoud:
          geNode.data.meervoud ||
          e.data?.jsonRolnaam ||
          `${(geNaam || "ge").toLowerCase()}s`,
        momentvoorkomen: e.data?.momentvoorkomen || "enkelvoudig",
        isMaterieel: geNode.data.isMaterieel || false,
        positie: geNode.position ? { x: geNode.position.x, y: geNode.position.y } : undefined,
        // Bewaar editor-edge id zodat export/import en DB-round-trips merge-stabiel blijven.
        id: e.id || undefined,
        sourceHandle: e.sourceHandle || undefined,
        targetHandle: e.targetHandle || undefined,
        afgeleideVelden: (geNode.data.afgeleideVelden || []).length > 0
          ? geNode.data.afgeleideVelden
              .filter((v) => (v.naam || "").trim() !== "")
              .map(afgeleideVeldNaarV3)
          : undefined,
        velden: (geNode.data.velden || [])
          .filter((v) => (v.naam || "").trim() !== "")
          .map(veldNaarV3),
        useEdges: verzamelUseEdges(geNode.id, edges),
      };
    });

    const relaties = relEdges.map((e) => {
      const relNode = relNodesById[e.target];
      const relTargetEdge = edges.find(
        (re) =>
          re.type === "metamodel" &&
          re.data?.isDependency !== true &&
          re.source === relNode.id &&
          re.target !== ent.id &&
          entiteitNodes.some((n) => n.id === re.target)
      );
      const doelEntiteitNode = entiteitNodes.find(
        (n) => n.id === relTargetEdge?.target
      );
      const doelEntiteitNaam =
        relNode.data.doelEntiteit ||
        doelEntiteitNode?.data?.typenaam ||
        "";
      const instantieBinding = vindReferentielijstInstantieBinding(relNode.id, relNode.data, edges, nodesById);

      return {
        naam: relNode.data.typenaam,
        description: relNode.data.description || undefined,
        domein: relNode.data.domein || undefined,
        meervoud:
          relNode.data.meervoud ||
          e.data?.jsonRolnaam || `${(relNode.data.typenaam || "rel").toLowerCase()}s`,
        momentvoorkomen: e.data?.momentvoorkomen || "meervoudig",
        isMaterieel: relNode.data.isMaterieel || false,
        // Referentielijst-subtypes (optioneel, zie Referentielijsten.md)
        relatieSubtype: relNode.data.relatieSubtype || undefined,
        referentielijstInstantie: instantieBinding.naam || undefined,
        doelEntiteit: doelEntiteitNaam,
        positie: relNode.position ? { x: relNode.position.x, y: relNode.position.y } : undefined,
        // Bewaar editor-edge ids zodat export/import en DB-round-trips merge-stabiel blijven.
        id: e.id || undefined,
        sourceHandle: e.sourceHandle || undefined,
        targetHandle: e.targetHandle || undefined,
        doelId: relTargetEdge?.id || undefined,
        doelSourceHandle: relTargetEdge?.sourceHandle || undefined,
        doelTargetHandle: relTargetEdge?.targetHandle || undefined,
        instantieId: instantieBinding.edgeId || undefined,
        instantieSourceHandle: instantieBinding.sourceHandle || undefined,
        instantieTargetHandle: instantieBinding.targetHandle || undefined,
        afgeleideVelden: (relNode.data.afgeleideVelden || []).length > 0
          ? relNode.data.afgeleideVelden
              .filter((v) => (v.naam || "").trim() !== "")
              .map(afgeleideVeldNaarV3)
          : undefined,
        velden: (relNode.data.velden || [])
          .filter((v) => (v.naam || "").trim() !== "")
          .map(veldNaarV3),
        useEdges: verzamelUseEdges(relNode.id, edges),
      };
    });

    return {
      typenaam: ent.data.typenaam,
      description: ent.data.description || undefined,
      domein: ent.data.domein || undefined,
      isMaterieel: ent.data.isMaterieel || false,
      // Referentielijst-subtypes (optioneel, zie Referentielijsten.md)
      entiteitSubtype: ent.data.entiteitSubtype || undefined,
      kleur: ent.data.kleur || undefined,
      meervoud:
        ent.data.meervoud ||
        opts.padnaamByEntiteit?.[ent.data.typenaam] ||
        `${(ent.data.typenaam || "entiteit").toLowerCase()}s`,
      positie: ent.position ? { x: ent.position.x, y: ent.position.y } : undefined,
      afgeleideVelden: (ent.data.afgeleideVelden || []).length > 0
        ? ent.data.afgeleideVelden
            .filter((v) => (v.naam || "").trim() !== "")
            .map(afgeleideVeldNaarV3)
        : undefined,
      gegevenselementen,
      relaties,
    };
  });

  // Referentielijst-instanties (bijv. Landenlijst, EULidstaten)
  const referentielijstInstanties = nodes
    .filter((n) => n.type === "referentielijstInstantie")
    .map((n) => ({
      systeemnaam: n.data.systeemnaam || "",
      naam: n.data.naam || "",
      omschrijving: n.data.omschrijving || "",
      positie: n.position ? { x: n.position.x, y: n.position.y } : undefined,
    }))
    .filter((ri) => ri.systeemnaam); // filter lege instanties

  return {
    versie: opts.versie || "v3",
    naam: opts.naam || "Editor export",
    beschrijving:
      opts.beschrijving || "V3 export vanuit UML editor (codegen-ready)",
    datatypes,
    enums,
    entiteiten,
    ...(referentielijstInstanties.length > 0 ? { referentielijstInstanties } : {}),
  };
}
