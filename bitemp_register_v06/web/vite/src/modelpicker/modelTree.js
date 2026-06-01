/**
 * modelTree.js — pure helpers die de platte types-lijst van /api/schema/model/code
 * omzetten naar een hiërarchie Domein → Entiteit → GE/Relatie → Veld, plus de
 * FieldRef-structuur die de ModelPicker naar buiten emit.
 *
 * Een FieldRef is de verwijzing naar één veld in het canoniek model (zie
 * process_engine_v01/docs/driehoek-proces-regels-data.md):
 *
 *   {
 *     typenaam,        // type dat het veld bezit (bv. "NP_Naam_Data")
 *     veldnaam,        // JSON-veldnaam (bv. "achternaam")
 *     veldpad,         // "Entiteit.rol.veldnaam" voor lineage/leesbaarheid
 *     entiteit,        // bovenliggende entiteit-typenaam (bv. "NatuurlijkPersoon")
 *     datatype,        // custom datatype (bv. "BSN") of ""
 *     type,            // OAS-type (string|integer|...)
 *     format,          // OAS-format (date|email|...)
 *     enum,            // toegestane waarden of []
 *     afgeleid,        // true bij afgeleid veld
 *     tDimensie,       // "formeel" | "materieel"
 *   }
 */

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normDomein(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw || "(zonder domein)";
}

/** Bouw een FieldRef uit een veld-DTO. */
export function maakFieldRef({ veld, ownerTypenaam, entiteitTypenaam, rol, afgeleid, tDimensie }) {
  const veldnaam = veld?.naam || "";
  const padDelen = [entiteitTypenaam || ownerTypenaam, rol, veldnaam].filter(Boolean);
  return {
    typenaam: ownerTypenaam,
    veldnaam,
    veldpad: padDelen.join("."),
    entiteit: entiteitTypenaam || ownerTypenaam,
    datatype: veld?.datatype || "",
    type: veld?.type || "",
    format: veld?.format || "",
    enum: safeArray(veld?.enum),
    ref: veld?.ref || "",
    afgeleid: Boolean(afgeleid),
    tDimensie: tDimensie || "formeel",
  };
}

/** Stabiele sleutel voor een FieldRef (voor selectie-vergelijking). */
export function fieldRefKey(ref) {
  if (!ref) return "";
  return `${ref.typenaam}::${ref.veldnaam}`;
}

/**
 * bouwModelTree — zet de platte types om naar een geneste boom.
 *
 * @param {Array} types          platte types van /api/schema/model/code
 * @param {object} opties
 * @param {boolean} opties.includeAfgeleid  neem afgeleide velden mee (default true)
 * @param {string} opties.tDimensie         "formeel" | "materieel" voor emitted refs
 * @returns {Array} domeinen: [{ naam, entiteiten: [{ type, velden, kinderen }] }]
 */
export function bouwModelTree(types, { includeAfgeleid = true, tDimensie = "formeel", hiddenDomains = [] } = {}) {
  const verborgen = new Set(safeArray(hiddenDomains).map(normDomein));
  const lijst = safeArray(types);
  const byTypenaam = new Map();
  lijst.forEach((t) => {
    if (t?.typenaam) byTypenaam.set(t.typenaam, t);
  });

  // Velden + afgeleide velden van één type → FieldRef-knopen.
  const veldKnopenVan = (type, { entiteitTypenaam, rol }) => {
    const knopen = [];
    safeArray(type?.velden).forEach((veld) => {
      knopen.push({
        kind: "veld",
        ref: maakFieldRef({ veld, ownerTypenaam: type.typenaam, entiteitTypenaam, rol, afgeleid: false, tDimensie }),
      });
    });
    if (includeAfgeleid) {
      safeArray(type?.afgeleideVelden).forEach((av) => {
        knopen.push({
          kind: "veld",
          ref: maakFieldRef({
            veld: { naam: av.naam, type: av.goType, description: av.description },
            ownerTypenaam: type.typenaam,
            entiteitTypenaam,
            rol,
            afgeleid: true,
            tDimensie,
          }),
          afleidingsregel: av.afleidingsregel || "",
          afleidingsregelTaal: av.afleidingsregelTaal || "",
        });
      });
    }
    return knopen;
  };

  const domeinen = new Map();
  const ontvang = (naam) => {
    const key = normDomein(naam);
    if (!domeinen.has(key)) domeinen.set(key, { naam: key, entiteiten: [] });
    return domeinen.get(key);
  };

  lijst
    .filter((t) => t?.metatype === "entiteit")
    .forEach((ent) => {
      if (verborgen.has(normDomein(ent.domein))) return;
      const kinderen = [];
      // Onderliggende GE's/relaties resolven naar hun type-DTO.
      safeArray(ent.onderliggende).forEach((child) => {
        const childType = byTypenaam.get(child.doeltype);
        if (!childType) return;
        kinderen.push({
          kind: "ge",
          rol: child.jsonRolnaam || child.rolnaam || child.doeltype,
          jsonRolnaam: child.jsonRolnaam || "",
          momentvoorkomen: child.momentvoorkomen || "",
          metatype: childType.metatype,
          type: childType,
          velden: veldKnopenVan(childType, {
            entiteitTypenaam: ent.typenaam,
            rol: child.jsonRolnaam || child.rolnaam,
          }),
        });
      });

      ontvang(ent.domein).entiteiten.push({
        kind: "entiteit",
        type: ent,
        // Eigen velden van de entiteit zelf (zeldzaam, maar mogelijk).
        velden: veldKnopenVan(ent, { entiteitTypenaam: ent.typenaam, rol: "" }),
        kinderen,
      });
    });

  // Sorteer domeinen en entiteiten alfabetisch (Nederlands).
  const cmp = (a, b) => String(a).localeCompare(String(b), "nl", { sensitivity: "base", numeric: true });
  const result = [...domeinen.values()].sort((a, b) => cmp(a.naam, b.naam));
  result.forEach((d) => d.entiteiten.sort((a, b) => cmp(a.type.typenaam, b.type.typenaam)));
  return result;
}

/**
 * filterTree — verwijdert takken die niet matchen met de zoekterm.
 * Match op entiteit-, GE- en veldnaam (case-insensitive).
 */
export function filterTree(domeinen, zoekterm) {
  const q = String(zoekterm || "").trim().toLowerCase();
  if (!q) return domeinen;

  const veldMatch = (knoop) =>
    knoop.ref.veldnaam.toLowerCase().includes(q) ||
    knoop.ref.veldpad.toLowerCase().includes(q) ||
    (knoop.ref.datatype || "").toLowerCase().includes(q);

  return safeArray(domeinen)
    .map((d) => {
      const entiteiten = safeArray(d.entiteiten)
        .map((ent) => {
          const entMatch = ent.type.typenaam.toLowerCase().includes(q);
          const eigenVelden = ent.velden.filter(veldMatch);
          const kinderen = safeArray(ent.kinderen)
            .map((ge) => {
              const geMatch =
                ge.rol.toLowerCase().includes(q) || ge.type.typenaam.toLowerCase().includes(q);
              const velden = geMatch ? ge.velden : ge.velden.filter(veldMatch);
              if (geMatch || velden.length > 0) return { ...ge, velden };
              return null;
            })
            .filter(Boolean);
          if (entMatch || eigenVelden.length > 0 || kinderen.length > 0) {
            return {
              ...ent,
              velden: entMatch ? ent.velden : eigenVelden,
              kinderen: entMatch ? ent.kinderen : kinderen,
            };
          }
          return null;
        })
        .filter(Boolean);
      return entiteiten.length > 0 ? { ...d, entiteiten } : null;
    })
    .filter(Boolean);
}
