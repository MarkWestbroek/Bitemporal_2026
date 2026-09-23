/**
 * publicatieData.js — data ophalen voor de publicatiepagina via opgeslagen documenten
 * (QueryDefinitie, `documentId` op /graphql/query), plus het resolven van veldpaden op
 * de opgehaalde rijen. Zonder React, zodat het met node:test te testen is.
 *
 * Twee databronnen (keuze via `tabel_config_json` van de WeergaveDefinitie):
 *   - `query`: naam van de QueryDefinitie voor de lijst. Het document moet $limit en
 *     $offset accepteren (max 100 per aanroep, zie dynql) en een lijst teruggeven.
 *   - `detailQuery`: naam van de QueryDefinitie voor één record, met $id.
 * Ontbreken ze, dan valt de pagina terug op REST (/full/…) zoals vóór 24-09-2026.
 *
 * Vorm van de rijen: GraphQL slaat hub + data plat (enkelvoudig GE = object, meervoudig =
 * lijst); REST levert hub.data[]. resolveVeldpad werkt op allebei.
 *
 * Zie docs/PUBLICATIE_TEMPLATES.md en docs/dynamische-graphql-laag.md § Uitvoeren op naam.
 */
import { safeArray, platSlaHubItems } from "../shared/schemaUtils.js";

/** Maximum van de GraphQL-lijstqueries (dynql: limit > 100 wordt afgekapt). */
export const PAGINA_GROOTTE = 100;

/** Bovengrens aan pagina's, tegen een document dat nooit een korte pagina geeft. */
const MAX_PAGINAS = 200;

/**
 * Voert een opgeslagen document uit. Geeft `data` terug; een HTTP-fout of GraphQL-fout
 * wordt een Error met een leesbare melding (410 met reden, 404, …).
 */
export async function voerDocumentUit({ baseUrl, documentId, variables, fetchFn = fetch }) {
  const res = await fetchFn(`${baseUrl}/graphql/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentId, variables: variables || {} }),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    const melding = json?.error || `HTTP ${res.status}`;
    const reden = json?.reden ? ` (${json.reden})` : "";
    throw new Error(`Document "${documentId}": ${melding}${reden}`);
  }
  if (Array.isArray(json?.errors) && json.errors.length > 0) {
    throw new Error(json.errors.map((e) => e?.message || String(e)).join(", "));
  }
  return json?.data || {};
}

/** De (eerste) lijst in een GraphQL-antwoord: { full_initiatieven_list: [...] } → [...]. */
export function eersteLijst(data) {
  if (!data || typeof data !== "object") return [];
  for (const waarde of Object.values(data)) {
    if (Array.isArray(waarde)) return waarde;
  }
  return [];
}

/**
 * Haalt de hele lijst op in pagina's van PAGINA_GROOTTE, tot een pagina korter is dan de
 * paginagrootte. Zo blijven zoeken en sorteren in de browser over de volledige set werken
 * (zoals met REST), zonder de afkap op 100 per aanroep.
 */
export async function haalLijstViaDocument({ baseUrl, documentId, extra, fetchFn = fetch, paginaGrootte = PAGINA_GROOTTE }) {
  const alles = [];
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
    const variables = { limit: paginaGrootte, offset: pagina * paginaGrootte };
    if (extra) variables.extra = extra;
    const rijen = eersteLijst(await voerDocumentUit({ baseUrl, documentId, variables, fetchFn }));
    alles.push(...rijen);
    if (rijen.length < paginaGrootte) break;
  }
  return alles;
}

/** Haalt één record op via een detail-document met $id; null als het er niet is. */
export async function haalDetailViaDocument({ baseUrl, documentId, id, fetchFn = fetch }) {
  const data = await voerDocumentUit({ baseUrl, documentId, variables: { id: Number(id) }, fetchFn });
  const rijen = eersteLijst(data);
  if (rijen.length > 0) return rijen[0];
  // Een detail-document mag ook één object teruggeven (full_<padnaam>).
  for (const waarde of Object.values(data)) {
    if (waarde && typeof waarde === "object" && !Array.isArray(waarde)) return waarde;
  }
  return null;
}

/**
 * De items van een onderliggend GE als lijst van platgeslagen records, ongeacht de bron:
 *   - REST: lijst van hubs met `data[]` → platSlaHubItems;
 *   - GraphQL meervoudig: lijst van al platgeslagen records → ongewijzigd (platSlaHubItems
 *     vindt geen `data` en laat ze staan);
 *   - GraphQL enkelvoudig: één object → [object]; null → [].
 */
export function geItems(entity, child, childMeta, typeMetaByTypenaam) {
  const raw = entity?.[child.jsonRolnaam] ?? entity?.[child.rolnaam];
  if (raw == null) return [];
  const lijst = Array.isArray(raw) ? raw : typeof raw === "object" ? [raw] : [];
  return platSlaHubItems(lijst, childMeta, typeMetaByTypenaam);
}

/**
 * Resolvet een veldpad (bijv. "namen.data.roepnaam" of "id") naar een waarde uit een
 * entiteit-object (REST full-entity of GraphQL-rij).
 *
 * Ondersteunt drie patronen:
 *   - Direct entity-veld:       "id" → entity.id
 *   - Genest GE-veld:           "namen.data.roepnaam" → zoek in onderliggende GE "namen",
 *     neem het actuele (platgeslagen) item, en lees "roepnaam".
 *   - Meervoudig GE-veld:       "initiatief_domeinen.weergavenaam" → bij meervoudig
 *     momentvoorkomen worden ALLE actieve items verzameld en de waarden
 *     gejoined met ", ".
 *
 * Het segment ".data." in het pad wordt overgeslagen omdat de hub al is platgeslagen.
 * De lookup werkt op zowel jsonRolnaam (snake_case) als klassenaam (PascalCase).
 */
export function resolveVeldpad(entity, veldpad, typeMeta, typeMetaByTypenaam) {
  if (!entity || !veldpad) return null;

  // 1) Directe entity-velden (bijv. "id", "opvoer")
  if (!veldpad.includes(".")) {
    return entity[veldpad] ?? null;
  }

  // 2) Genest veldpad: splits op "." en verwijder "data" segmenten
  const delen = veldpad.split(".").filter((d) => d !== "data");
  if (delen.length < 2) return entity[delen[0]] ?? null;

  const [geKey, ...restDelen] = delen;

  // Zoek het onderliggende GE op basis van jsonRolnaam, rolnaam, doeltype of klassenaam.
  // Klassenaam-matching (bijv. "Adres") is nodig voor fallback-kolommen die het pad
  // opbouwen via childMeta.klassenaam (PascalCase) i.p.v. jsonRolnaam (snake_case).
  const onderliggende = safeArray(typeMeta?.onderliggende);
  const child = onderliggende.find(
    (c) =>
      c.jsonRolnaam === geKey ||
      c.rolnaam === geKey ||
      c.doeltype === geKey ||
      typeMetaByTypenaam?.[c.doeltype]?.klassenaam === geKey
  );
  if (!child) return null;

  const childMeta = typeMetaByTypenaam?.[child.doeltype];
  const items = geItems(entity, child, childMeta, typeMetaByTypenaam);

  const navigeer = (item) => {
    let huidig = item;
    for (const deel of restDelen) {
      if (huidig == null || typeof huidig !== "object") return null;
      huidig = huidig[deel];
    }
    return huidig ?? null;
  };

  // Meervoudig: verzamel waarden van ALLE actieve items en join met ", "
  if (child.momentvoorkomen === "meervoudig") {
    const actieveItems = items.filter((item) => !item.afvoer);
    if (actieveItems.length === 0) return null;
    const waarden = actieveItems.map(navigeer).filter((v) => v != null);
    return waarden.length > 0 ? waarden.join(", ") : null;
  }

  // Enkelvoudig: neem het eerste actieve item (zonder afvoer)
  const actiefItem = items.find((item) => !item.afvoer) || items[0] || null;
  if (!actiefItem) return null;
  return navigeer(actiefItem);
}

/**
 * Vervangt punten in een veldpad door dubbel-underscore, zodat TanStack Table
 * het als een eenvoudige string-sleutel kan gebruiken (geen nested-path
 * interpretatie, geen problemen in _getAllFlatColumnsById).
 */
export function sanitizeKolId(veldpad) {
  return (veldpad || "").replace(/\./g, "__");
}
