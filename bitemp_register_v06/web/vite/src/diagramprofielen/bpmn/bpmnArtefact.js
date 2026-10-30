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
  return { artefact, diagnostics, aangeroepen };
}
