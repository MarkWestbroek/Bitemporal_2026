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
 * van de eigen woordenschat (`ts:exporteren` → exporteren).
 *
 * Waar de export een woord van ODRL koos, kiest deze regelset het woord van
 * Toegangsspraak terug: `odrl:read` is bekijken, `odrl:purpose` het doel van de
 * aanvraag, `apnl:rolAanvrager` de rol van de aanvrager.
 *
 * Wat hier geen regel heeft komt in de trace als "geen-regel": dat is het
 * verliesrapport van de import. De regelset dekt de ODRL die de eigen export
 * schrijft; ODRL van anderen (andere handelingen, andere operanden, plichten
 * met gevolgen) valt daar nu grotendeels in.
 *
 * Hoe het plan een beleid in klare taal wordt (de zin weer opbouwen, de
 * volgorde, de lidwoorden) staat in de bouwer `odrlNaarBeleid.js`, niet hier.
 */

const voorwaarde = (naam, links, data) => ({
  naam,
  bij: "knoop",
  als: { klasse: "odrl:Constraint", "odrl:leftOperand": links },
  maak: { type: "voorwaarde", data: { ...data, operator: "{odrl.operator|lokaal}", waarde: "{odrl.rightOperand}" } },
});

const handeling = (odrl, woord) => ({
  naam: `Handeling: ${woord}`,
  bij: "knoop",
  als: { klasse: "odrl:Action", "rdf:value": odrl },
  maak: { type: "handeling", data: { actie: woord } },
});

export const ODRL_AP_NL_NAAR_TOEGANGSSPRAAK = {
  id: "odrl-ap-nl-naar-toegangsspraak",
  versie: 1,
  titel: "ODRL (ODRL-AP-NL) → Toegangsspraak",
  bron: "odrl-ap-nl",
  doel: "toegangsspraak",
  regels: [
    // ── Het beleid ──────────────────────────────────────────────────────────
    {
      naam: "Beleid",
      bij: "knoop",
      als: { klasse: ["odrl:Set", "odrl:Policy"] },
      maak: {
        type: "beleid",
        data: { geldigVanaf: "{schema.validFrom}", geldigTot: "{schema.validThrough}", uitgegeven: "{dct.issued}", brontekst: "{ts.brontekst}" },
      },
    },
    { naam: "Grondslag", bij: "knoop", als: { klasse: "dct:LegalResource" }, maak: { type: "grondslag" } },

    // ── Regels ──────────────────────────────────────────────────────────────
    { naam: "Toestemming", bij: "knoop", als: { klasse: "odrl:Permission" }, maak: { type: "regel", data: { modaliteit: "mag", zin: "{dct.description}", volgorde: "{ts.volgorde}" } } },
    { naam: "Verbod", bij: "knoop", als: { klasse: "odrl:Prohibition" }, maak: { type: "regel", data: { modaliteit: "mag-niet", zin: "{dct.description}", volgorde: "{ts.volgorde}" } } },

    // De handeling per regel is de knoop met rdf:value; woorden die ODRL kent eerst.
    handeling("odrl:read", "bekijken"),
    handeling("odrl:modify", "veranderen"),
    handeling("odrl:delete", "afvoeren"),
    { naam: "Handeling (eigen woord)", bij: "knoop", als: { klasse: "odrl:Action", "rdf:value": { patroon: "^ts:" } }, maak: { type: "handeling", data: { actie: "{rdf.value|lokaal}" } } },

    // ── Wie en wat ──────────────────────────────────────────────────────────
    { naam: "Partij", bij: "knoop", als: { klasse: "odrl:PartyCollection" }, maak: { type: "partij", data: { definitie: "{skos.definition}" } } },
    // Een verzameling zonder pad in het register is een begrip uit de beleidstekst.
    { naam: "Gegevensbegrip", bij: "knoop", als: { klasse: "odrl:AssetCollection", "dct:identifier": { leeg: true } }, maak: { type: "gegevensbegrip", data: { definitie: "{skos.definition}" } } },
    { naam: "Registerdeel", bij: "knoop", als: { klasse: ["odrl:Asset", "odrl:AssetCollection"], "dct:identifier": { leeg: false } }, maak: { type: "registerdeel", data: { pad: "{dct.identifier}" } } },

    // ── Voorwaarden: eerst de operanden van ODRL en ODRL-AP-NL ──────────────
    voorwaarde("Voorwaarde: doelbinding", "odrl:purpose", { anker: "aanvraag", subpad: "doel" }),
    voorwaarde("Voorwaarde: tijdstip van de aanvraag", "odrl:dateTime", { anker: "aanvraag", subpad: "tijdstip" }),
    voorwaarde("Voorwaarde: rol van de aanvrager", "apnl:rolAanvrager", { anker: "aanvrager", subpad: "rol" }),
    // De eigen operanden heten ts:<anker>.<subpad>; de bouwer splitst dat woord.
    voorwaarde("Voorwaarde (eigen operand)", { patroon: "^ts:" }, { operand: "{odrl.leftOperand|lokaal}" }),
    { naam: "Voorwaardegroep", bij: "knoop", als: { klasse: "odrl:LogicalConstraint" }, maak: { type: "voorwaardegroep" } },

    // ── Plichten ────────────────────────────────────────────────────────────
    { naam: "Plicht", bij: "knoop", als: { klasse: "odrl:Duty" }, maak: { type: "plicht", data: { plicht: "{odrl.action|lokaal}" } } },

    // ── Woordenschat: de termen dragen de zinsnede uit de klare taal ────────
    { naam: "Profiel van de woordenschat", bij: "knoop", als: { klasse: "odrl:Profile" }, negeer: true },
    { naam: "Term: operand", bij: "knoop", als: { klasse: "odrl:LeftOperand" }, maak: { type: "term", data: { termsoort: "operand" } } },
    { naam: "Term: vergelijking", bij: "knoop", als: { klasse: "odrl:Operator" }, maak: { type: "term", data: { termsoort: "operator" } } },
    { naam: "Term: handeling", bij: "knoop", als: { klasse: "odrl:Action", "rdf:value": { leeg: true } }, maak: { type: "term", data: { termsoort: "handeling" } } },
    { naam: "Term: niveau in het register", bij: "knoop", als: { klasse: "rdfs:Class" }, maak: { type: "term", data: { termsoort: "niveau" } } },
    // Na de termen: die zijn ook skos:Concept.
    { naam: "Doelbinding", bij: "knoop", als: { klasse: "skos:Concept" }, maak: { type: "doel" } },

    // ── Verbindingen ────────────────────────────────────────────────────────
    { naam: "Het beleid staat toe", bij: "verbinding", als: { aard: "odrl:permission" }, maak: { type: "regel" } },
    { naam: "Het beleid verbiedt", bij: "verbinding", als: { aard: "odrl:prohibition" }, maak: { type: "regel" } },
    { naam: "Grondslag van het beleid", bij: "verbinding", als: { aard: "dpv:hasLegalBasis" }, maak: { type: "grondslag" } },
    { naam: "Doel van het beleid", bij: "verbinding", als: { aard: "dpv:hasPurpose" }, maak: { type: "doel" } },
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
    { naam: "Waarde is een begrip uit het beleid", bij: "verbinding", als: { aard: "odrl:rightOperand" }, maak: { type: "waarde" } },
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
