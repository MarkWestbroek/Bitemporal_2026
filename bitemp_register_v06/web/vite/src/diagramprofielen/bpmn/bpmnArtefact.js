// @ts-check
/**
 * bpmnArtefact — aansluiting "BPMN-model (Omnium-project) + e-dienst →
 * bpmn-artefact (uitvoerbare BPMN 2.0 XML)" voor de inrichting van e-diensten
 * (docs/TRANSFORMATIES.md §11.11).
 *
 * Route:
 *
 *   BPMN-model (profiel bpmn-motor) ─ diagram ─▶ bpmnXmlSchrijver + engine-regelset ─▶ XML ─▶ artefact
 *   e-dienst (identifier = process-id, engine)
 *
 * Bron is een BPMN-model in Omnium, niet het canonieke model: het proces is
 * zijn eigen M1-model (profiel bpmn-motor). De e-dienst kiest per artefact het
 * diagram (`bron.diagram`, de naam) en de engine (`engine`, nu alleen "gzac").
 * De process-id is de identifier van het artefact: daarop vervangt de uitrol
 * het vorige artefact, en de process-links van GZAC binden op de activityId's
 * (`bpmnId` in het model).
 *
 * Een vervolgproces start bij voorkeur op een bericht (losse processen, Mark
 * 30-10): toets BPMN-BERICHT kijkt of elk geworpen bericht een message start
 * event van een ander bpmn-artefact van de e-dienst raakt; `gestart` geeft die
 * processen terug. Een call activity (`aangeroepen`) mag nog, met toets
 * BPMN-AANGEROEPEN.
 *
 * Zelfde artefactvorm als de andere inrichtingsartefacten, met één verschil
 * (afspraak FUNDAMENT 28-10): de payload is de XML-tekst en payloadHash =
 * sha256 over de UTF-8-tekst, niet JCS (het is geen JSON). bronmodelHash is
 * wel sha256 over JCS(model).
 *
 * Puur op de hashfunctie na, die wordt meegegeven.
 */
import { jcsHash } from "../../transformatie/jcs.js";
import { schrijfBpmn } from "../../transformatie/bpmnXmlSchrijver.js";
import { BPMN_NAAR_GZAC } from "./bpmnGzacRegels.js";

export const SCHRIJVER_ID = "bpmn-xml-schrijver@0.1.0";

export const ENGINES = { gzac: BPMN_NAAR_GZAC };

/**
 * @param {Object} invoer
 * @param {any} invoer.modelBestand          - het BPMN-model ({model_naam, model: {elements, diagrams}}) of het model zelf
 * @param {any} invoer.edienst               - het e-dienst-inrichtingsmodel
 * @param {string} invoer.identifier         - de identifier van het artefact = process-id
 * @param {string|null} [invoer.peiltijdstip]
 * @param {string} [invoer.versienummer]
 * @param {(tekst: string) => string | Promise<string>} invoer.sha256Hex
 * @param {any} [invoer.regelset]            - engine-regelset (anders volgens `engine` in de e-dienst)
 */
export async function maakBpmnArtefact({ modelBestand, edienst, identifier, peiltijdstip = null, versienummer, sha256Hex, regelset }) {
  const model = modelBestand?.model || modelBestand;
  const keuzes = (edienst?.artefacten || []).find((a) => a.identifier === identifier && a.soort === "bpmn");
  if (!keuzes) throw new Error(`Geen bpmn-artefact "${identifier}" in het e-dienstmodel.`);
  const engine = regelset || ENGINES[keuzes.engine];
  if (!engine) throw new Error(`Onbekende engine "${keuzes.engine}" (bekend: ${Object.keys(ENGINES).join(", ")}).`);

  const diagnostics = [];
  const naam = keuzes.bron?.diagram;
  const diagram = Object.values(model?.diagrams || {}).find((d) => d.naam === naam || d.id === naam);
  if (!diagram) throw new Error(`Diagram "${naam}" niet gevonden in het BPMN-model.`);

  const { xml, ids, diagnostics: schrijf } = schrijfBpmn({
    model,
    diagramId: diagram.id,
    proces: { id: keuzes.identifier, naam: keuzes.naam || diagram.naam },
    targetNamespace: keuzes.targetNamespace,
    engine,
  });
  diagnostics.push(...schrijf);

  // Toetsen: wat een engine nodig heeft en wat de process-links verwachten.
  const elementen = Object.values(model.elements);
  for (const id of keuzes.activityIds || []) {
    if (![...ids.values()].includes(id)) diagnostics.push({ severity: "error", code: "BPMN-ACTIVITYID", message: `activityId "${id}" (process-link) staat niet in het proces`, sourceId: id, path: null });
  }
  for (const el of elementen) {
    if (!ids.has(el.id) || el.source) continue;
    if (el.elementType === "taak" && !el.data?.bpmnId) {
      diagnostics.push({ severity: "warning", code: "BPMN-GEEN-ID", message: `Taak "${el.naam}" heeft geen bpmnId; de activityId "${ids.get(el.id)}" komt uit de naam en verandert als die verandert`, sourceId: el.id, path: null });
    }
  }
  const aangeroepen = elementen.filter((e) => ids.has(e.id) && e.data?.aangeroepenProces).map((e) => e.data.aangeroepenProces);
  const processen = new Set((edienst?.artefacten || []).filter((a) => a.soort === "bpmn").map((a) => a.identifier));
  for (const sleutel of aangeroepen) {
    if (/[$#]\{/.test(sleutel)) {
      if (engine.taken?.callActivity?.vasteSleutel) diagnostics.push({ severity: "error", code: "BPMN-AANGEROEPEN", message: `Call activity met expressie "${sleutel}": ${engine.id} vraagt een vaste proces-id`, sourceId: sleutel, path: null });
    } else if (!processen.has(sleutel)) {
      diagnostics.push({ severity: "warning", code: "BPMN-AANGEROEPEN", message: `Aangeroepen proces "${sleutel}" is geen bpmn-artefact van deze e-dienst`, sourceId: sleutel, path: null });
    }
  }

  // Berichten: elk geworpen bericht start een proces van deze e-dienst (message
  // start event met dezelfde naam, in een diagram dat een bpmn-artefact is).
  const diagramNaarProces = new Map();
  for (const a of (edienst?.artefacten || []).filter((x) => x.soort === "bpmn")) {
    const d = Object.values(model.diagrams || {}).find((x) => x.naam === a.bron?.diagram || x.id === a.bron?.diagram);
    if (d) diagramNaarProces.set(d.id, a.identifier);
  }
  const startBericht = new Map();
  for (const d of Object.values(model.diagrams || {})) {
    for (const n of d.nodes || []) {
      const e = model.elements[n.elementId];
      if (e?.elementType === "start-event" && e.data?.soort === "bericht" && e.data?.bericht && diagramNaarProces.has(d.id)) startBericht.set(e.data.bericht, diagramNaarProces.get(d.id));
    }
  }
  const werpend = elementen.filter((e) => ids.has(e.id) && e.data?.soort === "bericht" && e.data?.bericht && (e.elementType === "eind-event" || (e.elementType === "tussen-event" && e.data?.richting === "werpt")));
  const gestart = [];
  for (const e of werpend) {
    const doel = startBericht.get(e.data.bericht);
    if (!doel) diagnostics.push({ severity: "warning", code: "BPMN-BERICHT", message: `Bericht "${e.data.bericht}" start geen proces van deze e-dienst (geen message start event met die naam)`, sourceId: e.id, path: null });
    else if (doel === keuzes.identifier) diagnostics.push({ severity: "warning", code: "BPMN-BERICHT", message: `Bericht "${e.data.bericht}" start dit proces zelf`, sourceId: e.id, path: null });
    else gestart.push(doel);
  }

  const traceregels = [...ids.entries()].map(([bronGE, xmlId]) => ({ bronGE, regel: "BPMN-schrijver + engine-regelset", doelPad: `#${xmlId}`, actie: "aangemaakt" }));
  const artefact = {
    artefactIdentificatie: {
      soort: keuzes.soort,
      identifier: keuzes.identifier,
      naam: keuzes.naam || diagram.naam,
      versienummer: versienummer || keuzes.versienummer || edienst?.edienst?.versienummer || "0.1.0",
    },
    artefactInhoud: { formaat: keuzes.formaat, payload: xml, payloadHash: await sha256Hex(xml) },
    artefactHerkomst: {
      regelsetId: engine.id,
      regelsetVersie: engine.versie,
      bronmodelHash: await jcsHash(model, sha256Hex),
      bronmodelVersie: modelBestand?.model_naam || null,
      schrijverId: SCHRIJVER_ID,
      peiltijdstip,
    },
    traceregels,
    edienstversie: { edienst: edienst?.edienst?.naam, versienummer: edienst?.edienst?.versienummer },
    doelcomponent: keuzes.doelcomponent,
    afhankelijkheden: (edienst?.afhankelijkheden || [])
      .filter((a) => a.artefact === keuzes.identifier && (!a.soort || a.soort === keuzes.soort))
      .map((a) => ({ identifier: a.afhankelijkVan, ...(a.afhankelijkVanSoort ? { soort: a.afhankelijkVanSoort } : {}), reden: a.reden })),
  };
  return { artefact, diagnostics, aangeroepen, gestart };
}
