/**
 * materieleTijd.js — materiële tijd (aanvang/einde) van de voorkomens van een GE of relatie, voor de
 * editorformulieren (27-10-2026).
 *
 * Een materieel én enkelvoudig element heeft "één geldig voorkomen op elk materieel moment", niet
 * "één formeel actief voorkomen": een nieuwe status is een nieuw voorkomen, en de engine geeft het
 * vorige automatisch een einde (docs/plans/2026-10-25 Materieel enkelvoudig §7). De formulieren
 * tonen zo'n element dus als lijst van voorkomens.
 *
 * Tijdprecisie per representatie (schema-API `tijdprecisie`, V3 besluit Mark 27-10-2026):
 *  - "datum" (default): `JJJJ-MM-DD`, einde inclusief;
 *  - "tijdstip": RFC 3339, einde exclusief (half-open).
 * De JSON-sleutel is in beide gevallen `datum`.
 */
import { korteDatumWeergave } from "./oortjesUtils.js";

const lijst = (a) => (Array.isArray(a) ? a : []);

/** Tijdprecisie van een type: "tijdstip" of "datum". */
export function tijdprecisieVan(meta) {
  return meta?.tijdprecisie === "tijdstip" ? "tijdstip" : "datum";
}

/**
 * De aanvang- en eindkinderen van een materiële hub: { aanvang, einde }, elk
 * { jsonRolnaam, meta } of null.
 */
export function materieleKinderen(hubMeta, typeMetaByTypenaam) {
  const uit = { aanvang: null, einde: null };
  for (const kind of lijst(hubMeta?.onderliggende)) {
    const meta = typeMetaByTypenaam?.[kind.doeltype];
    const soort = meta?.ge_subtype;
    if (soort !== "aanvang" && soort !== "einde") continue;
    uit[soort] = { jsonRolnaam: kind.jsonRolnaam || kind.rolnaam || soort, meta };
  }
  return uit;
}

/** De `datum` van het formeel actieve record (opvoer, geen afvoer) uit een aanvang/einde-lijst. */
function actieveDatum(records) {
  const actief = lijst(records).find((r) => r && !r.afvoer && r.opvoer !== null);
  return actief?.datum ?? null;
}

/** { aanvang, einde } van één hub-item uit /full (elk een string of null). */
export function materieleTijdVan(hubItem, kinderen) {
  const lees = (k, standaard) => actieveDatum(hubItem?.[k?.jsonRolnaam || standaard]);
  return { aanvang: lees(kinderen?.aanvang, "aanvang"), einde: lees(kinderen?.einde, "einde") };
}

/** Milliseconden van een datum (`JJJJ-MM-DD`, als UTC-middernacht) of tijdstip; null als leeg. */
function ms(waarde) {
  if (!waarde) return null;
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(waarde) ? `${waarde}T00:00:00Z` : waarde);
  return Number.isNaN(t) ? null : t;
}

/** Sorteert voorkomens ({ tijd: { aanvang } }) op aanvang, oudste eerst; zonder aanvang vooraan. */
export function sorteerOpAanvang(voorkomens) {
  return [...lijst(voorkomens)].sort((a, b) => (ms(a?.tijd?.aanvang) ?? -Infinity) - (ms(b?.tijd?.aanvang) ?? -Infinity));
}

/** Lokale kalenderdag `JJJJ-MM-DD` van een Date. */
function lokaleDag(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Is een voorkomen geldig op `moment` (Date)? Datum: aanvang ≤ dag ≤ einde (einde inclusief);
 * tijdstip: aanvang ≤ moment < einde (einde exclusief). Zonder aanvang: geldig vanaf altijd.
 */
export function isGeldigOp(tijd, moment, precisie) {
  if (precisie === "tijdstip") {
    const m = moment.getTime();
    const a = ms(tijd?.aanvang);
    const e = ms(tijd?.einde);
    return (a == null || a <= m) && (e == null || m < e);
  }
  const dag = lokaleDag(moment);
  const a = tijd?.aanvang ? String(tijd.aanvang).slice(0, 10) : null;
  const e = tijd?.einde ? String(tijd.einde).slice(0, 10) : null;
  return (a == null || a <= dag) && (e == null || dag <= e);
}

/** Waarde voor een `<input type="date">` of `"datetime-local"` (lokale tijd). */
export function naarInvoer(waarde, precisie) {
  if (!waarde) return "";
  if (precisie !== "tijdstip") return String(waarde).slice(0, 10);
  const t = ms(waarde);
  if (t == null) return "";
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, "0");
  return `${lokaleDag(d)}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Invoer terug naar de API-waarde: datum blijft `JJJJ-MM-DD`, tijdstip wordt RFC 3339 (UTC). */
export function vanInvoer(invoer, precisie) {
  if (!invoer) return null;
  if (precisie !== "tijdstip") return String(invoer).slice(0, 10);
  const d = new Date(invoer);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace(/\.000Z$/, "Z");
}

/** Invoerwaarde voor "nu" (voorinvulling van een nieuwe aanvang). */
export function nuAlsInvoer(precisie, nu = new Date()) {
  return precisie === "tijdstip" ? naarInvoer(nu.toISOString(), "tijdstip") : lokaleDag(nu);
}

/** Leesbare weergave: d-m-jjjj, bij tijdstip met uu:mm (lokale tijd). */
export function toonMoment(waarde, precisie) {
  if (!waarde) return "—";
  if (precisie !== "tijdstip") return korteDatumWeergave(String(waarde).slice(0, 10)) || String(waarde);
  const invoer = naarInvoer(waarde, "tijdstip");
  if (!invoer) return String(waarde);
  const [dag, tijd] = invoer.split("T");
  return `${korteDatumWeergave(dag)} ${tijd}`;
}

/**
 * Sleutel van een aanvang/einde-record bij een bestaand voorkomen (zoals scenario 22 stap 3):
 * { <entiteitIDKolom>: …, <hub-idKolom of rel_id>: … }.
 */
export function sleutelVanVoorkomen(hubItem, hubMeta) {
  const sleutel = {};
  const entKolom = hubMeta?.entiteitIDKolom;
  if (entKolom && hubItem?.[entKolom] != null) sleutel[entKolom] = hubItem[entKolom];
  const idKolom = hubMeta?.idKolom || "rel_id";
  if (hubItem?.[idKolom] != null) sleutel[idKolom] = hubItem[idKolom];
  return sleutel;
}

/**
 * Wijzigingen voor de materiële tijd van een formulier:
 *  - nieuw voorkomen → velden voor de hub-payload (shorthand `aanvang`/`einde`);
 *  - bestaand voorkomen → eigen opvoer op het `_Aanvang`/`_Einde`-element als de waarde veranderde.
 * Een leeggemaakt einde wordt niet verstuurd (weghalen gaat via correctie/ongedaanmaking): fout.
 *
 * @returns {{ hubVelden: object, wijzigingen: Array }}
 */
export function bouwMaterieleTijd({ invoer, origineel, precisie, kinderen, sleutel, isNieuw, aanvangVerplicht }) {
  const aanvang = vanInvoer(invoer?.aanvang, precisie);
  const einde = vanInvoer(invoer?.einde, precisie);
  if (aanvangVerplicht && !aanvang) throw new Error("Aanvang is verplicht: het vorige voorkomen krijgt dan automatisch een einde.");
  if (aanvang && einde && (ms(einde) ?? 0) < (ms(aanvang) ?? 0)) throw new Error("Einde ligt vóór de aanvang.");
  if (isNieuw) {
    const hubVelden = {};
    if (aanvang) hubVelden[kinderen?.aanvang?.jsonRolnaam || "aanvang"] = aanvang;
    if (einde) hubVelden[kinderen?.einde?.jsonRolnaam || "einde"] = einde;
    return { hubVelden, wijzigingen: [] };
  }
  const wijzigingen = [];
  const zelfde = (a, b) => (a ? ms(a) : null) === (b ? ms(b) : null);
  for (const [soort, nieuw] of [["aanvang", aanvang], ["einde", einde]]) {
    const oud = origineel?.[soort] ?? null;
    if (zelfde(nieuw, oud)) continue;
    if (!nieuw) throw new Error(`${soort === "aanvang" ? "Aanvang" : "Einde"} weghalen kan hier niet; gebruik een correctie of ongedaanmaking.`);
    const veldnaam = kinderen?.[soort]?.meta?.veldnaam;
    if (!veldnaam) throw new Error(`Geen ${soort}-element in het schema.`);
    wijzigingen.push({ opvoer: { [veldnaam]: { ...sleutel, datum: nieuw } } });
  }
  return { hubVelden: {}, wijzigingen };
}

/** Is de materiële tijd in het formulier gewijzigd t.o.v. het origineel? */
export function materieleTijdGewijzigd(invoer, origineel, precisie) {
  for (const soort of ["aanvang", "einde"]) {
    const nieuw = vanInvoer(invoer?.[soort], precisie);
    const oud = origineel?.[soort] ?? null;
    if ((nieuw ? ms(nieuw) : null) !== (oud ? ms(oud) : null)) return true;
  }
  return false;
}
