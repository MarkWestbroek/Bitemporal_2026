// @ts-check
/**
 * pickerTypesUitV3 — de platte types-lijst van de ModelPicker (zelfde vorm als `types` uit
 * GET /api/schema/model/code, handlers/viz_schema_handler.go vizSchemaTypeDTO) uit een
 * V3-model in plaats van uit het gebouwde register (Mark, 31-10). Zo leest de picker in de
 * Studio het canonieke model van het project: een hernoeming is meteen zichtbaar en elk
 * veld draagt zijn `uuid` (de binding van een FieldRef, besluit Mark 31-10).
 *
 * Vorm, zoals het register hem levert:
 *   - entiteit: velden `id` + per onderliggende een collectieveld (format "array");
 *     onderliggende → de GE-hub (`Entiteit_GE`) of de relatie (`Relatienaam`), en bij een
 *     materiële entiteit `_Aanvang`/`_Einde`;
 *   - GE-hub/relatie: `<entiteit>_id`, `rel_id` (relatie ook `<doel>_id`) + de eigen velden.
 * De plumbing-velden verbergt de picker zelf (isTechnischVeldnaam).
 */
import { v3ModelNaarStore } from "../store/adapters.js";

/** snake_case zoals codegen de id-kolommen noemt (GehandicaptenParkeerkaart → gehandicapten_parkeerkaart). */
function snake(s) {
  return String(s || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

/** Store-veld (v3ModelNaarStore) → veld-DTO van de picker. */
function veldDto(v) {
  return {
    naam: v.naam,
    ...(v.description ? { description: v.description } : {}),
    type: v.type || "string",
    ...(v.format ? { format: v.format } : {}),
    verplicht: v.verplicht !== false,
    ...(v.datatypeNaam ? { datatype: v.datatypeNaam } : {}),
    ...(Array.isArray(v.enum) && v.enum.length ? { enum: v.enum } : {}),
    ...(v.refNaam ? { ref: v.refNaam } : {}),
    ...(v.uuid ? { uuid: v.uuid } : {}),
  };
}

const afgeleidDto = (av) => ({
  naam: av.naam,
  goType: av.goType || "string",
  ...(av.description ? { description: av.description } : {}),
  afleidingsregel: av.afleidingsregel || "",
  afleidingsregelTaal: av.afleidingsregelTaal || "cel",
});

/**
 * @param {any} v3 - V3-bestand ({model}) of het model zelf
 * @returns {any[]} platte types
 */
export function pickerTypesUitV3(v3) {
  const m = v3?.model || v3 || {};
  const { elements } = v3ModelNaarStore(v3);
  const types = [];
  const tijdlijn = (eigenaar, domein, idVeld) => [
    { typenaam: `${eigenaar}_Aanvang`, metatype: "gegevenselement", ge_subtype: "aanvang", domein, velden: [{ naam: idVeld, type: "integer", verplicht: true }, { naam: "datum", type: "string", format: "date", verplicht: false }] },
    { typenaam: `${eigenaar}_Einde`, metatype: "gegevenselement", ge_subtype: "einde", domein, velden: [{ naam: idVeld, type: "integer", verplicht: true }, { naam: "datum", type: "string", format: "date", verplicht: false }] },
  ];
  for (const ent of m.entiteiten || []) {
    const domein = ent.domein || "";
    const entId = `${snake(ent.typenaam)}_id`;
    const onderliggende = [];
    const collectie = [];
    for (const ge of ent.gegevenselementen || []) {
      const typenaam = `${ent.typenaam}_${ge.naam}`;
      const jsonRolnaam = ge.meervoud || ge.naam.toLowerCase();
      onderliggende.push({ rolnaam: ge.naam, jsonRolnaam, doeltype: typenaam, momentvoorkomen: ge.momentvoorkomen || "enkelvoudig" });
      collectie.push({ naam: jsonRolnaam, type: typenaam, format: "array", verplicht: false });
      const d = elements[typenaam]?.data || {};
      types.push({
        typenaam,
        klassenaam: ge.naam,
        metatype: "gegevenselement",
        ge_subtype: "hub",
        domein: ge.domein || domein,
        ...(ge.isMaterieel ? { isMaterieel: true } : {}),
        ...(ge.uuid ? { uuid: ge.uuid } : {}),
        velden: [
          { naam: entId, type: "integer", verplicht: true },
          { naam: "rel_id", type: "integer", verplicht: true, autoIncrement: true },
          ...(d.velden || []).map(veldDto),
        ],
        afgeleideVelden: (ge.afgeleideVelden || []).map(afgeleidDto),
        ...(ge.isMaterieel ? { onderliggende: [{ rolnaam: "Aanvang", jsonRolnaam: "aanvang", doeltype: `${typenaam}_Aanvang`, momentvoorkomen: "enkelvoudig" }, { rolnaam: "Einde", jsonRolnaam: "einde", doeltype: `${typenaam}_Einde`, momentvoorkomen: "enkelvoudig" }] } : {}),
      });
      if (ge.isMaterieel) types.push(...tijdlijn(typenaam, ge.domein || domein, "rel_id"));
    }
    for (const rel of ent.relaties || []) {
      const jsonRolnaam = rel.meervoud || rel.naam.toLowerCase();
      onderliggende.push({ rolnaam: rel.naam, jsonRolnaam, doeltype: rel.naam, momentvoorkomen: rel.momentvoorkomen || "meervoudig" });
      collectie.push({ naam: jsonRolnaam, type: rel.naam, format: "array", verplicht: false });
      if (types.some((t) => t.typenaam === rel.naam)) continue;
      const d = elements[rel.naam]?.data || {};
      types.push({
        typenaam: rel.naam,
        klassenaam: rel.naam,
        metatype: "relatie",
        ge_subtype: "hub",
        domein: rel.domein || domein,
        doelEntiteit: rel.doelEntiteit || "",
        ...(rel.uuid ? { uuid: rel.uuid } : {}),
        velden: [
          { naam: entId, type: "integer", verplicht: true },
          { naam: "rel_id", type: "integer", verplicht: true, autoIncrement: true },
          ...(rel.doelEntiteit ? [{ naam: `${snake(rel.doelEntiteit)}_id`, type: "integer", verplicht: true }] : []),
          ...(rel.afgeleid ? [] : (d.velden || []).map(veldDto)),
        ],
        afgeleideVelden: (rel.afgeleideVelden || []).map(afgeleidDto),
      });
    }
    if (ent.isMaterieel) {
      onderliggende.push(
        { rolnaam: "Aanvang", jsonRolnaam: "aanvang", doeltype: `${ent.typenaam}_Aanvang`, momentvoorkomen: "enkelvoudig" },
        { rolnaam: "Einde", jsonRolnaam: "einde", doeltype: `${ent.typenaam}_Einde`, momentvoorkomen: "enkelvoudig" }
      );
      types.push(...tijdlijn(ent.typenaam, domein, entId));
    }
    types.push({
      typenaam: ent.typenaam,
      klassenaam: ent.typenaam,
      metatype: "entiteit",
      domein,
      ...(ent.isMaterieel ? { isMaterieel: true } : {}),
      ...(ent.entiteitSubtype ? { entiteitSubtype: ent.entiteitSubtype } : {}),
      ...(ent.erft ? { parentTypenaam: ent.erft } : {}),
      ...(ent.uuid ? { uuid: ent.uuid } : {}),
      velden: [
        { naam: "id", type: "integer", verplicht: true },
        // Subtype (erft): de verwijzing naar het supertype, zoals codegen hem maakt.
        ...(ent.erft ? [{ naam: `parent_${snake(ent.erft)}`, type: ent.erft, verplicht: false }] : []),
        ...collectie,
      ],
      afgeleideVelden: (ent.afgeleideVelden || []).map(afgeleidDto),
      onderliggende,
    });
  }
  return types.sort((a, b) => (a.typenaam < b.typenaam ? -1 : a.typenaam > b.typenaam ? 1 : 0));
}
