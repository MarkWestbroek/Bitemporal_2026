export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function tUitRegistratieTijdstip(tijdstipRaw) {
  if (!tijdstipRaw) {
    return null;
  }

  const tijdstipMillis = Date.parse(tijdstipRaw);
  const basisMillis = Date.parse("2026-01-01T00:00:00Z");
  if (Number.isNaN(tijdstipMillis) || Number.isNaN(basisMillis)) {
    return null;
  }

  const deltaMillis = tijdstipMillis - basisMillis;
  const afgerondeUren = Math.round(deltaMillis / (60 * 60 * 1000));
  if (afgerondeUren < 0) {
    return null;
  }

  return afgerondeUren;
}

export function microsecondeIntVanTijdstip(tijdstipRaw) {
  if (!tijdstipRaw) {
    return 0;
  }

  const raw = String(tijdstipRaw);
  const match = raw.match(/\.(\d+)/);
  if (!match) {
    return 0;
  }

  const fraction = match[1].slice(0, 6).padEnd(6, "0");
  const parsed = Number.parseInt(fraction, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function wijzigingKleur(wijzigingstype) {
  const type = String(wijzigingstype || "").toLowerCase();
  if (type === "opvoer") {
    return "#eefcf2";
  }
  if (type === "afvoer") {
    return "#fff4e8";
  }
  return "#f8fafc";
}

export function wijzigingPatroonId(wijzigingstype) {
  const type = String(wijzigingstype || "").toLowerCase();
  if (type === "opvoer") {
    return "pat-opvoer";
  }
  if (type === "afvoer") {
    return "pat-afvoer";
  }
  return "pat-neutraal";
}

export function isPrimitiveWaarde(value) {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

export function veldEntries(record) {
  return Object.entries(record || {}).filter(([, value]) => isPrimitiveWaarde(value));
}

export function korteSamenvatting(record) {
  const overSlaan = new Set(["id", "rel_id", "opvoer", "afvoer", "aanvang", "einde", "a_id", "b_id"]);
  const parts = veldEntries(record)
    .filter(([k]) => !overSlaan.has(k))
    .slice(0, 2)
    .map(([k, v]) => `${k}=${v ?? "-"}`);

  if (parts.length === 0) {
    return "-";
  }

  return parts.join(" | ");
}

export function donkerdereRandkleurVanHex(hexKleur, ratio = 0.62) {
  const hex = String(hexKleur || "").trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return "#1e3a8a";
  }

  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);

  const donker = (n) => Math.max(0, Math.min(255, Math.round(n * ratio)));
  const naarHex = (n) => n.toString(16).padStart(2, "0");

  return `#${naarHex(donker(r))}${naarHex(donker(g))}${naarHex(donker(b))}`;
}

export function leidEntiteitTypeAfUitKolomnaam(kolomnaam, beschikbareEntiteitTypen) {
  const prefix = String(kolomnaam || "").split("_")[0].trim().toUpperCase();
  if (!prefix) {
    return "";
  }

  const bestaat = safeArray(beschikbareEntiteitTypen).some((item) => String(item?.typenaam || "").toUpperCase() === prefix);
  return bestaat ? prefix : "";
}

/**
 * Plat slaan van hub-items voor weergave en formulieren.
 *
 * In v06 retourneert de API hub-items met geneste data-arrays:
 *   { a_id:1, rel_id:1, opvoer:…, data:[{versie:1, aaa:"foo", …}] }
 *
 * De functie mergt de inhoudsvelden van het actieve data-record (zonder afvoer)
 * in het hub-item, zodat downstream code (visualisatie, formulieren, payloads)
 * transparant met een plat item kan werken.
 *
 * Structurele velden van het data-type (bijv. versie = idKolom) worden
 * niet gemerged om ruis in formulieren te voorkomen.
 *
 * @param {Array} items        - Array van hub-items uit de API-response
 * @param {Object} hubTypeMeta - Schema-metadata van het hub-type (uit typeMetaByTypenaam)
 * @param {Object} typeMetaByTypenaam - Volledige schema-map (typenaam → metadata)
 * @returns {Array} Geplatte items met gemergde inhoudsvelden
 */
export function platSlaHubItems(items, hubTypeMeta, typeMetaByTypenaam) {
  if (hubTypeMeta?.ge_subtype !== "hub") return safeArray(items);
  const onderliggende = safeArray(hubTypeMeta?.onderliggende);
  if (onderliggende.length === 0) return safeArray(items);

  return safeArray(items).map((hubItem) => {
    const merged = { ...hubItem };

    for (const child of onderliggende) {
      const childMeta = typeMetaByTypenaam?.[child.doeltype];
      if (!childMeta || childMeta.ge_subtype !== "data") continue;

      const childArray = safeArray(hubItem[child.jsonRolnaam] || hubItem[child.rolnaam]);
      // Actief record = zonder afvoer; bij enkelvoudig max 1
      const actief = childArray.find((d) => !d.afvoer) || childArray[0];
      if (!actief) continue;

      // Skip structurele velden van het data-type (bijv. "versie").
      // entiteitIDKolom en hub-IDKolom bestaan al in het hub-item via !(k in merged).
      const skipVelden = new Set();
      if (childMeta.idKolom) skipVelden.add(String(childMeta.idKolom).toLowerCase());

      for (const [k, v] of Object.entries(actief)) {
        if (!(k in merged) && isPrimitiveWaarde(v) && !skipVelden.has(k.toLowerCase())) {
          merged[k] = v;
        }
      }
    }

    return merged;
  });
}
