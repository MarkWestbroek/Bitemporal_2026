// @ts-check
/**
 * woordenschat — wat een Cedar-model voor Toegangsspraak betekent, in beide richtingen hetzelfde
 * (fase 2 van "2026-11-25 Cedar als M2").
 *
 *   - **Handelingen**: de acties uit het schema (of afgeleid) zijn de woordenschat (Mark 25-11:
 *     een eigen actielijst, geen vaste tabel). Toegangsspraak eist één woord; dat staat per actie
 *     in `handeling`, en is anders afgeleid uit het laatste deel van de naam
 *     (`zaakafhandelcomponent/behandelaar` → `behandelaar`).
 *   - **Kenmerken**: een attribuut van een principal is een kenmerk van de aanvrager, een attribuut
 *     van een resource een kenmerk van de gegevens. De naam in de zin staat in `kenmerk`, en is
 *     anders afgeleid: een attribuut dat op "rol(len)" eindigt heet "rol"
 *     (`functioneleRollen` → `Iemand met rol "…"`), de rest naar zijn woorden.
 *   - **Meerwaardig**: een attribuut van type `Set<…>`. "Is" betekent daar "één van de waarden is"
 *     (Mark 25-11), in Cedar `.contains(…)`.
 *
 * Puur; leest alleen de elementen van het model.
 */
import { camelNaarWoorden, woordenNaarVeldnaam } from "../../toegangsspraak/woorden.js";

const isConnector = (el) => Boolean(el?.source && el?.target);

/** Vergelijkvorm van een naam: kleine letters, alleen letters en cijfers. */
export const norm = (s) => String(s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** De lokale naam van een Cedar-type: `NS::Persoon` → `Persoon`. */
export const lokaal = (type) => String(type ?? "").split("::").pop() || "";

/** Het woord voor een actie als `handeling` leeg is: het laatste deel van de naam. */
export function standaardWoord(naam) {
  const laatste = String(naam ?? "").split(/[/:]+/).filter(Boolean).pop() || "actie";
  const woord = laatste.toLowerCase().replace(/[^\p{L}\p{N}_]+/gu, "_").replace(/^_+|_+$/g, "");
  return /^\p{L}/u.test(woord) ? woord : `actie_${woord || "x"}`;
}

/** De naam van het kenmerk als `kenmerk` leeg is: "rol" voor een rollen-attribuut, anders de woorden. */
export function standaardKenmerk(attribuut) {
  const woorden = camelNaarWoorden(attribuut);
  const laatste = woorden[woorden.length - 1] || "";
  return /^(rol|rollen)$/.test(laatste) || /rollen$/.test(laatste) ? "rol" : woorden.join(" ");
}

/**
 * @typedef {{naam: string, type: string, meerwaardig: boolean, kenmerk: string}} Attribuut
 * @typedef {{id: string, naam: string, attributen: Attribuut[], ouders: string[]}} Entiteittype
 * @typedef {{id: string, type: string, naam: string, woord: string, principal: string[], resource: string[], groepen: string[]}} Actie
 */

/**
 * @param {Record<string, any>|undefined} elements  de elementen van een Cedar-model
 */
export function cedarWoordenschat(elements) {
  const alle = Object.values(elements || {});
  const byId = Object.fromEntries(alle.map((el) => [el.id, el]));
  const lijnen = alle.filter(isConnector);
  const doelen = (bron, soort, rol) =>
    lijnen.filter((l) => l.elementType === soort && l.source === bron && (!rol || l.data?.rol === rol)).map((l) => byId[l.target]?.naam).filter(Boolean);
  /** @type {{niveau: "fout"|"waarschuwing"|"info", bericht: string, elementId?: string}[]} */
  const meldingen = [];

  /** @type {Entiteittype[]} */
  const typen = alle
    .filter((el) => el.elementType === "entiteittype")
    .map((el) => ({
      id: el.id,
      naam: el.naam,
      attributen: (el.compartimenten || []).flatMap((c) => c.velden || []).map((v) => {
        const type = String(v.data?.typeLabel || "");
        return { naam: v.naam, type, meerwaardig: /^Set\s*</.test(type), kenmerk: String(v.data?.kenmerk || "").trim() || standaardKenmerk(v.naam) };
      }),
      ouders: doelen(el.id, "lid"),
    }));

  /** @type {Actie[]} */
  const acties = alle
    .filter((el) => el.elementType === "actie")
    .map((el) => ({
      id: el.id,
      type: el.data?.actietype || "Action",
      naam: el.naam,
      woord: String(el.data?.handeling || "").trim() || standaardWoord(el.naam),
      principal: doelen(el.id, "geldtVoor", "principal"),
      resource: doelen(el.id, "geldtVoor", "resource"),
      groepen: doelen(el.id, "lid"),
    }));
  const perWoord = new Map();
  for (const a of acties) {
    if (!/^\p{L}[\p{L}\p{N}_]*$/u.test(a.woord)) meldingen.push({ niveau: "fout", elementId: a.id, bericht: `Actie ${a.naam}: handeling "${a.woord}" is geen woord (letters, cijfers, _).` });
    if (perWoord.has(a.woord)) meldingen.push({ niveau: "fout", elementId: a.id, bericht: `Acties ${perWoord.get(a.woord).naam} en ${a.naam} hebben hetzelfde woord "${a.woord}"; geef er één een eigen handeling.` });
    else perWoord.set(a.woord, a);
  }

  const typeVan = (naam) => typen.find((t) => t.naam === naam) || null;
  return {
    typen,
    acties,
    meldingen,
    typeVan,
    /** @param {{type: string, id: string}} uid */
    actieVoorUid: (uid) => acties.find((a) => a.type === uid.type && a.naam === uid.id) || null,
    /** @param {string} woord */
    actieVoorWoord: (woord) => perWoord.get(woord) || null,
    /** Het type bij een pad of woorden uit de tekst ("PabcEntiteittype", "pabc entiteittype"). */
    typeVoor: (tekst) => {
      const n = norm(tekst);
      const gevonden = typen.filter((t) => norm(t.naam) === n || norm(lokaal(t.naam)) === n);
      return gevonden.length === 1 ? gevonden[0] : null;
    },
    /**
     * Het attribuut bij een kenmerk of subpad, gezocht in de gegeven typen: eerst op de naam van
     * het kenmerk, dan op de naam van het attribuut. Null als het niet (eenduidig) bestaat.
     * @param {string[]} typeNamen
     * @param {string} kenmerk
     * @returns {Attribuut|null}
     */
    attribuut: (typeNamen, kenmerk) => {
      const n = norm(kenmerk);
      const kandidaten = typeNamen.map(typeVan).filter(Boolean).flatMap((t) => t.attributen);
      for (const sleutel of [(a) => norm(a.kenmerk), (a) => norm(a.naam)]) {
        const namen = [...new Set(kandidaten.filter((a) => sleutel(a) === n).map((a) => a.naam))];
        if (namen.length === 1) return kandidaten.find((a) => a.naam === namen[0]) || null;
        if (namen.length > 1) return null;
      }
      return null;
    },
    /** De principaltypen van een lijst acties (of alle principaltypen). */
    principalTypen: (lijst = acties) => [...new Set(lijst.flatMap((a) => a.principal))],
    resourceTypen: (lijst = acties) => [...new Set(lijst.flatMap((a) => a.resource))],
  };
}

/** De woorden van een attribuut in een zin: het kenmerk als het er een is, anders de naam. */
export function attribuutWoorden(woordenschat, typeNamen, attr) {
  const gevonden = typeNamen.map(woordenschat.typeVan).filter(Boolean).flatMap((t) => t.attributen).find((a) => a.naam === attr);
  return (gevonden ? gevonden.kenmerk : standaardKenmerk(attr)).split(" ").filter(Boolean);
}

export { woordenNaarVeldnaam };
