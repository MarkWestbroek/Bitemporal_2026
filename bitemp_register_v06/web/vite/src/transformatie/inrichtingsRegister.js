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

/**
 * Items van een referentielijst uit het register (laatste stand): de data van
 * het gegevenselement `<x>_gegevens` per item, bv. full/aanvraagtypen →
 * aanvraagtype_gegevens → {code, omschrijving, …}.
 * @param {(pad: string) => Promise<any>} haalJson
 * @param {string} bron - "register: /full/aanvraagtypen" of "full/aanvraagtypen"
 */
export async function leesReferentielijst(haalJson, bron) {
  const pad = String(bron).replace(/^register:\s*/, "").replace(/^\/+/, "");
  const items = await haalAlles(haalJson, pad);
  return items
    .map((it) => {
      const k = Object.keys(it).find((s) => s.endsWith("_gegevens"));
      return k ? laatsteData(it[k]) : null;
    })
    .filter(Boolean)
    .map(({ versie, ...rest }) => rest);
}
