// @ts-check
/**
 * simulatieRun — de run van de simulatie in de Studio: één plek waar de
 * activiteit Simulatie (bediening, objecten, log) en het BPMN-canvas (het
 * token) allebei naar kijken.
 *
 * Een run is één afhandeling: één startobject met één of meer
 * procesinstanties, over meerdere procesdiagrammen heen. Hij hoort dus bij
 * geen enkel diagram, en leeft daarom hier en niet in een component
 * (docs/plans/2026-11-12 Simulatie van BPMN en DMN met cm-objecten §11.1).
 *
 * Het token op het BPMN-canvas: zolang er een run loopt staat er een stijlblok
 * in de pagina dat de canvas-nodes aanwijst op hun element-id
 * (simulatie/weergave.js). De motor weet er niets van.
 *
 * De M1-set: het proces is het BPMN-model van het project (profiel
 * bpmnMotor05); de beslistabellen komen uit de DMN-profielen op de motor; het
 * e-dienstmodel (process-id's en taakformulieren) is een bestand. Beslistabel
 * en e-dienstmodel van het GPK-voorbeeld zijn los te gebruiken.
 */
import { useSyncExternalStore } from "react";
import { maakSimulatie } from "../simulatie/simulatie.js";
import { leesProcessen, startVan, gewoneStart, metProcessen } from "../simulatie/procesmodel.js";
import { tokenBeeld, tokenCss } from "../simulatie/weergave.js";
import { getProfieltype, getProfieltypen } from "./profieltypeRegistry";
import { conditiesNaarCel } from "../diagramprofielen/bpmn/conditiesNaarCel.js";
import { exporteerV3 } from "../diagramprofielen/canoniek-uml/serialisatie.js";
import { maakCmBeelden, maakCmBeeldDirect, beeldVoor } from "../simulatie/cmVorm.js";
import { scenarioUitModel, scenarioNaarModel, simulatiesIn, toetsVerwachting } from "../simulatie/scenarioModel.js";
import { typeZoeker } from "../diagramprofielen/bpmn/bpmnXmlImport.js";
import { useModellerenStore } from "./activities/modellerenActivity.jsx";

/** Het profiel waar de processen in staan. */
export const BPMN_PROFIEL = "bpmnMotor05";

import gpk1 from "../simulatie/fixtures/gpk-scenario-1.json";
import gpk2 from "../simulatie/fixtures/gpk-scenario-2.json";
import gpk3 from "../simulatie/fixtures/gpk-scenario-3.json";
import gpk4 from "../simulatie/fixtures/gpk-scenario-4.json";
import gpk5 from "../simulatie/fixtures/gpk-scenario-5.json";

/**
 * De ingebakken GPK-scenario's, met hun naam en beschrijving (klein; daarom niet lui geladen). Ze
 * brengen de beslistabel en het e-dienstmodel van het GPK-voorbeeld mee. Andere scenario's staan
 * als model in het project (profiel Simulatiemodel); de Waterstede-scenario's stonden hier tot
 * ze op 16-11 naar het demo-project gingen (`simulatie/fixtures/waterstede-*.json` blijven als
 * testgegevens).
 */
export const VOORBEELDEN = [gpk1, gpk2, gpk3, gpk4, gpk5].map((s, i) => ({ nr: i + 1, set: "gpk", naam: s.naam, beschrijving: s.beschrijving || "", scenario: s }));
export const laadScenario = async (nr) => VOORBEELDEN.find((v) => v.nr === nr)?.scenario;
/**
 * Het GPK-voorbeeld: vier processen (Mark 13-11, ontwerp §11.6), de beslistabel en het
 * e-dienstmodel van Fundament met de process-id's van de vier processen.
 */
export const laadGpk = async () => {
  const proces = (await import("../simulatie/fixtures/gpk-vier-processen.bpmn-model.json")).default;
  const edienst = (await import("../diagramprofielen/canoniek-uml/fixtures/cg-test/gpk-edienst.json")).default;
  return {
    proces,
    beslissingen: (await import("../diagramprofielen/canoniek-uml/fixtures/cg-test/gpk-beslissingen.dmn-model.json")).default,
    edienst: metProcessen(edienst, proces.processen),
  };
};

export const LEEG_SCENARIO = {
  versie: "0.1",
  naam: "Nieuw scenario",
  beschrijving: "Wat dit scenario laat zien, in een zin.",
  start: { type: "Object", id: "startobject", object: {}, variabelen: {} },
  vulwijze: { standaard: "hand", perSoort: { dienst: "willekeurig" } },
  antwoorden: {},
  zaadje: 1,
};

/**
 * sim: de lopende simulatie (of null); m1: waar hij op draait; scenarioTekst: het scenario als JSON;
 * edienst: {naam, inhoud} van een gekozen bestand; gpk: {beslissingen, edienst} van het GPK-voorbeeld;
 * startProces: de keuze bij "Start bij"; toonProces: het proces waarvan het diagram getoond wordt
 * (null = volg het token).
 */
// opCanvas (Mark 14-11): toon het token ook op het modelcanvas (het M1-diagram). Standaard uit:
// de run hoort bij de simulatie, niet bij het model. Er wordt nooit iets in het model geschreven;
// het is alleen een stijlblok in deze browsertab (andere tabs en gebruikers zien niets), maar
// zolang het aan staat neemt een PNG/SVG-export van het canvas het token mee — handig als je een
// plaatje van de stand van een procesinstantie wilt.
const LEEG_SLEUTEL = "studio-simulatie-leeg-verbergen";
const leesVerbergLeeg = () => {
  try {
    return localStorage.getItem(LEEG_SLEUTEL) === "ja";
  } catch {
    return false;
  }
};
// zwevend: de objecten die los over de tekening hangen ({id, left, top}); wijsAan: het object dat in
// het objectenpaneel aangewezen wordt; verbergLeeg: lege optionele velden niet tonen (bewaard).
const S = { zwevend: [], wijsAan: null, verbergLeeg: leesVerbergLeeg(), projectScenario: null, subjecten: null, testset: null, sim: null, m1: null, scenarioTekst: null, edienst: null, gpk: null, startProces: null, toonProces: null, toonObject: null, opCanvas: false, cm: null, fout: null, versie: 0 };
const luisteraars = new Set();
const STIJL_ID = "sim-token-stijl";

/** Het stijlblok voor het BPMN-canvas bijwerken: aanwezig zolang er een run is en opCanvas aan staat. */
function werkTokenStijlBij() {
  if (typeof document === "undefined") return;
  let stijl = document.getElementById(STIJL_ID);
  if (!S.sim || !S.opCanvas) {
    stijl?.remove();
    return;
  }
  if (!stijl) {
    stijl = document.createElement("style");
    stijl.id = STIJL_ID;
    stijl.setAttribute("data-testid", STIJL_ID);
    document.head.appendChild(stijl);
  }
  stijl.textContent = tokenCss(tokenBeeld(S.sim.toestand(), S.sim.log));
}

export function zet(patch = {}) {
  Object.assign(S, patch);
  S.versie += 1;
  werkTokenStijlBij();
  for (const l of luisteraars) l();
}
const abonneer = (l) => (luisteraars.add(l), () => luisteraars.delete(l));

/** De run in een component: rendert opnieuw bij elke wijziging. */
/** De stand van nu, buiten een component. */
export const useRunNu = () => S;

/** Lege optionele velden verbergen of tonen; de keuze blijft bewaard. */
export function zetVerbergLeeg(aan) {
  try {
    localStorage.setItem(LEEG_SLEUTEL, aan ? "ja" : "nee");
  } catch {
    /* geen opslag: de keuze geldt voor deze tab */
  }
  zet({ verbergLeeg: !!aan });
}

export function useRun() {
  useSyncExternalStore(abonneer, () => S.versie);
  return S;
}

export const scenarioTekst = () => S.scenarioTekst ?? JSON.stringify(LEEG_SCENARIO, null, 2);

/** Het BPMN-model van het project. */
export function bpmnModel() {
  const st = getProfieltype(BPMN_PROFIEL)?.useStore?.getState?.();
  return { elements: st?.elements || {}, diagrams: st?.diagrams || {} };
}

/** De beslissingen (DMN) die in het project staan: elk profiel met een beslistabel erin. */
export function beslissingenUitProject() {
  const uit = [];
  for (const p of getProfieltypen()) {
    const st = p.useStore?.getState?.();
    if (!st?.elements) continue;
    if (Object.values(st.elements).some((e) => e.elementType === "decision" && e.data?.beslistabel)) uit.push({ model_naam: `Studio-project, profiel ${p.label || p.id}`, model: { elements: st.elements, diagrams: st.diagrams || {} } });
  }
  return uit;
}

export const edienstNu = () => S.edienst?.inhoud || S.gpk?.edienst || null;

/** De processen die je kunt starten, met hun startevent. */
export function startbareProcessen(model = bpmnModel()) {
  const { elementen, processen } = leesProcessen({ model }, edienstNu());
  return processen.map((p) => ({ ...p, start: startVan(p, elementen), gewoon: !!gewoneStart(p, elementen) })).filter((p) => p.start);
}

/**
 * Welk proces start: wat bij "Start bij" gekozen is, anders wat het scenario noemt, anders het
 * BPMN-diagram dat open staat, anders het eerste proces met een startevent zonder trigger.
 */
export function gekozenStartProces(startbaar = startbareProcessen()) {
  let uitScenario = null;
  try {
    const naam = JSON.parse(scenarioTekst()).start?.proces;
    uitScenario = startbaar.find((p) => p.id === naam || p.naam === naam)?.id || null;
  } catch {
    /* het scenario is nog geen geldige JSON */
  }
  const actief = getProfieltype(BPMN_PROFIEL)?.useStore?.getState?.().actiefDiagramId;
  return (
    (startbaar.some((p) => p.id === S.startProces) && S.startProces) ||
    uitScenario ||
    startbaar.find((p) => p.diagramId === actief)?.id ||
    startbaar.find((p) => p.gewoon)?.id ||
    startbaar[0]?.id ||
    null
  );
}

/** Voert iets uit op de run; een fout komt in het scherm in plaats van in de console. */
export function probeer(doen) {
  let fout = null;
  try {
    doen();
  } catch (e) {
    fout = e.message;
  }
  zet({ fout });
}

/**
 * De subjecten van de simulatie waar een scenario uit het project bij hoort (16-11): de
 * BPMN-diagrammen waar de run op draait. Null = geen beperking (een los scenario, of een simulatie
 * zonder subjecten die naar een bestaand BPMN-diagram wijzen).
 * @returns {{simulatie: string, diagramIds: Set<string>}|null}
 */
export function subjectenVan(scenarioId) {
  const st = getProfieltype(SIMULATIEMODEL_PROFIEL)?.useStore?.getState?.();
  if (!scenarioId || !st?.elements?.[scenarioId]) return null;
  const bij = simulatiesIn(st.elements).simulaties.find((s) => s.scenarios.some((sc) => sc.id === scenarioId));
  if (!bij) return null;
  const bestaand = bpmnModel().diagrams;
  const diagramIds = new Set(
    bij.subjecten
      .map((s) => s.data?.verwijstNaar)
      .filter((v) => v && (typeof v === "string" || v.profielId === BPMN_PROFIEL))
      .map((v) => (typeof v === "string" ? v : v.diagramId))
      .filter((id) => bestaand[id]),
  );
  return diagramIds.size ? { simulatie: bij.simulatie.naam || "Simulatie", diagramIds } : null;
}

/** De M1-set van een run: het proces (beperkt tot de subjecten, als die er zijn), de beslistabellen en het e-dienstmodel. */
function m1Voor(subjecten) {
  const model = bpmnModel();
  const project = beslissingenUitProject();
  return {
    proces: {
      model_naam: subjecten ? `BPMN-model van het project (subjecten van ${subjecten.simulatie})` : "BPMN-model van het project",
      model: subjecten ? { elements: model.elements, diagrams: Object.fromEntries(Object.entries(model.diagrams).filter(([id]) => subjecten.diagramIds.has(id))) } : model,
    },
    beslissingen: project.length ? project : S.gpk ? [S.gpk.beslissingen] : [],
    edienst: edienstNu(),
  };
}

export function start() {
  probeer(() => {
    const scenario = JSON.parse(scenarioTekst());
    const subjecten = subjectenVan(S.projectScenario);
    const m1 = m1Voor(subjecten);
    const sim = maakSimulatie({ m1, scenario: { ...scenario, start: { ...scenario.start, proces: gekozenStartProces() } } });
    S.subjecten = subjecten ? { simulatie: subjecten.simulatie, aantal: subjecten.diagramIds.size } : null;
    sim.start();
    Object.assign(S, { sim, m1, toonProces: null });
  });
  if (S.sim) laadCmBeelden(S.m1?.edienst).catch((e) => zet({ cm: { beelden: [], bron: null, fout: e.message } }));
}

// ── De cm-vorm van de objecten (POC, Mark 14-11, ontwerp §11.7) ──

const CANONIEK_PROFIEL = "diagram05";

async function sha256Hex(tekst) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tekst));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Het canonieke model van het project als V3, of null als het leeg is. */
function projectV3() {
  const st = getProfieltype(CANONIEK_PROFIEL)?.useStore?.getState?.();
  if (!st || !Object.keys(st.elements || {}).length) return null;
  try {
    return exporteerV3(st).v3;
  } catch {
    return null;
  }
}

/**
 * Per objecttype van het e-dienstmodel de structuur uit het cm en de trace naar de platte vorm.
 * Het cm komt uit het project als de bron-entiteiten daarin staan, anders uit het voorbeeld van
 * cg-test (het model waartegen het GPK-e-dienstmodel is opgesteld).
 */
async function laadCmBeelden(edienst) {
  const project = projectV3();
  directeBeelden = new Map();
  directModel = project;
  if (!edienst) return zet({ cm: { beelden: [], bron: null } });
  let beelden = project ? await maakCmBeelden({ model: project, edienst, sha256Hex }) : [];
  let bron = beelden.length ? "het canonieke model van het project" : null;
  if (!beelden.length) {
    const fixture = (await import("../diagramprofielen/canoniek-uml/fixtures/cg-test/inrichten-domeinen-v3.json")).default;
    beelden = await maakCmBeelden({ model: fixture, edienst, sha256Hex });
    bron = beelden.length ? "het canonieke model van cg-test (voorbeeld)" : null;
  }
  zet({ cm: { beelden, bron } });
}

// Zonder e-dienstmodel (16-11): het beeld van een type rechtstreeks uit het canonieke model van het
// project, per type gemaakt als een object van dat type getoond wordt.
let directeBeelden = new Map();
let directModel = null;

/**
 * Het cm-beeld bij een objecttype van de run: dat van het e-dienstmodel als het er is, anders
 * rechtstreeks uit het canonieke model van het project (elk veld op zijn veldnaam).
 * @returns {{beeld: any, bron: string|null}|null}
 */
export function cmBeeldVoor(type) {
  const viaEdienst = beeldVoor(S.cm?.beelden, type);
  if (viaEdienst) return { beeld: viaEdienst, bron: S.cm?.bron || null };
  if (!directModel || !type) return null;
  const sleutel = String(type).toLowerCase();
  if (!directeBeelden.has(sleutel)) {
    let beeld = null;
    try {
      beeld = maakCmBeeldDirect({ model: directModel, bron: type });
    } catch {
      /* een type dat niet te lezen is, blijft platte json */
    }
    directeBeelden.set(sleutel, beeld);
  }
  const beeld = directeBeelden.get(sleutel);
  return beeld ? { beeld, bron: "het canonieke model van het project (zonder e-dienstmodel: elk veld op zijn veldnaam)" } : null;
}

export function stop() {
  if (klok) clearInterval(klok);
  klok = null;
  zet({ sim: null, m1: null, fout: null, toonProces: null, zwevend: [], wijsAan: null });
}

/** Het proces waar een element in staat. */
const procesVan = (plek) => S.sim?.processen.find((p) => p.elementen.has(plek))?.id || null;

/**
 * Het proces waar het token nu is: eerst wat verder kan, dan een open gat, dan wat wacht. Zonder
 * tokens (de run is klaar) het proces van de laatste stap, zodat het beeld niet terugvalt op het
 * eerste proces (gemeld door Mark 13-11).
 */
export function procesVanToken() {
  if (!S.sim) return null;
  const tokens = Object.values(S.sim.toestand().tokens);
  const token = tokens.find((k) => k.status === "klaar") || tokens.find((k) => k.wachtOp?.soort === "gat") || tokens[0];
  if (token) return procesVan(token.plek);
  const laatste = [...S.sim.log].reverse().find((r) => r.plek && procesVan(r.plek));
  return laatste ? procesVan(laatste.plek) : null;
}

/**
 * De laatste sprong naar een ander proces: de eerste stap in een proces waar de stap ervoor in een
 * ander proces stond. Voor de melding boven het diagram ("het token ging naar …").
 */
export function laatsteSprong() {
  if (!S.sim) return null;
  const regels = S.sim.log.filter((r) => r.plek && procesVan(r.plek));
  for (let i = regels.length - 1; i > 0; i--) {
    const naar = procesVan(regels[i].plek);
    const van = procesVan(regels[i - 1].plek);
    if (naar !== van) {
      const naam = (id) => S.sim.processen.find((p) => p.id === id)?.naam || id;
      // Waarlangs: een bericht of een signaal op de stap ervoor (of deze), anders een call activity.
      const via = (r) => (r.bericht ? `bericht ${r.bericht}` : r.signaal ? `signaal ${r.signaal.naam}` : null);
      const bericht = via(regels[i - 1]) || via(regels[i]) || null;
      return { nr: regels[i].nr, van: naam(van), naar: naam(naar), naarId: naar, bericht, recent: i === regels.length - 1 };
    }
  }
  return null;
}

/**
 * Afspelen: stap voor stap met een pauze ertussen, zodat je elke stap ziet gebeuren en het beeld
 * het token naar een ander proces volgt. Stopt vanzelf bij een gat of het einde. De klok leeft hier
 * en niet in een component: wisselen van activiteit laat het afspelen doorgaan.
 */
let klok = null;
export const SNELHEDEN = { langzaam: 1400, gewoon: 700, snel: 250 };
export const speeltAf = () => klok !== null;
export function pauzeer() {
  if (klok) clearInterval(klok);
  klok = null;
  zet();
}
export function speelAf(ms = SNELHEDEN.gewoon) {
  if (!S.sim || klok) return;
  klok = setInterval(() => {
    if (!S.sim || S.sim.stand().soort !== "loopt") return pauzeer();
    probeer(() => S.sim.stap());
  }, ms);
  zet();
}

/**
 * Zet de JUEL-condities in het BPMN-model van het project om naar CEL, in één undo-stap
 * (Bewerken → Ongedaan maken in Modelleren). Geeft terug wat omgezet is en wat JUEL blijft.
 */
export function conditiesProjectNaarCel() {
  const st = getProfieltype(BPMN_PROFIEL)?.useStore?.getState?.();
  if (!st) throw new Error("Het BPMN-profiel is niet geladen.");
  const uit = conditiesNaarCel(st.elements);
  if (uit.omgezet) st.updateElementen(uit.patches);
  zet();
  return uit;
}

/** Gebruik de beslistabel en het e-dienstmodel van het GPK-voorbeeld; het eigen BPMN-model blijft staan. */
export async function gebruikGpk() {
  const gpk = await laadGpk();
  zet({ gpk: { beslissingen: gpk.beslissingen, edienst: gpk.edienst } });
}

/** Een GPK-scenario kiezen; het brengt zijn eigen startproces mee, en beslistabel en e-dienstmodel van het voorbeeld. */
export async function kiesVoorbeeld(nr) {
  if (!nr) return;
  const tekst = JSON.stringify(await laadScenario(nr), null, 2);
  S.projectScenario = null;
  const gpk = S.gpk || (await laadGpk());
  zet({ scenarioTekst: tekst, startProces: null, gpk: { beslissingen: gpk.beslissingen, edienst: gpk.edienst } });
}

// ── Scenario's in het project (profiel simulatie, 16-11, ontwerp §12) ──

/** Het profiel waar simulaties en scenario's als model in staan. */
export const SIMULATIEMODEL_PROFIEL = "simulatiemodel05";
/** Loopt door over alle aanroepen: twee keer bewaren in dezelfde milliseconde geeft geen dubbele ids. */
let smTeller = 0;
const simulatiemodel = () => getProfieltype(SIMULATIEMODEL_PROFIEL)?.useStore?.getState?.() || null;

/** De scenario's die in het project staan, met de simulatie waar ze bij horen. */
export function scenariosUitProject() {
  const st = simulatiemodel();
  if (!st?.elements) return [];
  const { simulaties, los } = simulatiesIn(st.elements);
  return [
    ...simulaties.flatMap((s) => s.scenarios.map((sc) => ({ id: sc.id, naam: sc.naam, beschrijving: sc.data?.beschrijving || "", simulatie: s.simulatie.naam }))),
    ...los.map((sc) => ({ id: sc.id, naam: sc.naam, beschrijving: sc.data?.beschrijving || "", simulatie: "" })),
  ];
}

const elementVan = (ref) => (ref?.profielId && ref?.elementId ? getProfieltype(ref.profielId)?.useStore?.getState?.().elements?.[ref.elementId] || null : null);

/** Een scenario uit het project kiezen: het model wordt het json-scenario in het tekstvak. */
export function kiesProjectScenario(id) {
  probeer(() => {
    const st = simulatiemodel();
    if (!st) throw new Error("Het profiel Simulatiemodel is niet geladen.");
    const scenario = scenarioUitModel(st.elements, id, {
      naamVan: (ref) => elementVan(ref)?.naam || null,
      plekVan: (ref) => elementVan(ref)?.data?.bpmnId || null,
      procesVan: (ref) => (ref?.elementId ? startbareProcessen().find((p) => p.elementen.has(ref.elementId))?.id || null : null),
    });
    Object.assign(S, { scenarioTekst: JSON.stringify(scenario, null, 2), startProces: null, projectScenario: id });
  });
}

/**
 * Alle scenario's van het project in één keer draaien, als testset (16-11): elk scenario loopt
 * door tot een gat of een einde, en de afloop wordt getoetst aan zijn verwachting. De lopende run
 * blijft staan; de uitkomst komt in `S.testset`.
 * @returns {{id: string, naam: string, simulatie: string, uitkomst: "klopt"|"wijkt af"|"geen verwachting"|"fout", tekst: string}[]}
 */
export function draaiTestset() {
  const st = simulatiemodel();
  const uit = [];
  for (const sc of scenariosUitProject()) {
    const rij = { id: sc.id, naam: sc.naam, simulatie: sc.simulatie };
    try {
      const subjecten = subjectenVan(sc.id);
      const m1 = m1Voor(subjecten);
      const { processen } = leesProcessen(m1.proces, m1.edienst);
      const scenario = scenarioUitModel(st.elements, sc.id, {
        naamVan: (ref) => elementVan(ref)?.naam || null,
        plekVan: (ref) => elementVan(ref)?.data?.bpmnId || null,
        procesVan: (ref) => (ref?.elementId ? processen.find((p) => p.elementen.has(ref.elementId))?.id || null : null),
      });
      const sim = maakSimulatie({ m1, scenario });
      const stand = sim.loop();
      const t = sim.toestand();
      const toets = toetsVerwachting(scenario.verwacht, { stand, variabelen: t.variabelen, object: t.objecten[scenario.start?.id || "startobject"]?.data || {}, log: sim.log });
      if (!toets) uit.push({ ...rij, uitkomst: "geen verwachting", tekst: `eindigt als ${stand.soort}` });
      else if (toets.klopt) uit.push({ ...rij, uitkomst: "klopt", tekst: toets.punten.map((p) => `${p.wat} = ${typeof p.verwacht === "string" ? p.verwacht : JSON.stringify(p.verwacht)}`).join("; ") });
      else uit.push({ ...rij, uitkomst: "wijkt af", tekst: toets.punten.filter((p) => !p.klopt).map((p) => `${p.wat}: verwacht ${JSON.stringify(p.verwacht)}, gevonden ${JSON.stringify(p.gevonden)}`).join("; ") });
    } catch (e) {
      uit.push({ ...rij, uitkomst: "fout", tekst: e.message });
    }
  }
  zet({ testset: uit });
  return uit;
}

/**
 * Het scenario uit het tekstvak in het project bewaren, als model in het profiel Simulatiemodel:
 * een nieuw scenario, of het bestaande met dezelfde naam bijgewerkt. Een nieuwe simulatie krijgt
 * de processen van het project als subjecten. Nieuwe elementen komen op een diagram: de simulatie
 * met haar subjecten en scenario's op het overzicht, elk scenario met zijn instantie, stubs en
 * verwachting op een eigen diagram.
 * @param {any} [gegeven] - een scenario in plaats van dat uit het tekstvak (het GPK-voorbeeld)
 * @returns {{naam: string, nieuw: boolean}|null}
 */
export function bewaarScenarioInProject(gegeven = null) {
  let uit = null;
  probeer(() => {
    const st = simulatiemodel();
    if (!st) throw new Error("Het profiel Simulatiemodel is niet geladen.");
    const scenario = gegeven || JSON.parse(scenarioTekst());
    if (!String(scenario.naam || "").trim()) throw new Error("Geef het scenario eerst een naam.");
    const startbaar = startbareProcessen();
    const proces = gegeven ? null : gekozenStartProces(startbaar);
    const bpmn = bpmnModel().elements;
    const opNaam = (naam, typen) => {
      const treffers = Object.values(bpmn).filter((e) => e.naam === naam && (!typen || typen.includes(e.elementType)));
      return treffers.length === 1 ? { profielId: BPMN_PROFIEL, elementId: treffers[0].id } : null;
    };
    const zoekType = typeZoeker(
      getProfieltypen()
        .filter((p) => p?.useStore?.getState)
        .map((p) => ({ id: p.id, elements: p.useStore.getState().elements || {}, elementTypes: p.descriptor?.elementTypes || [] })),
    );
    const nieuwId = () => `sm_${Date.now()}_${++smTeller}`;
    const w = scenarioNaarModel(
      { ...scenario, start: { ...scenario.start, proces: scenario.start?.proces || proces || undefined } },
      {
        elements: st.elements,
        nieuwId,
        subjecten: leesProcessen({ model: bpmnModel() }, edienstNu()).processen.map((p) => ({ naam: p.naam, ref: { profielId: BPMN_PROFIEL, diagramId: p.diagramId } })),
        zoek: {
          type: (naam) => zoekType(naam).ref || null,
          plek: (sleutel) => {
            const el = Object.values(bpmn).find((e) => e.data?.bpmnId === sleutel) || bpmn[sleutel] || (opNaam(sleutel) && bpmn[opNaam(sleutel).elementId]);
            return el ? { ref: { profielId: BPMN_PROFIEL, elementId: el.id }, naam: el.naam || sleutel } : null;
          },
          start: (procesId) => {
            const p = startbaar.find((x) => x.id === procesId || x.naam === procesId);
            return p?.start ? { profielId: BPMN_PROFIEL, elementId: p.start.id } : null;
          },
          einde: (naam) => opNaam(naam, ["eind-event", "taak"]),
        },
      },
    );

    // Het model bijwerken.
    const voor = st.actiefDiagramId;
    for (const id of w.verwijderen) st.deleteElement(id);
    for (const e of w.toevoegen) st.addElement(e);
    for (const [id, patch] of Object.entries(w.bijwerken)) st.updateElement(id, patch);

    // De nieuwe elementen op een diagram zetten.
    const nieuw = new Map(w.toevoegen.filter((e) => !e.source).map((e) => [e.id, e]));
    const diagrammen = () => Object.values(simulatiemodel().diagrams || {});
    const diagramMet = (elementId, behalve = null) => diagrammen().find((d) => d.id !== behalve && (d.nodes || []).some((k) => k.elementId === elementId)) || null;
    const onder = (diagram) => Math.max(0, ...(diagram?.nodes || []).map((k) => (k.position?.y || 0) + 140));
    // Nieuwe diagrammen komen in de map van de simulatie in de projectboom (16-11): het overzicht in
    // een map met de naam van de simulatie, elk scenario-diagram in de map waar het overzicht staat.
    // Wat de gebruiker daarna verplaatst, blijft waar hij het zet.
    const boom = () => useModellerenStore.getState();
    const boomSleutel = (diagramId) => `${SIMULATIEMODEL_PROFIEL}::${diagramId}`;
    let overzicht = diagramMet(w.simulatieId);
    if (!overzicht) {
      const id = nieuwId();
      const naam = st.elements[w.simulatieId]?.naam || w.toevoegen.find((e) => e.id === w.simulatieId)?.naam || "Simulatie";
      st.addDiagram({ id, naam });
      const map = Object.values(boom().mappen || {}).find((m) => m.naam === naam && !m.ouderId)?.id || boom().nieuweMap(naam);
      boom().plaatsDiagram(boomSleutel(id), map);
      st.addElementToDiagram(id, w.simulatieId, { x: 60, y: 40 });
      [...nieuw.values()].filter((e) => e.elementType === "subject").forEach((e, i) => st.addElementToDiagram(id, e.id, { x: 60 + i * 290, y: 200 }));
      overzicht = simulatiemodel().diagrams[id];
    }
    if (w.nieuw.scenario) {
      const aantal = (overzicht.nodes || []).filter((k) => simulatiemodel().elements[k.elementId]?.elementType === "scenario").length;
      st.addElementToDiagram(overzicht.id, w.scenarioId, { x: 60 + aantal * 290, y: 380 });
    }
    let eigen = diagramMet(w.scenarioId, overzicht.id);
    if (!eigen) {
      const id = nieuwId();
      st.addDiagram({ id, naam: scenario.naam });
      const map = boom().plaatsing?.[boomSleutel(overzicht.id)] || null;
      if (map) boom().plaatsDiagram(boomSleutel(id), map);
      st.addElementToDiagram(id, w.scenarioId, { x: 60, y: 40 });
      eigen = simulatiemodel().diagrams[id];
    }
    const y0 = Math.max(240, onder(eigen));
    w.kinderen.filter((id) => nieuw.has(id)).forEach((id, i) => st.addElementToDiagram(eigen.id, id, { x: 60 + (i % 4) * 290, y: y0 + Math.floor(i / 4) * 190 }));
    if (voor && simulatiemodel().diagrams[voor]) st.setActiefDiagram(voor);
    uit = { naam: scenario.naam, nieuw: w.nieuw.scenario };
  });
  return uit;
}

/**
 * Klopt de afloop van de run met de verwachting van het scenario (`verwacht`)? Null zolang de
 * run loopt of als het scenario geen verwachting heeft.
 */
export function verwachtingVanRun() {
  if (!S.sim) return null;
  const stand = S.sim.stand();
  if (stand.soort === "loopt" || stand.soort === "niet-gestart") return null;
  let scenario;
  try {
    scenario = JSON.parse(scenarioTekst());
  } catch {
    return null;
  }
  const t = S.sim.toestand();
  return toetsVerwachting(scenario.verwacht, { stand, variabelen: t.variabelen, object: t.objecten[scenario.start?.id || "startobject"]?.data || {}, log: S.sim.log });
}

/**
 * Zet de vier GPK-processen in het BPMN-profiel van het project, met beslistabel, e-dienstmodel en
 * scenario 4. De vijf GPK-scenario's komen ook als model in het project (profiel Simulatiemodel,
 * 16-11): een voorbeeld van een simulatie met subjecten, scenario's, instanties, stubs en
 * verwachtingen. Bestaan ze al, dan worden ze bijgewerkt.
 */
export async function laadGpkProces() {
  const gpk = await laadGpk();
  if (klok) clearInterval(klok);
  klok = null;
  const st = getProfieltype(BPMN_PROFIEL)?.useStore?.getState?.();
  if (!st) throw new Error("Het BPMN-profiel is niet geladen.");
  const eerste = Object.values(gpk.proces.model.diagrams).find((d) => d.naam === "Aanvraag oppakken");
  st.laadModel({ diagramTypeId: st.diagramTypeId, elements: gpk.proces.model.elements, diagrams: gpk.proces.model.diagrams, actiefDiagramId: eerste?.id });
  const leeg = !S.scenarioTekst || S.scenarioTekst.includes(`"naam": "${LEEG_SCENARIO.naam}"`);
  zet({ sim: null, m1: null, fout: null, startProces: null, toonProces: null, gpk: { beslissingen: gpk.beslissingen, edienst: gpk.edienst }, ...(leeg ? { scenarioTekst: JSON.stringify(await laadScenario(4), null, 2) } : {}) });
  if (simulatiemodel()) for (const v of VOORBEELDEN.filter((x) => x.set === "gpk")) bewaarScenarioInProject(v.scenario);
}
