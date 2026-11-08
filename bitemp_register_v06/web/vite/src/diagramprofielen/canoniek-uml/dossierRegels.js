// @ts-check
/**
 * dossierRegels — de **regelset** "canoniek model + e-dienst → GZAC-
 * dossierbundel" voor de inrichting van e-diensten (docs/TRANSFORMATIES.md
 * §11.9). Acht artefactsoorten, elk één bestand uit de dossierbundel van GZAC
 * (Valtimo):
 *
 * - `dossierdefinitie` (gzac-case-definition-json): de wortel van de bundel:
 *   sleutel, naam, versie en beschrijving van het dossier uit de e-dienst, en
 *   hoe taken aan behandelaars toegewezen worden.
 * - `dossierschema` (json-schema): de documentdefinitie, het JSON Schema van
 *   de dossierinhoud. Dat is het schema van het objecttype (zonder de
 *   verzoek-envelop, want de Verzoek-plugin kopieert `data`) plus de
 *   **behandelvelden** die de behandelaar vult (bv. de beoordeling). Die kent
 *   het canonieke model nog niet; ze staan in de e-dienst.
 * - `dossierformulier` (formio-json): een form.io-formulier op de
 *   dossierinhoud. Een paneel met de aanvraagvelden alleen-lezen in kolommen
 *   (de samenvatting), en bij een taakformulier daaronder een paneel met
 *   behandelvelden en een verzendknop.
 * - `dossiertabbladen` (gzac-case-tab-json): de tabbladen van de dossierpagina;
 *   generiek, een sjabloon uit deze regelset.
 * - `dossierzaaktypelink` (gzac-zaak-type-link-json): de koppeling van het
 *   dossier aan zijn zaaktype. Welk zaaktype en of het dossier bij aanmaken
 *   meteen een zaak krijgt, staat in de e-dienst; de url van het zaaktype, de
 *   Zaken API-plugin en de RSIN zijn gegevens van de omgeving en gaan als
 *   plaatshouder mee, die de uitrol (FUNDAMENT) invult.
 * - `dossierprocessen` (gzac-process-document-link-json): welke processen bij
 *   het dossier horen: elk bpmn-artefact van de e-dienst.
 * - `dossierdocumentkolommen` (gzac-zgw-document-list-column-json): de kolommen
 *   van het documentenoverzicht; generiek, een sjabloon uit deze regelset.
 * - `dossierstatussen` (gzac-internal-case-status-json): de statussen van het
 *   dossier. Dat zijn waarden uit een statuslijst van het canonieke model (de
 *   e-dienst noemt de lijst): standaard de waarden die een taak in een proces
 *   van de e-dienst zet. Kleur en zichtbaarheid zijn vormgeving en komen uit
 *   deze regelset of de e-dienst.
 *
 * Wat waar vandaan komt: type, enum, beschrijving en lengte uit het model (via
 * het objecttype-artefact en zijn traceregels); welke velden, hun volgorde, de
 * panelen en labels uit de e-dienst. Zonder label maakt de regelset er een uit
 * de veldnaam (ingediendOp → "Ingediend op"): het model heeft geen labels.
 */

export const CANONIEK_NAAR_DOSSIER = {
  id: "canoniek-naar-gzac-dossier",
  versie: "0.6.0",
  titel: "Canoniek model + e-dienst → GZAC-dossierbundel (definitie, documentdefinitie, form.io, tabbladen, zaaktypekoppeling, processen, documentkolommen, statussen)",
  bron: "objecttype-artefact (uit canoniek-uml V3) + e-dienst",
  doel: "gzac-dossierbundel",

  // Het pad in de bundel leidt FUNDAMENT af uit soort + identifier
  // (afspraak 30-10): form/<id>.form.json, document/definition/<id>.schema.
  // document-definition.json, case/tab/<id>.case-tab.json,
  // zgw/zaak-type-link/<id>.zaak-type-link.json, case/definition/<id>.
  // case-definition.json, process-document-link/<id>.process-document-link.json,
  // zgw/document-list-column/<id>.zgw-document-list-column.json,
  // case/internal-status/<id>.internal-case-status.json,
  // case/widget-tab/<id>.case-widget-tab.json (dossierwidgettabbladen, 08-11). De identifier
  // van die delen is dus de key van het dossier; alleen een dossierformulier
  // heeft een eigen identifier.

  /**
   * Dossierdefinitie: wat de e-dienst niet zegt. Een dossier kan een
   * behandelaar hebben; taken worden niet vanzelf aan hem toegewezen.
   */
  definitie: { canHaveAssignee: true, autoAssignTasks: false },

  /**
   * Processen bij het dossier: het dossier ontstaat uit het verzoek (Verzoek-
   * plugin), niet uit een proces, en een behandelaar start een proces niet met
   * de hand.
   */
  processen: { canInitializeDocument: false, startableByUser: false },

  /**
   * Dossierstatus: de sleutel in GZAC is de waarde uit het model met
   * koppeltekens (`sleutel.js`), de titel komt uit de naam van de waarde. Wat
   * de e-dienst niet zegt: de status is zichtbaar in de dossierlijst, in grijs.
   * `vast` zijn de velden die GZAC zelf invult (geen bewaartermijn, geen
   * label); we leveren ze mee, zodat een uitrol zonder wijziging "ongewijzigd"
   * meldt (FUNDAMENT 05-11).
   */
  statussen: { zichtbaarInLijst: true, kleur: "WARMGRAY", vast: { retentionPeriodInDays: -1, label: null } },

  /** De kolommen van het documentenoverzicht (ZGW-documenten), nieuwste bovenaan. */
  documentkolommen: [
    { key: "TITEL" },
    { key: "CREATIEDATUM", sortering: "DESC" },
    { key: "AUTEUR" },
    { key: "BESTANDSOMVANG" },
    { key: "INFORMATIEOBJECTTYPE_OMSCHRIJVING" },
  ],

  /** Documentdefinitie: Valtimo valideert met JSON Schema draft-07; $id = naam + ".schema". */
  schema: {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "{id}.schema",
    // Bovenaan open (geen additionalProperties: false): de dossierinhoud groeit
    // in GZAC met behandelvelden en wat een taakformulier meestuurt. Dieper in
    // het schema (partijen, bijlagen) blijven de beperkingen van het model.
    bovenaanOpen: true,
    // Formats die draft-07 kent; de rest (bsn, kenteken, int32, …) laat de
    // schrijver weg: het patroon dat ernaast staat doet de controle.
    formats: ["date-time", "date", "time", "email", "idn-email", "hostname", "idn-hostname", "ipv4", "ipv6", "uri", "uri-reference", "iri", "iri-reference", "uri-template", "json-pointer", "relative-json-pointer", "regex"],
  },

  /**
   * Form.io-component per veld, de eerste regel die past. `als` toetst het
   * (samengestelde) schema van het veld.
   */
  componenten: [
    { naam: "Keuze bij een behandelveld: radio", als: { enum: true, behandelveld: true }, type: "radio" },
    { naam: "Ja/nee: checkbox", als: { type: "boolean" }, type: "checkbox" },
    { naam: "Getal: number", als: { type: ["integer", "number"] }, type: "number" },
    { naam: "Vrije tekst zonder lengte: textarea", als: { type: "string", vrijeTekst: true }, type: "textarea" },
    { naam: "Overige tekst (ook keuzes en tijdstippen alleen-lezen): textfield", als: {}, type: "textfield" },
  ],

  /** Een lijst van objecten (partijen, bijlagen) in een dossierformulier: een tabel, alleen-lezen zonder rijen toevoegen of weghalen (0.5.0). */
  tabel: { naam: "Lijst van objecten: datagrid", type: "datagrid" },

  /**
   * Tabbladen met widgets (0.5.0, vorm uit de handmatige proef op cg-test,
   * INRICHTEN_VIZ 08-11). Het tabblad komt in de tabbladen na `na`. Weergave
   * per veld: de eerste regel die past. Een enum toont de waarde als tekst
   * (het weergavetype enum vraagt labels; niet getest). Een documentUrl wordt
   * niet vanzelf een link (die wijst naar de Documenten-API zonder token); een
   * veld kiest zelf een weergave uit `toegestaan` (0.6.0: de collection waar
   * het pasfoto-widget uit leest, toont documentUrl als tekst: "link" toont
   * GZAC 13.50 in een collection als ruwe HTML, GZAC-WIDGET 08-11).
   */
  widgets: {
    na: "samenvatting",
    kleur: "WHITE",
    layout: "MUURI_GAP_FREE",
    kolommen: 2,
    paginagrootte: 4,
    breedte: { fields: 2, collection: 2 },
    toegestaan: ["text", "date", "datetime", "boolean", "number", "link"],
    weergave: [
      { naam: "Ja/nee", als: { type: "boolean" }, type: "boolean" },
      { naam: "Getal", als: { type: ["integer", "number"] }, type: "number" },
      { naam: "Datum", als: { format: "date" }, type: "date" },
      { naam: "Tijdstip", als: { format: "date-time" }, type: "datetime" },
      { naam: "Overige: tekst", als: {}, type: "text" },
    ],
  },

  formulier: { kolommen: 2, rijen: { alleenLezen: 3, invoer: 4 }, verzendLabel: "Opslaan" },

  /** De vijf standaardtabbladen van een dossier (key, naam, inhoud). */
  tabbladen: [
    { key: "samenvatting", name: "Samenvatting", contentKey: "summary", showTasks: true },
    { key: "documenten", name: "Documenten", contentKey: "documents", showTasks: false },
    { key: "voortgang", name: "Voortgang", contentKey: "progress", showTasks: false },
    { key: "historie", name: "Historie", contentKey: "audit", showTasks: false },
    { key: "notities", name: "Notities", contentKey: "notes", showTasks: false },
  ],

  /**
   * Koppeling dossier ↔ zaaktype. `{zaaktype}` is de identifier van het
   * zaaktype uit de e-dienst; de plaatshouders vult de uitrol per omgeving
   * in: de url van het uitgerolde zaaktype, de configuratie van de Zaken
   * API-plugin (`zakenapi` is de pluginDefinitionKey van GZAC) en de RSIN van
   * de organisatie. Namen afgesproken met FUNDAMENT (05-11).
   */
  zaaktypelink: {
    zaakTypeUrl: "${ZAAKTYPE_URL:{zaaktype}}",
    zakenApiPluginConfigurationId: "${PLUGINCONFIG_ID:zakenapi}",
    rsin: "${ORGANISATIE_RSIN}",
  },
};
