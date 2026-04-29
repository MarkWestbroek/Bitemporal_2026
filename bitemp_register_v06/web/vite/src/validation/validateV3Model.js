/**
 * Client-side V3-model validator — spiegelt de Go-codegen validatie in cmd/codegen/main.go.
 *
 * Kan zowel vanuit de IDE (IdePage) als de oude editor (MetamodelEditor) worden
 * aangeroepen vóórdat een model wordt gepubliceerd of naar rebuild wordt gestuurd.
 *
 * @param {object} v3 - een V3-model object (met entiteiten, enums, etc.)
 * @returns {{ errors: string[], warnings: string[] }}
 */

// ────────── Naamconventie-helpers (equivalent van Go counterparts) ──────────

function isIdentifierLike(s) {
  if (!s) return false;
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s);
}

function isPascalIdentifier(s) {
  if (!isIdentifierLike(s)) return false;
  return /^[A-Z]/.test(s);
}

function isSnakeLike(s) {
  if (!s) return false;
  return /^[a-z][a-z0-9_]*$/.test(s);
}

// ────────── Hoofdvalidatie ──────────

/**
 * @param {object} v3 - een V3-model object (met entiteiten, enums, etc.)
 * @param {string[]} [domeinFilter] - optioneel: valideer alleen entiteiten van deze domeinen.
 *   Leeg array of undefined = valideer alles.
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validateV3Model(v3, domeinFilter) {
  const errors = [];
  const warnings = [];
  const domeinSet = domeinFilter && domeinFilter.length > 0 ? new Set(domeinFilter) : null;

  if (!v3) {
    errors.push("Geen V3-model aanwezig.");
    return { errors, warnings };
  }

  // ── Versie ──
  if (!(v3.versie || "").trim()) {
    errors.push("model.versie is verplicht");
  }

  // ── Entiteiten ──
  if (!v3.entiteiten || v3.entiteiten.length === 0) {
    errors.push("Minimaal één entiteit vereist in model.entiteiten");
    return { errors, warnings };
  }

  // ── Enums ──
  const enumNamen = new Set();
  const constNamen = new Set();
  (v3.enums || []).forEach((en, i) => {
    const ctx = `enums[${i}]`;
    if (!isPascalIdentifier(en.goType)) {
      errors.push(`${ctx}.goType '${en.goType || ""}' is geen geldige Go-identifier; gebruik PascalCase zonder spaties (bijv. CGLaag i.p.v. CG laag)`);
    }
    if (enumNamen.has(en.goType)) {
      errors.push(`${ctx}.goType '${en.goType}' is een duplicaat`);
    }
    enumNamen.add(en.goType);

    (en.waarden || []).forEach((w, j) => {
      const wctx = `${ctx}.waarden[${j}]`;
      if (!isPascalIdentifier(w.constNaam)) {
        errors.push(`${wctx}.constNaam '${w.constNaam || ""}' is geen geldige Go-identifier`);
      }
      if (constNamen.has(w.constNaam)) {
        errors.push(`${wctx}.constNaam '${w.constNaam}' is een duplicaat (tip: maak elke constNaam uniek)`);
      }
      constNamen.add(w.constNaam);
    });
  });

  // ── Entiteiten + GE's + relaties ──
  const entiteitNamen = new Set();
  const datatypeNamen = new Set((v3.datatypes || []).map((dt) => dt?.naam).filter(Boolean));

  v3.entiteiten.forEach((ent, i) => {
    // Domein-filter: sla over als dit domein niet geselecteerd is
    if (domeinSet && ent.domein && !domeinSet.has(ent.domein)) return;

    const ctx = `${ent.typenaam || `entiteiten[${i}]`}`;

    if (!isPascalIdentifier(ent.typenaam)) {
      errors.push(`${ctx}: typenaam '${ent.typenaam || ""}' is ongeldig; gebruik PascalCase zonder spaties/koppeltekens (bijv. Persoon)`);
    }
    if (!isSnakeLike(ent.meervoud)) {
      errors.push(`${ctx}: meervoud '${ent.meervoud || ""}' is ongeldig; gebruik lowercase/snake_case (bijv. ${(ent.typenaam || "Persoon").toLowerCase()}en)`);
    }
    entiteitNamen.add(ent.typenaam);

    // GE's
    (ent.gegevenselementen || []).forEach((ge, j) => {
      const gctx = `${ctx}.${ge.naam || `gegevenselementen[${j}]`}`;
      if (!isPascalIdentifier(ge.naam)) {
        errors.push(`${gctx}.naam '${ge.naam || ""}' is ongeldig; gebruik PascalCase (bijv. Persoonsidentificatie of Naam)`);
      }
      if (!isSnakeLike(ge.meervoud)) {
        errors.push(`${gctx}.meervoud '${ge.meervoud || ""}' is ongeldig; gebruik lowercase/snake_case`);
      }
      if (ge.momentvoorkomen !== "enkelvoudig" && ge.momentvoorkomen !== "meervoudig") {
        errors.push(`${gctx}.momentvoorkomen '${ge.momentvoorkomen || ""}' is ongeldig; gebruik 'enkelvoudig' of 'meervoudig'`);
      }
      (ge.velden || []).forEach((v, k) => {
        const vctx = `${gctx}.velden[${k}]`;
        if (!isIdentifierLike(v.naam)) {
          errors.push(`${vctx}.naam '${v.naam || ""}' is ongeldig; gebruik letters/cijfers/underscore`);
        }
        if (v.enum && !enumNamen.has(v.enum)) {
          if (datatypeNamen.has(v.enum)) {
            warnings.push(`${vctx}.enum '${v.enum}' verwijst naar een datatype; gebruik alleen .datatype om wees-lijntjes te voorkomen`);
          } else {
            warnings.push(`${vctx}.enum '${v.enum}' verwijst niet naar een gedefinieerde enum`);
          }
        }
      });
      // Dubbele useEdges detecteren
      const geUseEdges = ge.useEdges || [];
      if (geUseEdges.length > 0) {
        const ueSeen = new Set();
        geUseEdges.forEach((ue) => {
          const key = JSON.stringify(ue);
          if (ueSeen.has(key)) {
            warnings.push(`${gctx}.useEdges bevat dubbele entry voor doel '${ue.doel}'`);
          }
          ueSeen.add(key);
        });
      }
    });

    // Relaties
    (ent.relaties || []).forEach((rel, j) => {
      const rctx = `${ctx}.${rel.naam || `relaties[${j}]`}`;
      if (!isPascalIdentifier(rel.naam)) {
        errors.push(`${rctx}.naam '${rel.naam || ""}' is ongeldig; gebruik PascalCase (underscore mag, bijv. Rel_Persoon_Adres)`);
      }
      if (!isSnakeLike(rel.meervoud)) {
        errors.push(`${rctx}.meervoud '${rel.meervoud || ""}' is ongeldig; gebruik lowercase/snake_case`);
      }
      if (rel.momentvoorkomen !== "enkelvoudig" && rel.momentvoorkomen !== "meervoudig") {
        errors.push(`${rctx}.momentvoorkomen '${rel.momentvoorkomen || ""}' is ongeldig; gebruik 'enkelvoudig' of 'meervoudig'`);
      }
      if (!rel.doelEntiteit) {
        errors.push(`${rctx}.doelEntiteit is verplicht`);
      }
      (rel.velden || []).forEach((v, k) => {
        const vctx = `${rctx}.velden[${k}]`;
        if (!isIdentifierLike(v.naam)) {
          errors.push(`${vctx}.naam '${v.naam || ""}' is ongeldig; gebruik letters/cijfers/underscore`);
        }
        if (v.enum && !enumNamen.has(v.enum)) {
          if (datatypeNamen.has(v.enum)) {
            warnings.push(`${vctx}.enum '${v.enum}' verwijst naar een datatype; gebruik alleen .datatype om wees-lijntjes te voorkomen`);
          } else {
            warnings.push(`${vctx}.enum '${v.enum}' verwijst niet naar een gedefinieerde enum`);
          }
        }
      });
      // Dubbele useEdges detecteren
      const relUseEdges = rel.useEdges || [];
      if (relUseEdges.length > 0) {
        const ueSeen = new Set();
        relUseEdges.forEach((ue) => {
          const key = JSON.stringify(ue);
          if (ueSeen.has(key)) {
            warnings.push(`${rctx}.useEdges bevat dubbele entry voor doel '${ue.doel}'`);
          }
          ueSeen.add(key);
        });
      }
    });
  });

  // ── Cross-referenties: doelEntiteit bestaat? ──
  v3.entiteiten.forEach((ent) => {
    // Zelfde domein-filter als hierboven
    if (domeinSet && ent.domein && !domeinSet.has(ent.domein)) return;
    (ent.relaties || []).forEach((rel) => {
      if (!rel.doelEntiteit) return;
      if (!entiteitNamen.has(rel.doelEntiteit)) {
        if (rel.relatieSubtype === "referentielijst_items") {
          warnings.push(`${ent.typenaam}.${rel.naam}.doelEntiteit '${rel.doelEntiteit}' is cross-domein (wordt niet gegenereerd)`);
        } else {
          errors.push(`${ent.typenaam}.${rel.naam}.doelEntiteit '${rel.doelEntiteit}' bestaat niet in model.entiteiten`);
        }
      }
    });
  });

  return { errors, warnings };
}
