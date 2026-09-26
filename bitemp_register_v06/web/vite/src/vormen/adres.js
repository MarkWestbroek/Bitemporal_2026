/**
 * adres.js — de rekenkant van de vorm `address-search`: een PDOK Locatieserver-resultaat
 * (lookup) → de velden van het formulier, via vormConfig.fields. Puur (adres.test.js).
 *
 * PDOK-velden die je kunt koppelen (lookup, type adres): straatnaam, huisnummer, huisletter,
 * huisnummertoevoeging, huis_nlt (nummer+letter+toevoeging), postcode, woonplaatsnaam,
 * gemeentenaam, gemeentecode, provincienaam, nummeraanduiding_id, adresseerbaarobject_id,
 * centroide_ll ("POINT(lon lat)"), weergavenaam. Plus het virtuele veld `land` = "Nederland".
 */
export const PDOK = "https://api.pdok.nl/bzk/locatieserver/search/v3_1";

export function suggestUrl(q, service = PDOK) {
  return `${service}/suggest?${new URLSearchParams({ q, fq: "type:adres", rows: "8" })}`;
}
export function lookupUrl(id, service = PDOK) {
  return `${service}/lookup?${new URLSearchParams({ id, fl: "*" })}`;
}

/** Suggest-antwoord → [{ id, label }] (de highlight-tags eruit). */
export function suggesties(antwoord) {
  return (antwoord?.response?.docs || []).map((d) => ({ id: d.id, label: String(d.weergavenaam || "").replace(/<\/?b>/g, "") }));
}

/**
 * Lookup-document → { [vol veldpad]: waarde } volgens de koppeling `fields`
 * ({ pdokVeld: "ENT.GE.veld" }). Ontbrekende PDOK-velden worden leeg, zodat een eerder
 * gekozen adres geen oude huisletter laat staan.
 */
export function adresNaarVelden(doc, fields = {}) {
  const uit = {};
  for (const [pdok, pad] of Object.entries(fields)) {
    if (!pad) continue;
    let w = pdok === "land" ? "Nederland" : doc?.[pdok];
    if (Array.isArray(w)) w = w[0];
    uit[pad] = w == null ? "" : String(w);
  }
  return uit;
}

/** Korte weergave van een adres uit de formulierwaarden (voor de samenvatting onder het zoekveld). */
export function adresRegel(waarden, fields = {}) {
  const w = (k) => (fields[k] ? String(waarden?.[fields[k]] ?? "") : "");
  const straat = [w("straatnaam"), w("huis_nlt") || [w("huisnummer"), w("huisletter"), w("huisnummertoevoeging")].filter(Boolean).join("")].filter(Boolean).join(" ");
  const plaats = [w("postcode"), w("woonplaatsnaam")].filter(Boolean).join(" ");
  return [straat, plaats].filter(Boolean).join(", ");
}
