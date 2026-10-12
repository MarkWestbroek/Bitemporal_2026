// @ts-check
/**
 * beschrijving — de vaste **beschrijving** van elk element en elk veld (M3,
 * 2026-10-12, besluit Mark). Naast de naam beschrijft elk modelelement zichzelf
 * met een beschrijving; dat is UML 2.5.1 §7.2 `Element::ownedComment` →
 * `Comment::body`, in EA het Notes-veld. Notities (plakkers erop) en
 * notitie-lijnen hebben er geen: een notitie ís zelf een tekst.
 *
 * - Opslag: `data.beschrijving` — zo werken projectsync, opslag, werkbestanden
 *   en exports zonder formaatwijziging.
 * - Een profiel hoeft hem niet te declareren: de motor zet hem vooraan in de
 *   eigenschappen (inspector). Heeft een profiel een eigen eigenschap met
 *   `betekenis: "beschrijving"` (MIM: `definitie` — "de beschrijving van de
 *   betekenis van dit modelelement"), dan is díe de beschrijving en voegt de
 *   motor er geen tweede aan toe.
 * - Oude sleutels (`toelichting`, `description`, `notes`) migreren bij het
 *   laden; welke dat zijn, zegt het profiel (`DiagramType.oudeBeschrijvingSleutels`).
 *
 * Puur en store-loos.
 */

/** De vaste M3-eigenschap. */
export const BESCHRIJVING = { key: "beschrijving", label: "beschrijving", datatype: "tekst", betekenis: "beschrijving" };

/**
 * Heeft dit type een beschrijving? Niet bij een notitie (vorm `note`) en niet
 * waar het profiel `beschrijving: false` zet (notitie-lijnen, lidmaatschap).
 * @param {{beschrijving?: boolean, shape?: string}|null|undefined} type
 */
export function heeftBeschrijving(type) {
  if (!type) return true;
  if (type.beschrijving === false) return false;
  return type.shape !== "note";
}

/**
 * De eigenschappen van een type, met de vaste beschrijving vooraan — tenzij
 * het type er geen heeft of het profiel er zelf een (met die betekenis) heeft.
 * @param {Array<{key?: string, betekenis?: string}>|undefined} properties
 * @param {{beschrijving?: boolean, shape?: string}|null|undefined} type
 */
export function metBeschrijving(properties, type) {
  const lijst = properties || [];
  if (!heeftBeschrijving(type)) return lijst;
  if (lijst.some((p) => p?.betekenis === "beschrijving" || p?.key === "beschrijving")) return lijst;
  return [BESCHRIJVING, ...lijst];
}

/**
 * De beschrijving van een element of veld, ongeacht onder welke sleutel het
 * profiel hem bewaart (via `betekenis`).
 * @param {Record<string, any>|null|undefined} data
 * @param {{properties?: Array<{key?: string, betekenis?: string}>}|null|undefined} [type]
 * @returns {string}
 */
export function beschrijvingVan(data, type = null) {
  if (!data) return "";
  if (typeof data.beschrijving === "string" && data.beschrijving) return data.beschrijving;
  for (const p of type?.properties || []) {
    if (p?.betekenis === "beschrijving" && p.key && typeof data[p.key] === "string" && data[p.key]) return data[p.key];
  }
  return "";
}

/** Zet de eerste gevulde oude sleutel om naar `beschrijving`; geeft null als er niets verandert. */
function migreerData(data, sleutels) {
  if (!data || typeof data !== "object") return null;
  const oud = sleutels.filter((k) => k in data);
  if (!oud.length) return null;
  const uit = { ...data };
  if (!(typeof uit.beschrijving === "string" && uit.beschrijving)) {
    const bron = oud.find((k) => typeof data[k] === "string" && data[k].trim());
    if (bron) uit.beschrijving = data[bron];
  }
  for (const k of oud) delete uit[k];
  return uit;
}

/**
 * Migratie bij het laden: oude beschrijvingssleutels van elementen én hun
 * velden → `data.beschrijving`. Bestaat er al een beschrijving, dan wint die
 * en vervallen de oude sleutels. Geeft null als er niets te doen is.
 *
 * @param {Record<string, any>} elements
 * @param {string[]} sleutels - bv. ["toelichting", "notes"]
 * @param {(elementTypeId: string) => any} [typeVan] - om notities over te slaan
 * @returns {Record<string, any>|null}
 */
export function migreerBeschrijving(elements, sleutels, typeVan = () => null) {
  if (!elements || !sleutels?.length) return null;
  let veranderd = false;
  const uit = {};
  for (const [id, el] of Object.entries(elements)) {
    let nieuw = el;
    if (el && heeftBeschrijving(typeVan(el.elementType))) {
      const data = migreerData(el.data, sleutels);
      if (data) nieuw = { ...nieuw, data };
    }
    if (Array.isArray(el?.compartimenten)) {
      let compVeranderd = false;
      const comps = el.compartimenten.map((c) => {
        let veldVeranderd = false;
        const velden = (c.velden || []).map((v) => {
          const data = migreerData(v?.data, sleutels);
          if (!data) return v;
          veldVeranderd = true;
          return { ...v, data };
        });
        if (!veldVeranderd) return c;
        compVeranderd = true;
        return { ...c, velden };
      });
      if (compVeranderd) nieuw = { ...nieuw, compartimenten: comps };
    }
    if (nieuw !== el) veranderd = true;
    uit[id] = nieuw;
  }
  return veranderd ? uit : null;
}
