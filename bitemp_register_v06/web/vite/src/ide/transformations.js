/**
 * transformations.js — IDE-bewerkingen op het metamodel.
 *
 * Pure transformatie-functies die werken op een snapshot van de store
 * ({ elements, structuralEdges }) en een patch teruggeven van wat moet
 * veranderen, samen met `warnings` en (optioneel) `errors`.
 *
 * Dit ontwerp houdt de logica triviaal testbaar (zonder store / DOM /
 * React) en laat de UI-laag de patch via `useModelStore.setState` of
 * gerichte actions toepassen.
 *
 * Beschikbare bewerkingen:
 *   - castEntiteitNaarGE  (B5): bouw een entiteit om tot gegevenselement
 *                              onder een gekozen parent-entiteit.
 *   - splitsEntiteit       (B6): trek geselecteerde velden uit een entiteit
 *                              naar nieuwe GE's onder die entiteit.
 *   - relatieNaarAssociatieklasse (B7): vervang een directe ENT→ENT edge door
 *                              ENT → relatie-element → ENT (klaar voor velden).
 *
 * Convention voor returnwaarde:
 *   {
 *     ok: boolean,
 *     warnings: string[],
 *     errors: string[],
 *     elements: Record<id, element>,        // volledig vervangen elementen-map
 *     structuralEdges: Edge[],              // volledig vervangen edges-array
 *     newIds?: string[],                    // ids van nieuw aangemaakte elementen
 *     removedIds?: string[],                // ids van verwijderde elementen
 *   }
 *
 * De caller mag bij `ok === false` de patch negeren.
 */

import { generateId, defaultKleur } from "../umleditor/metamodel/types.js";

// =====================================================================
// Hulpfuncties
// =====================================================================

/** Maak een veilige PascalCase naam (alleen letters/cijfers, eerste letter hoofdletter). */
export function pascalCase(s, fallback = "Naam") {
  const cleaned = String(s || "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join("");
  return cleaned || fallback;
}

function naamVan(el) {
  return el?.data?.typenaam || el?.naam || el?.id || "";
}

// Robuust: top-level `metatype`, `data.metatype` of `type` accepteren.
// Verschillende importpaden (V3, raw-editor) zetten het veld op
// verschillende plekken; deze helper normaliseert dat.
function metatypeVan(el) {
  return el?.metatype || el?.data?.metatype || el?.type || "";
}
function isEntiteit(el) { return metatypeVan(el) === "entiteit"; }
function isGE(el) { return metatypeVan(el) === "gegevenselement"; }
function isRelatie(el) { return metatypeVan(el) === "relatie"; }

// =====================================================================
// B5: ENT → GE cast
// =====================================================================

/**
 * Bouw een entiteit om tot gegevenselement onder een gekozen parent-entiteit.
 *
 * Regels:
 * - `entId` moet een entiteit zijn die GEEN andere entiteit-children
 *   heeft die zelf relaties dragen (warning bij twijfel, geen error).
 * - `parentEntId` moet een (andere) entiteit zijn.
 * - Inkomende compositie-edges van andere entiteiten worden vervangen door
 *   ÉÉN compositie-edge `parentEntId → entId`.
 * - Uitgaande edges naar entiteiten/relaties worden verwijderd
 *   (een GE heeft geen eigen relaties); dit levert warnings op.
 * - Edges naar andere GE's onder de oude entiteit blijven bestaan
 *   (dat zijn velden/sub-GE's die mee verhuizen) en krijgen een warning.
 *
 * @param {{elements: object, structuralEdges: any[]}} state
 * @param {string} entId
 * @param {string} parentEntId
 * @param {object} [opts]
 * @returns {object} patch + warnings/errors
 */
export function castEntiteitNaarGE(state, entId, parentEntId, opts = {}) {
  const warnings = [];
  const errors = [];
  const ent = state.elements?.[entId];
  const parent = state.elements?.[parentEntId];

  if (!ent) errors.push(`Element ${entId} niet gevonden.`);
  else if (!isEntiteit(ent)) errors.push(`Element ${entId} is geen entiteit (metatype=${ent.metatype}).`);
  if (!parent) errors.push(`Parent-entiteit ${parentEntId} niet gevonden.`);
  else if (!isEntiteit(parent)) errors.push(`Element ${parentEntId} is geen entiteit (metatype=${parent.metatype}).`);
  if (entId === parentEntId) errors.push("Entiteit kan geen GE worden onder zichzelf.");
  if (errors.length) return { ok: false, errors, warnings, elements: state.elements, structuralEdges: state.structuralEdges };

  const edges = state.structuralEdges || [];
  const elements = state.elements || {};

  // 1. Nieuwe element-map: ent wordt GE
  const nieuweEnt = {
    ...ent,
    metatype: "gegevenselement",
    domein: parent.domein || ent.domein || "",
    kleur: defaultKleur("gegevenselement"),
    data: {
      ...(ent.data || {}),
      // GE-naam-conventie: parent-typenaam als prefix als hij er nog niet bij staat
      // Laat naam ongemoeid; gebruiker kan hernoemen.
    },
  };
  if (nieuweEnt.domein !== ent.domein && ent.domein) {
    warnings.push(`Domein gewijzigd van "${ent.domein}" naar "${parent.domein}" om bij parent te passen.`);
  }
  const nieuweElements = { ...elements, [entId]: nieuweEnt };

  // 2. Edges herschrijven
  /** @type {any[]} */
  const nieuweEdges = [];
  let parentCompositieToegevoegd = false;

  for (const edge of edges) {
    const srcEl = elements[edge.source];
    const tgtEl = elements[edge.target];

    // Edge → entId (inkomend)
    if (edge.target === entId) {
      if (edge.source === parentEntId) {
        // Bestaande edge van parent → ent: mag blijven, dient als compositie.
        nieuweEdges.push(edge);
        parentCompositieToegevoegd = true;
      } else if (isEntiteit(srcEl)) {
        // Andere entiteit had ent als compositie/associatie. Verwijderen.
        warnings.push(`Inkomende edge van ${naamVan(srcEl)} naar ${naamVan(ent)} is verwijderd; ${naamVan(ent)} hangt nu onder ${naamVan(parent)}.`);
        // niet toevoegen
      } else {
        // Bron is GE/relatie/onbekend — laat staan met warning
        nieuweEdges.push(edge);
        warnings.push(`Inkomende edge van ${naamVan(srcEl) || edge.source} naar ${naamVan(ent)} is behouden; controleer of dit nog klopt.`);
      }
      continue;
    }

    // Edge entId → ... (uitgaand)
    if (edge.source === entId) {
      if (isEntiteit(tgtEl) || isRelatie(tgtEl)) {
        warnings.push(`Uitgaande edge van ${naamVan(ent)} naar ${naamVan(tgtEl) || edge.target} is verwijderd; een GE heeft geen eigen relaties.`);
        // niet toevoegen
      } else {
        // GE → GE blijft (sub-velden)
        nieuweEdges.push(edge);
      }
      continue;
    }

    nieuweEdges.push(edge);
  }

  // 3. Voeg compositie parent → ent toe als die nog niet bestond
  if (!parentCompositieToegevoegd) {
    nieuweEdges.push({
      id: generateId("edge"),
      source: parentEntId,
      target: entId,
      sourceHandle: null,
      targetHandle: null,
      data: {
        rolnaam: "",
        jsonRolnaam: pascalCase(naamVan(ent)).toLowerCase(),
        momentvoorkomen: opts.momentvoorkomen || "enkelvoudig",
        kardinaliteit: opts.kardinaliteit || "0..1",
      },
    });
  }

  return {
    ok: true,
    warnings,
    errors,
    elements: nieuweElements,
    structuralEdges: nieuweEdges,
    newIds: [],
    removedIds: [],
  };
}

// =====================================================================
// B6: ENT splitsen in ENT + losse GE's
// =====================================================================

/**
 * Trek geselecteerde velden uit een entiteit en maak gegevenselementen onder
 * die entiteit. De oorspronkelijke entiteit behoudt de overige velden.
 *
 * Aanroep-varianten:
 *   splitsEntiteit(state, entId, veldNamen)
 *     - veldNamen: string[]  → elk veld krijgt een GE: `${entTypenaam}_${PascalCase(veld)}`
 *
 *   splitsEntiteit(state, entId, veldNamen, geNaamPerVeld)
 *     - geNaamPerVeld: {[veldNaam]: string}  → per-veld GE-naam opgeven
 *     - Velden met dezelfde GE-naam worden gegroepeerd in één GE.
 *     - Lege GE-naam = veld NIET splitsen.
 *     - Veldnamen die niet in geNaamPerVeld staan krijgen de automatische naam.
 *
 * Per GE:
 *  - Maak GE-element met de opgegeven naam, `velden = [...]`, domein = ent.domein.
 *  - Voeg compositie-edge ent → newGE toe (momentvoorkomen "enkelvoudig").
 *  - Verwijder de velden uit ent.velden.
 *
 * @param {{elements: object, structuralEdges: any[]}} state
 * @param {string} entId
 * @param {string[]} veldNamen
 * @param {{[veldNaam: string]: string}} [geNaamPerVeld] - optionele GE-naam per veld
 * @returns {object} patch + warnings
 */
export function splitsEntiteit(state, entId, veldNamen = [], geNaamPerVeld = null) {
  const warnings = [];
  const errors = [];
  const ent = state.elements?.[entId];

  if (!ent) errors.push(`Entiteit ${entId} niet gevonden.`);
  else if (!isEntiteit(ent)) errors.push(`Element ${entId} is geen entiteit.`);
  if (!Array.isArray(veldNamen) || veldNamen.length === 0)
    errors.push("Selecteer ten minste één veld om uit te splitsen.");
  if (errors.length) return { ok: false, errors, warnings, elements: state.elements, structuralEdges: state.structuralEdges };

  const huidigeVelden = ent.data?.velden || [];
  const teSplitsen = [];
  const overgebleven = [];
  for (const v of huidigeVelden) {
    if (veldNamen.includes(v.naam)) teSplitsen.push(v);
    else overgebleven.push(v);
  }
  for (const naam of veldNamen) {
    if (!teSplitsen.some((v) => v.naam === naam)) {
      warnings.push(`Veld "${naam}" niet gevonden op ${naamVan(ent)} — overgeslagen.`);
    }
  }
  if (teSplitsen.length === 0) {
    return { ok: false, errors: ["Geen geldige velden geselecteerd."], warnings, elements: state.elements, structuralEdges: state.structuralEdges };
  }

  const entTypenaam = naamVan(ent);
  const nieuweElements = { ...state.elements };
  const nieuweEdges = [...(state.structuralEdges || [])];
  const newIds = [];

  // Groepeer velden per GE-naam.
  // Als geNaamPerVeld is meegegeven: gebruik die naam; leeg = skip.
  // Velden zonder expliciete GE-naam krijgen de automatische naam.
  const geGroepen = new Map(); // geNaam → veld[]
  const werkelijkOvergebleven = [...overgebleven]; // velden die niet gesplitst worden

  for (const veld of teSplitsen) {
    let geNaam;
    if (geNaamPerVeld !== null) {
      const opgegeven = geNaamPerVeld[veld.naam];
      if (opgegeven === "" || opgegeven === undefined || opgegeven === null) {
        // Lege naam = niet splitsen, veld blijft op entiteit
        werkelijkOvergebleven.push(veld);
        continue;
      }
      geNaam = opgegeven.trim();
    } else {
      geNaam = `${entTypenaam}_${pascalCase(veld.naam, "Veld")}`;
    }
    if (!geGroepen.has(geNaam)) geGroepen.set(geNaam, []);
    geGroepen.get(geNaam).push(veld);
  }

  if (geGroepen.size === 0) {
    return { ok: false, errors: ["Geen geldige velden geselecteerd."], warnings, elements: nieuweElements, structuralEdges: nieuweEdges };
  }

  for (const [geNaam, velden] of geGroepen) {
    const geId = generateId("ge");
    // Korte weergavenaam: strip de entiteit-prefix als die aanwezig is.
    // bijv. "Contactmoment_Status" → "Status" (wat de gebruiker op het canvas ziet)
    const klassenaam = (entTypenaam && geNaam.startsWith(entTypenaam + "_"))
      ? geNaam.slice(entTypenaam.length + 1)
      : geNaam;
    const ge = {
      id: geId,
      naam: geNaam,
      type: "gegevenselement",
      domein: ent.domein || "",
      kleur: defaultKleur("gegevenselement"),
      data: {
        typenaam: geNaam,
        klassenaam,
        metatype: "gegevenselement",
        meervoud: `${geNaam}en`,
        description: velden[0]?.description || "",
        velden: velden.map((v) => ({ ...v })),
        afgeleideVelden: [],
        isMaterieel: false,
      },
    };
    nieuweElements[geId] = ge;
    newIds.push(geId);

    nieuweEdges.push({
      id: generateId("edge"),
      source: entId,
      target: geId,
      sourceHandle: null,
      targetHandle: null,
      data: {
        rolnaam: "",
        jsonRolnaam: geNaam.toLowerCase(),
        momentvoorkomen: "enkelvoudig",
        kardinaliteit: velden.every((v) => v.verplicht !== false) ? "1" : "0..1",
      },
    });
  }

  // Update entiteit met overgebleven velden (incl. eventuele ge-naam=leeg velden)
  nieuweElements[entId] = {
    ...ent,
    data: {
      ...(ent.data || {}),
      velden: werkelijkOvergebleven,
    },
  };

  return {
    ok: true,
    warnings,
    errors,
    elements: nieuweElements,
    structuralEdges: nieuweEdges,
    newIds,
    removedIds: [],
  };
}

// =====================================================================
// B7: ENT↔ENT relatie → associatieklasse
// =====================================================================

/**
 * Vervang een directe edge tussen twee entiteiten door:
 *   ENT(bron) → relatie-element → ENT(doel)
 *
 * Het nieuwe relatie-element start zonder eigen velden (collapsed-vorm).
 * Zodra de gebruiker een veld toevoegt, schakelt de visualisatie automatisch
 * over naar de ASOC-vorm (anker + class-link), via `relatieVorm()` in
 * `shared/asoc.js`.
 *
 * @param {{elements: object, structuralEdges: any[]}} state
 * @param {string} edgeId — de bestaande directe edge ENT→ENT
 * @param {object} [opts]
 *    - relatieNaam?: string  (default: `Rel_${BronTypenaam}_${DoelTypenaam}`)
 *    - directioneel?: boolean
 * @returns {object} patch + warnings
 */
export function relatieNaarAssociatieklasse(state, edgeId, opts = {}) {
  const warnings = [];
  const errors = [];
  const edge = (state.structuralEdges || []).find((e) => e.id === edgeId);
  if (!edge) errors.push(`Edge ${edgeId} niet gevonden.`);
  if (errors.length) return { ok: false, errors, warnings, elements: state.elements, structuralEdges: state.structuralEdges };

  const bron = state.elements?.[edge.source];
  const doel = state.elements?.[edge.target];
  if (!isEntiteit(bron)) errors.push(`Bron van edge is geen entiteit (${bron?.metatype || "onbekend"}).`);
  if (!isEntiteit(doel)) errors.push(`Doel van edge is geen entiteit (${doel?.metatype || "onbekend"}).`);
  if (errors.length) return { ok: false, errors, warnings, elements: state.elements, structuralEdges: state.structuralEdges };

  const bronNaam = pascalCase(naamVan(bron), "Bron");
  const doelNaam = pascalCase(naamVan(doel), "Doel");
  const relNaam = opts.relatieNaam || `Rel_${bronNaam}_${doelNaam}`;
  const relId = generateId("relatie");

  const relElement = {
    id: relId,
    naam: relNaam,
    metatype: "relatie",
    domein: bron.domein || doel.domein || "",
    kleur: defaultKleur("relatie"),
    data: {
      typenaam: relNaam,
      klassenaam: relNaam,
      meervoud: `${relNaam}en`,
      description: edge.data?.description || "",
      doelEntiteit: naamVan(doel),
      directioneel: opts.directioneel ?? edge.data?.directioneel ?? false,
      velden: [],
      afgeleideVelden: [],
      isMaterieel: false,
    },
  };

  const nieuweElements = { ...state.elements, [relId]: relElement };

  // Twee nieuwe edges: bron → rel, rel → doel
  const ownerEdge = {
    id: generateId("edge"),
    source: edge.source,
    target: relId,
    sourceHandle: edge.sourceHandle || null,
    targetHandle: null,
    data: {
      rolnaam: edge.data?.rolnaam || "",
      jsonRolnaam: relNaam.toLowerCase(),
      momentvoorkomen: edge.data?.momentvoorkomen || "meervoudig",
      kardinaliteit: edge.data?.kardinaliteit || "0..*",
    },
  };
  const doelEdge = {
    id: generateId("edge"),
    source: relId,
    target: edge.target,
    sourceHandle: null,
    targetHandle: edge.targetHandle || null,
    data: {
      rolnaam: edge.data?.doelRolnaam || "",
      jsonRolnaam: doelNaam.toLowerCase(),
      momentvoorkomen: "meervoudig",
      kardinaliteit: "0..*",
    },
  };

  const nieuweEdges = (state.structuralEdges || [])
    .filter((e) => e.id !== edgeId)
    .concat([ownerEdge, doelEdge]);

  warnings.push(`Directe edge ${naamVan(bron)}→${naamVan(doel)} is vervangen door associatieklasse "${relNaam}". Voeg velden toe om de ASOC-vorm te activeren.`);

  return {
    ok: true,
    warnings,
    errors,
    elements: nieuweElements,
    structuralEdges: nieuweEdges,
    newIds: [relId],
    removedIds: [],
  };
}

// =====================================================================
// Store-wrapper helpers (gebruikt door UI)
// =====================================================================

/**
 * Pas een transformatie-resultaat toe op de zustand-store.
 * Verwacht een geladen `useModelStore` (lazy import om circulaire deps
 * te vermijden bij testen).
 */
export function passToePatch(useModelStore, patch) {
  if (!patch?.ok) return false;
  useModelStore.setState((state) => ({
    ...state,
    isDirty: true,
    elements: patch.elements,
    structuralEdges: patch.structuralEdges,
  }));
  return true;
}
