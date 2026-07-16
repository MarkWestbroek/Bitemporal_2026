/**
 * customFormMapping — pure logica achter het custom-formulier in EntiteitFormulier:
 * (1) het platslaan van de entiteit-GE's naar een veld-mapping voor de renderer,
 * (2) het bouwen van de cross-GE registratie-wijzigingen bij opslaan.
 *
 * Geëxtraheerd uit EntiteitFormulier zodat de (kritieke, bitemporele) save-logica
 * unit-getest kan worden. Afhankelijkheden (platslaan, waarde-coercion) worden
 * geïnjecteerd zodat deze module vrij is van React.
 *
 * ── Adressering ──
 * De visuele FormulierDefinitie-editor produceert **volledige paden**
 * (`ENT.GE.veld`), consistent met CEL/berichten. Oudere definities gebruiken
 * **korte veldnamen**. Deze mapping registreert elk veld daarom onder beide:
 *   - de korte naam (legacy; eerste GE wint bij naam-collisions — ongewijzigd gedrag);
 *   - het volledige pad (uniek over het model; lost collisions op).
 * De renderer/save vinden een element-`veld` dus of het nu kort of vol pad is.
 */
import { safeArray, platSlaHubItems } from "../../shared/schemaUtils.js";

/** Bouw een modelpad uit niet-lege delen (zoals FieldRef.veldpad). */
export function padVan(...delen) {
  return delen.filter(Boolean).join(".");
}

/**
 * bouwCustomVeldMapping — platslaan van de entiteit naar { customVelden, customValues, veldNaarGE }.
 *
 * @param {object} args
 * @param {object} args.entity              full-entity response
 * @param {object} args.typeMeta            meta van de hoofd-entiteit
 * @param {Array}  args.onderliggende       gefilterde onderliggende GE's (geen aanvang/einde)
 * @param {object} args.typeMetaByTypenaam  map typenaam → meta
 * @param {object} [args.parentTypeMeta]    TPT-parent meta (optioneel)
 * @param {string} [args.parentJSONKey]     JSON-key van parent-data in entity (optioneel)
 * @param {Function} [args.platSla]         injecteerbaar (default platSlaHubItems)
 * @returns {{ customVelden: Array, customValues: object, veldNaarGE: object }}
 */
export function bouwCustomVeldMapping({
  entity,
  typeMeta,
  onderliggende,
  typeMetaByTypenaam,
  parentTypeMeta = null,
  parentJSONKey = null,
  platSla = platSlaHubItems,
}) {
  const velden = [];
  const values = {};
  const geMapping = {};
  const gezienKort = new Set();

  // Registreer één veld onder vol pad (altijd) + korte naam (alleen eerste keer).
  function registreer({ naam, veldDef, info, waarde, volPad }) {
    if (volPad) {
      velden.push({ ...veldDef, naam: volPad });
      geMapping[volPad] = info;
      if (waarde !== undefined && waarde !== null) values[volPad] = waarde;
    }
    if (!gezienKort.has(naam)) {
      gezienKort.add(naam);
      velden.push(veldDef);
      geMapping[naam] = info;
    }
    // Korte-naam waarde: laatste GE wint (ongewijzigd t.o.v. origineel gedrag).
    if (waarde !== undefined && waarde !== null) values[naam] = waarde;
  }

  // ── Geërfde velden (TPT parent) ──
  if (parentTypeMeta && parentJSONKey) {
    const parentData = entity?.[parentJSONKey];
    const geerfdeVeldenRaw = safeArray(typeMeta?.geerfdeVelden);
    const skip = new Set(["opvoer", "afvoer"]);
    const info = {
      childMeta: parentTypeMeta, dataMeta: null, actueel: parentData,
      bronVelden: geerfdeVeldenRaw, isParentVeld: true,
      entTypenaam: parentTypeMeta.typenaam, rol: "",
    };
    for (const v of geerfdeVeldenRaw) {
      const naam = v?.naam;
      if (!naam) continue;
      if (skip.has(naam.toLowerCase())) continue;
      if (v.autoIncrement) continue;
      if (naam.toLowerCase() === String(parentTypeMeta?.idKolom || "id").toLowerCase()) continue;
      if (naam === "versie" || naam === "rel_id") continue;
      const volPad = padVan(parentTypeMeta.typenaam, naam);
      const waarde = parentData && parentData[naam] != null ? parentData[naam] : undefined;
      registreer({ naam, veldDef: v, info, waarde, volPad });
    }
  }

  // ── Eigen onderliggende GE's ──
  for (const child of safeArray(onderliggende)) {
    const childMeta = typeMetaByTypenaam?.[child.doeltype];
    if (!childMeta) continue;
    const dataChild = safeArray(childMeta?.onderliggende).find(
      (c) => typeMetaByTypenaam?.[c.doeltype]?.ge_subtype === "data"
    );
    const dataMeta = dataChild ? typeMetaByTypenaam?.[dataChild.doeltype] : null;
    const bronVelden = safeArray(dataMeta?.velden || childMeta?.velden);
    const rawItems = safeArray(entity?.[child.jsonRolnaam] || entity?.[child.rolnaam]);
    const flat = platSla(rawItems, childMeta, typeMetaByTypenaam);
    const actueel = flat.find((item) => item?.opvoer && !item?.afvoer);
    const rol = child.jsonRolnaam || child.rolnaam || "";
    const info = { childMeta, dataMeta, actueel, bronVelden, entTypenaam: typeMeta?.typenaam, rol };

    // Meervoudig GE → ook als array onder de bron (voor het `lijst`-element).
    // De items zijn de actuele (opgevoerde, niet-afgevoerde) platgeslagen records;
    // hun veld-keys zijn de korte namen = relatieve adressering binnen de lijst.
    if (String(child.momentvoorkomen || "").toLowerCase() === "meervoudig") {
      const actueleItems = flat.filter((i) => i?.opvoer && !i?.afvoer);
      const bron = padVan(typeMeta?.typenaam, rol);
      values[bron] = actueleItems;
      geMapping[bron] = { childMeta, dataMeta, bronVelden, entTypenaam: typeMeta?.typenaam, rol, isMeervoudig: true };
    }

    for (const v of bronVelden) {
      const naam = v?.naam;
      if (!naam) continue;
      if (["opvoer", "afvoer", "versie"].includes(naam)) continue;
      if (childMeta.entiteitIDKolom && naam === childMeta.entiteitIDKolom) continue;
      if (v.autoIncrement) continue;
      const volPad = padVan(typeMeta?.typenaam, rol, naam);
      const waarde = actueel && actueel[naam] != null ? actueel[naam] : undefined;
      registreer({ naam, veldDef: v, info, waarde, volPad });
    }
  }

  return { customVelden: velden, customValues: values, veldNaarGE: geMapping };
}

/**
 * bouwCustomWijzigingen — bouw de cross-GE registratie-wijzigingen uit de
 * gewijzigde waarden. Groepeert per GE en levert één opvoer-wijziging per GE.
 *
 * @param {object} args
 * @param {object} args.customEditValues  gewijzigde waarden ({ veld|pad → waarde })
 * @param {object} args.customValues      oorspronkelijke waarden (voor "is gewijzigd?")
 * @param {object} args.veldNaarGE        mapping veld|pad → GE-info
 * @param {string|number} args.id         entiteit-id
 * @param {Function} [args.coerce]        (raw, veld, naam) → gecoërceerde waarde
 * @returns {{ wijzigingen: Array, geenWijzigingen: boolean }}
 * @throws {Error} bij een leeg verplicht veld
 */
export function bouwCustomWijzigingen({ customEditValues, customValues, veldNaarGE, id, coerce }) {
  // Splits scalar-edits (platte velden) en array-edits (lijst/meervoudig).
  const flatEdits = {};
  const lijstWijzigingen = [];
  for (const [key, waarde] of Object.entries(customEditValues || {})) {
    if (Array.isArray(waarde)) {
      const info = veldNaarGE?.[key];
      if (info?.isMeervoudig) {
        lijstWijzigingen.push(...bouwLijstWijzigingen(info, safeArray(customValues?.[key]), waarde, id, coerce));
      }
    } else {
      flatEdits[key] = waarde;
    }
  }

  const geGroepen = {};
  for (const [veldnaam, waarde] of Object.entries(flatEdits)) {
    const orig = customValues?.[veldnaam];
    if (String(waarde ?? "") === String(orig ?? "")) continue;
    const ge = veldNaarGE?.[veldnaam];
    if (!ge) continue;
    const key = ge.childMeta.typenaam;
    if (!geGroepen[key]) geGroepen[key] = { ...ge };
  }

  const keys = Object.keys(geGroepen);
  if (keys.length === 0 && lijstWijzigingen.length === 0) {
    return { wijzigingen: [], geenWijzigingen: true };
  }

  const wijzigingen = [];
  // Parent-wijzigingen eerst (TPT: parent-record moet bestaan).
  const sorted = Object.values(geGroepen).sort((a, b) => (a.isParentVeld ? -1 : 0) - (b.isParentVeld ? -1 : 0));

  for (const info of sorted) {
    const hubMeta = info.childMeta;
    const veldnaamKey = hubMeta.veldnaam || hubMeta.padnaam;
    const payload = {};

    if (info.isParentVeld) {
      const idKolom = hubMeta?.idKolom || "id";
      if (id) payload[idKolom] = Number(id);
    } else {
      if (hubMeta.entiteitIDKolom && id) payload[hubMeta.entiteitIDKolom] = Number(id);
      if (info.actueel?.rel_id != null) payload.rel_id = info.actueel.rel_id;
      if (hubMeta.idKolom && info.actueel?.[hubMeta.idKolom] != null) payload[hubMeta.idKolom] = info.actueel[hubMeta.idKolom];
    }

    const bronVelden = safeArray(info.isParentVeld ? info.bronVelden : (info.dataMeta?.velden || hubMeta?.velden));
    for (const v of bronVelden) {
      const naam = v?.naam;
      if (!naam) continue;
      if (["opvoer", "afvoer", "versie"].includes(naam)) continue;
      if (info.isParentVeld) {
        if (naam.toLowerCase() === String(hubMeta?.idKolom || "id").toLowerCase()) continue;
      } else if (hubMeta.entiteitIDKolom && naam === hubMeta.entiteitIDKolom) {
        continue;
      }
      if (v.autoIncrement) continue;

      // Bewerkte waarde: vol pad heeft voorrang op korte naam (voorkomt cross-talk).
      const volPad = padVan(info.entTypenaam, info.rol, naam);
      const edited = flatEdits[volPad] !== undefined ? flatEdits[volPad] : flatEdits[naam];
      const original = info.actueel?.[naam];
      const raw = edited !== undefined ? edited : original;
      if (raw === "" || raw === null || raw === undefined) {
        if (v.verplicht) throw new Error(`${naam} is verplicht.`);
        continue;
      }
      payload[naam] = coerce ? coerce(raw, v, naam) : raw;
    }

    wijzigingen.push({ opvoer: { [veldnaamKey]: payload } });
  }

  // Lijst-wijzigingen (per-item opvoer/afvoer) achteraan.
  wijzigingen.push(...lijstWijzigingen);

  return { wijzigingen, geenWijzigingen: wijzigingen.length === 0 };
}

/**
 * bouwLijstWijzigingen — diff van een meervoudige (lijst) GE: per item een
 * opvoer (nieuw of gewijzigd) en per verwijderd item een afvoer.
 *
 * Items worden gematcht op rel_id (of idKolom). Nieuwe items hebben geen sleutel.
 */
function bouwLijstWijzigingen(info, origArray, editedArray, id, coerce) {
  const wijzigingen = [];
  const hubMeta = info.childMeta;
  const veldnaamKey = hubMeta.veldnaam || hubMeta.padnaam;
  const idKolom = hubMeta.idKolom;
  const entKolom = hubMeta.entiteitIDKolom;
  const bronVelden = safeArray(info.dataMeta?.velden || hubMeta?.velden);

  const sleutelVan = (it) =>
    it?.rel_id != null ? `rel:${it.rel_id}` : (idKolom && it?.[idKolom] != null ? `id:${it[idKolom]}` : null);

  const origBySleutel = new Map();
  for (const it of safeArray(origArray)) {
    const s = sleutelVan(it);
    if (s) origBySleutel.set(s, it);
  }

  const behouden = new Set();
  for (const item of safeArray(editedArray)) {
    const s = sleutelVan(item);
    if (s) behouden.add(s);
    const orig = s ? origBySleutel.get(s) : null;

    const payload = {};
    if (entKolom && id) payload[entKolom] = Number(id);
    if (orig) {
      if (item.rel_id != null) payload.rel_id = item.rel_id;
      if (idKolom && item[idKolom] != null) payload[idKolom] = item[idKolom];
    }

    let gewijzigd = !orig; // nieuw item = altijd schrijven
    for (const v of bronVelden) {
      const naam = v?.naam;
      if (!naam) continue;
      if (["opvoer", "afvoer", "versie"].includes(naam)) continue;
      if (entKolom && naam === entKolom) continue;
      if (v.autoIncrement) continue;
      const raw = item[naam];
      if (raw === "" || raw === null || raw === undefined) {
        if (v.verplicht && !orig) throw new Error(`${naam} is verplicht.`);
        continue;
      }
      if (!orig || String(raw ?? "") !== String(orig[naam] ?? "")) gewijzigd = true;
      payload[naam] = coerce ? coerce(raw, v, naam) : raw;
    }

    if (gewijzigd) wijzigingen.push({ opvoer: { [veldnaamKey]: payload } });
  }

  // Verwijderde items → afvoer.
  for (const [s, orig] of origBySleutel) {
    if (behouden.has(s)) continue;
    const sleutel = {};
    if (entKolom && id) sleutel[entKolom] = Number(id);
    if (orig.rel_id != null) sleutel.rel_id = orig.rel_id;
    if (idKolom && orig[idKolom] != null) sleutel[idKolom] = orig[idKolom];
    wijzigingen.push({ afvoer: { [veldnaamKey]: sleutel } });
  }

  return wijzigingen;
}
