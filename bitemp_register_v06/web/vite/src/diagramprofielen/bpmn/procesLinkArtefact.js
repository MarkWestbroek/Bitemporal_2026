// @ts-check
/**
 * procesLinkArtefact — aansluiting "BPMN-model (Omnium-project) + e-dienst →
 * proceskoppeling" voor de inrichting van e-diensten (docs/TRANSFORMATIES.md
 * §11.13). De proceskoppeling zegt per taak van een proces wat de engine
 * eraan hangt; bij GZAC is dat het bestand `process-link/<proces-id>.
 * process-link.json` van de dossierbundel.
 *
 * Route:
 *
 *   BPMN-model (profiel bpmn-motor) ─ taken van het diagram ─▶ engine-regelset ─▶ koppelingen ─▶ artefact
 *   e-dienst (bpmn-artefact met dezelfde identifier: model, diagram, engine)
 *
 * Nu: een gebruikerstaak met een `formulier` (de identifier van een
 * dossierformulier van de e-dienst) krijgt een formulierkoppeling. Wat een
 * servicetaak doet (zaak aanmaken, rol koppelen, status zetten) staat nog niet
 * in het model; die plugin-koppelingen zijn nog handwerk bij FUNDAMENT
 * (docs/plans/2026-11-05 Servicetaken en dossierstatus uit het model).
 *
 * De identifier is de proces-id, dezelfde als van het bpmn-artefact; de soort
 * onderscheidt ze. De activityId's zijn de id's die de BPMN-schrijver in de
 * XML zet, zodat koppeling en proces altijd op elkaar passen.
 *
 * Zelfde artefactvorm als de andere inrichtingsartefacten; de payload is JSON
 * en payloadHash = sha256 over JCS. Puur op de hashfunctie na.
 */
import { jcsHash } from "../../transformatie/jcs.js";
import { schrijfBpmn } from "../../transformatie/bpmnXmlSchrijver.js";
import { ENGINES } from "./bpmnArtefact.js";

export const SCHRIJVER_ID = "gzac-process-link-schrijver@0.1.0";
export const SOORT = "proceskoppeling";

const meld = (severity, code, message, sourceId = null) => ({ severity, code, message, sourceId, path: null });

/**
 * @param {Object} invoer
 * @param {any} invoer.modelBestand          - het BPMN-model ({model_naam, model: {elements, diagrams}}) of het model zelf
 * @param {any} invoer.edienst               - het e-dienst-inrichtingsmodel
 * @param {string} invoer.identifier         - de identifier van het artefact = proces-id
 * @param {string|null} [invoer.peiltijdstip]
 * @param {string} [invoer.versienummer]
 * @param {(tekst: string) => string | Promise<string>} invoer.sha256Hex
 * @param {any} [invoer.regelset]            - engine-regelset (anders volgens `engine` van het bpmn-artefact)
 * @param {Record<string, any[]>} [invoer.beslissingen] - zoals bij maakBpmnArtefact (alleen nodig om dezelfde id's te krijgen)
 */
export async function maakProcesLinkArtefact({ modelBestand, edienst, identifier, peiltijdstip = null, versienummer, sha256Hex, regelset, beslissingen = {} }) {
  const model = modelBestand?.model || modelBestand;
  const artefacten = edienst?.artefacten || [];
  const keuzes = artefacten.find((a) => a.identifier === identifier && a.soort === SOORT);
  if (!keuzes) throw new Error(`Geen proceskoppeling "${identifier}" in het e-dienstmodel.`);
  const proces = artefacten.find((a) => a.identifier === identifier && a.soort === "bpmn");
  if (!proces) throw new Error(`De proceskoppeling "${identifier}" heeft geen bpmn-artefact met dezelfde identifier in de e-dienst.`);
  const engine = regelset || ENGINES[proces.engine];
  if (!engine) throw new Error(`Onbekende engine "${proces.engine}" (bekend: ${Object.keys(ENGINES).join(", ")}).`);
  const regels = engine.proceskoppeling;
  if (!regels) throw new Error(`De engine-regelset "${engine.id}" kent geen proceskoppelingen.`);

  const naam = proces.bron?.diagram;
  const diagram = Object.values(model?.diagrams || {}).find((d) => d.naam === naam || d.id === naam);
  if (!diagram) throw new Error(`Diagram "${naam}" niet gevonden in het BPMN-model.`);

  // Dezelfde id's als in de XML van het bpmn-artefact.
  const { ids } = schrijfBpmn({ model, diagramId: diagram.id, proces: { id: proces.identifier, naam: proces.naam || diagram.naam }, targetNamespace: proces.targetNamespace, engine, beslissingen });

  const diagnostics = [];
  const traceregels = [];
  const payload = [];
  for (const knoop of diagram.nodes || []) {
    const el = model.elements?.[knoop.elementId];
    if (el?.elementType !== "taak" || el.data?.taakSoort !== "user") continue;
    const formulier = el.data?.formulier;
    if (!formulier) {
      diagnostics.push(meld("warning", "PL-FORMULIER", `Gebruikerstaak "${el.naam}" heeft geen formulier; de behandelaar kan de taak dan alleen zonder invoer afronden`, el.id));
      continue;
    }
    if (!artefacten.some((a) => a.soort === "dossierformulier" && a.identifier === formulier)) {
      diagnostics.push(meld("error", "PL-FORMULIER", `Gebruikerstaak "${el.naam}" noemt formulier "${formulier}", maar dat is geen dossierformulier van de e-dienst`, el.id));
    }
    traceregels.push({ bronGE: el.id, regel: "Gebruikerstaak met formulier → formulierkoppeling", doelPad: `/${payload.length}`, actie: "aangemaakt" });
    payload.push({ activityId: ids.get(el.id), ...regels.formulier.voor, formDefinitionName: formulier, ...regels.formulier.na });
  }
  if (!payload.length) diagnostics.push(meld("info", "PL-LEEG", `Proces "${identifier}" heeft geen taken waar de regelset een koppeling voor maakt`));

  const artefact = {
    artefactIdentificatie: {
      soort: keuzes.soort,
      identifier: keuzes.identifier,
      naam: keuzes.naam || `Taakkoppelingen ${proces.naam || diagram.naam}`,
      versienummer: versienummer || keuzes.versienummer || edienst?.edienst?.versienummer || "0.1.0",
    },
    artefactInhoud: { formaat: keuzes.formaat, payload, payloadHash: await jcsHash(payload, sha256Hex) },
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
    // Zelfde identifier als het bpmn-artefact: alleen afhankelijkheden die deze soort noemen.
    afhankelijkheden: (edienst?.afhankelijkheden || [])
      .filter((a) => a.artefact === keuzes.identifier && a.soort === keuzes.soort)
      .map((a) => ({ identifier: a.afhankelijkVan, ...(a.afhankelijkVanSoort ? { soort: a.afhankelijkVanSoort } : {}), reden: a.reden })),
  };
  return { artefact, diagnostics };
}
