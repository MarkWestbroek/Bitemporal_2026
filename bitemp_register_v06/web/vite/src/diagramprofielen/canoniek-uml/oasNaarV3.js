// @ts-check
/**
 * oasNaarV3 — OpenAPI 3.0/3.1 `components.schemas` → V3-model (canoniek-uml).
 *
 * Deel B van `docs/plans/2026-09-10 Opdracht demo-model np-loc-org-geo en
 * OAS-naar-canoniek.md`. Het `oas31`-diagramprofiel importeert een OAS al als
 * *eigen* notatie; deze module doet iets anders: ze zet de schemas om naar het
 * **canonieke model** (entiteiten, gegevenselementen, relaties, enums), zodat
 * de Studio er verder aan kan werken. V3 is daarvoor het juiste tussenformaat:
 * `serialisatie.js → importeerV3()` maakt er het core-model van.
 *
 * Uitgangspunt is *eerlijk tonen wat er in het document staat*, niet mooi
 * normaliseren. Wat niet past komt als diagnostic terug in plaats van stilletjes
 * te verdwijnen; opschonen doet de modelleur daarna met de hand in de Studio.
 *
 * Buiten scope (bewust): `paths`/operations, security, en de terugweg naar OAS.
 *
 * ## De heuristiek
 *
 * Een object-schema wordt een **entiteit** als het een eigen identiteit heeft of
 * zelfstandig staat, en anders een **gegevenselement** van het schema dat ernaar
 * verwijst:
 *
 * | Situatie | Wordt |
 * |---|---|
 * | heeft een `id`-achtige property | entiteit |
 * | door niemand ge-`$ref`d (top-level) | entiteit |
 * | door 2+ schemas ge-`$ref`d (gedeeld) | entiteit |
 * | door precies één schema ge-`$ref`d, zonder identiteit | GE van dat schema |
 *
 * Per property:
 *
 * | Property | Wordt |
 * |---|---|
 * | scalair | veld in het GE `<Entiteit>Gegevens` |
 * | `$ref` → entiteit | relatie (`doelEntiteit`) |
 * | `$ref` → GE-schema | dat GE, enkelvoudig |
 * | array van `$ref` | relatie/GE, **meervoudig** |
 * | array van scalars | eigen GE met één veld, **meervoudig** |
 * | inline object | eigen GE `<Entiteit><Property>` |
 * | `enum` | veld + een V3Enum `<Schema><Property>` |
 *
 * `required` bepaalt de optionaliteit (en daarmee de `*`-prefix op het goType).
 */

const OAS_REF = "#/components/schemas/";

// ── Naamgeving ───────────────────────────────────────────────────────────────

/** "natuurlijk_persoon" / "natuurlijkPersoon" → "NatuurlijkPersoon". */
export function pascal(naam) {
  return String(naam || "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

/** Meervoud/padnaam-achtige kleine-letterversie; V3 gebruikt dit als rolnaam. */
function rolnaam(naam) {
  const p = pascal(naam);
  return p ? p.charAt(0).toLowerCase() + p.slice(1) : "";
}

/** Maak een naam uniek binnen een set (Naam, Naam2, Naam3, …). */
function uniek(naam, gebruikt) {
  let kandidaat = naam || "Naamloos";
  let n = 2;
  while (gebruikt.has(kandidaat)) kandidaat = `${naam}${n++}`;
  gebruikt.add(kandidaat);
  return kandidaat;
}

/** "#/components/schemas/Persoon" → "Persoon" (anders null). */
function refNaam(ref) {
  return typeof ref === "string" && ref.startsWith(OAS_REF) ? ref.slice(OAS_REF.length) : null;
}

// ── Typen ────────────────────────────────────────────────────────────────────

/**
 * OAS type/format → Go-type, volgens dezelfde conventies als het register zelf
 * (`Date` voor date, `time.Time` voor date-time, int64 bij format int64).
 * Optionele velden krijgen een pointer, net als in de gegenereerde structs.
 */
export function goTypeVoor({ type, format }, verplicht) {
  const t = Array.isArray(type) ? type.find((x) => x !== "null") : type;
  let basis;
  switch (t) {
    case "integer":
      basis = format === "int64" ? "int64" : "int";
      break;
    case "number":
      basis = format === "float" || format === "float32" ? "float32" : "float64";
      break;
    case "boolean":
      basis = "bool";
      break;
    case "string":
      if (format === "date") basis = "Date";
      else if (format === "date-time") basis = "time.Time";
      else basis = "string";
      break;
    default:
      basis = "string";
  }
  return verplicht ? basis : `*${basis}`;
}

/** OAS-type dat in V3 terechtkomt (arrays zijn al afgepeld door de aanroeper). */
function oasType(schema) {
  const t = Array.isArray(schema?.type) ? schema.type.find((x) => x !== "null") : schema?.type;
  return t || (schema?.enum ? "string" : "string");
}

/** Technische/plumbing-velden zoals het register ze genereert. */
function isTechnischeProperty(naam) {
  const n = String(naam || "").toLowerCase();
  return n === "id" || n === "rel_id" || n === "versie" || n === "opvoer" || n === "afvoer" || n.endsWith("_id");
}

/** Heeft dit schema een identiteit (en dus recht op een eigen entiteit)? */
function heeftIdentiteit(schema) {
  const props = schema?.properties || {};
  return Object.keys(props).some((naam) => /^(id|uuid|identificatie)$/i.test(naam));
}

// ── Schema's normaliseren ────────────────────────────────────────────────────

/**
 * Vouw `allOf` plat: inline delen en lokale `$ref`-delen worden samengevoegd
 * tot één properties/required-verzameling. Dat is bewust grof — samenstelling
 * is in OAS vaak overerving, en die kent het canonieke model (nog) niet.
 */
function vouwAllOf(naam, schema, schemas, diagnostics, diepte = 0) {
  if (!schema || typeof schema !== "object") return { properties: {}, required: [] };
  if (!Array.isArray(schema.allOf)) {
    return { ...schema, properties: schema.properties || {}, required: schema.required || [] };
  }
  if (diepte > 10) {
    diagnostics.push({ severity: "warning", schema: naam, bericht: "allOf is te diep genest; de rest is overgeslagen." });
    return { properties: {}, required: [] };
  }
  const properties = {};
  const required = new Set(schema.required || []);
  const samengesteldUit = [];
  for (const deel of schema.allOf) {
    const doelNaam = refNaam(deel?.$ref);
    const bron = doelNaam ? schemas[doelNaam] : deel;
    if (doelNaam) samengesteldUit.push(doelNaam);
    if (!bron) continue;
    const plat = vouwAllOf(doelNaam || naam, bron, schemas, diagnostics, diepte + 1);
    Object.assign(properties, plat.properties);
    for (const r of plat.required || []) required.add(r);
  }
  Object.assign(properties, schema.properties || {});
  if (samengesteldUit.length) {
    diagnostics.push({
      severity: "info",
      schema: naam,
      bericht: `allOf is platgeslagen: de velden van ${samengesteldUit.join(", ")} staan nu rechtstreeks op ${naam}.`,
    });
  }
  return { ...schema, properties, required: [...required] };
}

/**
 * Pel een *property* af tot één bruikbaar schema.
 *
 * Generatoren verpakken een verwijzing graag. Twee patronen komen zo vaak voor
 * (drf-spectacular, maar niet alleen daar) dat ze afgehandeld moeten worden,
 * anders verdwijnen echte relaties als tekstveld in het model:
 *
 *   functieType:                       geslachtsaanduiding:
 *     allOf:                             oneOf:
 *       - $ref: '#/…/FunctieType'          - $ref: '#/…/GeslachtsaanduidingEnum'
 *     description: …                       - $ref: '#/…/BlankEnum'
 *
 * `allOf` op property-niveau is "een $ref met extra sleutels"; `oneOf`/`anyOf`
 * is meestal "deze waarde óf leeg". We pellen af tot de betekenisvolle variant
 * en melden het wanneer er écht iets te kiezen viel.
 *
 * @returns {{schema: object, notities: string[]}}
 */
export function pelProperty(prop, ctx = {}, diepte = 0) {
  if (!prop || typeof prop !== "object") return { schema: prop || {}, notities: [] };
  if (diepte > 5) return { schema: prop, notities: ["te diep genest; niet verder afgepeld"] };
  const blanco = ctx.blancoEnums || new Set();
  const notities = [];
  let schema = prop;

  if (Array.isArray(schema.allOf) && schema.allOf.length) {
    const { allOf, ...eigen } = schema;
    const samen = {};
    for (const deel of allOf) {
      if (deel && typeof deel === "object") Object.assign(samen, deel);
    }
    // De eigen sleutels van de property winnen van die uit de allOf-delen.
    schema = { ...samen, ...eigen };
  }

  const varianten = schema.oneOf || schema.anyOf;
  if (Array.isArray(varianten) && varianten.length) {
    const sleutel = schema.oneOf ? "oneOf" : "anyOf";
    const { oneOf, anyOf, ...eigen } = schema;
    const bruikbaar = varianten.filter((v) => {
      if (!v || typeof v !== "object") return false;
      if (v.type === "null") return false; // nullable-variant zegt niets over de vorm
      const doel = refNaam(v.$ref);
      return !(doel && blanco.has(doel)); // enum met alleen "" = "mag leeg zijn"
    });
    if (bruikbaar.length > 1) {
      const namen = bruikbaar.map((v) => refNaam(v.$ref) || v.type || "inline").join(", ");
      notities.push(`${sleutel} met meerdere varianten (${namen}); de eerste is gebruikt`);
    }
    const gekozen = bruikbaar[0] || {};
    const samen = { ...eigen, ...gekozen };
    if (eigen.description) samen.description = eigen.description;
    const verder = pelProperty(samen, ctx, diepte + 1);
    return { schema: verder.schema, notities: [...notities, ...verder.notities] };
  }

  return { schema, notities };
}

/** Property + eventuele array-items afgepeld: de kern waar het om draait. */
export function kernVanProperty(prop, ctx = {}) {
  const buiten = pelProperty(prop, ctx);
  const isArray = buiten.schema?.type === "array";
  const binnen = isArray ? pelProperty(buiten.schema.items || {}, ctx) : buiten;
  return {
    buiten: buiten.schema,
    kern: binnen.schema,
    isArray,
    notities: [...buiten.notities, ...(isArray ? binnen.notities : [])],
  };
}

/** Alle schema-namen waarnaar dit schema (op property-niveau) verwijst. */
function verwijzingenVan(plat, ctx) {
  const doelen = [];
  for (const prop of Object.values(plat.properties || {})) {
    const { kern } = kernVanProperty(prop, ctx);
    const doel = refNaam(kern?.$ref);
    if (doel) doelen.push(doel);
  }
  return doelen;
}

// ── Hoofdconversie ───────────────────────────────────────────────────────────

/**
 * @param {object} doc               geparsed OAS 3.0/3.1-document
 * @param {object} [opties]
 * @param {string} [opties.domein]          domein voor alle gemaakte types
 * @param {boolean} [opties.technischeVelden]  neem id/rel_id/versie/…-properties mee (default false)
 * @returns {{versie:string,naam:string,beschrijving:string,datatypes:Array,enums:Array,entiteiten:Array,diagnostics:Array}}
 */
export function oasNaarV3(doc, opties = {}) {
  const diagnostics = [];
  const schemas = doc?.components?.schemas || {};
  const domein = opties.domein || rolnaam(doc?.info?.title || "oas-import") || "oas-import";
  const houTechnisch = opties.technischeVelden === true;

  if (!Object.keys(schemas).length) {
    diagnostics.push({ severity: "warning", schema: null, bericht: "Het document heeft geen components.schemas; er valt niets te importeren." });
  }

  // 1. Platslaan (allOf) en scheiden in object-schemas, enums en primitieven.
  const plat = {};
  const enums = [];
  const datatypes = [];
  const enumNamen = new Set();
  const enumVoorSchema = new Map(); // schemanaam → goType van de gemaakte enum
  const datatypeVoorSchema = new Map(); // schemanaam → {basistype, format}
  const blancoEnums = new Set(); // enum met alleen "" — betekent "mag leeg zijn"
  for (const [naam, schema] of Object.entries(schemas)) {
    const p = vouwAllOf(naam, schema, schemas, diagnostics);
    if (Array.isArray(p.enum) && p.enum.length) {
      // Een enum die alleen de lege string toestaat is geen waardenlijst maar
      // een optionaliteits-truc van de generator; die hoort niet in het model.
      if (p.enum.every((w) => String(w ?? "").trim() === "")) {
        blancoEnums.add(naam);
        diagnostics.push({ severity: "info", schema: naam, bericht: `${naam} bevat alleen een lege waarde; gelezen als "mag leeg zijn", niet als enumeratie.` });
        continue;
      }
      const e = maakEnum(pascal(naam), p.enum, domein, enumNamen);
      enums.push(e);
      enumVoorSchema.set(naam, e.goType);
      continue;
    }
    const isObject = p.type === "object" || (!p.type && Object.keys(p.properties || {}).length > 0);
    if (!isObject) {
      // Primitief top-level schema: een gegevenstype met basistype/format.
      const dt = { naam: pascal(naam), description: p.description || "", basistype: oasType(p), format: p.format || "", domein };
      datatypes.push(dt);
      datatypeVoorSchema.set(naam, dt);
      continue;
    }
    plat[naam] = p;
  }

  // Context voor het afpellen van properties (allOf/oneOf/anyOf).
  const ctx = { blancoEnums };

  // 2. Tel de $ref-verwijzingen; die bepalen entiteit versus gegevenselement.
  const verwijzers = new Map(); // schemanaam → Set van schema's die ernaar verwijzen
  for (const [naam, p] of Object.entries(plat)) {
    for (const doel of verwijzingenVan(p, ctx)) {
      if (!plat[doel]) continue;
      if (!verwijzers.has(doel)) verwijzers.set(doel, new Set());
      verwijzers.get(doel).add(naam);
    }
  }
  const isEntiteit = {};
  for (const [naam, p] of Object.entries(plat)) {
    const bronnen = verwijzers.get(naam) || new Set();
    isEntiteit[naam] = heeftIdentiteit(p) || bronnen.size === 0 || bronnen.size > 1;
  }
  // Een GE-schema hoort bij precies één ouder.
  const ouderVan = {};
  for (const [naam, bronnen] of verwijzers) {
    if (!isEntiteit[naam]) ouderVan[naam] = [...bronnen][0];
  }

  // 3. Bouw de entiteiten.
  const gebruikteTypenamen = new Set(Object.keys(plat).filter((n) => isEntiteit[n]).map(pascal));
  const entiteiten = [];
  let kolom = 0;
  for (const [naam, p] of Object.entries(plat)) {
    if (!isEntiteit[naam]) continue;
    const typenaam = pascal(naam);
    const ent = {
      typenaam,
      description: p.description || "",
      domein,
      meervoud: `${rolnaam(naam)}s`,
      kleur: "#bfdbfe",
      positie: { x: kolom * 420, y: 0 },
      gegevenselementen: [],
      relaties: [],
    };
    const eigenVelden = [];
    const overgeslagen = [];   // properties die het model niet in kwamen
    const opmerkingen = [];    // properties die met een keuze zijn ingelezen
    let rij = 1;

    for (const [propNaam, ruwSchema] of Object.entries(p.properties || {})) {
      const verplicht = (p.required || []).includes(propNaam);
      // allOf/oneOf/anyOf op de property afpellen — anders verdwijnt een echte
      // verwijzing als tekstveld in het model.
      const { buiten: propSchema, kern, isArray, notities } = kernVanProperty(ruwSchema, ctx);
      for (const notitie of notities) opmerkingen.push(`${propNaam}: ${notitie}`);
      const doelNaam = refNaam(kern?.$ref);
      const positie = { x: kolom * 420, y: rij++ * 180 };

      // a0. Verwijzing naar een enum- of gegevenstype-schema: gewoon een veld.
      if (doelNaam && (enumVoorSchema.has(doelNaam) || datatypeVoorSchema.has(doelNaam) || blancoEnums.has(doelNaam))) {
        if (!houTechnisch && isTechnischeProperty(propNaam)) {
          overgeslagen.push(`${propNaam} (technisch veld)`);
          continue;
        }
        const dt = datatypeVoorSchema.get(doelNaam);
        eigenVelden.push(
          maakVeld(
            propNaam,
            { ...kern, ...(dt ? { type: dt.basistype, format: dt.format } : {}), description: propSchema.description || kern.description },
            verplicht,
            typenaam,
            domein,
            enums,
            enumNamen,
            enumVoorSchema.get(doelNaam)
          )
        );
        continue;
      }

      // a. Verwijzing naar een ander schema.
      if (doelNaam && plat[doelNaam]) {
        if (isEntiteit[doelNaam]) {
          ent.relaties.push({
            naam: uniek(`${typenaam}${pascal(propNaam)}`, gebruikteTypenamen),
            description: propSchema.description || `Verwijzing ${propNaam} naar ${pascal(doelNaam)}.`,
            domein,
            meervoud: rolnaam(propNaam),
            momentvoorkomen: isArray ? "meervoudig" : "enkelvoudig",
            doelEntiteit: pascal(doelNaam),
            directioneel: true,
            positie,
            velden: [],
          });
        } else {
          // GE-schema: alleen onder zijn eigen ouder uitklappen.
          if (ouderVan[doelNaam] && ouderVan[doelNaam] !== naam) {
            overgeslagen.push(`${propNaam} (→ ${doelNaam}, hangt al onder ${ouderVan[doelNaam]})`);
            continue;
          }
          ent.gegevenselementen.push(
            maakGE(pascal(doelNaam), propNaam, plat[doelNaam], isArray, { domein, positie, enums, enumNamen, houTechnisch, ctx, opmerkingen })
          );
        }
        continue;
      }
      if (doelNaam && !plat[doelNaam]) {
        overgeslagen.push(`${propNaam} (verwijst naar het onbekende schema ${doelNaam})`);
        continue;
      }
      if (kern?.$ref) {
        overgeslagen.push(`${propNaam} (externe $ref ${kern.$ref})`);
        continue;
      }

      // b. Inline object → eigen GE.
      if (kern?.type === "object" || kern?.properties) {
        ent.gegevenselementen.push(
          maakGE(uniek(`${typenaam}${pascal(propNaam)}`, gebruikteTypenamen), propNaam, kern, isArray, { domein, positie, enums, enumNamen, houTechnisch, ctx, opmerkingen })
        );
        continue;
      }

      // c. Array van scalars → eigen meervoudig GE met één veld.
      if (isArray) {
        ent.gegevenselementen.push({
          naam: uniek(`${typenaam}${pascal(propNaam)}`, gebruikteTypenamen),
          description: propSchema.description || "",
          domein,
          meervoud: rolnaam(propNaam),
          momentvoorkomen: "meervoudig",
          positie,
          velden: [maakVeld(propNaam, kern, true, `${typenaam}${pascal(propNaam)}`, domein, enums, enumNamen)],
        });
        continue;
      }

      // d. Scalair veld.
      if (!houTechnisch && isTechnischeProperty(propNaam)) {
        overgeslagen.push(`${propNaam} (technisch veld)`);
        continue;
      }
      eigenVelden.push(maakVeld(propNaam, propSchema, verplicht, typenaam, domein, enums, enumNamen));
    }

    // De scalaire properties van een entiteit leven in het canonieke model in
    // een gegevenselement, niet op de entiteit zelf.
    if (eigenVelden.length) {
      ent.gegevenselementen.unshift({
        naam: uniek(`${typenaam}Gegevens`, gebruikteTypenamen),
        description: `Eigenschappen van ${typenaam} uit het OAS-schema.`,
        domein,
        meervoud: `${rolnaam(naam)}gegevens`,
        momentvoorkomen: "enkelvoudig",
        positie: { x: kolom * 420, y: 180 },
        velden: eigenVelden,
      });
    }
    if (overgeslagen.length) {
      diagnostics.push({ severity: "info", schema: naam, bericht: `Overgeslagen properties: ${overgeslagen.join("; ")}.` });
    }
    if (opmerkingen.length) {
      diagnostics.push({ severity: "info", schema: naam, bericht: `Keuzes bij het inlezen: ${opmerkingen.join("; ")}.` });
    }
    if (!ent.gegevenselementen.length && !ent.relaties.length) {
      diagnostics.push({ severity: "warning", schema: naam, bericht: `${typenaam} heeft na import geen velden; het schema had er alleen technische of niet-ondersteunde.` });
    }
    entiteiten.push(ent);
    kolom += 1;
  }

  return {
    versie: "v3",
    naam: doc?.info?.title || "OAS-import",
    beschrijving: [doc?.info?.description, `Geïmporteerd uit OpenAPI ${doc?.openapi || "?"}.`].filter(Boolean).join(" "),
    datatypes,
    enums,
    entiteiten,
    diagnostics,
  };
}

// ── Bouwstenen ───────────────────────────────────────────────────────────────

function maakEnum(goType, waarden, domein, enumNamen) {
  const naam = uniek(goType, enumNamen);
  return {
    goType: naam,
    baseType: "string",
    domein,
    waarden: waarden.map((w) => ({ constNaam: `${naam}${pascal(String(w)) || "Waarde"}`, waarde: String(w) })),
  };
}

/**
 * Eén property → V3Veld. Een inline `enum` krijgt onderweg een eigen V3Enum;
 * `enumNaamOverride` wijst naar een enum die al uit een top-level schema komt.
 */
function maakVeld(propNaam, schema, verplicht, eigenaar, domein, enums, enumNamen, enumNaamOverride) {
  const veld = {
    naam: propNaam,
    goType: goTypeVoor({ type: oasType(schema), format: schema?.format }, verplicht),
    type: oasType(schema),
    verplicht: Boolean(verplicht),
  };
  if (schema?.format) veld.format = schema.format;
  if (schema?.description) veld.description = schema.description;
  if (enumNaamOverride) {
    veld.enum = enumNaamOverride;
    veld.goType = verplicht ? enumNaamOverride : `*${enumNaamOverride}`;
  } else if (Array.isArray(schema?.enum) && schema.enum.length) {
    const e = maakEnum(`${eigenaar}${pascal(propNaam)}`, schema.enum, domein, enumNamen);
    enums.push(e);
    veld.enum = e.goType;
    veld.goType = verplicht ? e.goType : `*${e.goType}`;
  }
  return veld;
}

/**
 * Een (verwezen of inline) object-schema → V3Gegevenselement.
 *
 * Een GE draagt alleen velden: verwijzingen en geneste objecten daarbinnen
 * passen niet in het canonieke model en worden gemeld, niet stil genegeerd.
 */
function maakGE(geNaam, propNaam, schema, isArray, { domein, positie, enums, enumNamen, houTechnisch, ctx, opmerkingen }) {
  const velden = [];
  for (const [naam, ruw] of Object.entries(schema?.properties || {})) {
    if (!houTechnisch && isTechnischeProperty(naam)) continue;
    const { kern, isArray: geneste } = kernVanProperty(ruw, ctx);
    if (kern?.$ref || geneste || kern?.type === "object" || kern?.properties) {
      opmerkingen?.push(`${propNaam}.${naam} valt weg (een gegevenselement draagt alleen velden)`);
      continue;
    }
    velden.push(maakVeld(naam, kern, (schema?.required || []).includes(naam), geNaam, domein, enums, enumNamen));
  }
  return {
    naam: geNaam,
    description: schema?.description || "",
    domein,
    meervoud: rolnaam(propNaam),
    momentvoorkomen: isArray ? "meervoudig" : "enkelvoudig",
    positie,
    velden,
  };
}
