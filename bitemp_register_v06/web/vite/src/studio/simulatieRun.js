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
import { maakCmBeelden } from "../simulatie/cmVorm.js";
import { scenarioUitModel, scenarioNaarModel, simulatiesIn, toetsVerwachting } from "../simulatie/scenarioModel.js";
import { typeZoeker } from "../diagramprofielen/bpmn/bpmnXmlImport.js";

/** Het profiel waar de processen in staan. */
export const BPMN_PROFIEL = "bpmnMotor05";

import gpk1 from "../simulatie/fixtures/gpk-scenario-1.json";
import gpk2 from "../simulatie/fixtures/gpk-scenario-2.json";
import gpk3 from "../simulatie/fixtures/gpk-scenario-3.json";
import gpk4 from "../simulatie/fixtures/gpk-scenario-4.json";
import gpk5 from "../simulatie/fixtures/gpk-scenario-5.json";
import ws1 from "../simulatie/fixtures/waterstede-1-buurtfeest.json";
import ws2 from "../simulatie/fixtures/waterstede-2-jaarmarkt.json";
import ws3 from "../simulatie/fixtures/waterstede-3-festival.json";

/**
 * De ingebakken scenario's, met hun naam en beschrijving (klein; daarom niet lui geladen).
 * `set` zegt waar een scenario op draait: "gpk" brengt de beslistabel en het e-dienstmodel van het
 * GPK-voorbeeld mee; "waterstede" (16-11) draait op het BPMN en DMN van het project zelf (het
 * demo-project "Omnium demo — gemeente Waterstede", docs/demo-project), zonder e-dienstmodel.
 * Tijdelijk: zodra scenario's in het project kunnen staan, verhuizen de Waterstede-scenario's daarheen.
 */
export const VOORBEELDEN = [
  ...[gpk1, gpk2, gpk3, gpk4, gpk5].map((s) => ({ set: "gpk", scenario: s })),
  ...[ws1, ws2, ws3].map((s) => ({ set: "waterstede", scenario: s })),
].map((v, i) => ({ nr: i + 1, set: v.set, naam: v.scenario.naam, beschrijving: v.scenario.beschrijving || "", scenario: v.scenario }));
export const VOORBEELDSETS = [
  { id: "gpk", label: "GPK (met eigen beslistabel en e-dienstmodel)" },
  { id: "waterstede", label: "Waterstede (demo-project; draait op het project zelf)" },
];
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
const S = { sim: null, m1: null, scenarioTekst: null, edienst: null, gpk: null, startProces: null, toonProces: null, toonObject: null, opCanvas: false, cm: null, fout: null, versie: 0 };
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

export function start() {
  probeer(() => {
    const scenario = JSON.parse(scenarioTekst());
    const project = beslissingenUitProject();
    const m1 = {
      proces: { model_naam: "BPMN-model van het project", model: bpmnModel() },
      beslissingen: project.length ? project : S.gpk ? [S.gpk.beslissingen] : [],
      edienst: edienstNu(),
    };
    const sim = maakSimulatie({ m1, scenario: { ...scenario, start: { ...scenario.start, proces: gekozenStartProces() } } });
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
  if (!edienst) return zet({ cm: { beelden: [], bron: null } });
  const project = projectV3();
  let beelden = project ? await maakCmBeelden({ model: project, edienst, sha256Hex }) : [];
  let bron = beelden.length ? "het canonieke model van het project" : null;
  if (!beelden.length) {
    const fixture = (await import("../diagramprofielen/canoniek-uml/fixtures/cg-test/inrichten-domeinen-v3.json")).default;
    beelden = await maakCmBeelden({ model: fixture, edienst, sha256Hex });
    bron = beelden.length ? "het canonieke model van cg-test (voorbeeld)" : null;
  }
  zet({ cm: { beelden, bron } });
}

export function stop() {
  if (klok) clearInterval(klok);
  klok = null;
  zet({ sim: null, m1: null, fout: null, toonProces: null, toonObject: null });
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

/**
 * Een ingebakken scenario kiezen; het brengt zijn eigen startproces mee. Een GPK-scenario ook de
 * beslistabel en het e-dienstmodel van het voorbeeld; een ander (Waterstede) juist niet: dat draait
 * op het project zelf, en een GPK-e-dienstmodel zou andere processen aanwijzen.
 */
export async function kiesVoorbeeld(nr) {
  if (!nr) return;
  const tekst = JSON.stringify(await laadScenario(nr), null, 2);
  if (VOORBEELDEN.find((v) => v.nr === nr)?.set !== "gpk") return zet({ scenarioTekst: tekst, startProces: null, gpk: null });
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
      procesVan: (ref) => (ref?.elementId ? startbareProcessen().find((p) => p.elementen.has(ref.elementId))?.id || null : null),
    });
    Object.assign(S, { scenarioTekst: JSON.stringify(scenario, null, 2), startProces: null });
  });
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
    let overzicht = diagramMet(w.simulatieId);
    if (!overzicht) {
      const id = nieuwId();
      st.addDiagram({ id, naam: st.elements[w.simulatieId]?.naam || w.toevoegen.find((e) => e.id === w.simulatieId)?.naam || "Simulatie" });
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
