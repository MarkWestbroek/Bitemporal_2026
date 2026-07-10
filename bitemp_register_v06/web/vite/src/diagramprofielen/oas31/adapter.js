// @ts-check
/**
 * adapter — OpenAPI 3.1-document → diagramcore-model voor het oas31-profiel.
 * (OAS 3.0 is een aparte opgave — zie BACKLOG; veel 3.0-documenten importeren
 * grotendeels, maar 3.0-eigenaardigheden zoals `nullable` vertalen we hier
 * bewust niet.)
 *
 * Puur (neemt een geparsed document-object aan; YAML/JSON-parsing gebeurt bij
 * de aanroeper) en verliesarm:
 *
 *   info → één «api»-element (titel/versie/beschrijving/licentie/contact);
 *   servers → «server»-elementen met een servers-connector vanaf de api.
 *
 *   components.schemas → «schema»-elementen (properties + required, incl.
 *   description/example/pattern/default per property) en «enum»-elementen;
 *   $ref-properties worden ref-connectoren met de property-naam als rolnaam,
 *   array-items met $ref worden items-connectoren, allOf wordt een
 *   allOf-connector (+ de inline delen als eigen properties). Primitieve
 *   schemas (string met format, …) dragen hun type als element-property,
 *   externe $ref-schemas (./bestand.json, URL) hun verwijzing.
 *
 *   paths → «operation»-elementen (method/pad/summary/description/tag/
 *   deprecated) met parameters- en responses-compartimenten (álle
 *   statussen) en ref-connectoren naar request- en response-schemas.
 *   Lokale $refs naar components.requestBodies/responses/parameters worden
 *   voor de weergave gevolgd; die componenten zelf reizen als pass-through
 *   mee in meta (net als tags, security en andere document-sleutels), zodat
 *   de export ze reproduceert.
 *
 * Het resultaat krijgt één diagram ("componenten"), geplaatst met de
 * gedeelde rijen-layout (api/servers bovenaan, dan operaties op
 * CRUD-volgorde, schemas per $ref-afstand eronder) — hetzelfde beeld als de
 * Auto-layout-knop.
 */
import { oasRijenPosities } from "./index.js";

/** "#/components/schemas/Persoon" → "Persoon" (anders null). */
function refNaam(ref) {
  const m = /^#\/components\/schemas\/([^/]+)$/.exec(ref || "");
  return m ? m[1] : null;
}

/**
 * Volg lokale $refs ("#/components/…") binnen het document — voor
 * requestBodies/responses/parameters die als benoemde componenten leven.
 * Externe $refs (andere bestanden/URL's) blijven staan.
 */
function derefLocal(doc, obj) {
  let huidig = obj;
  for (let hop = 0; hop < 10 && huidig && typeof huidig.$ref === "string" && huidig.$ref.startsWith("#/"); hop++) {
    const doel = huidig.$ref
      .slice(2)
      .split("/")
      .reduce((o, k) => o?.[decodeURIComponent(k).replace(/~1/g, "/").replace(/~0/g, "~")], doc);
    if (!doel) break;
    huidig = doel;
  }
  return huidig;
}

/** info.contact → één leesbare regel ("naam · e-mail · url"). */
function contactTekst(contact) {
  return [contact?.name, contact?.email, contact?.url].filter(Boolean).join(" · ");
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
  // 3.1: type mag een array zijn (["string","null"]) → "string|null".
  let t = Array.isArray(schema.type)
    ? schema.type.join("|")
    : schema.type || (schema.$ref ? refNaam(schema.$ref) || "object" : "object");
  if (schema.format) t += ` «${schema.format}»`;
  return t;
}

/** Eerste voorbeeld van een schema: 3.1 `examples`-array of `example`. */
function voorbeeldVan(schema) {
  if (schema?.example !== undefined) return String(schema.example);
  if (Array.isArray(schema?.examples) && schema.examples.length) return String(schema.examples[0]);
  return undefined;
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

  // ── info + servers ────────────────────────────────────────────────────
  const API_ID = "__api__";
  if (doc?.info) {
    const info = doc.info;
    elements[API_ID] = {
      id: API_ID,
      naam: info.title || "API",
      elementType: "api",
      compartimenten: [],
      data: {
        ...(info.version ? { versie: info.version } : {}),
        ...(info.description ? { beschrijving: info.description } : {}),
        ...(info.license?.name ? { licentie: info.license.name } : {}),
        ...(contactTekst(info.contact) ? { contact: contactTekst(info.contact) } : {}),
        bron: info,
      },
    };
  }
  (Array.isArray(doc?.servers) ? doc.servers : []).forEach((server, i) => {
    const sid = `__server_${i + 1}`;
    elements[sid] = {
      id: sid,
      naam: server.url || sid,
      elementType: "server",
      compartimenten: [],
      data: {
        ...(server.description ? { beschrijving: server.description } : {}),
        bron: server,
      },
    };
    if (elements[API_ID]) {
      connectoren.push({
        id: nieuwConnId("servers"),
        naam: "",
        elementType: "servers",
        source: API_ID,
        target: sid,
        compartimenten: [],
        data: {},
      });
    }
  });

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
        data: {
          ...(schema.description ? { beschrijving: schema.description } : {}),
          bron: schema,
        },
      };
      continue;
    }

    // Een schema dat zélf een $ref is: lokaal = alias (ref-connector),
    // extern (./bestand.json, URL) = schema-element met de verwijzing.
    if (schema?.$ref) {
      const lokaal = refNaam(schema.$ref);
      if (lokaal) voegRef(naam, schema.$ref, "ref", "(alias)");
      elements[naam] = {
        id: naam,
        naam,
        elementType: "schema",
        compartimenten: [],
        data: {
          ...(lokaal ? {} : { externRef: schema.$ref }),
          ...(schema.description ? { beschrijving: schema.description } : {}),
          bron: schema,
        },
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

    // Detail-data van een property-schema (description/example/pattern/
    // default) — example/default als tekst, de bron bewaart het type.
    const propDetails = (prop) => ({
      ...(prop?.description ? { beschrijving: prop.description } : {}),
      ...(voorbeeldVan(prop) !== undefined ? { voorbeeld: voorbeeldVan(prop) } : {}),
      ...(prop?.pattern ? { patroon: prop.pattern } : {}),
      ...(prop?.default !== undefined ? { standaard: String(prop.default) } : {}),
    });

    const velden = [];
    for (const [propNaam, prop] of Object.entries(eigen.properties)) {
      const verplicht = eigen.required.includes(propNaam);
      if (prop?.$ref) {
        voegRef(naam, prop.$ref, "ref", propNaam);
        velden.push({
          naam: propNaam,
          fieldType: "property",
          data: { typeLabel: refNaam(prop.$ref) || "object", verplicht, ...propDetails(prop) },
        });
        continue;
      }
      if (prop?.type === "array" && prop.items?.$ref) {
        voegRef(naam, prop.items.$ref, "items", propNaam);
      }
      velden.push({
        naam: propNaam,
        fieldType: "property",
        data: { typeLabel: typeLabelVoor(prop), verplicht, ...propDetails(prop) },
      });
    }

    // Primitief schema (TraceID: string «uuid», …): geen properties, wel
    // een eigen type — dat wordt een element-property (+ weergave-regel).
    const primitief = !velden.length && schema?.type && schema.type !== "object";
    elements[naam] = {
      id: naam,
      naam,
      elementType: "schema",
      compartimenten: velden.length ? [{ compartmentType: "properties", velden }] : [],
      data: {
        ...(schema?.description ? { beschrijving: schema.description } : {}),
        ...(primitief ? { typeLabel: typeLabelVoor(schema) } : {}),
        ...(voorbeeldVan(schema) !== undefined ? { voorbeeld: voorbeeldVan(schema) } : {}),
        ...(schema?.pattern ? { patroon: schema.pattern } : {}),
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

      // Parameters (pad-niveau + operatie-niveau); benoemde componenten
      // ($ref naar components.parameters) worden voor de weergave gevolgd.
      const parameterVelden = [...(padItem.parameters || []), ...(op.parameters || [])]
        .map((p) => derefLocal(doc, p))
        .filter((p) => p && p.name)
        .map((p) => ({
          naam: p.name,
          fieldType: "parameter",
          data: {
            ...(p.in ? { in: p.in } : {}),
            typeLabel: p.schema?.$ref ? refNaam(p.schema.$ref) || "object" : typeLabelVoor(p.schema),
            verplicht: !!p.required,
            ...(p.description ? { beschrijving: p.description } : {}),
            bronParam: p,
          },
        }));

      // Responses: álle statussen als compartiment-regel; schemas ($ref,
      // ook in arrays en ook voor 4xx/5xx) worden ref-connectoren.
      const responseVelden = [];
      for (const [status, response] of Object.entries(op.responses || {})) {
        const resp = derefLocal(doc, response) || {};
        const respSchema = contentSchema(resp.content);
        const doelRef = respSchema?.$ref || respSchema?.items?.$ref;
        const doelNaam = refNaam(doelRef);
        responseVelden.push({
          naam: status,
          fieldType: "response",
          data: {
            ...(doelNaam
              ? { typeLabel: respSchema?.items ? `${doelNaam}[]` : doelNaam }
              : respSchema
                ? { typeLabel: typeLabelVoor(respSchema) }
                : {}),
            ...(resp.description ? { beschrijving: resp.description } : {}),
          },
        });
        if (doelRef) voegRef(id, doelRef, "ref", `response ${status}`);
      }

      elements[id] = {
        id,
        naam: op.operationId || `${method.toUpperCase()} ${pad}`,
        elementType: "operatie",
        compartimenten: [
          ...(parameterVelden.length ? [{ compartmentType: "parameters", velden: parameterVelden }] : []),
          ...(responseVelden.length ? [{ compartmentType: "responses", velden: responseVelden }] : []),
        ],
        data: {
          method: method.toUpperCase(),
          pad,
          ...(op.tags?.[0] ? { tag: op.tags[0] } : {}),
          ...(op.summary ? { samenvatting: op.summary } : {}),
          ...(op.description ? { beschrijving: op.description } : {}),
          ...(op.deprecated ? { verouderd: true } : {}),
          bron: op,
        },
      };

      const reqSchema = contentSchema(derefLocal(doc, op.requestBody)?.content);
      if (reqSchema) {
        voegRef(id, reqSchema.$ref || reqSchema.items?.$ref, "ref", "request");
      }
    }
  }

  // Connectoren waarvan het doel niet bestaat (externe $refs) overslaan.
  for (const conn of connectoren) {
    if (elements[conn.target]) elements[conn.id] = conn;
  }

  // ── Eén diagram, geplaatst met de gedeelde rijen-layout: operaties
  // bovenaan op CRUD-volgorde, schemas per $ref-afstand eronder (zelfde
  // beeld als de Auto-layout-knop).
  const alleEdges = Object.values(elements)
    .filter((el) => el.source && el.target)
    .map((el) => ({ source: el.source, target: el.target }));
  const nietConnectorIds = Object.values(elements)
    .filter((el) => !el.source && !el.target)
    .map((el) => el.id);
  const schemaIds = Object.values(elements)
    .filter((el) => el.elementType === "schema" || el.elementType === "enum")
    .map((el) => el.id);
  const hoofdPosities = oasRijenPosities({ ids: nietConnectorIds, elements, edges: alleEdges });
  const nodes = nietConnectorIds.map((eid) => ({ elementId: eid, position: hoofdPosities[eid] }));

  const diagrams = {
    componenten: { id: "componenten", naam: doc?.info?.title || "Componenten", nodes, edges: [] },
  };

  // ── Ontpluizen: per tag (of pad-groep) een eigen diagram met de operaties
  // van die tag plus de schemas die daarvandaan (transitief, 2 stappen)
  // bereikbaar zijn — zo blijft een grote OAS leesbaar.
  const perTag = new Map();
  for (const el of Object.values(elements)) {
    if (el.elementType !== "operatie") continue;
    // Zonder expliciete OAS-tag groepeert het eerste pad-segment.
    const tag = el.data?.tag || (el.data?.pad || "").split("/").filter(Boolean)[0] || "overig";
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
      const tagIds = [...opIds, ...tagSchemas];
      const tagPosities = oasRijenPosities({ ids: tagIds, elements, edges: alleEdges });
      const tagNodes = tagIds.map((eid) => ({ elementId: eid, position: tagPosities[eid] }));
      diagrams[`tag_${tag}`] = { id: `tag_${tag}`, naam: `# ${tag}`, nodes: tagNodes, edges: [] };
    }
  }

  // Pass-through voor de terugreis: benoemde componenten (requestBodies,
  // responses, parameters, securitySchemes, …), tags en overige
  // document-sleutels (security, externalDocs, webhooks, …).
  const { schemas: _schemas, ...componentsRest } = doc?.components || {};
  const { openapi: _o, info: _i, servers: _sv, tags: _tg, paths: _pa, components: _c, ...docRest } = doc || {};
  return {
    elements,
    diagrams,
    meta: {
      oasInfo: doc?.info || null,
      ...(doc?.openapi ? { oasVersie: doc.openapi } : {}),
      ...(Array.isArray(doc?.tags) && doc.tags.length ? { oasTags: doc.tags } : {}),
      ...(Object.keys(componentsRest).length ? { oasComponents: componentsRest } : {}),
      ...(Object.keys(docRest).length ? { oasDocRest: docRest } : {}),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Terugreis: diagramcore-model → OpenAPI 3.1-document (voor YAML-export).
// Zelfde spiegel + delta-principe als canoniek-uml: `data.bron` is de basis,
// wat in 0.5 bewerkt is (properties, connectoren, teksten) overschrijft dat.
// ═══════════════════════════════════════════════════════════════════════════

/** typeLabel-tekst → property-schema ("Adres" → $ref, "string «date»" → type+format, "string|null" → type-array). */
function schemaVoorTypeLabel(label, schemaNamen) {
  const schoon = (label || "").trim();
  if (!schoon) return { type: "string" };
  const arrayMatch = /^(.+)\[\]$/.exec(schoon);
  if (arrayMatch) {
    return { type: "array", items: schemaVoorTypeLabel(arrayMatch[1], schemaNamen) };
  }
  if (schemaNamen.has(schoon)) return { $ref: `#/components/schemas/${schoon}` };
  const fmtMatch = /^([\w|-]+)\s*«(.+)»$/.exec(schoon);
  const [kaal, format] = fmtMatch ? [fmtMatch[1], fmtMatch[2]] : [schoon, null];
  // 3.1: "string|null" → type: ["string","null"]
  const type = kaal.includes("|") ? kaal.split("|") : kaal;
  return { type, ...(format ? { format } : {}) };
}

/**
 * Delta-waarde voor tekst-bewerkbare velden (example/default): niet gezet of
 * ongewijzigd t.o.v. de bron → de bronwaarde (met zijn oorspronkelijke
 * JSON-type); anders de bewerkte tekst.
 */
function bewerktOf(bewerkt, origineel) {
  if (bewerkt === undefined || bewerkt === "" || bewerkt === String(origineel ?? "")) return origineel;
  return bewerkt;
}

/** Schrijf een (eventueel bewerkt) voorbeeld terug: een 3.1 `examples`-array blijft een array, anders `example`. */
function schrijfVoorbeeld(doelSchema, bewerkt) {
  const origineel =
    doelSchema.example !== undefined
      ? doelSchema.example
      : Array.isArray(doelSchema.examples)
        ? doelSchema.examples[0]
        : undefined;
  const waarde = bewerktOf(bewerkt, origineel);
  if (waarde === undefined || waarde === origineel) return;
  if (Array.isArray(doelSchema.examples)) doelSchema.examples = [waarde, ...doelSchema.examples.slice(1)];
  else doelSchema.example = waarde;
}

/**
 * Converteer de 0.5-sandbox terug naar een OpenAPI 3.1-document.
 *
 * Pass-through-regel: verwijst de bron van een operatie voor requestBody,
 * een response of een parameter naar een benoemd component ($ref), dan wint
 * die $ref — de componenten zelf reizen mee via meta.oasComponents; edits
 * doe je dan dáár, niet in de gedereferenceerde weergave-regels.
 *
 * @param {{elements: Record<string, Object>, meta?: Object}} state
 * @returns {Object} OpenAPI-document (info/servers/tags + paths + components)
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

  // ── info + servers uit de api-/server-elementen ───────────────────────
  const api = els.find((el) => el.elementType === "api");
  const infoBron = api?.data?.bron || state?.meta?.oasInfo || {};
  const info = {
    ...infoBron,
    ...(api ? { title: api.naam || infoBron.title || "API" } : {}),
    ...(api?.data?.versie ? { version: api.data.versie } : {}),
    ...(api?.data?.beschrijving ? { description: api.data.beschrijving } : {}),
    // contact is pass-through via de bron (de éénregelige weergave is niet
    // betrouwbaar terug te splitsen); de licentie-naam wél als delta.
    ...(api?.data?.licentie ? { license: { ...(infoBron.license || {}), name: api.data.licentie } } : {}),
  };
  if (!info.title) info.title = "Omnium Studio export";
  if (!info.version) info.version = "1.0";

  const servers = els
    .filter((el) => el.elementType === "server")
    .map((el) => ({
      ...(el.data?.bron || {}),
      url: el.naam,
      ...(el.data?.beschrijving ? { description: el.data.beschrijving } : {}),
    }));

  // ── components.schemas ────────────────────────────────────────────────
  const schemas = {};
  for (const el of els) {
    if (el.elementType === "enum") {
      const bron = el.data?.bron || {};
      schemas[el.naam] = {
        ...bron,
        type: bron.type || "string",
        enum: compVeldenVan(el, "waarden").map((v) => v.naam),
        ...(el.data?.beschrijving ? { description: el.data.beschrijving } : {}),
      };
      continue;
    }
    if (el.elementType !== "schema") continue;
    const bron = el.data?.bron || {};
    const d = el.data || {};

    // Extern/alias-schema: de $ref wint (plus x-…-sleutels uit de bron).
    if (d.externRef || bron.$ref) {
      schemas[el.naam] = { ...bron, $ref: d.externRef || bron.$ref };
      continue;
    }

    const properties = {};
    const required = [];
    for (const veld of compVeldenVan(el, "properties")) {
      const vd = veld.data || {};
      const bronProp =
        (bron.properties || {})[veld.naam] ||
        (Array.isArray(bron.allOf)
          ? bron.allOf.find((deel) => deel?.properties?.[veld.naam])?.properties?.[veld.naam]
          : undefined) ||
        {};
      const kern = schemaVoorTypeLabel(vd.typeLabel, schemaNamen);
      let prop;
      if (kern.$ref) {
        // 3.1 staat description naast $ref toe; meer sturen we niet mee.
        prop = { ...kern, ...(vd.beschrijving ? { description: vd.beschrijving } : {}) };
      } else {
        prop = { ...(typeof bronProp === "object" && !bronProp.$ref ? bronProp : {}), ...kern };
        if (vd.beschrijving) prop.description = vd.beschrijving;
        if (vd.patroon) prop.pattern = vd.patroon;
        schrijfVoorbeeld(prop, vd.voorbeeld);
        const standaard = bewerktOf(vd.standaard, prop.default);
        if (standaard !== undefined) prop.default = standaard;
      }
      properties[veld.naam] = prop;
      if (vd.verplicht) required.push(veld.naam);
    }

    // Schema-brede sleutels uit de bron (description, example, pattern,
    // minProperties, x-…, externalDocs, …) blijven staan; wat de tekening
    // structureel beheert (type/properties/…) wordt hieronder opnieuw
    // opgebouwd, de tekst-details komen als delta eroverheen.
    const basis = { ...bron };
    for (const k of ["properties", "required", "allOf", "oneOf", "anyOf", "type", "format", "enum"]) {
      delete basis[k];
    }
    if (d.beschrijving) basis.description = d.beschrijving;
    if (d.patroon) basis.pattern = d.patroon;
    schrijfVoorbeeld(basis, d.voorbeeld);

    const eigenObject = {
      type: "object",
      ...(Object.keys(properties).length ? { properties } : {}),
      ...(required.length ? { required } : {}),
    };
    const conns = connsVan.get(el.id) || [];
    const allOfRefs = conns.filter((c) => c.elementType === "allOf").map((c) => refNaar(c.target));
    const oneOfRefs = conns.filter((c) => c.elementType === "oneOf").map((c) => refNaar(c.target));
    const anyOfRefs = conns.filter((c) => c.elementType === "anyOf").map((c) => refNaar(c.target));

    if (allOfRefs.length) {
      schemas[el.naam] = { ...basis, allOf: [...allOfRefs, eigenObject] };
    } else if (oneOfRefs.length) {
      schemas[el.naam] = { ...basis, oneOf: oneOfRefs, ...(Object.keys(properties).length ? eigenObject : {}) };
    } else if (anyOfRefs.length) {
      schemas[el.naam] = { ...basis, anyOf: anyOfRefs, ...(Object.keys(properties).length ? eigenObject : {}) };
    } else if (!Object.keys(properties).length && (d.typeLabel || (bron.type && bron.type !== "object"))) {
      // Primitief schema: type/format uit het bewerkbare typeLabel (of de bron).
      const kern = d.typeLabel
        ? schemaVoorTypeLabel(d.typeLabel, schemaNamen)
        : { type: bron.type, ...(bron.format ? { format: bron.format } : {}) };
      schemas[el.naam] = { ...basis, ...kern };
    } else {
      schemas[el.naam] = { ...basis, ...eigenObject };
    }
  }

  // ── paths uit operatie-elementen ──────────────────────────────────────
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
      ...(d.beschrijving ? { description: d.beschrijving } : {}),
      ...(d.verouderd ? { deprecated: true } : {}),
      ...(d.tag ? { tags: [d.tag, ...(bron.tags || []).slice(1)] } : {}),
    };

    // Parameters: compartiment-regels; benoemde $ref-parameters zijn bij
    // import gederefereerd en gaan dus inline terug.
    const parameterVelden = compVeldenVan(el, "parameters");
    if (parameterVelden.length) {
      op.parameters = parameterVelden.map((veld) => {
        const vd = veld.data || {};
        const p = { ...(vd.bronParam || {}), name: veld.naam };
        if (vd.in) p.in = vd.in;
        if (vd.beschrijving) p.description = vd.beschrijving;
        if (vd.typeLabel) p.schema = schemaVoorTypeLabel(vd.typeLabel, schemaNamen);
        if (vd.verplicht) p.required = true;
        else delete p.required;
        return p;
      });
    }

    // Request-/response-schemas uit de ref-connectoren.
    const conns = connsVan.get(el.id) || [];
    const responsesUitConns = new Map();
    for (const conn of conns.filter((c) => c.elementType === "ref")) {
      const rol = conn.data?.rolnaam || "response";
      if (rol === "request") {
        if (bron.requestBody?.$ref) continue; // benoemd component: pass-through
        const mt = Object.keys(bron.requestBody?.content || {})[0] || "application/json";
        op.requestBody = {
          ...(bron.requestBody || {}),
          content: {
            ...(bron.requestBody?.content || {}),
            [mt]: { ...(bron.requestBody?.content?.[mt] || {}), schema: refNaar(conn.target) },
          },
        };
        continue;
      }
      const status = /response (\d{3})/.exec(rol)?.[1] || "200";
      responsesUitConns.set(status, refNaar(conn.target));
    }

    // Responses: compartiment-regels (alle statussen) + connector-schemas;
    // het typeLabel van de regel weet meer dan de connector (arrays).
    const maakResponse = (status, vd, schemaRef) => {
      const bronResp = bron.responses?.[status];
      const resp = { ...(bronResp || {}) };
      if (vd?.beschrijving) resp.description = vd.beschrijving;
      const schema = vd?.typeLabel ? schemaVoorTypeLabel(vd.typeLabel, schemaNamen) : schemaRef;
      if (schema) {
        const mt = Object.keys(bronResp?.content || {})[0] || "application/json";
        resp.content = {
          ...(bronResp?.content || {}),
          [mt]: { ...(bronResp?.content?.[mt] || {}), schema },
        };
      }
      return resp;
    };
    const responseVelden = compVeldenVan(el, "responses");
    if (responseVelden.length || responsesUitConns.size) {
      op.responses = {};
      for (const veld of responseVelden) {
        const status = veld.naam;
        const bronResp = bron.responses?.[status];
        if (bronResp?.$ref) {
          op.responses[status] = bronResp; // benoemd component: pass-through
        } else {
          op.responses[status] = maakResponse(status, veld.data, responsesUitConns.get(status));
        }
        responsesUitConns.delete(status);
      }
      // Connectoren zonder eigen regel (handmatig getekend).
      for (const [status, schemaRef] of responsesUitConns) {
        const bronResp = bron.responses?.[status];
        op.responses[status] = bronResp?.$ref ? bronResp : maakResponse(status, null, schemaRef);
      }
    }
    if (!op.responses) op.responses = bron.responses || { 200: { description: "OK" } };

    if (!paths[pad]) paths[pad] = {};
    paths[pad][method] = op;
  }

  return {
    openapi: state?.meta?.oasVersie || "3.1.0",
    info,
    ...(servers.length ? { servers } : {}),
    ...(state?.meta?.oasTags ? { tags: state.meta.oasTags } : {}),
    ...(state?.meta?.oasDocRest || {}),
    ...(Object.keys(paths).length ? { paths } : {}),
    components: { ...(state?.meta?.oasComponents || {}), schemas },
  };
}

/** Velden van een compartiment (lokale helper voor de terugreis). */
function compVeldenVan(el, compartmentType) {
  return (
    (el.compartimenten || []).find((c) => c.compartmentType === compartmentType)?.velden || []
  );
}
