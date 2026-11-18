// @ts-check
/**
 * inrichtingSchemas — de **beschrijving van de instellingen** van twee schrijvers voor de
 * inrichting van e-diensten, als JSON Schema met de eigen sleutels van `vormen/schemaPaneel.js`:
 *
 * - `DOSSIER_SCHRIJVER_SCHEMA`: de schrijver van de GZAC-dossierbundel (`dossierArtefact.js`);
 *   `CANONIEK_NAAR_DOSSIER` (dossierRegels.js) is daar de stand van. De groepen volgen de
 *   onderdelen van de bundel, zodat je per onderdeel ziet wat de schrijver zelf invult.
 * - `ZAAKTYPE_SCHRIJVER_SCHEMA`: de schrijver van het zaaktype (`zaaktypeArtefact.js`);
 *   `CANONIEK_NAAR_ZAAKTYPE` is de stand. Het zaaktype is doelgedreven: de inhoud staat in de
 *   e-dienst, deze stand vult alleen de gaten (TRANSFORMATIES.md §9.7).
 *
 * Zelfde opzet als `bpmn/bpmnSchrijverSchema.js`. De test in `vormen/schemaPaneel.test.js` eist
 * dat beide standen geldig en volledig beschreven zijn.
 */

const tekst = (titel, omschrijving, extra = {}) => ({ type: "string", "x-titel": titel, "x-omschrijving": omschrijving, ...extra });
const getal = (titel, omschrijving) => ({ type: "number", "x-titel": titel, "x-omschrijving": omschrijving });
const jaNee = (titel, omschrijving) => ({ type: "boolean", "x-titel": titel, "x-omschrijving": omschrijving });
const vrij = (titel, omschrijving, extra = {}) => ({ type: "object", additionalProperties: {}, "x-titel": titel, "x-omschrijving": omschrijving, ...extra });
const rijen = (titel, omschrijving, properties, extra = {}) => ({
  type: "array",
  "x-vorm": "tabel",
  "x-titel": titel,
  "x-omschrijving": omschrijving,
  items: { type: "object", properties },
  ...extra,
});
const groep = (naam, schema) => ({ ...schema, "x-groep": naam });

const EERSTE_PAST = "De eerste regel die past wint; de laatste regel zonder voorwaarde vangt de rest.";
const REGEL = (doelTitel, doelUitleg) => ({
  naam: tekst("Regel", "Naam van de regel."),
  als: vrij("Als het veld", "Voorwaarden op het schema van het veld; leeg = altijd."),
  type: tekst(doelTitel, doelUitleg),
});

export const DOSSIER_SCHRIJVER_SCHEMA = {
  type: "object",
  properties: {
    definitie: groep("Dossierdefinitie", {
      type: "object",
      "x-titel": "Wat de e-dienst niet zegt",
      "x-omschrijving": "Sleutel, naam, versie en beschrijving komen uit de e-dienst.",
      properties: {
        canHaveAssignee: jaNee("Dossier kan een behandelaar hebben", "Een dossier kan aan een behandelaar worden toegewezen."),
        autoAssignTasks: jaNee("Taken vanzelf toewijzen", "Taken gaan vanzelf naar de behandelaar van het dossier."),
      },
    }),
    schema: groep("Documentdefinitie", {
      type: "object",
      "x-titel": "JSON Schema van de dossierinhoud",
      "x-omschrijving": "Het schema van het objecttype (zonder de verzoek-envelop) plus de behandelvelden uit de e-dienst.",
      properties: {
        $schema: tekst("Schemaversie", "Valtimo valideert met draft-07."),
        $id: tekst("Id van het schema", "`{id}` is de sleutel van het dossier.", { "x-placeholders": ["id"] }),
        bovenaanOpen: jaNee("Bovenaan open", "Geen `additionalProperties: false` op het hoogste niveau: de dossierinhoud groeit in GZAC."),
        formats: { type: "array", items: { type: "string" }, "x-titel": "Toegestane formats", "x-omschrijving": "De formats die draft-07 kent; de rest laat de schrijver weg (het patroon ernaast doet de controle)." },
      },
    }),
    componenten: groep("Dossierformulier", rijen("Component per veld", `Welk form.io-component een veld krijgt. ${EERSTE_PAST}`, REGEL("Component", "Het form.io-component."))),
    tabel: groep("Dossierformulier", {
      type: "object",
      "x-titel": "Lijst van objecten",
      "x-omschrijving": "Partijen en bijlagen: een tabel, alleen-lezen, zonder rijen toevoegen of weghalen.",
      properties: { naam: tekst("Regel", "Naam van de regel."), type: tekst("Component", "Het form.io-component.") },
    }),
    formulier: groep("Dossierformulier", {
      type: "object",
      "x-titel": "Opmaak",
      "x-omschrijving": "Kolommen en regels van de panelen, en de tekst op de verzendknop.",
      properties: {
        kolommen: getal("Kolommen", "Aantal kolommen in een paneel."),
        rijen: {
          type: "object",
          "x-titel": "Regels van een tekstvak",
          "x-omschrijving": "Hoogte van een vrij tekstveld.",
          properties: { alleenLezen: getal("Alleen-lezen", "In de samenvatting."), invoer: getal("Invoer", "In een behandelveld.") },
        },
        verzendLabel: tekst("Tekst op de verzendknop", "Bij een taakformulier."),
      },
    }),
    tabbladen: groep("Tabbladen", rijen("Standaardtabbladen", "De tabbladen van de dossierpagina, in volgorde.", {
      key: tekst("Sleutel", "Sleutel van het tabblad."),
      name: tekst("Naam", "Titel van het tabblad."),
      contentKey: tekst("Inhoud", "Wat GZAC op het tabblad toont."),
      showTasks: jaNee("Taken tonen", "Open taken boven het tabblad."),
    })),
    widgets: groep("Tabbladen", {
      type: "object",
      "x-titel": "Tabblad met widgets",
      "x-omschrijving": "Een eigen tabblad met de dossierinhoud in widgets.",
      properties: {
        na: tekst("Na tabblad", "Het tabblad komt na dit tabblad."),
        kleur: tekst("Kleur", "Achtergrond van een widget."),
        layout: tekst("Layout", "Hoe de widgets geschikt worden."),
        kolommen: getal("Kolommen", "Aantal kolommen in een widget."),
        paginagrootte: getal("Rijen per pagina", "In een widget met een lijst."),
        breedte: vrij("Breedte per soort widget", "In kolommen van het tabblad."),
        toegestaan: { type: "array", items: { type: "string" }, "x-titel": "Weergaven die een veld zelf mag kiezen", "x-omschrijving": "Een veld in de e-dienst kan een van deze weergaven noemen." },
        weergave: rijen("Weergave per veld", EERSTE_PAST, REGEL("Weergave", "Het weergavetype van GZAC.")),
      },
    }),
    lijst: groep("Dossierlijst", {
      type: "object",
      "x-titel": "Kolommen van de dossierlijst",
      "x-omschrijving": "Velden uit de dossierinhoud en gegevens die GZAC zelf bijhoudt.",
      properties: {
        dossier: { type: "object", additionalProperties: { type: "string" }, "x-titel": "Gegevens van GZAC", "x-omschrijving": "Wat GZAC zelf bij een dossier bijhoudt, met de weergave." },
        weergave: rijen("Weergave per veld", EERSTE_PAST, REGEL("Weergave", "Het weergavetype van de lijst.")),
        parameters: { type: "object", additionalProperties: vrij("", ""), "x-titel": "Parameters per weergave", "x-omschrijving": "Wat GZAC bij een weergavetype meekrijgt." },
      },
    }),
    statussen: groep("Statussen", {
      type: "object",
      "x-titel": "Dossierstatussen",
      "x-omschrijving": "De waarden komen uit de statuslijst van het model; dit is wat de e-dienst niet zegt.",
      properties: {
        zichtbaarInLijst: jaNee("Zichtbaar in de dossierlijst", "De status is te zien en te filteren in de lijst."),
        kleur: tekst("Kleur", "Kleur van de status."),
        vast: vrij("Velden die GZAC zelf invult", "Meegeleverd zodat een uitrol zonder wijziging 'ongewijzigd' meldt."),
      },
    }),
    processen: groep("Processen", {
      type: "object",
      "x-titel": "Processen bij het dossier",
      "x-omschrijving": "Elk BPMN-artefact van de e-dienst hoort bij het dossier.",
      properties: {
        canInitializeDocument: jaNee("Proces mag het dossier aanmaken", "Het dossier ontstaat uit het verzoek, niet uit een proces."),
        startableByUser: jaNee("Behandelaar mag het proces starten", "Met de hand, vanuit het dossier."),
      },
    }),
    documentkolommen: groep("Documentkolommen", rijen("Kolommen van het documentenoverzicht", "In volgorde; één kolom kan de sortering dragen.", {
      key: tekst("Kolom", "De sleutel van de kolom in GZAC."),
      sortering: { enum: ["ASC", "DESC"], "x-titel": "Sortering", "x-omschrijving": "Oplopend of aflopend." },
    })),
    zaaktypelink: groep("Zaaktypekoppeling", {
      type: "object",
      additionalProperties: { type: "string", "x-placeholders": ["zaaktype"] },
      "x-titel": "Koppeling dossier en zaaktype",
      "x-omschrijving": "`{zaaktype}` komt uit de e-dienst; een plaatshouder met een dollarteken vult de uitrol per omgeving in.",
    }),
  },
};

export const ZAAKTYPE_SCHRIJVER_SCHEMA = {
  type: "object",
  properties: {
    afleidingen: groep("Afleidingen", rijen("Wat de schrijver zelf invult", "Het zaaktype staat in de e-dienst; een afleiding vult een veld uit het model of het register.", {
      naam: tekst("Afleiding", "Naam van de afleiding."),
      doel: tekst("Veld in het zaaktype", "Het veld dat gevuld wordt."),
      uit: vrij("Uit", "Een veld van een referentielijst (M0) of van de e-dienst."),
      als: { enum: ["altijd", "ontbreekt"], "x-titel": "Wanneer", "x-omschrijving": "Altijd (een afwijkende waarde in de e-dienst is een fout) of alleen als de e-dienst het veld niet zet." },
    })),
    volgnummers: groep("Volgnummers", rijen("Nummeren op volgorde", "Een lijst zonder volgnummers krijgt ze uit de volgorde in de e-dienst.", {
      naam: tekst("Regel", "Naam van de regel."),
      lijst: tekst("Lijst", "De lijst in het zaaktype."),
      veld: tekst("Veld", "Het veld dat het volgnummer krijgt."),
    })),
  },
};
