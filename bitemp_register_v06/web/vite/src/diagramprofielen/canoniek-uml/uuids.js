// @ts-check
/**
 * uuids — identiteit binnen de tool voor de modelelementen van canoniek-uml (besluit Mark
 * 31-10): entiteit, gegevenselement, relatie, enumeratie, gegevenstype, referentielijst-
 * instantie en hun velden. De uuid gaat mee in V3 (`uuid`, ook naar codegen/BACKEND) en is
 * de sleutel voor de delta-import (v3DeltaImport.js); artefacten blijven op naampad.
 *
 * Een uuid wordt nooit bij een import bedacht (dan zou een her-import van hetzelfde
 * bestand zonder uuid niet meer op id matchen), maar bij een V3-export uit de Studio:
 * `ontbrekendeUuids` levert de patches, `vulUuids` zet ze in de store, zodat de volgende
 * export dezelfde uuid's draagt.
 *
 * Projectformaat 4 (Mark 15-11): de Studio vult ontbrekende uuid's voortaan zelf aan, na het
 * openen en na elke wijziging (studio/uuidAanvulling.js). Die aanvulling is **afgeleid** (uuid
 * v5, RFC 9562 §5.5): uit de stam van het project en het element-id, en voor een veld uit de
 * uuid van zijn element, het compartiment en de veldnaam van dat moment. Twee clients die
 * tegelijk een oud project openen, komen zo op dezelfde uuid's uit, en een branch op dezelfde
 * als zijn MAIN. Eenmaal gezet blijft een uuid staan, ook bij hernoemen.
 */

/** Naamruimte (uuid) van Omnium voor afgeleide uuid's. Nooit wijzigen: alle afgeleide uuid's hangen ervan af. */
export const OMNIUM_UUID_NAAMRUIMTE = "6f6d6e69-756d-5000-8000-737475646961";

/** SHA-1 (FIPS 180-4) van bytes; synchroon en zonder afhankelijkheden (browser én node). */
function sha1(bytes) {
  const n = bytes.length;
  const lengte = ((n + 9 + 63) >> 6) << 6;
  const m = new Uint8Array(lengte);
  m.set(bytes);
  m[n] = 0x80;
  const bits = n * 8;
  const dv = new DataView(m.buffer);
  dv.setUint32(lengte - 8, Math.floor(bits / 0x100000000));
  dv.setUint32(lengte - 4, bits >>> 0);
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  for (let o = 0; o < lengte; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (x << 1) | (x >>> 31);
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      const f = i < 20 ? (b & c) | (~b & d) : i < 40 ? b ^ c ^ d : i < 60 ? (b & c) | (b & d) | (c & d) : b ^ c ^ d;
      const k = i < 20 ? 0x5a827999 : i < 40 ? 0x6ed9eba1 : i < 60 ? 0x8f1bbcdc : 0xca62c1d6;
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
      e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  const uit = new Uint8Array(20);
  const ov = new DataView(uit.buffer);
  [h0, h1, h2, h3, h4].forEach((h, i) => ov.setUint32(i * 4, h));
  return uit;
}

/**
 * Uuid v5 (RFC 9562 §5.5): SHA-1 over naamruimte + naam (UTF-8). Dezelfde invoer geeft altijd
 * dezelfde uuid.
 * @param {string} naamruimte - een uuid
 * @param {string} naam
 * @returns {string}
 */
export function uuidV5(naamruimte, naam) {
  const hex = String(naamruimte).replace(/-/g, "");
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) throw new Error(`uuidV5: geen uuid als naamruimte: ${naamruimte}`);
  const ns = Uint8Array.from(hex.match(/../g) || [], (b) => parseInt(b, 16));
  const tekst = new TextEncoder().encode(String(naam));
  const invoer = new Uint8Array(16 + tekst.length);
  invoer.set(ns);
  invoer.set(tekst, 16);
  const h = sha1(invoer).slice(0, 16);
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const s = Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/**
 * Maker van afgeleide uuid's voor `ontbrekendeUuids`: element uit (stam, element-id), veld uit
 * (uuid van het element, compartiment, veldnaam).
 * @param {string} stam - id van het stamproject (een branch: zijn MAIN)
 */
export function afgeleideUuidMaker(stam) {
  const ns = uuidV5(OMNIUM_UUID_NAAMRUIMTE, `project:${stam}`);
  return (/** @type {{element?: any, elementUuid?: string, compartiment?: string, veld?: any}} */ ctx = {}) =>
    ctx.veld ? uuidV5(ns, `veld:${ctx.elementUuid}/${ctx.compartiment}/${String(ctx.veld.naam || "").trim()}`) : uuidV5(ns, `element:${ctx.element?.id}`);
}

/** Elementsoorten die een uuid krijgen. */
export const UUID_SOORTEN = new Set(["entiteit", "gegevenselement", "relatie", "enumeratie", "gegevenstype", "referentielijstInstantie"]);

const nieuweUuid = () => globalThis.crypto.randomUUID();

/**
 * Patches (voor updateElementen) voor elementen en velden zonder uuid.
 * @param {{elements?: Record<string, any>}} state
 * @param {(ctx: {element?: any, elementUuid?: string, compartiment?: string, veld?: any}) => string} [maak]
 *   willekeurig (v4, standaard) of afgeleid (`afgeleideUuidMaker`)
 * @returns {Record<string, {data?: {uuid: string}, compartimenten?: any[]}>}
 */
export function ontbrekendeUuids(state, maak = nieuweUuid) {
  const patches = {};
  for (const el of Object.values(state?.elements || {})) {
    if (!el || !UUID_SOORTEN.has(el.elementType)) continue;
    const patch = {};
    if (!el.data?.uuid) patch.data = { ...(el.data || {}), uuid: maak({ element: el }) };
    const elementUuid = el.data?.uuid || patch.data?.uuid;
    let veldenNieuw = false;
    const compartimenten = (el.compartimenten || []).map((c) => {
      if (c.compartmentType !== "velden") return c;
      return {
        ...c,
        velden: (c.velden || []).map((v) => {
          if (v.data?.uuid || !(v.naam || "").trim()) return v;
          veldenNieuw = true;
          return { ...v, data: { ...(v.data || {}), uuid: maak({ element: el, elementUuid, compartiment: c.compartmentType, veld: v }) } };
        }),
      };
    });
    if (veldenNieuw) patch.compartimenten = compartimenten;
    if (patch.data || patch.compartimenten) patches[el.id] = patch;
  }
  return patches;
}

/**
 * Geef alle modelelementen in de store een uuid (één stap; niets als ze er al zijn).
 * @param {{getState: () => any}} store - een diagramcore-store
 * @param {(ctx: any) => string} [maak] - zie `ontbrekendeUuids`
 * @returns {number} aantal bijgewerkte elementen
 */
export function vulUuids(store, maak = undefined) {
  const patches = ontbrekendeUuids(store.getState(), maak);
  const n = Object.keys(patches).length;
  if (n) store.getState().updateElementen(patches);
  return n;
}
