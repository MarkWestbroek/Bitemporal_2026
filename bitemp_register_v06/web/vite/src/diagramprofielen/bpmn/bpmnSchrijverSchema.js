// @ts-check
/**
 * bpmnSchrijverSchema — de **beschrijving van de instellingen** van de BPMN-schrijver
 * (`transformatie/bpmnXmlSchrijver.js`), als JSON Schema met de eigen sleutels van
 * `vormen/schemaPaneel.js` (x-titel, x-omschrijving, x-groep, x-placeholders).
 *
 * Aanleiding (Mark 18-11): de schrijver is een motor met parameters; een engine-regelset zoals
 * `BPMN_NAAR_GZAC` (bpmnGzacRegels.js) is een **stand van die parameters** (een preset), geen
 * lijst regels. Dit schema hoort bij de motor en geldt voor elke engine; het paneel
 * (`vormen/SchemaPaneel.jsx`) tekent er de instellingen van, en `valideerSchema` controleert ze.
 *
 * Een test (`bpmnSchrijverSchema.test.js`) eist dat de GZAC-stand geldig is en dat het schema
 * elke instelling beschrijft: komt er in de code een instelling bij, dan faalt de test tot hij
 * hier een beschrijving heeft.
 */

const tekst = (titel, omschrijving, extra = {}) => ({ type: "string", "x-titel": titel, "x-omschrijving": omschrijving, ...extra });
const jaNee = (titel, omschrijving) => ({ type: "boolean", "x-titel": titel, "x-omschrijving": omschrijving });
const tabel = (titel, omschrijving, extra = {}) => ({ type: "object", additionalProperties: { type: "string", ...extra }, "x-titel": titel, "x-omschrijving": omschrijving });
const sjabloon = (titel, omschrijving, placeholders) => tekst(titel, omschrijving, { "x-placeholders": placeholders });

const ATTRIBUTEN = "Attributen die de schrijver op het element zet. `${…}` is een expressie voor de engine en blijft staan.";

const TAAK = {
  type: "object",
  properties: {
    attributen: tabel("Vaste attributen", ATTRIBUTEN),
    asyncAfter: jaNee("Wachtpunt na de taak", "De engine legt de stand vast na deze taak; bij een fout hoeft alleen deze taak opnieuw."),
    vasteSleutel: jaNee("Vaste sleutel", "Het aangeroepen proces of de beslistabel staat als vaste sleutel in de XML, niet als expressie. Valtimo zoekt hem bij de export op sleutel op."),
    uitData: {
      type: "array",
      "x-titel": "Attributen uit het model",
      "x-omschrijving": "Per regel: staat deze eigenschap op de taak in het model, zet dan deze attributen. `{naam}` wordt de waarde van die eigenschap.",
      items: {
        type: "object",
        required: ["als", "attributen"],
        properties: {
          als: tekst("Als de taak dit heeft", "De eigenschap in het model (data) die er moet zijn."),
          attributen: tabel("Dan deze attributen", ATTRIBUTEN, { "x-placeholders": ["dossierstatus", "beslissing", "resultaat"] }),
        },
      },
    },
    invoer: {
      type: "object",
      "x-titel": "Invoer van de beslistabel",
      "x-omschrijving": "Per invoerkolom van de beslistabel een parameter: uit het dossier of uit een procesvariabele.",
      properties: {
        tag: tekst("Element", "Het XML-element dat de parameters omvat."),
        parameter: tekst("Parameter", "Het XML-element van één parameter."),
        dossier: sjabloon("Waarde uit het dossier", "Expressie voor een kolom die uit het dossier komt.", ["pointer"]),
        variabele: sjabloon("Waarde uit een procesvariabele", "Expressie voor een kolom die al een procesvariabele is.", ["variabele"]),
      },
    },
    extensies: {
      type: "array",
      "x-titel": "Extra elementen",
      "x-omschrijving": "Vaste extensie-elementen onder de taak.",
      items: { type: "object", properties: { tag: tekst("Element", "Het XML-element."), attributen: tabel("Attributen", ATTRIBUTEN) } },
    },
    variabelen: {
      type: "object",
      "x-titel": "Variabelen erheen en terug",
      "x-omschrijving": "Welke procesvariabelen naar het aangeroepen proces gaan en terugkomen; het model zegt welke.",
      properties: {
        in: tekst("Element erheen", "Het XML-element voor een variabele naar het aangeroepen proces."),
        uit: tekst("Element terug", "Het XML-element voor een variabele terug."),
        standaardIn: { enum: ["alle", "geen"], "x-titel": "Zonder opgave erheen", "x-omschrijving": "Wat erheen gaat als het model niets noemt." },
      },
    },
  },
};

const BERICHT = (titel, omschrijving) => ({
  type: "object",
  "x-titel": titel,
  "x-omschrijving": omschrijving,
  properties: {
    asyncAfter: jaNee("Wachtpunt na het event", "De engine legt de stand vast na het versturen."),
    definitie: tabel("Attributen op de berichtdefinitie", "`{bericht}` is de berichtnaam, als tekst of als expressie voor een variabele naam.", { "x-placeholders": ["bericht"] }),
  },
});

const KOPPELING_DEEL = (titel, omschrijving) => ({ type: "object", additionalProperties: {}, "x-titel": titel, "x-omschrijving": omschrijving });

const ACTIE = {
  type: "object",
  required: ["actie"],
  properties: {
    actie: tekst("Plugin-actie", "De sleutel van de actie in de plugin van GZAC."),
    definitie: tekst("Plugin", "Een andere plugin dan de standaard van de koppeling."),
    configuratie: tekst("Pluginconfiguratie", "Een andere configuratie dan de standaard; een plaatshouder met een dollarteken lost de uitrol per omgeving op."),
    voor: KOPPELING_DEEL("Velden vóór", "Vervangt de standaardvelden vóór de plugin, bijvoorbeeld een ander activityType."),
    doel: {
      type: "object",
      "x-titel": "Waar de actie op wijst",
      "x-omschrijving": "Een rol of status van het zaaktype, die de schrijver uit de e-dienst opzoekt.",
      properties: {
        soort: { enum: ["rol", "status"], "x-titel": "Soort", "x-omschrijving": "Roltype of statustype." },
        alleenGeneriek: tekst("Alleen deze generieke rol", "De regelset kent nu alleen deze rol."),
      },
    },
    eigenschappen: {
      type: "object",
      additionalProperties: {},
      "x-titel": "Eigenschappen van de actie",
      "x-omschrijving": "`pv:naam` is een procesvariabele; `{naam}` vult de schrijver in.",
      "x-placeholders": ["zaaktype", "volgnummer", "toelichting", "formulier"],
    },
  },
};

export const BPMN_SCHRIJVER_SCHEMA = {
  type: "object",
  required: ["engine", "taken"],
  properties: {
    engine: tekst("Engine", "De procesmotor waarvoor deze stand geldt.", { "x-groep": "Engine" }),
    namespaces: { ...tabel("Namespaces", "Voorvoegsel en URI van de extensies van de engine."), "x-groep": "Engine" },
    proces: { ...tabel("Attributen op het proces", "Vaste attributen op elk proces."), "x-groep": "Engine" },
    asyncAfter: tekst("Attribuut voor een wachtpunt", "De naam van het attribuut dat een wachtpunt na een taak zet.", { "x-groep": "Wachtpunten en lussen" }),
    lus: {
      type: "object",
      "x-groep": "Wachtpunten en lussen",
      "x-titel": "Herhaling (multi-instance)",
      "x-omschrijving": "De attributen voor de verzameling en de elementvariabele van een herhaalde taak.",
      properties: { verzameling: tekst("Verzameling", "Attribuut voor de verzameling."), element: tekst("Element", "Attribuut voor de elementvariabele.") },
    },
    taken: {
      type: "object",
      "x-groep": "Taken",
      "x-titel": "Per taaksoort",
      "x-omschrijving": "Wat de schrijver per soort taak extra schrijft zodat de engine hem kan uitvoeren.",
      additionalProperties: TAAK,
    },
    variabelenZetten: {
      type: "object",
      "x-groep": "Variabelen en berichten",
      "x-titel": "Variabelen met een vaste waarde",
      "x-omschrijving": "Een taak die in het model variabelen zet, krijgt per variabele een uitvoerparameter.",
      properties: { tag: tekst("Element", "Het XML-element dat de parameters omvat."), parameter: tekst("Parameter", "Het XML-element van één parameter.") },
    },
    berichten: {
      type: "object",
      "x-groep": "Variabelen en berichten",
      "x-titel": "Berichten",
      "x-omschrijving": "Hoe een werpend bericht-event een ander proces van hetzelfde dossier start of wekt.",
      properties: {
        werpen: BERICHT("Werpen (proces starten)", "Start het proces met het bericht-startevent van die naam."),
        wekken: BERICHT("Wekken (lopend proces)", "Zet het bericht door naar een lopend proces dat erop wacht."),
        variabel: sjabloon("Berichtnaam uit een variabele", "De expressie als de berichtnaam in een procesvariabele staat.", ["variabele"]),
      },
    },
    proceskoppeling: {
      type: "object",
      "x-groep": "Proceskoppeling",
      "x-titel": "Proceskoppeling (process-link)",
      "x-omschrijving": "Wat GZAC per taak aan het proces hangt: een formulier of een plugin-actie.",
      properties: {
        formulier: {
          type: "object",
          "x-titel": "Formulier op een gebruikerstaak",
          "x-omschrijving": "De velden rond de formuliernaam, in de volgorde van de Valtimo-export.",
          properties: { voor: KOPPELING_DEEL("Velden vóór", "Vóór de formuliernaam."), na: KOPPELING_DEEL("Velden na", "Na de formuliernaam.") },
        },
        plugin: {
          type: "object",
          "x-titel": "Plugin op een servicetaak",
          "x-omschrijving": "Een servicetaak met een actie in het model krijgt een plugin-koppeling.",
          properties: {
            voor: KOPPELING_DEEL("Velden vóór", "Vóór de plugin."),
            configuratie: tekst("Pluginconfiguratie", "De configuratie in de omgeving; een plaatshouder met een dollarteken lost de uitrol op."),
            definitie: tekst("Plugin", "De sleutel van de plugin."),
            na: KOPPELING_DEEL("Velden na", "Na de eigenschappen van de actie."),
            acties: { type: "object", "x-titel": "Acties", "x-omschrijving": "Per actie uit het model: welke plugin-actie en met welke eigenschappen.", additionalProperties: ACTIE },
          },
        },
      },
    },
  },
};
