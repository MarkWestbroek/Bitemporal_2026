// @ts-check
/**
 * handlerCatalogus — namen en beschrijvingen voor het Implementation-domein
 * (P02): hooks, property-editors en reference-resolvers zijn code en dus
 * niet tekenbaar, maar wél benoembaar. De PE toont ze per elementtype in
 * het "implementatie"-compartiment; deze catalogus levert de leesbare naam
 * en beschrijving (en optioneel een illustratie, gereserveerd).
 *
 * Registratie is decentraal: de core registreert de generieke hook-soorten,
 * profielen registreren hun eigen resolvers/editors erbij. Zonder
 * registratie valt de PE terug op een generieke soort-beschrijving.
 */

const _handlers = new Map();

const sleutel = (soort, id) => `${soort}:${id}`;

/**
 * @param {"hook"|"editor"|"resolver"} soort
 * @param {string} id - hook-naam, editor-datatype of resolver-id
 * @param {{naam: string, beschrijving: string, illustratie?: string}} info
 */
export function registreerHandlerInfo(soort, id, info) {
  _handlers.set(sleutel(soort, id), info);
}

const SOORT_FALLBACK = {
  hook: (id) => ({
    naam: id,
    beschrijving: `Code-hook "${id}" op dit type (Implementation-domein; zie de descriptor).`,
  }),
  editor: (id) => ({
    naam: id,
    beschrijving: `Eigen PropertyTypeEditor voor het datatype "${id}".`,
  }),
  resolver: (id) => ({
    naam: id,
    beschrijving: `ReferenceResolver "${id}": levert de keuzekandidaten voor verwijzings-properties.`,
  }),
};

/**
 * Info voor een handler; altijd een resultaat (fallback per soort).
 * @param {"hook"|"editor"|"resolver"} soort
 * @param {string} id
 */
export function handlerInfo(soort, id) {
  return _handlers.get(sleutel(soort, id)) || SOORT_FALLBACK[soort]?.(id) || { naam: id, beschrijving: "" };
}

// ── Basisregistraties: de generieke core-hooks ─────────────────────────────
registreerHandlerInfo("hook", "extraCompartimenten", {
  naam: "Extra compartimenten",
  beschrijving:
    "Berekent weergave-compartimenten uit element-data of het model — bv. de operatie-signatuur (OAS) of overgeërfde velden (canoniek). Alleen-lezen; wordt nooit opgeslagen.",
});
registreerHandlerInfo("hook", "edgeLabels", {
  naam: "Edge-labels",
  beschrijving:
    "Bepaalt de labels op een connector (kardinaliteiten, rolnamen, «stereotype»-teksten) uit de connector-data, per zijde en voor de kale gedaante.",
});
registreerHandlerInfo("hook", "edgePresentatie", {
  naam: "Edge-presentatie (dynamisch)",
  beschrijving:
    "Vult de statische edgePresentatie aan op basis van connector-data — bv. een pijlpunt zodra 'gericht/unidirectioneel' aan staat.",
});
registreerHandlerInfo("hook", "hierarchieParen", {
  naam: "Hiërarchie-paren",
  beschrijving:
    "Levert extra ouder→kind-paren aan de elementen-boom, voor relaties die niet als connector-element bestaan (bv. gespiegelde composities).",
});
registreerHandlerInfo("hook", "valideer", {
  naam: "Validatie",
  beschrijving: "Valideert element-data bij bewerking (profiel-eigen regels).",
});
