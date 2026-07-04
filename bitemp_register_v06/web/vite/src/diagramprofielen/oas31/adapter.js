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
    // oneOf/anyOf: alleen $ref-varianten worden connectoren (inline
    // varianten zijn een restpunt — zeldzaam in componenten-schemas).
    for (const soort of ["oneOf", "anyOf"]) {
      for (const variant of Array.isArray(schema?.[soort]) ? schema[soort] : []) {
        if (variant?.$ref) voegRef(naam, variant.$ref, soort, null);
      }
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
      const tag = op.tags?.[0] || pad.split("/").filter(Boolean)[0] || "overig";
      elements[id] = {
        id,
        naam: op.operationId || `${method.toUpperCase()} ${pad}`,
        elementType: "operatie",
        compartimenten: [],
        data: {
          method: method.toUpperCase(),
          pad,
          tag,
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

  const diagrams = {
    componenten: { id: "componenten", naam: doc?.info?.title || "Componenten", nodes, edges: [] },
  };

  // ── Ontpluizen: per tag (of pad-groep) een eigen diagram met de operaties
  // van die tag plus de schemas die daarvandaan (transitief, 2 stappen)
  // bereikbaar zijn — zo blijft een grote OAS leesbaar.
  const perTag = new Map();
  for (const el of Object.values(elements)) {
    if (el.elementType !== "operatie") continue;
    const tag = el.data?.tag || "overig";
    if (!perTag.has(tag)) perTag.set(tag, []);
    perTag.get(tag).push(el.id);
  }
  if (perTag.size > 1 || (perTag.size === 1 && schemaIds.length > 6)) {
    const uitgaand = new Map(); // element-id → [doel-ids]
    for (const el of Object.values(elements)) {
      if (!el.source || !el.target) continue;
      if (!uitgaand.has(el.source)) uitgaand.set(el.source, []);
      uitgaand.get(el.source).push(el.target);
    }
    for (const [tag, opIds] of perTag) {
      const bereikbaar = new Set(opIds);
      let rand = [...opIds];
      for (let stap = 0; stap < 2; stap++) {
        const volgende = [];
        for (const vanId of rand) {
          for (const doel of uitgaand.get(vanId) || []) {
            if (!bereikbaar.has(doel)) {
              bereikbaar.add(doel);
              volgende.push(doel);
            }
          }
        }
        rand = volgende;
      }
      const tagSchemas = [...bereikbaar].filter((eid) => {
        const t = elements[eid]?.elementType;
        return t === "schema" || t === "enum";
      });
      const tagNodes = [];
      tagSchemas.forEach((eid, i) => {
        tagNodes.push({
          elementId: eid,
          position: { x: 60 + (i % PER_RIJ) * 320, y: 60 + Math.floor(i / PER_RIJ) * 260 },
        });
      });
      const yOps = 60 + Math.ceil(tagSchemas.length / PER_RIJ) * 260 + 120;
      opIds.forEach((eid, i) => {
        tagNodes.push({
          elementId: eid,
          position: { x: 60 + (i % PER_RIJ) * 320, y: yOps + Math.floor(i / PER_RIJ) * 200 },
        });
      });
      diagrams[`tag_${tag}`] = { id: `tag_${tag}`, naam: `# ${tag}`, nodes: tagNodes, edges: [] };
    }
  }

  return { elements, diagrams, meta: { oasInfo: doc?.info || null } };
}

// ═══════════════════════════════════════════════════════════════════════════
// Terugreis: diagramcore-model → OpenAPI 3.1-document (voor YAML-export).
// Zelfde spiegel + delta-principe als canoniek-uml: `data.bron` is de basis,
// wat in 0.5 bewerkt is (properties, connectoren, teksten) overschrijft dat.
// ═══════════════════════════════════════════════════════════════════════════

/** typeLabel-tekst → property-schema ("Adres" → $ref, "string «date»" → type+format). */
function schemaVoorTypeLabel(label, schemaNamen) {
  const schoon = (label || "").trim();
  if (!schoon) return { type: "string" };
  const arrayMatch = /^(.+)\[\]$/.exec(schoon);
  if (arrayMatch) {
    return { type: "array", items: schemaVoorTypeLabel(arrayMatch[1], schemaNamen) };
  }
  if (schemaNamen.has(schoon)) return { $ref: `#/components/schemas/${schoon}` };
  const fmtMatch = /^([\w-]+)\s*«(.+)»$/.exec(schoon);
  if (fmtMatch) return { type: fmtMatch[1], format: fmtMatch[2] };
  return { type: schoon };
}

/**
 * Converteer de 0.5-sandbox terug naar een OpenAPI 3.1-document.
 *
 * @param {{elements: Record<string, Object>, meta?: Object}} state
 * @returns {Object} OpenAPI-document (components.schemas + paths)
 */
export function naarOasDocument(state) {
  const els = Object.values(state?.elements || {});
  const schemaNamen = new Set(
    els.filter((el) => el.elementType === "schema" || el.elementType === "enum").map((el) => el.naam)
  );

  // Connectoren per bron verzamelen (allOf/oneOf/anyOf/ref/items).
  const connsVan = new Map();
  for (const el of els) {
    if (!el.source || !el.target) continue;
    if (!connsVan.has(el.source)) connsVan.set(el.source, []);
    connsVan.get(el.source).push(el);
  }
  const naamVan = (id) => state.elements[id]?.naam || id;
  const refNaar = (id) => ({ $ref: `#/components/schemas/${naamVan(id)}` });

  const schemas = {};
  for (const el of els) {
    if (el.elementType === "enum") {
      const bron = el.data?.bron || {};
      schemas[el.naam] = {
        ...bron,
        type: bron.type || "string",
        enum: compVeldenVan(el, "waarden").map((v) => v.naam),
      };
      continue;
    }
    if (el.elementType !== "schema") continue;
    const bron = el.data?.bron || {};
    const conns = connsVan.get(el.id) || [];

    const properties = {};
    const required = [];
    for (const veld of compVeldenVan(el, "properties")) {
      const bronProp =
        (bron.properties || {})[veld.naam] ||
        (Array.isArray(bron.allOf)
          ? bron.allOf.find((d) => d?.properties?.[veld.naam])?.properties?.[veld.naam]
          : undefined) ||
        {};
      properties[veld.naam] = {
        ...(typeof bronProp === "object" && !bronProp.$ref ? bronProp : {}),
        ...schemaVoorTypeLabel(veld.data?.typeLabel, schemaNamen),
      };
      if (veld.data?.verplicht) required.push(veld.naam);
    }

    const eigen = {
      type: "object",
      ...(el.data?.beschrijving ? { description: el.data.beschrijving } : bron.description ? { description: bron.description } : {}),
      ...(Object.keys(properties).length ? { properties } : {}),
      ...(required.length ? { required } : {}),
    };

    const allOfRefs = conns.filter((c) => c.elementType === "allOf").map((c) => refNaar(c.target));
    const oneOfRefs = conns.filter((c) => c.elementType === "oneOf").map((c) => refNaar(c.target));
    const anyOfRefs = conns.filter((c) => c.elementType === "anyOf").map((c) => refNaar(c.target));

    if (allOfRefs.length) {
      schemas[el.naam] = { allOf: [...allOfRefs, eigen] };
    } else if (oneOfRefs.length) {
      schemas[el.naam] = { oneOf: oneOfRefs, ...(Object.keys(properties).length ? { ...eigen } : {}) };
    } else if (anyOfRefs.length) {
      schemas[el.naam] = { anyOf: anyOfRefs, ...(Object.keys(properties).length ? { ...eigen } : {}) };
    } else {
      schemas[el.naam] = eigen;
    }
  }

  // paths uit operatie-elementen; request/response-refs uit hun connectoren.
  const paths = {};
  for (const el of els) {
    if (el.elementType !== "operatie") continue;
    const d = el.data || {};
    const bron = d.bron || {};
    const pad = d.pad || "/";
    const method = (d.method || "GET").toLowerCase();
    const op = {
      ...bron,
      operationId: el.naam || bron.operationId,
      ...(d.samenvatting ? { summary: d.samenvatting } : {}),
      ...(d.tag ? { tags: [d.tag] } : bron.tags ? { tags: bron.tags } : {}),
    };
    const conns = connsVan.get(el.id) || [];
    for (const conn of conns.filter((c) => c.elementType === "ref")) {
      const rol = conn.data?.rolnaam || "response";
      const inhoud = { content: { "application/json": { schema: refNaar(conn.target) } } };
      if (rol === "request") {
        op.requestBody = { ...(bron.requestBody || {}), ...inhoud };
      } else {
        const status = /response (\d{3})/.exec(rol)?.[1] || "200";
        op.responses = { ...(op.responses || {}), [status]: { ...(bron.responses?.[status] || {}), ...inhoud } };
      }
    }
    if (!op.responses) op.responses = bron.responses || { 200: { description: "OK" } };
    if (!paths[pad]) paths[pad] = {};
    paths[pad][method] = op;
  }

  return {
    openapi: "3.1.0",
    info: state?.meta?.oasInfo || { title: "Omnium Studio export", version: "1.0" },
    ...(Object.keys(paths).length ? { paths } : {}),
    components: { schemas },
  };
}

/** Velden van een compartiment (lokale helper voor de terugreis). */
function compVeldenVan(el, compartmentType) {
  return (
    (el.compartimenten || []).find((c) => c.compartmentType === compartmentType)?.velden || []
  );
}
