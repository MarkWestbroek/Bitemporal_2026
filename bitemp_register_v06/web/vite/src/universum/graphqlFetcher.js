/**
 * graphqlFetcher.js — Bouwt dynamische GraphQL queries uit schema-metadata
 * en voert ze uit via /graphql/query.
 *
 * Wordt gebruikt als alternatief voor de REST /full endpoints in het
 * 3D Data Universum; een toggle in de UI bepaalt welke bron actief is.
 *
 * Bevat ook flattenRecord() — normaliseert REST responses naar het
 * geflattende formaat (hub+data plat, enkelvoudig als object) zodat
 * de frontend één uniform format verwerkt.
 */

const GQL_PATH = "/graphql/query";

/**
 * Bouw een GraphQL field-selectie string voor een type, inclusief onderliggende GE's/relaties.
 * Recursief: voor elk onderliggend type worden de velden ook opgenomen.
 *
 * @param {string} typenaam — typenaam van het type
 * @param {Object} typesByTypenaam — lookup: typenaam → schema type DTO
 * @param {number} [depth=2] — maximale nesting (voorkomt oneindige recursie)
 * @returns {string} GraphQL field-selectie (zonder buitenste accolades)
 */
function buildFieldSelection(typenaam, typesByTypenaam, depth = 2) {
  const meta = typesByTypenaam[typenaam];
  if (!meta) return "id";

  // Veldnamen die als geneste objecten worden opgenomen via onderliggende
  // moeten NIET ook als leaf-veld worden opgenomen (GraphQL staat dat niet toe
  // voor Object-types: "must have a sub selection").
  const onderliggendeNamen = new Set(
    (meta.onderliggende || []).map((c) => c.jsonRolnaam).filter(Boolean)
  );

  // Directe velden uit schema — skip velden die als genest object meekomen
  const veldNamen = (meta.velden || [])
    .map((v) => v.naam)
    .filter((n) => n && !onderliggendeNamen.has(n));

  // Altijd opvoer/afvoer meenemen als ze niet al in velden zitten
  for (const f of ["opvoer", "afvoer"]) {
    if (!veldNamen.includes(f)) veldNamen.push(f);
  }

  // Afgeleide velden (weergavenaam etc.)
  for (const av of meta.afgeleideVelden || []) {
    if (av.naam && !veldNamen.includes(av.naam)) {
      veldNamen.push(av.naam);
    }
  }

  const parts = [...veldNamen];

  // Onderliggende GE's/relaties (recursief tot depth)
  if (depth > 0 && Array.isArray(meta.onderliggende)) {
    for (const child of meta.onderliggende) {
      const childMeta = typesByTypenaam[child.doeltype];
      if (!childMeta) continue;

      const childFields = buildFieldSelection(
        child.doeltype,
        typesByTypenaam,
        depth - 1
      );
      const rolnaam = child.jsonRolnaam || child.rolnaam;
      if (rolnaam) {
        parts.push(`${rolnaam} { ${childFields} }`);
      }
    }
  }

  return parts.join("\n    ");
}

/**
 * Haal een lijst van entiteiten op via GraphQL (equivalent van GET /full/{padnaam}?page=1&size=N).
 *
 * @param {string} apiBase — bijv. "http://localhost:8082" of ""
 * @param {string} padnaam — URL-pad van de entiteit (bijv. "natuurlijk_personen")
 * @param {string} typenaam — typenaam voor schema lookup
 * @param {Object} typesByTypenaam — schema lookup
 * @param {number} [limit=50]
 * @returns {Promise<Array>} — array van entity records
 */
export async function fetchInstancesGraphQL(
  apiBase,
  padnaam,
  typenaam,
  typesByTypenaam,
  limit = 50
) {
  const fields = buildFieldSelection(typenaam, typesByTypenaam);
  // Gebruik full_<padnaam>_list zodat kinderen mee geladen en geflattened worden
  const queryName = `full_${padnaam}_list`;
  const query = `query {
  ${queryName}(limit: ${limit}) {
    ${fields}
  }
}`;

  const resp = await fetch(`${apiBase}${GQL_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!resp.ok) throw new Error(`GraphQL ${resp.status}`);
  const json = await resp.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }
  return json.data?.[queryName] || [];
}

/**
 * Ontdek reverse relaties voor een entiteit: andere entiteiten die via relaties
 * naar dit type wijzen. Gebaseerd op schema-metadata (client-side inference).
 *
 * @param {string} entityTypenaam — typenaam van het doelentiteit-type
 * @param {Object} typesByTypenaam — schema lookup
 * @returns {Array<{gqlFieldName, bronTypenaam, bronPadnaam, bronMeta, relatieTypenaam}>}
 */
export function discoverReverseRelations(entityTypenaam, typesByTypenaam) {
  const reverses = [];
  const allTypes = Object.values(typesByTypenaam);

  for (const t of allTypes) {
    if (t.metatype !== "relatie" || t.doelEntiteit !== entityTypenaam) continue;

    // Vind de bron-entiteit: welke entiteit heeft deze relatie in onderliggende?
    const bron = allTypes.find(
      (e) =>
        e.metatype === "entiteit" &&
        e.onderliggende?.some((c) => c.doeltype === t.typenaam)
    );
    if (!bron) continue;

    const bronPadnaam = bron.padnaam || bron.veldnaam;
    reverses.push({
      gqlFieldName: `gerelateerde_${bronPadnaam}`,
      bronTypenaam: bron.typenaam,
      bronPadnaam,
      bronMeta: bron,
      relatieTypenaam: t.typenaam,
    });
  }
  return reverses;
}

/**
 * Haal een volledige entiteit op via GraphQL (equivalent van GET /full/{padnaam}/{id}).
 * Optioneel worden reverse relaties meegeladen.
 *
 * @param {string} apiBase
 * @param {string} padnaam
 * @param {string|number} id
 * @param {string} typenaam
 * @param {Object} typesByTypenaam
 * @param {Array} [reverseRelations=[]] — output van discoverReverseRelations
 * @returns {Promise<Object>} — het volledige entity record (incl. gerelateerde_* velden)
 */
export async function fetchFullEntityGraphQL(
  apiBase,
  padnaam,
  id,
  typenaam,
  typesByTypenaam,
  reverseRelations = []
) {
  const fields = buildFieldSelection(typenaam, typesByTypenaam);

  // Reverse relatie velden: depth 1 zodat onderliggende GE's mee komen
  // voor het berekenen van weergavenamen
  let reverseFields = "";
  for (const rev of reverseRelations) {
    const bronFields = buildFieldSelection(rev.bronTypenaam, typesByTypenaam, 1);
    reverseFields += `\n    ${rev.gqlFieldName}(limit: 20) { ${bronFields} }`;
  }

  const queryName = `full_${padnaam}`;
  // Bepaal ID-type: als het een getal is of alleen cijfers bevat → Int, anders String
  const isNumeric =
    typeof id === "number" || (typeof id === "string" && /^\d+$/.test(id));
  const idArg = isNumeric ? Number(id) : `"${id}"`;

  const query = `query {
  ${queryName}(id: ${idArg}) {
    ${fields}${reverseFields}
  }
}`;

  const resp = await fetch(`${apiBase}${GQL_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!resp.ok) throw new Error(`GraphQL ${resp.status}`);
  const json = await resp.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }
  return json.data?.[queryName] || null;
}

/**
 * Normaliseer een REST response record naar het geflattende formaat
 * (identiek aan wat de GraphQL full resolvers retourneren):
 *
 * 1. Hub+Data flattening: kopieer data[0] velden naar hub-niveau, verwijder "data" key
 * 2. Enkelvoudig: unwrap [single] array naar object (of null)
 * 3. Recursief voor geneste kinderen (bijv. aanvang/einde binnen een hub)
 *
 * @param {object} record — het REST response record
 * @param {object} entityMeta — schema metadata van het type (met onderliggende)
 * @param {object} typesByTypenaam — lookup: typenaam → schema-type
 * @returns {object} het geflattende record
 */
export function flattenRecord(record, entityMeta, typesByTypenaam) {
  if (!record || !entityMeta?.onderliggende) return record;

  const result = { ...record };

  for (const child of entityMeta.onderliggende) {
    const childMeta = typesByTypenaam?.[child.doeltype];
    if (!childMeta) continue;

    const raw = result[child.jsonRolnaam];
    if (raw == null) continue;

    // Zorg dat we een array hebben om te verwerken
    let items = Array.isArray(raw) ? raw : [raw];

    // Verwerk elk item
    const processed = items.map((item) => {
      if (typeof item !== "object" || item === null) return item;
      let flat = { ...item };

      // Hub+Data flattening: kopieer data[0] velden naar hub-niveau
      if (childMeta.ge_subtype === "hub" && Array.isArray(childMeta.onderliggende)) {
        const dataChild = childMeta.onderliggende.find((c) => {
          const cm = typesByTypenaam?.[c.doeltype];
          return cm?.ge_subtype === "data";
        });
        if (dataChild) {
          const dataItems = flat[dataChild.jsonRolnaam];
          if (Array.isArray(dataItems) && dataItems.length > 0) {
            const dataObj = dataItems[0];
            for (const [k, v] of Object.entries(dataObj)) {
              if (!(k in flat)) flat[k] = v;
            }
          }
          delete flat[dataChild.jsonRolnaam];
        }
      }

      // Recursie voor kinderen van dit type (bijv. aanvang/einde binnen hub)
      if (Array.isArray(childMeta.onderliggende) && childMeta.onderliggende.length > 0) {
        flat = flattenRecord(flat, childMeta, typesByTypenaam);
      }

      return flat;
    });

    // Enkelvoudig: array → single object (of null)
    if (child.momentvoorkomen === "enkelvoudig") {
      result[child.jsonRolnaam] = processed.length > 0 ? processed[0] : null;
    } else {
      result[child.jsonRolnaam] = processed;
    }
  }

  return result;
}
