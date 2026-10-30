// @ts-check
/**
 * dossierRegels — de **regelset** "canoniek model + e-dienst → GZAC-
 * dossierbundel" voor de inrichting van e-diensten (docs/TRANSFORMATIES.md
 * §11.9). Drie artefactsoorten, elk één bestand uit de dossierbundel van GZAC
 * (Valtimo):
 *
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
 *
 * Wat waar vandaan komt: type, enum, beschrijving en lengte uit het model (via
 * het objecttype-artefact en zijn traceregels); welke velden, hun volgorde, de
 * panelen en labels uit de e-dienst. Zonder label maakt de regelset er een uit
 * de veldnaam (ingediendOp → "Ingediend op"): het model heeft geen labels.
 */

export const CANONIEK_NAAR_DOSSIER = {
  id: "canoniek-naar-gzac-dossier",
  versie: "0.1.0",
  titel: "Canoniek model + e-dienst → GZAC-dossierbundel (documentdefinitie, form.io, tabbladen)",
  bron: "objecttype-artefact (uit canoniek-uml V3) + e-dienst",
  doel: "gzac-dossierbundel",

  // Het pad in de bundel leidt FUNDAMENT af uit soort + identifier
  // (afspraak 30-10): form/<id>.form.json, document/definition/<id>.schema.
  // document-definition.json, case/tab/<id>.case-tab.json. De identifier van
  // het dossierschema en de tabbladen is dus de key van het dossier.

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

  formulier: { kolommen: 2, rijen: { alleenLezen: 3, invoer: 4 }, verzendLabel: "Opslaan" },

  /** De vijf standaardtabbladen van een dossier (key, naam, inhoud). */
  tabbladen: [
    { key: "samenvatting", name: "Samenvatting", contentKey: "summary", showTasks: true },
    { key: "documenten", name: "Documenten", contentKey: "documents", showTasks: false },
    { key: "voortgang", name: "Voortgang", contentKey: "progress", showTasks: false },
    { key: "historie", name: "Historie", contentKey: "audit", showTasks: false },
    { key: "notities", name: "Notities", contentKey: "notes", showTasks: false },
  ],
};
