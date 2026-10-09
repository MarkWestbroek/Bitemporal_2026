/**
 * genereer-voorbeelddocument — maakt docs/voorbeelden/documenten/use-case-overzicht-klant.md
 * (+ diagram-SVG's) met dezelfde renderer, context en schets-tekenaar als de Studio.
 * Gebruik: node scripts/genereer-voorbeelddocument.mjs (vanuit web/vite).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { maakDocumentContext } from "../src/transformatie/sjabloon/context.js";
import { schetsDiagramSvg } from "../src/transformatie/sjabloon/schets.js";
import { renderSjabloon } from "../src/transformatie/sjabloon/renderer.js";
import { SJABLOON_USE_CASE_OVERZICHT } from "../src/transformatie/sjabloon/sjablonen.js";

const hier = dirname(fileURLToPath(import.meta.url));
const uitMap = join(hier, "../../../docs/voorbeelden/documenten");
mkdirSync(uitMap, { recursive: true });

// Descriptor-uittreksel van het use case-profiel (vormen + lijnpresentatie).
const descriptor = { elementTypes: [
  { id: "actor", label: "Actor", shape: "uc-actor" },
  { id: "usecase", label: "Use case", shape: "uc-ellips", kleur: "#e0f2fe" },
  { id: "systeem", label: "Systeemkader", shape: "uc-systeem", achtergrond: true },
  { id: "associatie", label: "Associatie", isConnector: true, edgePresentatie: { lijn: "solid", kleur: "#475569" } },
  { id: "include", label: "Include", isConnector: true, edgePresentatie: { lijn: "dash-4-3", kleur: "#475569", markerEnd: "pijl-open" } },
  { id: "extend", label: "Extend", isConnector: true, edgePresentatie: { lijn: "dash-4-3", kleur: "#475569", markerEnd: "pijl-open" } },
  { id: "generalisatie", label: "Generalisatie", isConnector: true, edgePresentatie: { lijn: "solid", kleur: "#475569", markerEnd: "driehoek" } },
] };

const el = (id, naam, elementType, toelichting = "") => ({ id, naam, elementType, data: toelichting ? { toelichting } : {}, compartimenten: [] });
const con = (id, elementType, source, target, naam = "") => ({ id, naam, elementType, source, target, data: {} });
const elements = Object.fromEntries([
  el("klant", "Klant", "actor", "Inwoner of onderneming die contact zoekt met de gemeente."),
  el("inwoner", "Inwoner", "actor"),
  el("onderneming", "Onderneming", "actor"),
  el("kcc", "KCC-medewerker", "actor", "Medewerker van het klantcontactcentrum."),
  el("sys", "Gemeentelijke dienstverlening", "systeem"),
  el("zoek", "Zoek informatie over producten en diensten", "usecase", "De klant zoekt zelf op de website."),
  el("vraag", "Stel een vraag", "usecase"),
  el("gesprek", "Voer gesprek", "usecase", "Een gesprek tussen klant en medewerker, via een van de kanalen."),
  el("bel", "Bel op", "usecase"),
  el("chat", "Voer chatgesprek", "usecase"),
  el("mail", "Stuur een e-mail", "usecase"),
  el("afspraak", "Maak een afspraak", "usecase", "Een afspraak aan de balie of per video."),
  el("voortgang", "Bekijk voortgang", "usecase"),
  el("aanvraag", "Vraag product of dienst aan", "usecase"),
  con("g1", "generalisatie", "inwoner", "klant"),
  con("g2", "generalisatie", "onderneming", "klant"),
  con("a1", "associatie", "klant", "zoek"),
  con("a2", "associatie", "klant", "vraag"),
  con("a3", "associatie", "klant", "aanvraag"),
  con("a4", "associatie", "kcc", "gesprek"),
  con("i1", "include", "vraag", "gesprek"),
  con("s1", "generalisatie", "bel", "gesprek", "gespreksvorm"),
  con("s2", "generalisatie", "chat", "gesprek", "gespreksvorm"),
  con("s3", "generalisatie", "mail", "gesprek", "gespreksvorm"),
  con("e1", "extend", "afspraak", "vraag"),
  con("e2", "extend", "voortgang", "aanvraag"),
].map((x) => [x.id, x]));

const n = (elementId, x, y, size) => ({ elementId, position: { x, y }, ...(size ? { size } : {}) });
const diagrams = {
  d1: { id: "d1", naam: "Klantcontact", diagramType: "usecase", nodes: [
    n("sys", 220, 0, { width: 520, height: 420 }),
    n("inwoner", 0, 40), n("onderneming", 0, 300), n("klant", 100, 170),
    n("zoek", 260, 40, { width: 200, height: 70 }), n("vraag", 260, 170), n("aanvraag", 260, 300, { width: 200, height: 64 }),
    n("afspraak", 540, 120), n("voortgang", 540, 300),
  ] },
  d2: { id: "d2", naam: "Gespreksvormen", diagramType: "usecase", nodes: [
    n("kcc", 0, 120), n("gesprek", 200, 120),
    n("bel", 460, 0), n("chat", 460, 120), n("mail", 460, 240),
  ] },
};

let i = 0;
const ctx = maakDocumentContext({
  naam: "Klantcontact",
  profielen: [{ id: "usecase05", label: "Use case", descriptor, elements, diagrams }],
  svgVan: (diagram, { elements: els, descriptor: desc }) => {
    const bestand = `use-case-overzicht-klant-${diagram.id}.svg`;
    writeFileSync(join(uitMap, bestand), schetsDiagramSvg({ diagram, elements: els, descriptor: desc, idPrefix: `d${++i}` }) + "\n");
    return `![${diagram.naam}](${bestand})`;
  },
});
const { tekst } = renderSjabloon(SJABLOON_USE_CASE_OVERZICHT, ctx);
const kop = "<!-- Gegenereerd met scripts/genereer-voorbeelddocument.mjs (sjabloon: Use case-overzicht). Niet met de hand bewerken. -->\n\n";
writeFileSync(join(uitMap, "use-case-overzicht-klant.md"), kop + tekst);
console.log("geschreven naar", uitMap);
