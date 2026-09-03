// @ts-check
/**
 * archimate/elementen — de volledige ArchiMate 3.2-elemententabel als pure
 * data, los van `index.js` (dat shapes/iconen importeert en dus niet in de
 * node-testrunner laadbaar is — patroon `bpmn/sequenceFlow.js`).
 *
 * **Waarom volledig (04-09):** de v0-subset van 22 typen strandde op de
 * eerste echte Archi-export van Mark — Capability, ApplicationInterface,
 * Grouping, Resource, CommunicationNetwerk enz. zijn in gangbare modellen
 * (GEMMA!) geen randgevallen. Dit is de "volledige elemententabel"-stap uit
 * het notatie-plan §3 fase 2; de **relatiematrix** blijft daarvan het open
 * restant, net als nesting via containers.
 *
 * Vorm blijft één verhaal: alles is de `archimate-box` met laagkleur en
 * hoek-icoon; gedrag = ronde hoeken, structuur = recht, motivation =
 * afgeschuind (afgeleid van de laagkleur in index.js). De tabel is dus louter
 * data — geen nieuwe shapes nodig.
 *
 * Tuple: [id, label, laagkleur, icoon, rond?, omschrijving, kort?]
 * (`kort` alleen waar de afgeleide knoptekst lelijk zou afbreken).
 */

// Laag-kleuren (conventie uit het notatie-plan §2.1; per element
// overschrijfbaar via data.kleur). Physical hoort bij de technology-laag en
// deelt dus die kleur; locatie/grouping zijn laag-loos ("overig").
export const STRATEGY = "#fff0e0";
export const BUSINESS = "#fff4b8";
export const APPLICATION = "#cfe6ff";
export const TECHNOLOGY = "#d3f5cf";
export const MOTIVATION = "#e8d9f5";
export const IMPLEMENTATIE = "#ffe6f0";
export const OVERIG = "#f1f5f9";

/** Laagkleur → taakbalkgroep (scheidingstekens in de Maken-balk). */
export const LAAG_GROEP = {
  [STRATEGY]: "strategy",
  [BUSINESS]: "business",
  [APPLICATION]: "application",
  [TECHNOLOGY]: "technology",
  [MOTIVATION]: "motivation",
  [IMPLEMENTATIE]: "realisatie",
  [OVERIG]: "overig",
};

/** @type {[string, string, string, string, boolean, string, string?][]} */
export const ELEMENTEN = [
  // ── strategy ──
  ["resource", "Resource", STRATEGY, "am-resource", false, "Bezit of middel van de organisatie (mensen, kapitaal, informatie)."],
  ["capability", "Capability", STRATEGY, "am-capability", true, "Vermogen dat de organisatie bezit of wil ontwikkelen."],
  ["koers", "Course of action", STRATEGY, "am-koers", true, "Aanpak of plan om capabilities in te zetten richting het doel."],
  ["waardestroom", "Value stream", STRATEGY, "am-waardestroom", true, "Reeks waarde-toevoegende activiteiten, van trigger tot resultaat."],
  // ── business ──
  ["business-actor", "Business actor", BUSINESS, "am-actor", false, "Organisatie-entiteit die gedrag kan uitvoeren (persoon, afdeling, organisatie)."],
  ["business-rol", "Business rol", BUSINESS, "am-rol", false, "Verantwoordelijkheid die aan een actor toegewezen wordt."],
  ["business-collaboratie", "Business collaboratie", BUSINESS, "am-collaboratie", false, "Samenwerkingsverband van rollen/actoren voor gezamenlijk gedrag."],
  ["business-interface", "Business interface", BUSINESS, "am-interface", false, "Kanaal waarlangs een business service beschikbaar is (balie, telefoon)."],
  ["business-proces", "Business proces", BUSINESS, "am-proces", true, "Reeks gedragingen die een product of dienst oplevert."],
  ["business-functie", "Business functie", BUSINESS, "am-functie", true, "Gedrag gebundeld op benodigde kennis/kunde (afdelings-agnostisch)."],
  ["business-interactie", "Business interactie", BUSINESS, "am-interactie", true, "Gedrag dat twee of meer rollen sámen uitvoeren."],
  ["business-service", "Business service", BUSINESS, "am-service", true, "Expliciet aangeboden dienst met waarde voor de omgeving."],
  ["business-event", "Business event", BUSINESS, "am-event", true, "Gebeurtenis die business-gedrag start of beïnvloedt."],
  ["business-object", "Business object", BUSINESS, "am-object", false, "Concept dat in de business gebruikt wordt (passieve structuur)."],
  ["contract", "Contract", BUSINESS, "am-contract", false, "Formele afspraak over rechten en plichten (specialisatie van business object)."],
  ["representatie", "Representatie", BUSINESS, "am-representatie", false, "Waarneembare vorm van een business object (brief, formulier, bestand)."],
  ["product", "Product", BUSINESS, "am-product", false, "Samenhangend pakket van services en contract(en) met waarde voor de klant."],
  // ── application ──
  ["app-component", "Applicatiecomponent", APPLICATION, "am-component", false, "Modulair, zelfstandig inzetbaar stuk applicatie-functionaliteit."],
  ["app-collaboratie", "Applicatiecollaboratie", APPLICATION, "am-collaboratie", false, "Samenwerkende applicatiecomponenten voor gezamenlijk gedrag."],
  ["app-interface", "Applicatie-interface", APPLICATION, "am-interface", false, "Toegangspunt waar een component zijn diensten aanbiedt (API, scherm)."],
  ["app-functie", "Applicatiefunctie", APPLICATION, "am-functie", true, "Intern gedrag van een applicatiecomponent."],
  ["app-interactie", "Applicatie-interactie", APPLICATION, "am-interactie", true, "Gedrag dat componenten sámen uitvoeren."],
  ["app-proces", "Applicatieproces", APPLICATION, "am-proces", true, "Reeks applicatiegedragingen richting een resultaat."],
  ["app-event", "Applicatie-event", APPLICATION, "am-event", true, "Gebeurtenis op applicatieniveau (bericht binnen, timer)."],
  ["app-service", "Applicatieservice", APPLICATION, "am-service", true, "Expliciet aangeboden applicatiedienst."],
  ["data-object", "Data-object", APPLICATION, "am-object", false, "Gegevens geschikt voor geautomatiseerde verwerking."],
  // ── technology (incl. physical) ──
  ["node", "Node", TECHNOLOGY, "am-node", false, "Reken-/opslagresource waarop artifacts draaien."],
  ["device", "Device", TECHNOLOGY, "am-device", false, "Fysiek IT-middel (server, telefoon, sensor)."],
  ["systeemsoftware", "Systeemsoftware", TECHNOLOGY, "am-software", false, "Software-omgeving voor het draaien van componenten (OS, DBMS)."],
  ["tech-collaboratie", "Technology-collaboratie", TECHNOLOGY, "am-collaboratie", false, "Samenwerkende nodes voor gezamenlijk technologiegedrag."],
  ["tech-interface", "Technology-interface", TECHNOLOGY, "am-interface", false, "Toegangspunt waar een node zijn diensten aanbiedt."],
  ["pad", "Pad", TECHNOLOGY, "am-pad", false, "Verbinding waarlangs nodes gegevens uitwisselen (realiseert een netwerk)."],
  ["communicatienetwerk", "Communicatienetwerk", TECHNOLOGY, "am-netwerk", false, "Verzameling verbonden communicatiemiddelen (LAN, internet).", "netwerk"],
  ["tech-functie", "Technology-functie", TECHNOLOGY, "am-functie", true, "Intern gedrag van een node."],
  ["tech-proces", "Technology-proces", TECHNOLOGY, "am-proces", true, "Reeks technologiegedragingen richting een resultaat."],
  ["tech-interactie", "Technology-interactie", TECHNOLOGY, "am-interactie", true, "Gedrag dat nodes sámen uitvoeren."],
  ["tech-event", "Technology-event", TECHNOLOGY, "am-event", true, "Gebeurtenis op technologieniveau."],
  ["tech-service", "Technologyservice", TECHNOLOGY, "am-service", true, "Expliciet aangeboden infrastructuurdienst."],
  ["artifact", "Artifact", TECHNOLOGY, "am-artifact", false, "Fysiek stuk data/software (bestand, deployable)."],
  ["equipment", "Equipment", TECHNOLOGY, "am-equipment", false, "Fysieke machines of gereedschap (physical-laag)."],
  ["facility", "Facility", TECHNOLOGY, "am-facility", false, "Fysieke voorziening of gebouw (fabriek, datacenter)."],
  ["distributienetwerk", "Distributienetwerk", TECHNOLOGY, "am-distributie", false, "Fysiek netwerk voor transport van materialen of energie.", "distributie"],
  ["materiaal", "Materiaal", TECHNOLOGY, "am-materiaal", false, "Tastbare grondstof of product (physical-laag)."],
  // ── motivation ──
  ["stakeholder", "Stakeholder", MOTIVATION, "am-stakeholder", false, "Belanghebbende met interesse in de architectuur-uitkomst."],
  ["driver", "Driver", MOTIVATION, "am-driver", false, "Interne of externe drijfveer voor verandering."],
  ["assessment", "Assessment", MOTIVATION, "am-assessment", false, "Uitkomst van een analyse van een driver (SWOT-bevinding)."],
  ["goal", "Goal", MOTIVATION, "am-goal", false, "Beoogd resultaat (doel) van een stakeholder."],
  ["outcome", "Outcome", MOTIVATION, "am-outcome", false, "Bereikt eindresultaat, meetbaar gemaakt."],
  ["principle", "Principle", MOTIVATION, "am-principle", false, "Algemene ontwerpuitspraak die richting geeft."],
  ["requirement", "Requirement", MOTIVATION, "am-requirement", false, "Concrete eis aan het systeem of de architectuur."],
  // ArchiMate 3: Constraint is een specialisatie van Requirement — een
  // opgelegde beperking, bv. wet- en regelgeving (grondslag van toegangsbeleid).
  ["constraint", "Constraint", MOTIVATION, "am-requirement", false, "Opgelegde beperking op realisatie (bv. wet- en regelgeving)."],
  ["betekenis", "Betekenis (meaning)", MOTIVATION, "am-betekenis", false, "De betekenis of interpretatie van een business object.", "betekenis"],
  ["waarde", "Waarde (value)", MOTIVATION, "am-waarde", false, "Het belang of nut van een element voor een stakeholder.", "waarde"],
  // ── implementatie & migratie ──
  ["werkpakket", "Werkpakket", IMPLEMENTATIE, "am-werkpakket", true, "Afgebakende reeks acties met begin en eind (project, sprint)."],
  ["deliverable", "Deliverable", IMPLEMENTATIE, "am-deliverable", false, "Precies omschreven resultaat van een werkpakket."],
  ["implementatie-event", "Implementatie-event", IMPLEMENTATIE, "am-event", true, "Gebeurtenis in de verandering (go-live, oplevering).", "impl-event"],
  ["plateau", "Plateau", IMPLEMENTATIE, "am-plateau", false, "Relatief stabiele tussentoestand van de architectuur."],
  ["gap", "Gap", IMPLEMENTATIE, "am-gap", false, "Verschil tussen twee plateaus (wat er nog ontbreekt)."],
  // ── overig ──
  ["locatie", "Locatie", OVERIG, "am-locatie", false, "Conceptuele of fysieke plaats waar elementen zich bevinden."],
  // Grouping is een écht modelelement (anders dan het view-only kader);
  // nesting-als-notatie blijft het bekende v1-restant — de groepsleden
  // verbind je vooralsnog met aggregatie/compositie.
  ["grouping", "Grouping", OVERIG, "am-groep", false, "Groepeert elementen die iets delen (domein, thema)."],
];

/** Alle element-ids, inclusief de junction (die staat apart in index.js). */
export const ELEMENT_IDS = [...ELEMENTEN.map(([id]) => id), "junction"];
