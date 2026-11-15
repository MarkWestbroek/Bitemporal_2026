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
 * @param {{naam: string, beschrijving: string, illustratie?: string, plek?: "DiagramType"|"ElementType"}} info -
 *   `plek` (alleen hooks): op welke metaklasse het profiel de hook zet (standaard ElementType)
 */
export function registreerHandlerInfo(soort, id, info) {
  _handlers.set(sleutel(soort, id), info);
}

/**
 * De geregistreerde handlers van één soort, in registratievolgorde: `[{id, naam, beschrijving,
 * plek?}]`. Voor de hooks is dit de enumeratie HookSoort van het M3 (types/m3.js); de controletest
 * in render-svc (m3Dekking.test.mjs) eist dat elke hook die een profiel gebruikt hier staat.
 * @param {"hook"|"editor"|"resolver"} soort
 */
export function handlersVan(soort) {
  const voor = `${soort}:`;
  return [..._handlers].filter(([k]) => k.startsWith(voor)).map(([k, info]) => ({ id: k.slice(voor.length), ...info }));
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
    "Bepaalt de labels op een connector (kardinaliteiten, rolnamen, «stereotype»-teksten) uit de connector-data (en via ctx.elements eventueel uit bron/doel), per zijde en voor de kale gedaante.",
});
registreerHandlerInfo("hook", "naVerbinden", {
  naam: "Na verbinden",
  beschrijving:
    "Wordt aangeroepen zodra een verbinding op het canvas is getrokken: (connector, {s: store-state, diagramId, van, naar}) — van/naar = muispositie (flow-coördinaten) bij begin en eind van de sleep. Het profiel mag de verbinding afmaken — bv. een sequence-bericht van levenslijn naar levenslijn krijgt zijn punten op die hoogte.",
});
registreerHandlerInfo("hook", "magVerbinden", {
  naam: "Mag verbinden",
  beschrijving:
    "Beperkt een connectortype verder dan zijn verbindingsregels: (bronElement, doelElement) → false = deze verbinding niet. Bv. canoniek «gebruikt» naar een entiteit alleen als die een referentielijst-item is (subtype). Getoetst bij het trekken van een lijn (passendOpType).",
});
registreerHandlerInfo("hook", "eigenschapUit", {
  naam: "Eigenschap uit",
  beschrijving:
    "Zet een eigenschap in de inspector uit, met de reden: (element, key, {elements}) → tekst of null. Bv. canoniek: materieel en tijdprecisie bij een subtype ('de tijdlijn komt van de ouder').",
});
registreerHandlerInfo("hook", "naVerwijderen", {
  naam: "Na verwijderen",
  beschrijving:
    "Wordt aangeroepen nadat een element uit het model is verwijderd: (element, {s: store-state}). Het profiel ruimt wat het element bezat op — bv. de punten van een sequence-bericht die geen ander bericht meer gebruikt. Zit met het verwijderen in één undo-stap.",
});
registreerHandlerInfo("hook", "verschuifConnector", {
  naam: "Lijn verschuiven",
  beschrijving:
    "Maakt een connector verticaal versleepbaar op het canvas: (connector, dy, {elements, diagram}) → nieuwe posities per voorkomen-id (bv. sequence: beide punten mee, lijn horizontaal, berichten eronder wegduwen).",
});
registreerHandlerInfo("hook", "edgePresentatie", {
  naam: "Edge-presentatie (dynamisch)",
  beschrijving:
    "Vult de statische edgePresentatie aan op basis van connector-data (ctx.elements erbij) — bv. een pijlpunt zodra 'gericht/unidirectioneel' aan staat; mag ook sourceHandle/targetHandle/vorm voorstellen (sequence-zelfbericht: rechts eruit, hoekig, rechts erin).",
});
registreerHandlerInfo("hook", "hierarchieParen", {
  naam: "Hiërarchie-paren",
  plek: "DiagramType",
  beschrijving:
    "Levert extra ouder→kind-paren aan de elementen-boom, voor relaties die niet als connector-element bestaan (bv. gespiegelde composities).",
});
registreerHandlerInfo("hook", "migreerModel", {
  naam: "Model-migratie",
  plek: "DiagramType",
  beschrijving:
    "Brengt een opgeslagen (persistente) sandbox bij met de huidige profielvorm — bv. oude presentatie-edges omzetten naar connectoren. Idempotent; geeft null als er niets te doen is.",
});
registreerHandlerInfo("hook", "stereotype", {
  naam: "Stereotype (afgeleid)",
  beschrijving:
    "Leidt het stereotype op de node af uit element-data (bv. een subtype). undefined = opgeslagen stereotype gebruiken, lege string = het type-stereotype.",
});
registreerHandlerInfo("hook", "inhoudsregels", {
  naam: "Eigen inhoud",
  beschrijving: "Regels met eigen gegevens van dit type (bv. reqId en status), die de motor in het inhoudsvak van de vorm tekent.",
});
registreerHandlerInfo("hook", "naamWeergave", {
  naam: "Naamweergave",
  beschrijving:
    "De naam zoals de vorm hem toont als dat niet letterlijk de naam is (object: \"jan : Persoon\"). Lege string = geen naamregel; undefined = de gewone naam.",
});
registreerHandlerInfo("hook", "magVerbinden", {
  naam: "Mag verbinden",
  beschrijving:
    "Connector: (bron, doel) → false als deze verbinding niet mag, bovenop de verbindingsregels (bv. canoniek «gebruikt»: alleen naar een ref.lijst-item).",
});
registreerHandlerInfo("hook", "ontvangtDrop", {
  naam: "Ontvangt drop",
  beschrijving:
    "Een element uit de boom is op dit element gedropt: (element, ref = {profielId, elementId}, {updateElement}). Het profiel legt de band — bv. een sequence-levenslijn krijgt zo haar type.",
});
registreerHandlerInfo("hook", "eigenschapUit", {
  naam: "Eigenschap uit",
  beschrijving:
    "(element, key, {elements}) → reden of null: de inspector zet de eigenschap uit en toont de reden (bv. canoniek: een subtype krijgt zijn tijdlijn van de ouder).",
});
registreerHandlerInfo("hook", "afgeleideEigenschappen", {
  naam: "Afgeleide eigenschappen",
  beschrijving:
    "(element, {elements}) → [{key, label, waarde, uitleg?, inOndertitel?}]: alleen-lezen regels in de inspector, bv. het domein uit het package.",
});
registreerHandlerInfo("hook", "valideer", {
  naam: "Validatie",
  beschrijving: "Valideert element-data bij bewerking (profiel-eigen regels).",
});
