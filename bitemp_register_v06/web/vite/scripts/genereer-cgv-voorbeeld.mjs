/**
 * genereer-cgv-voorbeeld — het CGV use case-model als volledig gegenereerd
 * document (sjabloon "Projectdocument (volgt de mappen)"): de mappenboom is de
 * hoofdstukindeling, de omschrijving van elke map de tekst, de diagrammen in de
 * map de platen — ook de lagenplaat, als gewoon Omnium-diagram.
 * Uitvoer: docs/voorbeelden/documenten/CGV_Use_case_model-gegenereerd.md (+ SVG's).
 * Gebruik: node scripts/genereer-cgv-voorbeeld.mjs (vanuit web/vite).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { maakDocumentContext } from "../src/transformatie/sjabloon/context.js";
import { schetsDiagramSvg } from "../src/transformatie/sjabloon/schets.js";
import { renderSjabloon } from "../src/transformatie/sjabloon/renderer.js";
import { INGEBOUWDE_SJABLONEN } from "../src/transformatie/sjabloon/sjablonen.js";

const hier = dirname(fileURLToPath(import.meta.url));
const uitMap = join(hier, "../../../docs/voorbeelden/documenten");
mkdirSync(uitMap, { recursive: true });
const STAM = "CGV_Use_case_model-gegenereerd";

// Use case-profiel (uittreksel) + een eenvoudig "lagen"-profiel voor de overzichtsplaat.
const ucDescriptor = { elementTypes: [
  { id: "actor", label: "Actor", shape: "uc-actor" },
  { id: "usecase", label: "Use case", shape: "uc-ellips", kleur: "#e0f2fe" },
  { id: "associatie", label: "Associatie", isConnector: true, edgePresentatie: { lijn: "solid" } },
  { id: "include", label: "Include", isConnector: true, edgePresentatie: { lijn: "dash-4-3", markerEnd: "pijl-open" } },
  { id: "extend", label: "Extend", isConnector: true, edgePresentatie: { lijn: "dash-4-3", markerEnd: "pijl-open" } },
  { id: "generalisatie", label: "Generalisatie", isConnector: true, edgePresentatie: { lijn: "solid", markerEnd: "driehoek" } },
] };
const lagenDescriptor = { elementTypes: [
  { id: "laag", label: "Laag", shape: "package", achtergrond: true },
  { id: "component", label: "Component", shape: "rounded", kleur: "#ede9fe" },
  { id: "actor", label: "Actor", shape: "uc-actor" },
  { id: "gebruikt", label: "Gebruikt", isConnector: true, edgePresentatie: { lijn: "solid", markerEnd: "pijl-dicht" } },
] };

const el = (id, naam, elementType, data = {}) => ({ id, naam, elementType, data, compartimenten: [] });
const con = (id, elementType, source, target, naam = "") => ({ id, naam, elementType, source, target, data: {} });
const n = (elementId, x, y, size) => ({ elementId, position: { x, y }, ...(size ? { size } : {}) });
const per = (lijst) => Object.fromEntries(lijst.map((x) => [x.id, x]));
const grijs = { kleur: "#e5e7eb" };

// ── Map 1: CGV — inleiding + lagenplaat ──
const lagen = per([
  el("l1", "Actoren", "laag"), el("l2", "Applicaties (buiten scope)", "laag"), el("l3", "Integratievoorzieningen", "laag"), el("l4", "Gegevens", "laag"),
  el("klant", "Klant", "actor"), el("mw", "Medewerker", "actor"),
  el("of", "OpenFormulieren", "component", grijs), el("nlp", "NLPortal", "component", grijs), el("kiss", "KISS", "component", grijs), el("gzac", "GZAC", "component", grijs),
  el("fsc", "OpenFSC", "component"), el("ftv", "OpenFTV", "component"),
  el("oz", "OpenZaak", "component"), el("ok", "OpenKlant", "component"), el("oo", "OpenObject", "component"),
  con("c1", "gebruikt", "klant", "ok"), con("c2", "gebruikt", "mw", "oz"), con("c3", "gebruikt", "mw", "ok"), con("c4", "gebruikt", "mw", "oo"),
]);
const lagenDiagram = { d0: { id: "d0", naam: "Lagen van de CGV", diagramType: "lagen", nodes: [
  n("l1", 0, 0, { width: 760, height: 150 }), n("klant", 230, 30), n("mw", 450, 30),
  n("l2", 0, 170, { width: 760, height: 100 }), n("of", 20, 210, { width: 170, height: 44 }), n("nlp", 205, 210, { width: 170, height: 44 }), n("kiss", 390, 210, { width: 170, height: 44 }), n("gzac", 575, 210, { width: 170, height: 44 }),
  n("l3", 0, 290, { width: 760, height: 100 }), n("fsc", 150, 330, { width: 200, height: 44 }), n("ftv", 410, 330, { width: 200, height: 44 }),
  n("l4", 0, 410, { width: 760, height: 100 }), n("oz", 60, 450, { width: 190, height: 44 }), n("ok", 285, 450, { width: 190, height: 44 }), n("oo", 510, 450, { width: 190, height: 44 }),
] } };

// ── Map 2: Actoren — actormodel ──
const actoren = per([
  el("a-klant", "Klant", "actor"), el("a-inw", "Inwoner", "actor"), el("a-bedr", "Bedrijf", "actor"),
  el("a-mw", "Medewerker", "actor"), el("a-gem", "Medewerker gemeente", "actor"), el("a-regie", "Medewerker regie-organisatie", "actor"),
  el("a-beh", "Beheerder", "actor"), el("a-zb", "Zaakbehandelaar", "actor"),
  con("g1", "generalisatie", "a-inw", "a-klant"), con("g2", "generalisatie", "a-bedr", "a-klant"),
  con("g3", "generalisatie", "a-gem", "a-mw"), con("g4", "generalisatie", "a-regie", "a-mw"),
  con("g5", "generalisatie", "a-beh", "a-gem"), con("g6", "generalisatie", "a-zb", "a-gem"),
]);
const actorDiagram = { d1: { id: "d1", naam: "Actormodel", diagramType: "usecase", nodes: [
  n("a-klant", 110, 0), n("a-inw", 20, 170), n("a-bedr", 200, 170),
  n("a-mw", 520, 0), n("a-gem", 420, 170), n("a-regie", 640, 170), n("a-beh", 340, 340), n("a-zb", 500, 340),
] } };

// ── Map 3/4: Use cases per actor ──
const ucKlant = per([
  el("u-klant", "Klant", "actor"),
  el("u-zoek", "Zoek informatie over producten en diensten", "usecase", { toelichting: "De klant zoekt zelf; de CGV levert de productgegevens via een API." }),
  el("u-aanvr", "Vraag product of dienst aan", "usecase", { toelichting: "Een formulier legt de aanvraag vast als zaak met klantgegevens." }),
  el("u-voortg", "Bekijk voortgang", "usecase", { toelichting: "Status van de eigen zaken, uit OpenZaak via het portaal." }),
  con("k1", "associatie", "u-klant", "u-zoek"), con("k2", "associatie", "u-klant", "u-aanvr"),
  con("k3", "extend", "u-voortg", "u-aanvr"),
]);
const ucKlantDiagram = { d2: { id: "d2", naam: "Use cases Klant", diagramType: "usecase", nodes: [
  n("u-klant", 0, 120), n("u-zoek", 200, 20, { width: 220, height: 72 }), n("u-aanvr", 200, 160, { width: 220, height: 64 }), n("u-voortg", 480, 160),
] } };
const ucMw = per([
  el("m-mw", "Medewerker", "actor"),
  el("m-zaak", "Behandel zaak", "usecase", { toelichting: "De zaakbehandelaar werkt de zaak af; de zaakgegevens staan in OpenZaak." }),
  el("m-klant", "Raadpleeg klantbeeld", "usecase", { toelichting: "Contacten en gegevens van de klant uit OpenKlant." }),
  el("m-obj", "Registreer object", "usecase"),
  con("w1", "associatie", "m-mw", "m-zaak"), con("w2", "associatie", "m-mw", "m-obj"),
  con("w3", "include", "m-zaak", "m-klant"),
]);
const ucMwDiagram = { d3: { id: "d3", naam: "Use cases Medewerker", diagramType: "usecase", nodes: [
  n("m-mw", 0, 100), n("m-zaak", 200, 40), n("m-obj", 200, 180), n("m-klant", 460, 40),
] } };

const INLEIDING = [
  "De Collectieve Gegevensvoorziening (CGV) is een systeem dat functionaliteiten biedt voor het opslaan, beheren en ontsluiten van gegevens. In dit document beschrijven we de functionaliteiten van de CGV met een use case model. Een use case model beschrijft actoren en de use cases waar de actoren gebruik van kunnen maken.",
  "Het bijzondere aan de CGV is dat deze zich beperkt tot componenten (en dus functionaliteiten) op de lagen één t/m drie, d.w.z. gegevens, services en integratie. Daardoor is het niet triviaal om functionaliteiten voor eindgebruikers te beschrijven. Toch willen we eindgebruikers als actoren beschouwen, om zo de verbinding met dienstverlening te behouden.",
  "Belangrijke actoren zijn klanten en medewerkers. Deze maken gebruik van applicaties. Die applicaties leven op lagen vier en vijf en vallen buiten de scope van de CGV; die tonen we grijs. De applicaties sluiten aan op de integratielaag om gebruik te maken van API's en componenten die gegevens ontsluiten. De genoemde componenten zijn slechts voorbeelden.",
].join("\n\n");
const ACTOREN = "De belangrijkste actoren van het use case model zijn Klant en Medewerker. We onderscheiden ook meer specifieke klanten en medewerkers. Klanten kunnen bijvoorbeeld inwoners of bedrijven zijn, en medewerkers kunnen bij de gemeente werken of bij de regie-organisatie. Medewerkers kunnen nog specifieker worden uitgesplitst naar bijvoorbeeld beheerders en zaakbehandelaars. Bij iedere actor kunnen verschillende use cases worden gedefinieerd.";

const files = new Map();
let i = 0;
const svgVan = (diagram, { elements, descriptor }) => {
  const bestand = `${STAM}-${diagram.id}.svg`;
  files.set(bestand, schetsDiagramSvg({ diagram, elements, descriptor, idPrefix: `d${++i}` }));
  return `![${diagram.naam}](${bestand})`;
};
const ctx = maakDocumentContext({
  naam: "CGV Use case model",
  omschrijving: INLEIDING,
  profielen: [{ id: "lagen", label: "Lagen", descriptor: lagenDescriptor, elements: lagen, diagrams: lagenDiagram }],
  svgVan,
  kinderen: [
    { naam: "Actoren", omschrijving: ACTOREN, profielen: [{ id: "usecase05", label: "Use case", descriptor: ucDescriptor, elements: actoren, diagrams: actorDiagram }] },
    { naam: "Use cases", omschrijving: "Per actor de use cases waarvoor de CGV gegevens, services of integratie levert.", profielen: [], kinderen: [
      { naam: "Use cases Klant", omschrijving: "", profielen: [{ id: "usecase05", label: "Use case", descriptor: ucDescriptor, elements: ucKlant, diagrams: ucKlantDiagram }] },
      { naam: "Use cases Medewerker", omschrijving: "", profielen: [{ id: "usecase05", label: "Use case", descriptor: ucDescriptor, elements: ucMw, diagrams: ucMwDiagram }] },
    ] },
  ],
});
const sj = INGEBOUWDE_SJABLONEN.find((s) => s.id === "projectdocument");
const { tekst } = renderSjabloon(sj.tekst, ctx, { partials: sj.partials });
for (const [bestand, svg] of files) writeFileSync(join(uitMap, bestand), svg + "\n");
const kop = "<!-- Gegenereerd met scripts/genereer-cgv-voorbeeld.mjs (sjabloon: Projectdocument). Niet met de hand bewerken; vergelijk met CGV_Use_case_model.md (handgeschreven). -->\n\n";
writeFileSync(join(uitMap, `${STAM}.md`), kop + tekst);
console.log("geschreven:", [...files.keys(), `${STAM}.md`].join(", "));
