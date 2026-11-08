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
 * Twee soorten koppelingen:
 * - een gebruikerstaak met een `formulier` (de identifier van een
 *   dossierformulier van de e-dienst) krijgt een formulierkoppeling;
 * - een servicetaak met een `actie` (zaak aanmaken, rol koppelen, document
 *   koppelen, zaakstatus zetten) krijgt een plugin-koppeling. De rol of status
 *   (`actieDoel`) is op naam een roltype of statustype van het zaaktype in de
 *   e-dienst; de engine-regelset zegt welke plugin-actie erbij hoort
 *   (docs/plans/2026-11-05 Servicetaken en dossierstatus uit het model).
 * Een servicetaak die alleen de dossierstatus zet, heeft geen koppeling nodig:
 * dat staat in de XML.
 *
 * De identifier is de proces-id, dezelfde als van het bpmn-artefact; de soort
 * onderscheidt ze. De activityId's zijn de id's die de BPMN-schrijver in de
 * XML zet, zodat koppeling en proces altijd op elkaar passen.
 *
 * Zelfde artefactvorm als de andere inrichtingsartefacten; de payload is JSON
 * en payloadHash = sha256 over JCS. Puur op de hashfunctie na.
 */
import { jcsHash } from "../../transformatie/jcs.js";
import { afhankelijkhedenVan } from "../../transformatie/afhankelijkheden.js";
import { doelVersieRange } from "../../transformatie/doelVersie.js";
import { schrijfBpmn } from "../../transformatie/bpmnXmlSchrijver.js";
import { ENGINES } from "./bpmnArtefact.js";

export const SCHRIJVER_ID = "gzac-process-link-schrijver@0.1.0";
export const SOORT = "proceskoppeling";

const meld = (severity, code, message, sourceId = null) => ({ severity, code, message, sourceId, path: null });

/** Het zaaktype waar een proces op draait: genoemd bij het bpmn-artefact, anders het enige zaaktype van de e-dienst. */
function zaaktypeVan(proces, artefacten) {
  const alle = artefacten.filter((a) => a.soort === "zaaktype");
  if (proces.zaaktype) return alle.find((a) => a.identifier === proces.zaaktype) || null;
  return alle.length === 1 ? alle[0] : null;
}

/**
 * Vul `{zaaktype}`, `{volgnummer}`, `{toelichting}` en `{formulier}` in; `${…}` en `pv:…` blijven
 * staan. Leeg = weglaten. Een waarde die geen tekst is (lijst, getal) gaat ongewijzigd mee.
 */
function vulEigenschappen(sjabloon, waarden) {
  const uit = {};
  for (const [k, v] of Object.entries(sjabloon)) {
    if (typeof v !== "string") {
      uit[k] = structuredClone(v);
      continue;
    }
    const w = Object.entries(waarden).reduce((t, [naam, waarde]) => t.split(`{${naam}}`).join(String(waarde ?? "")), String(v));
    if (w !== "") uit[k] = w;
  }
  return uit;
}

/**
 * De plugin-koppeling van een servicetaak met een actie, of null met een
 * melding als de actie of zijn rol/status niet klopt.
 */
function pluginKoppeling({ el, activityId, regels, proces, artefacten, diagnostics }) {
  const regel = regels.acties?.[el.data.actie];
  if (!regel) {
    diagnostics.push(meld("error", "PL-ACTIE", `Taak "${el.naam}": de regelset kent de actie "${el.data.actie}" niet`, el.id));
    return null;
  }
  const zaaktype = zaaktypeVan(proces, artefacten);
  const waarden = { zaaktype: zaaktype?.identifier || "", volgnummer: "", toelichting: el.data.actieToelichting || "", formulier: el.data.formulier || "" };
  if (!waarden.formulier && Object.values(regel.eigenschappen || {}).some((v) => typeof v === "string" && v.includes("{formulier}"))) {
    diagnostics.push(meld("error", "PL-FORMULIER", `Taak "${el.naam}": de actie "${el.data.actie}" vraagt een formulier`, el.id));
    return null;
  }
  const doel = el.data.actieDoel;
  if (regel.doel) {
    if (!zaaktype) {
      diagnostics.push(meld("error", "PL-ZAAKTYPE", `Servicetaak "${el.naam}": de e-dienst heeft niet precies één zaaktype; noem het bij het bpmn-artefact (zaaktype)`, el.id));
      return null;
    }
    if (!doel) {
      diagnostics.push(meld("error", regel.doel.soort === "rol" ? "PL-ROL" : "PL-STATUS", `Servicetaak "${el.naam}": de actie "${el.data.actie}" noemt geen ${regel.doel.soort}`, el.id));
      return null;
    }
    if (regel.doel.soort === "rol") {
      const rol = (zaaktype.zaaktype?.roltypen || []).find((r) => r.omschrijving === doel);
      if (!rol) {
        diagnostics.push(meld("error", "PL-ROL", `Servicetaak "${el.naam}": zaaktype ${zaaktype.identifier} kent geen roltype "${doel}"`, el.id));
        return null;
      }
      if (regel.doel.alleenGeneriek && rol.omschrijvingGeneriek !== regel.doel.alleenGeneriek) {
        diagnostics.push(meld("warning", "PL-ROL", `Servicetaak "${el.naam}": de regelset koppelt alleen de rol "${regel.doel.alleenGeneriek}"; "${doel}" (${rol.omschrijvingGeneriek}) krijgt geen koppeling`, el.id));
        return null;
      }
    } else {
      const i = (zaaktype.zaaktype?.statustypen || []).findIndex((s) => s.omschrijving === doel);
      if (i < 0) {
        diagnostics.push(meld("error", "PL-STATUS", `Servicetaak "${el.naam}": zaaktype ${zaaktype.identifier} kent geen statustype "${doel}"`, el.id));
        return null;
      }
      waarden.volgnummer = i + 1; // het statustypevolgnummer volgt de volgorde in de e-dienst (zaaktype-regelset)
    }
  }
  return {
    activityId,
    // Een actie mag een eigen plugin hebben (definitie, configuratie) en een eigen activityType
    // (`voor`), bv. de portaaltaak op een gebruikerstaak (regelset 0.8.0).
    ...regels.voor,
    ...regel.voor,
    pluginConfigurationId: regel.configuratie || regels.configuratie,
    pluginDefinitionKey: regel.definitie || regels.definitie,
    pluginActionDefinitionKey: regel.actie,
    actionProperties: vulEigenschappen(regel.eigenschappen, waarden),
    ...regels.na,
  };
}

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
    if (el?.elementType !== "taak" || !ids.has(el.id)) continue; // niet in het proces (pool als deelnemer)
    // Een gebruikerstaak met een actie (bv. een portaaltaak, 08-11) krijgt ook een plugin-koppeling.
    if (el.data?.taakSoort === "user" && el.data?.actie) {
      const koppeling = pluginKoppeling({ el, activityId: ids.get(el.id), regels: regels.plugin, proces, artefacten, diagnostics });
      if (!koppeling) continue;
      traceregels.push({ bronGE: el.id, regel: `Gebruikerstaak met actie ${el.data.actie} → plugin-koppeling`, doelPad: `/${payload.length}`, actie: "aangemaakt" });
      payload.push(koppeling);
      continue;
    }
    if (el.data?.taakSoort === "service") {
      if (!el.data.actie) {
        // Een taak die alleen de dossierstatus zet, doet dat in de XML.
        if (!el.data.dossierstatus) diagnostics.push(meld("warning", "PL-ACTIE", `Servicetaak "${el.naam}" heeft geen actie; de engine voert hem uit zonder iets te doen`, el.id));
        continue;
      }
      const koppeling = pluginKoppeling({ el, activityId: ids.get(el.id), regels: regels.plugin, proces, artefacten, diagnostics });
      if (!koppeling) continue;
      traceregels.push({ bronGE: el.id, regel: `Servicetaak met actie ${el.data.actie} → plugin-koppeling`, doelPad: `/${payload.length}`, actie: "aangemaakt" });
      payload.push(koppeling);
      continue;
    }
    if (el.data?.taakSoort !== "user") continue;
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
      doelVersieRange: doelVersieRange(keuzes),
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
    afhankelijkheden: afhankelijkhedenVan(edienst, keuzes, { alleenMetSoort: true }),
  };
  return { artefact, diagnostics };
}
