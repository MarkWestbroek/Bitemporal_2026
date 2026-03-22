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

// === Helper functies ===

/** Genereer een simpele unieke ID */
let _idCounter = 0;
export function generateId(prefix = "node") {
  _idCounter += 1;
  return `${prefix}_${Date.now()}_${_idCounter}`;
}

/** Default kleur per metatype */
export function defaultKleur(metatype) {
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

/** Maak een leeg type-object */
export function maakLeegType(metatype = "entiteit") {
  return {
    id: generateId(metatype),
    typenaam: "",
    description: "",
    metatype,
    isMaterieel: metatype === "entiteit",
    kleur: defaultKleur(metatype),
    velden: [],
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
  };
}

/** Maak een lege enumeratie */
export function maakLegeEnumeratie() {
  return {
    id: generateId("enum"),
    naam: "",
    waarden: [""],
  };
}

/** Maak een leeg gegevenstype (custom datatype) */
export function maakLeegGegevenstype() {
  return {
    id: generateId("datatype"),
    naam: "",
    description: "",
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
 * Bouw de VELDTYPEN-lijst dynamisch op: primitieve types + custom datatypes + enumeraties.
 * @param {Array} datatypeNodes - React Flow nodes met type === "gegevenstype"
 * @param {Array} enumNodes - React Flow nodes met type === "enumeratie"
 * @returns {Array} veldtypen array met { type, format, label, isCustom?, isEnum?, enumNaam?, enumWaarden? }
 */
export function bouwVeldtypen(datatypeNodes = [], enumNodes = []) {
  const custom = datatypeNodes.map((n) => ({
    type: n.data.basistype || "string",
    format: n.data.format || "",
    label: n.data.naam || n.data.format || "(naamloos)",
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
  return [...VELDTYPEN, ...custom, ...enums];
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
      basistype: n.data.basistype,
      format: n.data.format,
      validatie: n.data.validatie,
      normalisatie: n.data.normalisatie,
      weergave: n.data.weergave,
    }));

  return { types, relaties, enumeraties, datatypes };
}
