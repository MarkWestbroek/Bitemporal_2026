// @ts-check
/**
 * inrichtingsRegister — lezen uit het inrichting-register (een Omnium-instantie
 * op Fundament, cg-test) en de bundel ertegen leggen (docs/TRANSFORMATIES.md §11.10).
 *
 * Alleen lezen: registreren doet (nog) het script van FUNDAMENT met de
 * download; schrijven vanuit de browser wacht op een token/service-account en
 * CORS bij BACKEND.
 *
 * Vorm van /full (afspraak FUNDAMENT 30-10): elke relatie is een lijst van
 * voorkomens ({rel_id, …, data: [versies]}); de geldende stand is het laatste
 * voorkomen zonder einde of afvoer, en daarin de hoogste versie. Soort en
 * formaat staan als id; de codes komen uit full/artefactsoorten en
 * full/artefactformaten. "Ongewijzigd" = zelfde payloadHash bij dezelfde
 * (e-dienstnaam + versienummer, soort, identifier).
 *
 * Puur: de HTTP-laag komt binnen als `haalJson(pad)` → Promise<json>.
 */

/** De items van een /full-antwoord: een lijst, of de eerste lijst in het object. */
export function itemsVan(antwoord) {
  if (Array.isArray(antwoord)) return antwoord;
  for (const v of Object.values(antwoord || {})) if (Array.isArray(v)) return v;
  return [];
}

/** Het geldende voorkomen: het laatste zonder afvoer of einde. */
export function geldendVoorkomen(voorkomens) {
  const actief = (voorkomens || []).filter((v) => v && !v.afvoer && !(Array.isArray(v.einde) && v.einde.length));
  return actief.length ? actief[actief.length - 1] : null;
}

/** De data van de hoogste versie in het geldende voorkomen (of null). */
export function laatsteData(voorkomens) {
  const vk = geldendVoorkomen(voorkomens);
  const data = Array.isArray(vk?.data) ? vk.data : [];
  if (!data.length) return null;
  return data.reduce((a, b) => ((b?.versie ?? 0) >= (a?.versie ?? 0) ? b : a));
}

/** Haal alle items van een /full-lijst op (paginering met has_more). */
export async function haalAlles(haalJson, pad, grootte = 500) {
  const alle = [];
  for (let pagina = 1; pagina < 100; pagina += 1) {
    const sep = pad.includes("?") ? "&" : "?";
    const antwoord = await haalJson(`${pad}${sep}size=${grootte}&page=${pagina}`);
    alle.push(...itemsVan(antwoord));
    if (!antwoord || Array.isArray(antwoord) || !antwoord.has_more) break;
  }
  return alle;
}

/** {id → code} uit een codelijst, met de gegevens onder `<sleutel>`. */
function codes(items, sleutel) {
  return new Map(items.map((it) => [it.id, laatsteData(it[sleutel])?.code]).filter(([, c]) => c));
}

const sleutel = (edienst, versienummer, soort, identifier) => `${edienst}|${versienummer}|${soort}|${identifier}`;

/**
 * Lees de geregistreerde artefacten als index.
 * @param {(pad: string) => Promise<any>} haalJson
 * @returns {Promise<Map<string, {id: any, soort: string, identifier: string, versienummer: string, payloadHash: string, edienst: string, edienstVersie: string}>>}
 */
export async function leesRegisterStand(haalJson) {
  const [artefacten, soorten, ediensten, versies] = await Promise.all([
    haalAlles(haalJson, "full/artefacten"),
    haalAlles(haalJson, "full/artefactsoorten"),
    haalAlles(haalJson, "full/ediensten"),
    haalAlles(haalJson, "full/edienstversies"),
  ]);
  const soortCode = codes(soorten, "artefactsoort_gegevens");
  const edienstNaam = new Map(ediensten.map((e) => [e.id, laatsteData(e.edienst_namen)?.naam]));
  const versie = new Map(
    versies.map((v) => [
      v.id,
      {
        versienummer: laatsteData(v.edienstversie_nummers)?.versienummer,
        edienst: edienstNaam.get(geldendVoorkomen(v.edienstversie_ediensten)?.edienst_id),
      },
    ])
  );

  const index = new Map();
  for (const a of artefacten) {
    const id = laatsteData(a.artefact_identificaties);
    const inhoud = laatsteData(a.artefact_inhouden);
    const ev = versie.get(geldendVoorkomen(a.artefact_edienstversies)?.edienstversie_id);
    const soort = soortCode.get(id?.soort) || id?.soort;
    if (!id || !ev?.edienst) continue;
    index.set(sleutel(ev.edienst, ev.versienummer, soort, id.identifier), {
      id: a.id,
      soort,
      identifier: id.identifier,
      versienummer: id.versienummer,
      payloadHash: inhoud?.payloadHash || null,
      edienst: ev.edienst,
      edienstVersie: ev.versienummer,
    });
  }
  return index;
}

/**
 * Leg de bundel tegen het register: per artefact "nieuw", "ongewijzigd" of "gewijzigd".
 * @param {Array<{soort: string, identifier: string, artefact: any}>} bundel
 * @param {Map<string, any>} stand  - uit leesRegisterStand
 * @param {{naam: string, versienummer: string}} edienst - edienst.edienst uit het e-dienstmodel
 */
export function vergelijkMetRegister(bundel, stand, edienst) {
  return bundel.map((b) => {
    if (!b.artefact) return { ...b, status: "fout", register: null };
    const r = stand.get(sleutel(edienst?.naam, edienst?.versienummer, b.soort, b.identifier)) || null;
    const status = !r ? "nieuw" : r.payloadHash === b.artefact.artefactInhoud?.payloadHash ? "ongewijzigd" : "gewijzigd";
    return { ...b, status, register: r };
  });
}

/** De sleutel van het gegevens-GE van een item: `<x>_gegevens` (tot 08-11) of `<x>gegevens` (na de rebuild van 08-11, bv. aanvraagtypegegevens). */
export function gegevensSleutel(item) {
  return Object.keys(item || {}).find((s) => /gegevens$/i.test(s) && Array.isArray(item[s])) || null;
}

/** De datum van een aanvang of einde: de laatste `[{datum}]` zonder afvoer (een gecorrigeerde blijft met afvoer staan), of `{datum}`/string. */
function datumVan(x) {
  const geldig = Array.isArray(x) ? x.filter((e) => e && !e.afvoer) : [x];
  const v = geldig[geldig.length - 1];
  const d = typeof v === "string" ? v : v?.datum || v?.tijdstip || null;
  return d ? String(d).slice(0, 10) : null;
}

/**
 * Is het item lid van de referentielijst-instantie met id `lijstId` op `peildatum`?
 * Lidmaatschap = een voorkomen van de items-relatie (sleutel `lidmaatschap`, de
 * meervoud van de items-REL, bv. `aanvraagtypen`) met `referentielijst_id`,
 * zonder afvoer, met aanvang uiterlijk op de peildatum en zonder einde vóór de
 * peildatum (einde = laatste geldige dag, inclusief; afspraak FUNDAMENT 08-11).
 * @param {any} item
 * @param {string} lidmaatschap
 * @param {any} lijstId
 * @param {string} peildatum - JJJJ-MM-DD
 */
export function isLidVan(item, lidmaatschap, lijstId, peildatum) {
  return (item?.[lidmaatschap] || []).some((v) => {
    if (!v || v.afvoer || String(v.referentielijst_id) !== String(lijstId)) return false;
    const aanvang = datumVan(v.aanvang);
    const einde = datumVan(v.einde);
    return (!aanvang || aanvang <= peildatum) && (!einde || einde >= peildatum);
  });
}

/**
 * Het id van een referentielijst-instantie bij haar naam (bv. "Verzoekpartijrollen"),
 * uit de lijst van Referentielijst-records (naam onder `referentielijstnamen`).
 * @param {(pad: string) => Promise<any>} haalJson
 * @param {string} naam
 * @param {string} [pad]
 */
export async function referentielijstId(haalJson, naam, pad = "full/referentielijsten/referentielijsten") {
  const items = await haalAlles(haalJson, String(pad).replace(/^register:\s*/, "").replace(/^\/+/, ""));
  const gevonden = items.filter((it) => {
    const k = Object.keys(it).find((s) => /namen$/i.test(s) && Array.isArray(it[s]));
    return k && laatsteData(it[k])?.naam === naam;
  });
  if (gevonden.length !== 1) throw new Error(gevonden.length ? `referentielijst "${naam}" komt ${gevonden.length} keer voor` : `referentielijst "${naam}" niet gevonden in ${pad}`);
  return gevonden[0].id;
}

/**
 * Items van een referentielijst uit het register (laatste stand): de data van
 * het gegevens-GE per item, bv. full/aanvraagtypedefinities →
 * aanvraagtypegegevens → {code, omschrijving, …}.
 *
 * Met `lid` alleen de items die lid zijn van die instantie (na de rebuild van
 * 08-11: een item-entiteit kan in meer lijsten staan). De opties-route van de
 * API filtert (nog) niet op een $ref naar een items-REL, dus dat doen we hier.
 * @param {(pad: string) => Promise<any>} haalJson
 * @param {string} bron - "register: /full/aanvraagtypedefinities" of "full/aanvraagtypedefinities"
 * @param {{instantie: string, lidmaatschap: string, instantieBron?: string, peildatum?: string}|null} [lid]
 */
export async function leesReferentielijst(haalJson, bron, lid = null) {
  const pad = String(bron).replace(/^register:\s*/, "").replace(/^\/+/, "");
  let items = await haalAlles(haalJson, pad);
  if (lid?.instantie) {
    const id = await referentielijstId(haalJson, lid.instantie, lid.instantieBron);
    const peildatum = (lid.peildatum || new Date().toISOString()).slice(0, 10);
    items = items.filter((it) => isLidVan(it, lid.lidmaatschap, id, peildatum));
  }
  return items
    .map((it) => {
      const k = gegevensSleutel(it);
      return k ? laatsteData(it[k]) : null;
    })
    .filter(Boolean)
    .map(({ versie, ...rest }) => rest);
}
