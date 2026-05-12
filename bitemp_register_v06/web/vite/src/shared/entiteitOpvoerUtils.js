/**
 * entiteitOpvoerUtils.js
 *
 * Gedeelde utilities voor het opvoeren van een nieuwe entiteit met onderliggende
 * gegevenselementen en relaties in één registratie-aanroep.
 *
 * Dezelfde logica als IndexSchemaPage, maar geëxtraheerd voor hergebruik in
 * NieuwEntiteitPagina (editor-route /t/:typePad/nieuw).
 */

import { safeArray } from "./schemaUtils";

/** Temporale plumbing-veldnamen die nooit als invoerveld getoond worden. */
export const TEMPORALE_PLUMBING_VELDEN = new Set(["opvoer", "afvoer", "aanvang", "einde"]);

/**
 * Bouw groepopties voor GEs en relaties vanuit de schema-metadata van een entiteittype.
 * Dit is equivalent aan `gegevenselementGroepOpties` en `relatieGroepOpties` in
 * IndexSchemaPage, maar afgeleid puur van de typeMeta (geen entity-data nodig).
 *
 * @param {Object} typeMeta - Schema-entry van de entiteit
 * @param {Object} typeMetaByTypenaam - Map typenaam → typeMeta (uit SchemaContext)
 * @returns {{ gegevenselementGroepOpties: Array, relatieGroepOpties: Array }}
 */
export function bouwGroepOptiesVanTypeMeta(typeMeta, typeMetaByTypenaam) {
  const onderliggende = safeArray(typeMeta?.onderliggende);

  function bouwOptieVoorKind(kind) {
    const kindMeta = typeMetaByTypenaam?.[kind.doeltype];
    // Filter materiële plumbing-types (aanvang/einde) uit de reguliere GE-lijst.
    // Die worden apart behandeld als materiële tijd.
    if (kindMeta?.bovenliggendTypenaam) return null;

    const metatype = String(kindMeta?.metatype || "gegevenselement").toLowerCase();
    const entKolom = String(kindMeta?.entiteitIDKolom || "").toLowerCase();
    const idKolom = String(kindMeta?.idKolom || "").toLowerCase();
    const primaireKolom = String(kindMeta?.entiteitIDKolom || "").toLowerCase();

    const schemaVeldDefinities = safeArray(kindMeta?.velden)
      .filter((veld) => {
        if (!veld) return false;
        const naam = String(veld.naam || "").toLowerCase();
        if (TEMPORALE_PLUMBING_VELDEN.has(naam)) return false;
        if (naam === "opvoer" || naam === "afvoer") return false;
        if (entKolom && naam === entKolom) return false;
        if (metatype === "relatie" && primaireKolom && naam === primaireKolom) return false;
        if (veld.autoIncrement) return false;
        // Array-velden zijn geneste GE-rolnamen; geen invoer
        if (String(veld.format || "") === "array") return false;
        return true;
      })
      .map((veld) => ({
        naam: String(veld.naam || ""),
        description: String(veld.description || ""),
        type: String(veld.type || "string"),
        format: String(veld.format || ""),
        enum: safeArray(veld.enum).map((w) => String(w || "")).filter(Boolean),
        ref: veld.ref || undefined,
        datatype: veld.datatype || undefined,
        defaultValue: "",
        verplicht: Boolean(veld.verplicht),
      }))
      .filter((veld) => veld.naam);

    const groepKey = `${kind.rolnaam}__${kind.doeltype}`;
    return {
      groupKey: groepKey,
      metatype,
      label: String(kindMeta?.klassenaam || kind.doeltype || kind.rolnaam || "?"),
      geVeldnaam: String(kindMeta?.veldnaam || kind.doeltype.toLowerCase()),
      entiteitIDKolom: String(kindMeta?.entiteitIDKolom || ""),
      secondaireEntiteitIDKolom: kindMeta?.secondaireEntiteitIDKolom || "",
      doelEntiteit: kindMeta?.doelEntiteit || "",
      isMaterieel: Boolean(kindMeta?.isMaterieel && kindMeta?.ge_subtype === "hub"),
      momentvoorkomen: String(kind.momentvoorkomen || "enkelvoudig").toLowerCase(),
      veldDefinities: schemaVeldDefinities,
    };
  }

  const alle = onderliggende.map(bouwOptieVoorKind).filter(Boolean);
  return {
    gegevenselementGroepOpties: alle.filter((o) => o.metatype === "gegevenselement"),
    relatieGroepOpties: alle.filter((o) => o.metatype === "relatie"),
  };
}

/**
 * Initialiseer een leeg waardenobject voor een groepoptie.
 */
export function initialiseerGeWaardenVoorOptie(optie) {
  const values = {};
  safeArray(optie?.veldDefinities).forEach((veld) => {
    values[veld.naam] = veld.defaultValue;
  });
  if (optie?.isMaterieel) {
    values.aanvang = "";
    values.einde = "";
  }
  return values;
}

/**
 * Is deze optie meervoudig? (momentvoorkomen = 'meervoudig')
 */
export function isMeervoudigOptie(optie) {
  return String(optie?.momentvoorkomen || "").toLowerCase() === "meervoudig";
}

/**
 * Bouw de beginrijen voor alle groepopties (1 rij per enkelvoudig, 2 per meervoudig).
 */
export function bouwInitieleRijen(opties, startId = 1) {
  const rows = [];
  let nextId = startId;
  safeArray(opties).forEach((optie) => {
    const aantal = isMeervoudigOptie(optie) ? 2 : 1;
    for (let i = 0; i < aantal; i += 1) {
      rows.push({
        id: nextId,
        groupKey: optie.groupKey,
        values: initialiseerGeWaardenVoorOptie(optie),
      });
      nextId += 1;
    }
  });
  return { rows, nextId };
}

/**
 * Vul materiële tijd (aanvang/einde) in het hub-input item vanuit de rijwaarden.
 */
export function vulMaterieleTijdVoorHubInput(item, row, optie) {
  if (!optie?.isMaterieel) return;
  const aanvang = String(row?.values?.aanvang || "").trim();
  const einde = String(row?.values?.einde || "").trim();
  if (aanvang) item.aanvang = aanvang;
  if (einde) item.einde = einde;
}
