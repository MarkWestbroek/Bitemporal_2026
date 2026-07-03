// @ts-check
/**
 * adapter — OpenAPI 3.1-document → diagramcore-model voor het oas31-profiel.
 *
 * Puur (neemt een geparsed document-object aan; YAML/JSON-parsing gebeurt bij
 * de aanroeper) en verliesarm op schema-niveau:
 *
 *   components.schemas → «schema»-elementen (properties + required) en
 *   «enum»-elementen; $ref-properties worden ref-connectoren met de
 *   property-naam als rolnaam, array-items met $ref worden items-connectoren,
 *   allOf wordt een allOf-connector (+ de inline delen als eigen properties).
 *
 *   paths → «operation»-elementen (method/pad/summary) met ref-connectoren
 *   naar de request- en response-schemas.
 *
 * Het resultaat krijgt één diagram ("componenten") met een eenvoudige
 * grid-plaatsing — geen auto-layout-afhankelijkheid.
 */

/** "#/components/schemas/Persoon" → "Persoon" (anders null). */
function refNaam(ref) {
  const m = /^#\/components\/schemas\/([^/]+)$/.exec(ref || "");
  return m ? m[1] : null;
}

/** Type-kolomtekst voor een property-schema (zonder $ref-afhandeling). */
function typeLabelVoor(schema) {
  if (!schema) return "";
  if (schema.type === "array") {
    const items = schema.items || {};
    const itemRef = refNaam(items.$ref);
    if (itemRef) return `${itemRef}[]`;
    return `${typeLabelVoor(items) || "object"}[]`;
  }
  let t = schema.type || (schema.$ref ? refNaam(schema.$ref) || "object" : "object");
  if (schema.format) t += ` «${schema.format}»`;
  return t;
}

/** Eerste schema uit een content-map (application/json wint). */
function contentSchema(content) {
  if (!content) return null;
  const mediaType = content["application/json"] || Object.values(content)[0];
  return mediaType?.schema || null;
}

let _connTeller = 0;
const nieuwConnId = (soort) => `oasconn_${soort}_${++_connTeller}`;

/**
 * @param {Object} doc - geparsed OpenAPI 3.1-document
 * @returns {{elements: Record<string, Object>, diagrams: Record<string, Object>, meta: Object}}
 */
export function vanOasDocument(doc) {
  const elements = {};
  const connectoren = [];

  const voegRef = (bron, doelRef, soort, rolnaam) => {
    const doel = refNaam(doelRef);
    if (!doel) return false;
    connectoren.push({
      id: nieuwConnId(soort),
      naam: "",
      elementType: soort,
      source: bron,
      target: doel,
      compartimenten: [],
      data: rolnaam ? { rolnaam } : {},
    });
    return true;
  };

  // ── components.schemas ────────────────────────────────────────────────
  const schemas = doc?.components?.schemas || {};
  for (const [naam, schema] of Object.entries(schemas)) {
    if (Array.isArray(schema?.enum)) {
      elements[naam] = {
        id: naam,
        naam,
        elementType: "enum",
        compartimenten: [
          {
            compartmentType: "waarden",
            velden: schema.enum.map((w) => ({ naam: String(w), fieldType: "literal" })),
          },
        ],
        data: { bron: schema },
      };
      continue;
    }

    // allOf: refs → connectoren; inline delen → eigen properties.
    const delen = Array.isArray(schema?.allOf) ? schema.allOf : [schema];
    const eigen = { properties: {}, required: [] };
    for (const deel of delen) {
      if (deel?.$ref) {
        voegRef(naam, deel.$ref, "allOf", null);
        continue;
      }
      Object.assign(eigen.properties, deel?.properties || {});
      eigen.required.push(...(deel?.required || []));
    }

    const velden = [];
    for (const [propNaam, prop] of Object.entries(eigen.properties)) {
      const verplicht = eigen.required.includes(propNaam);
      if (prop?.$ref) {
        voegRef(naam, prop.$ref, "ref", propNaam);
        velden.push({
          naam: propNaam,
          fieldType: "property",
          data: { typeLabel: refNaam(prop.$ref) || "object", verplicht },
        });
        continue;
      }
      if (prop?.type === "array" && prop.items?.$ref) {
        voegRef(naam, prop.items.$ref, "items", propNaam);
      }
      velden.push({
        naam: propNaam,
        fieldType: "property",
        data: { typeLabel: typeLabelVoor(prop), verplicht },
      });
    }

    elements[naam] = {
      id: naam,
      naam,
      elementType: "schema",
      compartimenten: velden.length ? [{ compartmentType: "properties", velden }] : [],
      data: {
        ...(schema?.description ? { beschrijving: schema.description } : {}),
        bron: schema,
      },
    };
  }

  // ── paths → operaties ─────────────────────────────────────────────────
  const METHODS = ["get", "post", "put", "patch", "delete"];
  for (const [pad, padItem] of Object.entries(doc?.paths || {})) {
    for (const method of METHODS) {
      const op = padItem?.[method];
      if (!op) continue;
      const id = `op_${method}_${pad}`.replace(/[^a-zA-Z0-9_]/g, "_");
      elements[id] = {
        id,
        naam: op.operationId || `${method.toUpperCase()} ${pad}`,
        elementType: "operatie",
        compartimenten: [],
        data: {
          method: method.toUpperCase(),
          pad,
          ...(op.summary ? { samenvatting: op.summary } : {}),
          bron: op,
        },
      };

      const reqSchema = contentSchema(op.requestBody?.content);
      if (reqSchema) {
        voegRef(id, reqSchema.$ref || reqSchema.items?.$ref, "ref", "request");
      }
      for (const [status, response] of Object.entries(op.responses || {})) {
        if (!/^2\d\d$/.test(status)) continue;
        const respSchema = contentSchema(response?.content);
        if (respSchema) {
          voegRef(id, respSchema.$ref || respSchema.items?.$ref, "ref", `response ${status}`);
        }
      }
    }
  }

  // Connectoren waarvan het doel niet bestaat (externe $refs) overslaan.
  for (const conn of connectoren) {
    if (elements[conn.target]) elements[conn.id] = conn;
  }

  // ── Eén diagram met grid-plaatsing: schemas/enums boven, operaties onder ──
  const PER_RIJ = 4;
  const nodes = [];
  const plaats = (ids, yStart) => {
    ids.forEach((id, i) => {
      nodes.push({
        elementId: id,
        position: { x: 60 + (i % PER_RIJ) * 320, y: yStart + Math.floor(i / PER_RIJ) * 260 },
      });
    });
    return yStart + Math.ceil(ids.length / PER_RIJ) * 260;
  };
  const schemaIds = Object.values(elements)
    .filter((el) => el.elementType === "schema" || el.elementType === "enum")
    .map((el) => el.id);
  const operatieIds = Object.values(elements)
    .filter((el) => el.elementType === "operatie")
    .map((el) => el.id);
  const yNa = plaats(schemaIds, 60);
  plaats(operatieIds, yNa + 120);

  return {
    elements,
    diagrams: {
      componenten: { id: "componenten", naam: doc?.info?.title || "Componenten", nodes, edges: [] },
    },
    meta: { oasInfo: doc?.info || null },
  };
}
