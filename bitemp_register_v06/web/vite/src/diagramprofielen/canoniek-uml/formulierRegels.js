// @ts-check
/**
 * formulierRegels — de **regelset** "canoniek model → formulier (Open
 * Formulieren / Form.io)".
 *
 * Bron: het graafbeeld uit `transformatie/formulierGraaf.js` (`aard` =
 * formulier | stap | veld, met de opgeloste V3-feiten van elk veld). Doel: het
 * vocabulaire van de Open Formulieren-schrijver
 * (`transformatie/openformsSchrijver.js`): formulier | stap | component, met
 * Form.io-eigenschappen als data.
 *
 * De regels kiezen de **vorm** uit de **inhoud** van het model: een verwijzing
 * naar een referentielijst → keuzelijst (select), een enum → keuzerondjes
 * (radio), ja/nee → vinkje, een geheel getal → getal, een e-mailadres → email,
 * lange tekst → tekstvak, anders een tekstveld. Wijkt een e-dienst daarvan af,
 * dan noemt hij `component` bij het veld en wint die. Lengte en patroon komen
 * uit het datatype, zodat het formulier weigert wat het objecttype weigert.
 *
 * Wat hier níét staat: welke velden, in welke stap, met welk label — dat is de
 * e-dienst (gehandicaptenparkeerkaart-edienst.json). Deze regelset geldt voor
 * elk canoniek model (M2, §9.0).
 */

/** Wat elke component meekrijgt; de schrijver laat lege waarden weg. */
const BASIS = {
  key: "{eigenschappen.key}",
  label: "{eigenschappen.label}",
  hulptekst: "{eigenschappen.hulptekst}",
  verplicht: "{eigenschappen.verplicht}",
  valideerVerplicht: "{eigenschappen.valideerVerplicht}",
  conditional: "{eigenschappen.conditional}",
};
/** Tekstvelden ook lengte en patroon uit het datatype. */
const TEKST = { ...BASIS, maxLength: "{eigenschappen.maxLength}", pattern: "{eigenschappen.pattern}" };

const component = (naam, als, type, data = BASIS) => ({ naam, bij: "knoop", als: { aard: "veld", ...als }, maak: { type: "component", naam: "{tekst}", data: { ...data, type } } });

export const CANONIEK_NAAR_FORMULIER = {
  id: "canoniek-naar-formulier",
  versie: "0.2.0",
  titel: "Canoniek model → formulier (Open Formulieren)",
  bron: "canoniek-uml (V3) + e-dienst",
  doel: "openforms-export",
  regels: [
    {
      naam: "Formulier uit het e-dienstartefact",
      bij: "groep",
      als: { aard: "formulier" },
      maak: { type: "formulier", naam: "{tekst}", data: { slug: "{eigenschappen.slug}", inloggen: "{eigenschappen.inloggen}" } },
    },
    { naam: "Stap", bij: "groep", als: { aard: "stap" }, maak: { type: "stap", naam: "{tekst}", data: { slug: "{eigenschappen.slug}" } } },

    // ── Vorm uit de inhoud; de eerste die past wint ──
    {
      naam: "Vorm die de e-dienst noemt",
      bij: "knoop",
      als: { aard: "veld", vasteVorm: true },
      // Lengte en patroon van het datatype passen niet bij elke vorm (een
      // bestand is geen tekst): bij een gekozen vorm alleen de basis.
      maak: { type: "component", naam: "{tekst}", data: { ...BASIS, type: "{eigenschappen.component}", bestand: "{eigenschappen.bestand}" } },
    },
    component("Verwijzing naar een referentielijst → keuzelijst", { refAls: "code" }, "select", { ...BASIS, waarden: "{eigenschappen.waarden}" }),
    component("Enum → keuzerondjes", { heeftEnum: true }, "radio", { ...BASIS, waarden: "{eigenschappen.waarden}" }),
    component("Ja/nee → vinkje", { basistype: "boolean" }, "checkbox"),
    component("Geheel getal → getalveld zonder decimalen", { basistype: "integer" }, "number", { ...BASIS, decimalLimit: 0 }),
    component("Getal → getalveld", { basistype: "number" }, "number"),
    component("E-mailadres → e-mailveld", { format: "email" }, "email", TEKST),
    component("Datum → datumveld", { format: "date" }, "date"),
    component("Tijdstip → datum-tijdveld", { format: "date-time" }, "datetime"),
    component("Telefoonnummer → telefoonveld", { format: "phone" }, "phoneNumber", TEKST),
    component("Lange tekst → tekstvak", { datatype: "LangeTekst" }, "textarea", TEKST),
    component("Overig → tekstveld", {}, "textfield", TEKST),
  ],
};
