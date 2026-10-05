// @ts-check
/**
 * odrlApNlRegels — de **regelset** "Toegangsspraak → ODRL (ODRL-AP-NL)".
 *
 * De leesbare kern van de export: wat elk onderdeel van een beleid in klare
 * taal (de graaf uit `graaf.js`) wordt in ODRL. Het doel-`type` is hier
 * letterlijk RDF: bij een knoop een klasse, bij een verbinding een predicaat;
 * de sleutels van `data` zijn predicaten. Hoe een waarde geschreven wordt
 * (tekst met taal, verwijzing, datum) staat in de context van de schrijver
 * (`odrlExport.js`), niet hier.
 *
 * De keuzes volgen de werkversie van ODRL-AP-NL (werkgroep FTV) en de ODRL
 * Visualisation Note, zodat de ODRL-viewer het resultaat als document leest:
 *
 *   - elke regel, voorwaarde en plicht krijgt een eigen IRI en een naam
 *     (Note §1, §2, §7);
 *   - wat over het verzoek gaat — doel, rol, argumenten — is een verfijning op
 *     de handeling; wat over de gegevens gaat een voorwaarde op de regel
 *     (ODRL-AP-NL: `apnl:rolAanvrager` en `odrl:purpose` in refinement-positie);
 *   - het register is een hiërarchie van assets met `odrl:partOf` en een
 *     niveau-klasse (Note §3);
 *   - geldigheid met `schema:validFrom`, publicatie met `dct:issued` (Note §5).
 *
 * Waar Toegangsspraak een woord heeft dat ODRL al kent, wint ODRL: bekijken is
 * `odrl:read`, het doel van de aanvraag `odrl:purpose`, de rol van de aanvrager
 * `apnl:rolAanvrager`. De overige woorden worden termen in de eigen
 * woordenschat (`ts:`), met de zinsnede uit de klare taal als label.
 */

const ZELF = { zelf: true };
const iri = (waarde) => ({ iri: waarde });

/** Constraint met een vaste linkeroperand uit ODRL of ODRL-AP-NL. */
const kernVoorwaarde = (naam, als, links) => ({
  naam,
  bij: "knoop",
  als: { aard: "voorwaarde", ...als },
  maak: { type: "odrl:Constraint", data: { "odrl:leftOperand": iri(links), "odrl:operator": "odrl:{operator}", "odrl:rightOperand": "{waarde}" } },
});

/** Handeling die ODRL zelf kent. */
const kernHandeling = (woord, odrl) => ({
  naam: `Handeling: ${woord}`,
  bij: "knoop",
  als: { aard: "handeling", actie: woord },
  maak: { type: "odrl:Action", naam: "", data: { "rdf:value": iri(odrl) } },
});

export const TOEGANGSSPRAAK_NAAR_ODRL_AP_NL = {
  id: "toegangsspraak-naar-odrl-ap-nl",
  versie: 1,
  titel: "Toegangsspraak → ODRL (ODRL-AP-NL)",
  bron: "toegangsspraak",
  doel: "odrl-ap-nl",
  regels: [
    // ── Het beleid ──────────────────────────────────────────────────────────
    {
      naam: "Beleid",
      bij: "knoop",
      als: { aard: "beleid" },
      maak: {
        type: "odrl:Set",
        data: {
          "odrl:uid": ZELF,
          "odrl:profile": [iri("apnl:profiel"), iri("ts:profiel")],
          "dct:description": "{toelichting}",
          "dct:issued": "{uitgegeven}",
          "schema:validFrom": "{geldigVanaf}",
          "schema:validThrough": "{geldigTot}",
          "odrl:conflict": iri("odrl:prohibit"),
        },
      },
    },
    {
      naam: "Grondslag",
      bij: "knoop",
      als: { aard: "grondslag" },
      maak: { type: "dct:LegalResource", data: { "skos:note": "Grondslag zoals in de beleidstekst genoemd; nog geen verwijzing naar wetten.overheid.nl." } },
    },
    { naam: "Doelbinding", bij: "knoop", als: { aard: "doel" }, maak: { type: "skos:Concept", data: { "skos:definition": 'Doelbinding "{tekst}" zoals genoemd in het beleid.' } } },

    // ── Regels ──────────────────────────────────────────────────────────────
    { naam: "Toestemming", bij: "knoop", als: { aard: "regel", modaliteit: "mag" }, maak: { type: "odrl:Permission", data: { "odrl:uid": ZELF, "dct:description": "{zin}" } } },
    { naam: "Verbod", bij: "knoop", als: { aard: "regel", modaliteit: "mag-niet" }, maak: { type: "odrl:Prohibition", data: { "odrl:uid": ZELF, "dct:description": "{zin}" } } },

    // De handeling per regel is een knoop met rdf:value, zodat verfijningen
    // eraan kunnen hangen. Woorden die ODRL kent eerst.
    kernHandeling("bekijken", "odrl:read"),
    kernHandeling("veranderen", "odrl:modify"),
    kernHandeling("afvoeren", "odrl:delete"),
    { naam: "Handeling (eigen woord)", bij: "knoop", als: { aard: "handeling" }, maak: { type: "odrl:Action", naam: "", data: { "rdf:value": "ts:{actie}" } } },

    // ── Wie en wat ──────────────────────────────────────────────────────────
    { naam: "Partij", bij: "knoop", als: { aard: "partij" }, maak: { type: "odrl:PartyCollection", data: { "skos:definition": "{definitie}" } } },
    { naam: "Gegevensbegrip", bij: "knoop", als: { aard: "gegevensbegrip" }, maak: { type: "odrl:AssetCollection", data: { "skos:definition": "{definitie}" } } },
    { naam: "Registerdeel", bij: "knoop", als: { aard: "registerdeel" }, maak: { type: "odrl:Asset", data: { "dct:identifier": "{pad}" } } },

    // ── Voorwaarden: eerst wat ODRL of ODRL-AP-NL al een naam geeft ─────────
    kernVoorwaarde("Voorwaarde: doelbinding", { anker: "aanvraag", subpad: "doel" }, "odrl:purpose"),
    kernVoorwaarde("Voorwaarde: tijdstip van de aanvraag", { anker: "aanvraag", subpad: "tijdstip" }, "odrl:dateTime"),
    kernVoorwaarde("Voorwaarde: rol van de aanvrager", { anker: "aanvrager", subpad: "rol" }, "apnl:rolAanvrager"),
    {
      naam: "Voorwaarde (ODRL-vergelijking)",
      bij: "knoop",
      als: { aard: "voorwaarde", kern: true },
      maak: { type: "odrl:Constraint", data: { "odrl:leftOperand": "ts:{anker}.{subpad}", "odrl:operator": "odrl:{operator}", "odrl:rightOperand": "{waarde}" } },
    },
    {
      naam: "Voorwaarde (eigen vergelijking)",
      bij: "knoop",
      als: { aard: "voorwaarde" },
      maak: { type: "odrl:Constraint", data: { "odrl:leftOperand": "ts:{anker}.{subpad}", "odrl:operator": "ts:{operator}", "odrl:rightOperand": "{waarde}" } },
    },
    { naam: "Voorwaardegroep", bij: "knoop", als: { aard: "voorwaardegroep" }, maak: { type: "odrl:LogicalConstraint" } },

    // ── Plichten ────────────────────────────────────────────────────────────
    { naam: "Plicht", bij: "knoop", als: { aard: "plicht" }, maak: { type: "odrl:Duty", data: { "odrl:uid": ZELF, "odrl:action": "ts:{plicht}" } } },

    // ── Woordenschat: termen die ODRL al kent vallen weg ────────────────────
    {
      naam: "Term die ODRL of ODRL-AP-NL al kent",
      bij: "knoop",
      als: { aard: "term", id: ["ts:aanvraag.doel", "ts:aanvraag.tijdstip", "ts:aanvrager.rol", "ts:bekijken", "ts:veranderen", "ts:afvoeren"] },
      negeer: true,
    },
    { naam: "Term: operand", bij: "knoop", als: { aard: "term", termsoort: "operand" }, maak: { type: "odrl:LeftOperand", data: { "rdf:type": iri("skos:Concept"), "skos:definition": "{definitie}" } } },
    { naam: "Term: vergelijking", bij: "knoop", als: { aard: "term", termsoort: "operator" }, maak: { type: "odrl:Operator", data: { "rdf:type": iri("skos:Concept") } } },
    { naam: "Term: handeling", bij: "knoop", als: { aard: "term", termsoort: "handeling" }, maak: { type: "odrl:Action", data: { "rdf:type": iri("skos:Concept"), "odrl:includedIn": iri("odrl:use") } } },
    { naam: "Term: plichthandeling", bij: "knoop", als: { aard: "term", termsoort: "plichthandeling" }, maak: { type: "odrl:Action", data: { "rdf:type": iri("skos:Concept") } } },
    { naam: "Term: niveau in het register", bij: "knoop", als: { aard: "term", termsoort: "niveau" }, maak: { type: "rdfs:Class", data: { "rdf:type": iri("skos:Concept") } } },

    // ── Verbindingen ────────────────────────────────────────────────────────
    { naam: "Het beleid staat toe", bij: "verbinding", als: { aard: "regel", modaliteit: "mag" }, maak: { type: "odrl:permission" } },
    { naam: "Het beleid verbiedt", bij: "verbinding", als: { aard: "regel", modaliteit: "mag-niet" }, maak: { type: "odrl:prohibition" } },
    { naam: "Grondslag van het beleid", bij: "verbinding", als: { aard: "grondslag" }, maak: { type: "dpv:hasLegalBasis" } },
    { naam: "Handeling van de regel", bij: "verbinding", als: { aard: "doet" }, maak: { type: "odrl:action" } },
    { naam: "Wie", bij: "verbinding", als: { aard: "wie" }, maak: { type: "odrl:assignee" } },
    { naam: "Wat", bij: "verbinding", als: { aard: "wat" }, maak: { type: "odrl:target" } },
    // Een groep is bepaald door haar kenmerken: verfijning op de PartyCollection.
    { naam: "Kenmerk dat de groep bepaalt", bij: "verbinding", als: { aard: "kenmerk" }, maak: { type: "odrl:refinement" } },
    // Over het verzoek: verfijning op de handeling. Over de gegevens:
    // voorwaarde op de regel. De lezer heeft de voorwaarde daar al gehangen.
    { naam: "Verfijning op de handeling", bij: "verbinding", als: { aard: "als", bron: { aard: "handeling" } }, maak: { type: "odrl:refinement" } },
    { naam: "Voorwaarde op de regel", bij: "verbinding", als: { aard: "als" }, maak: { type: "odrl:constraint" } },
    { naam: "Lid van een en-groep", bij: "verbinding", als: { aard: "lid", logica: "en" }, maak: { type: "odrl:and" } },
    { naam: "Lid van een of-groep", bij: "verbinding", als: { aard: "lid", logica: "of" }, maak: { type: "odrl:or" } },
    { naam: "Lid van een precies-één-groep", bij: "verbinding", als: { aard: "lid", logica: "xof" }, maak: { type: "odrl:xone" } },
    { naam: "Plicht bij de regel", bij: "verbinding", als: { aard: "waarbij" }, maak: { type: "odrl:duty" } },
    { naam: "Onderdeel van", bij: "verbinding", als: { aard: "onderdeel-van" }, maak: { type: "odrl:partOf" } },
    { naam: "Waarde is een begrip uit het beleid", bij: "verbinding", als: { aard: "waarde" }, maak: { type: "odrl:rightOperand" } },
    { naam: "Operand hoort bij een registerdeel", bij: "verbinding", als: { aard: "zie-ook" }, maak: { type: "rdfs:seeAlso" } },
    { naam: "Niveau van een registerdeel", bij: "verbinding", als: { aard: "niveau" }, maak: { type: "rdf:type" } },
  ],
};
