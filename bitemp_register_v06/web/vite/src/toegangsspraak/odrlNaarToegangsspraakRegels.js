// @ts-check
/**
 * odrlNaarToegangsspraakRegels — de **regelset** "ODRL (ODRL-AP-NL) → Toegangsspraak".
 *
 * Het spiegelbeeld van `odrlApNlRegels.js`: wat elk onderdeel van een ODRL-
 * beleid (de brongraaf uit `transformatie/rdfBrongraaf.js`) in de begrippen van
 * Toegangsspraak is. Het doel-`type` is de `aard` uit het graafbeeld van de
 * export (`graaf.js`): beleid, regel, handeling, partij, gegevensbegrip,
 * registerdeel, voorwaarde, voorwaardegroep, plicht, grondslag, doel, term.
 * Een verbinding krijgt de aard van daar: regel, doet, wie, wat, als, lid, …
 *
 * Een regel toetst op `klasse` (rdf:type) en op de waarde van een predicaat
 * (`"rdf:value": "odrl:read"`); een sjabloon leest de getypeerde waarde
 * (`"{odrl.rightOperand}"`). Het filter `lokaal` haalt het woord uit een term
 * (`ts:exporteren` → exporteren).
 *
 * Waar de export een woord van ODRL koos, kiest deze regelset het woord van
 * Toegangsspraak terug: `odrl:read` is bekijken, `odrl:purpose` het doel van de
 * aanvraag, `apnl:rolAanvrager` de rol van de aanvrager.
 *
 * **ODRL van anderen** (versie 2). De regelset leest ook wat een ander volgens
 * ODRL-AP-NL schrijft, voor zover Toegangsspraak het kan zeggen:
 *
 *   - een handeling of voorwaarde als lege knoop zonder rdf:type
 *     (`odrl:action [ rdf:value odrl:read ; odrl:refinement … ]`);
 *   - verwante handelingen van ODRL (`odrl:display`, `odrl:use`,
 *     `odrl:distribute`) als het naaste woord van de taal — met `meld`, want dat
 *     is een interpretatie;
 *   - een operand uit een ander vocabulaire (`vlierdam:zoektype`): de bouwer
 *     leest hem als kenmerk van de aanvraag of de aanvrager;
 *   - een partij (`odrl:Party`) en een asset zonder pad in een register;
 *   - het anker naar de uitvoering (`apnl:verwerkingsverzoek`): dat is
 *     realisatie, geen norm, en valt bewust weg.
 *
 * Wat hier geen regel heeft komt in de trace als "geen-regel": dat is het
 * verliesrapport van de import. Wat wél een regel heeft maar niet in de taal
 * past (een vergelijking die Toegangsspraak niet kent, een plicht op het
 * beleid) meldt de bouwer `odrlNaarBeleid.js`. Daar staat ook hoe het plan een
 * beleid in klare taal wordt.
 */

/**
 * Handelingen van ODRL in het woord van Toegangsspraak. `exact`: hetzelfde
 * begrip (de export schrijft het zo). Anders is het het naaste woord en dus
 * een interpretatie; `ruim` als het ODRL-woord meer omvat dan het woord van de
 * taal (`odrl:use` is elk gebruik) — een verbod daarop is dan niet te vertalen.
 */
export const HANDELINGEN = [
  { odrl: "odrl:read", woord: "bekijken", exact: true },
  { odrl: "odrl:modify", woord: "veranderen", exact: true },
  { odrl: "odrl:delete", woord: "afvoeren", exact: true },
  { odrl: "odrl:display", woord: "bekijken" },
  { odrl: "odrl:present", woord: "bekijken" },
  { odrl: "odrl:use", woord: "bekijken", ruim: true },
  { odrl: "odrl:distribute", woord: "exporteren" },
  { odrl: "odrl:extract", woord: "exporteren" },
  { odrl: "odrl:reproduce", woord: "exporteren" },
];

/** Een handeling als IRI (compact) → het woord van de taal, of null. Voor `odrl:action odrl:read` zonder eigen knoop. */
export function woordVoorHandeling(iri) {
  const s = String(iri || "");
  const bekend = HANDELINGEN.find((h) => h.odrl === s);
  if (bekend) return bekend;
  return s.startsWith("ts:") ? { odrl: s, woord: s.slice(3), exact: true } : null;
}

const voorwaarde = (naam, links, data) => ({
  naam,
  bij: "knoop",
  // Geen toets op klasse: een voorwaarde is vaak een lege knoop zonder rdf:type.
  als: { "odrl:leftOperand": links },
  maak: { type: "voorwaarde", data: { ...data, operator: "{odrl.operator|lokaal}", operatorIri: "{odrl.operator}", waarde: "{odrl.rightOperand}" } },
});

const handeling = ({ odrl, woord, exact, ruim }) => ({
  naam: `Handeling: ${woord}${exact ? "" : ` (${odrl})`}`,
  bij: "knoop",
  // Geen toets op klasse: de knoop met rdf:value is vaak een lege knoop zonder rdf:type.
  als: { "rdf:value": odrl },
  maak: { type: "handeling", naam: "", data: { actie: woord, bron: odrl, ruim: ruim ? "ja" : "" } },
  ...(exact ? {} : { meld: true }),
});

const groep = (predicaat) => ({
  naam: `Voorwaardegroep zonder type (${predicaat})`,
  bij: "knoop",
  als: { [predicaat]: { leeg: false } },
  maak: { type: "voorwaardegroep" },
});

export const ODRL_AP_NL_NAAR_TOEGANGSSPRAAK = {
  id: "odrl-ap-nl-naar-toegangsspraak",
  versie: 2,
  titel: "ODRL (ODRL-AP-NL) → Toegangsspraak",
  bron: "odrl-ap-nl",
  doel: "toegangsspraak",
  regels: [
    // ── Het beleid ──────────────────────────────────────────────────────────
    {
      naam: "Beleid",
      bij: "knoop",
      als: { klasse: ["odrl:Set", "odrl:Policy", "odrl:Agreement", "odrl:Offer", "odrl:Request"] },
      maak: {
        type: "beleid",
        data: { geldigVanaf: "{schema.validFrom}", geldigTot: "{schema.validThrough}", uitgegeven: "{dct.issued}", brontekst: "{ts.brontekst}", profiel: "{odrl.profile}" },
      },
    },
    { naam: "Grondslag", bij: "knoop", als: { klasse: "dct:LegalResource" }, maak: { type: "grondslag" } },

    // ── Regels ──────────────────────────────────────────────────────────────
    // `handeling`: de handeling als IRI, voor een regel zonder eigen handelingsknoop (odrl:action odrl:read).
    { naam: "Toestemming", bij: "knoop", als: { klasse: "odrl:Permission" }, maak: { type: "regel", data: { modaliteit: "mag", zin: "{dct.description}", volgorde: "{ts.volgorde}", handeling: "{odrl.action}" } } },
    { naam: "Verbod", bij: "knoop", als: { klasse: "odrl:Prohibition" }, maak: { type: "regel", data: { modaliteit: "mag-niet", zin: "{dct.description}", volgorde: "{ts.volgorde}", handeling: "{odrl.action}" } } },

    // De handeling per regel is de knoop met rdf:value; woorden die ODRL kent eerst.
    ...HANDELINGEN.map(handeling),
    { naam: "Handeling (eigen woord)", bij: "knoop", als: { "rdf:value": { patroon: "^ts:" } }, maak: { type: "handeling", naam: "", data: { actie: "{rdf.value|lokaal}", bron: "{rdf.value}" } } },
    // Een handeling die de taal niet kent: wel een knoop, zodat de bouwer kan zeggen welke regel erdoor wegvalt.
    { naam: "Handeling die Toegangsspraak niet kent", bij: "knoop", als: { "rdf:value": { leeg: false } }, maak: { type: "handeling", naam: "", data: { actie: "", bron: "{rdf.value}" } } },

    // ── Wie en wat ──────────────────────────────────────────────────────────
    { naam: "Partij (groep)", bij: "knoop", als: { klasse: "odrl:PartyCollection" }, maak: { type: "partij", data: { definitie: "{skos.definition}" } } },
    // Eén benoemde partij (een organisatie): de bouwer maakt er een begrip van.
    { naam: "Partij (benoemd)", bij: "knoop", als: { klasse: "odrl:Party" }, maak: { type: "partij", data: { benoemd: "ja" } } },
    // Een verzameling zonder pad in het register is een begrip uit de beleidstekst.
    { naam: "Gegevensbegrip", bij: "knoop", als: { klasse: "odrl:AssetCollection", "dct:identifier": { leeg: true } }, maak: { type: "gegevensbegrip", data: { definitie: "{skos.definition}" } } },
    { naam: "Registerdeel", bij: "knoop", als: { klasse: ["odrl:Asset", "odrl:AssetCollection"], "dct:identifier": { leeg: false } }, maak: { type: "registerdeel", data: { pad: "{dct.identifier}" } } },
    // Een asset zonder pad in een register: de bouwer leest zijn naam als gegeven.
    { naam: "Gegeven zonder pad in een register", bij: "knoop", als: { klasse: "odrl:Asset" }, maak: { type: "gegeven" } },

    // ── Voorwaarden ─────────────────────────────────────────────────────────
    // Het anker naar de uitvoering (ODRL Visualisation Note §7) is realisatie, geen norm.
    { naam: "Anker naar de uitvoering", bij: "knoop", als: { "odrl:leftOperand": "apnl:verwerkingsverzoek" }, negeer: true },
    // Eerst de operanden van ODRL en ODRL-AP-NL.
    voorwaarde("Voorwaarde: doelbinding", "odrl:purpose", { anker: "aanvraag", subpad: "doel" }),
    voorwaarde("Voorwaarde: tijdstip van de aanvraag", "odrl:dateTime", { anker: "aanvraag", subpad: "tijdstip" }),
    voorwaarde("Voorwaarde: rol van de aanvrager", "apnl:rolAanvrager", { anker: "aanvrager", subpad: "rol" }),
    // De eigen operanden heten ts:<anker>.<subpad>; de bouwer splitst dat woord.
    voorwaarde("Voorwaarde (eigen operand)", { patroon: "^ts:" }, { operand: "{odrl.leftOperand|lokaal}" }),
    // Een operand uit een ander vocabulaire: de bouwer leest hem als kenmerk van aanvraag of aanvrager.
    voorwaarde("Voorwaarde (operand van elders)", { leeg: false }, { vreemd: "{odrl.leftOperand|lokaal}", vreemdIri: "{odrl.leftOperand}" }),
    { naam: "Voorwaardegroep", bij: "knoop", als: { klasse: "odrl:LogicalConstraint" }, maak: { type: "voorwaardegroep" } },
    groep("odrl:and"),
    groep("odrl:or"),
    groep("odrl:xone"),

    // ── Plichten ────────────────────────────────────────────────────────────
    { naam: "Plicht", bij: "knoop", als: { klasse: "odrl:Duty" }, maak: { type: "plicht", data: { plicht: "{odrl.action|lokaal}", handeling: "{odrl.action}" } } },

    // ── Woordenschat: de termen dragen de zinsnede uit de klare taal ────────
    { naam: "Profiel van de woordenschat", bij: "knoop", als: { klasse: "odrl:Profile" }, negeer: true },
    { naam: "Term: operand", bij: "knoop", als: { klasse: "odrl:LeftOperand" }, maak: { type: "term", data: { termsoort: "operand" } } },
    { naam: "Term: vergelijking", bij: "knoop", als: { klasse: "odrl:Operator" }, maak: { type: "term", data: { termsoort: "operator" } } },
    { naam: "Term: handeling", bij: "knoop", als: { klasse: "odrl:Action" }, maak: { type: "term", data: { termsoort: "handeling", breder: "{odrl.includedIn}" } } },
    { naam: "Term: niveau in het register", bij: "knoop", als: { klasse: "rdfs:Class" }, maak: { type: "term", data: { termsoort: "niveau" } } },
    // Na de termen: die zijn ook skos:Concept. Een begrip is hier een waarde (het doel, een afdeling).
    { naam: "Begrip als waarde (doelbinding)", bij: "knoop", als: { klasse: "skos:Concept" }, maak: { type: "doel" } },

    // ── Verbindingen ────────────────────────────────────────────────────────
    { naam: "Het beleid staat toe", bij: "verbinding", als: { aard: "odrl:permission" }, maak: { type: "regel" } },
    { naam: "Het beleid verbiedt", bij: "verbinding", als: { aard: "odrl:prohibition" }, maak: { type: "regel" } },
    { naam: "Grondslag van het beleid", bij: "verbinding", als: { aard: "dpv:hasLegalBasis" }, maak: { type: "grondslag" } },
    { naam: "Doel van het beleid", bij: "verbinding", als: { aard: "dpv:hasPurpose" }, maak: { type: "doel" } },
    // Toegangsspraak kent plichten bij een regel, niet op het beleid, en geen overerving: de bouwer meldt ze.
    { naam: "Plicht op het beleid", bij: "verbinding", als: { aard: "odrl:obligation" }, maak: { type: "plicht-van-beleid" } },
    { naam: "Beleid erft van een ander beleid", bij: "verbinding", als: { aard: "odrl:inheritFrom" }, maak: { type: "erft" } },
    // De handeling van een plicht is al als eigenschap gelezen (de regel "Plicht").
    { naam: "Handeling van een plicht", bij: "verbinding", als: { aard: "odrl:action", bron: { type: "plicht" } }, negeer: true },
    { naam: "Handeling van de regel", bij: "verbinding", als: { aard: "odrl:action" }, maak: { type: "doet" } },
    { naam: "Wie", bij: "verbinding", als: { aard: "odrl:assignee" }, maak: { type: "wie" } },
    { naam: "Wat", bij: "verbinding", als: { aard: "odrl:target" }, maak: { type: "wat" } },
    { naam: "Kenmerk dat de groep bepaalt", bij: "verbinding", als: { aard: "odrl:refinement", bron: { type: "partij" } }, maak: { type: "kenmerk" } },
    { naam: "Verfijning op de handeling", bij: "verbinding", als: { aard: "odrl:refinement" }, maak: { type: "als" } },
    { naam: "Voorwaarde op de regel", bij: "verbinding", als: { aard: "odrl:constraint" }, maak: { type: "als" } },
    { naam: "Lid van een en-groep", bij: "verbinding", als: { aard: "odrl:and" }, maak: { type: "lid", data: { logica: "en", positie: "{positie}" } } },
    { naam: "Lid van een of-groep", bij: "verbinding", als: { aard: "odrl:or" }, maak: { type: "lid", data: { logica: "of", positie: "{positie}" } } },
    { naam: "Lid van een precies-één-groep", bij: "verbinding", als: { aard: "odrl:xone" }, maak: { type: "lid", data: { logica: "xof", positie: "{positie}" } } },
    { naam: "Plicht bij de regel", bij: "verbinding", als: { aard: "odrl:duty" }, maak: { type: "waarbij" } },
    { naam: "Onderdeel van", bij: "verbinding", als: { aard: "odrl:partOf" }, maak: { type: "onderdeel-van" } },
    { naam: "Waarde is een begrip uit het beleid", bij: "verbinding", als: { aard: "odrl:rightOperand" }, maak: { type: "waarde", data: { positie: "{positie}" } } },
    { naam: "Operand hoort bij een registerdeel", bij: "verbinding", als: { aard: "rdfs:seeAlso" }, maak: { type: "zie-ook" } },
    // Verwijzingen die de knoopregels al als eigenschap lazen, of die de taal niet nodig heeft.
    {
      naam: "Verwijzing die al als eigenschap is gelezen",
      bij: "verbinding",
      als: { aard: ["odrl:uid", "odrl:leftOperand", "odrl:operator", "rdf:value", "odrl:profile", "odrl:includedIn"] },
      negeer: true,
    },
  ],
};
