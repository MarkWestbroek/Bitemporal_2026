/**
 * voorbeelddata.js — vaste voorbeelddata voor de vormenbibliotheek (vormen.html). Geen API:
 * de waarden lijken op het CG-model (lagen, schaal, fase, API-standaarden) en np-loc (adres),
 * zodat de bibliotheek los te bekijken is. Gemeenten komen uit de kaartdata zelf.
 */
import kaart from "../data/nl-kaart.json";

export const LAGEN = ["Laag 5", "Laag 4", "Laag 3", "Laag 2", "Laag 1", "Hosting en infrastructuur", "Utility"];
const LAAG_NAMEN = ["Laag 5 · Interactie", "Laag 4 · Proces", "Laag 3 · Integratie", "Laag 2 · Services", "Laag 1 · Data", "Hosting en infrastructuur"];

export const LAGEN_CONFIG = {
  image: `${import.meta.env.BASE_URL}voorbeelden/cg-lagen-utility.svg`,
  alt: "Het Common Ground-vijflagenmodel met hosting eronder en Utility als kolom naast alle lagen",
  units: "px", width: 600, height: 420, maxWidth: "460px",
  areas: [
    ...LAGEN.slice(0, 6).map((w, i) => ({ value: w, label: LAAG_NAMEN[i], shape: "rect", coords: [20, 20 + i * 65, 470, 75 + i * 65] })),
    { value: "Utility", label: "Utility (dwars door alle lagen)", shape: "rect", coords: [480, 20, 580, 400] },
  ],
};

export const API_STANDAARDEN = ["ZGW API", "REST API", "StUF", "Haal Centraal BRP Personen API", "Notificaties API", "Documenten API", "OAuth 2.0",
  "Zaken API", "Catalogi API", "NL API Strategie", "Objecten API", "Autorisaties API", "CloudEvents profiel", "DSO API", "JWT", "OpenAPI",
  "BAG API", "CMIS", "DigiD", "SAML", "eHerkenning", "GeoJSON", "NLX", "Objecttypen API", "OData", "PDOK services", "WMS", "SOAP", "GraphQL"]
  .map((naam, i) => ({ value: String(i + 1), label: naam, order: i + 1 }));

export const PRODUCTTYPEN = ["Component", "Toepassing", "Standaard"].map((v) => ({ value: v, label: v }));
export const PRODUCTTYPE_KAARTEN = {
  items: {
    Component: { icon: "🧩", description: "Een onderdeel dat in een toepassing wordt gebruikt." },
    Toepassing: { icon: "🖥️", description: "Een bruikbare oplossing voor medewerkers of inwoners." },
    Standaard: { icon: "📐", description: "Afspraken over gegevens of koppelvlakken." },
  },
};

export const SCHAAL = ["Schaal 1", "Schaal 2", "Schaal 3", "Schaal 4"].map((v, i) => ({ value: v, label: ["1 · klein", "2", "3", "4 · groot"][i] }));
export const SCHAAL_KLEUREN = ["#fef3c7", "#fde68a", "#fcd34d", "#fbbf24"];
export const BIJDRAGEN = [
  { value: "Wendbaarheid", label: "Wendbaarheid", description: "sneller en goedkoper kunnen veranderen" },
  { value: "Dienstverlening", label: "Dienstverlening", description: "betere dienstverlening aan inwoners en ondernemers" },
  { value: "Regie", label: "Regie", description: "meer grip op gegevens en IT" },
];

export const FASEN = ["Idee (nog geen concrete opbrengsten)", "Initiatie (al een snelle POC)", "Realisatie (gaat binnenkort draaien bij eerste gemeenten)",
  "Opschaling (draait bij enkele gemeenten, nu op zoek naar verbreding)", "Doorontwikkeling en beheer", "Doorontwikkeling en beheer (stabiel, onderdeel gevestigde orde)"]
  .map((v) => ({ value: v, label: v }));
export const FASE_LABELS = Object.fromEntries(FASEN.map((f, i) => [f.value, ["Idee", "Initiatie", "Realisatie", "Opschaling", "Beheer", "Gevestigd"][i]]));

/** Alle gemeenten uit de kaartdata, als keuzebron (value = CBS-code, zoals een referentielijst-item). */
export const GEMEENTEN = Object.entries(kaart.gemeenten).map(([code, g]) => ({ value: code, label: g.naam, code }))
  .sort((a, b) => a.label.localeCompare(b.label, "nl"));

export const ADRES_VELDEN = {
  straatnaam: "Locatie.adres.straatnaam", huisnummer: "Locatie.adres.huisnummer", postcode: "Locatie.adres.postcode",
  woonplaatsnaam: "Locatie.adres.plaats", gemeentenaam: "Locatie.adres.gemeente", land: "Locatie.adres.land",
};
