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

/** Het profiel waar de processen in staan. */
export const BPMN_PROFIEL = "bpmnMotor05";

import gpk1 from "../simulatie/fixtures/gpk-scenario-1.json";
import gpk2 from "../simulatie/fixtures/gpk-scenario-2.json";
import gpk3 from "../simulatie/fixtures/gpk-scenario-3.json";
import gpk4 from "../simulatie/fixtures/gpk-scenario-4.json";
import gpk5 from "../simulatie/fixtures/gpk-scenario-5.json";

/** De GPK-scenario's, met hun beschrijvende naam en beschrijving (klein; daarom niet lui geladen). */
export const VOORBEELDEN = [gpk1, gpk2, gpk3, gpk4, gpk5].map((s, i) => ({ nr: i + 1, naam: s.naam, beschrijving: s.beschrijving || "", scenario: s }));
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
const S = { sim: null, m1: null, scenarioTekst: null, edienst: null, gpk: null, startProces: null, toonProces: null, opCanvas: false, fout: null, versie: 0 };
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
}

export function stop() {
  if (klok) clearInterval(klok);
  klok = null;
  zet({ sim: null, m1: null, fout: null, toonProces: null });
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
  const gpk = S.gpk || (await laadGpk());
  zet({ scenarioTekst: tekst, startProces: null, gpk: { beslissingen: gpk.beslissingen, edienst: gpk.edienst } });
}

/** Zet de vier GPK-processen in het BPMN-profiel van het project, met beslistabel, e-dienstmodel en scenario 4. */
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
}
