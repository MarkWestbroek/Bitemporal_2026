// @ts-check
/**
 * dmnArtefact — aansluiting "DMN-model (Omnium-project) + objecttype + e-dienst
 * → dmn-artefact (DMN 1.3 XML)" voor de inrichting van e-diensten
 * (docs/TRANSFORMATIES.md §11.12).
 *
 * Route:
 *
 *   DMN-model (profiel dmn-drd) ─ beslissing.beslistabel ─▶ dmnXmlSchrijver ─▶ XML ─▶ artefact
 *   objecttype-artefact (traceregels) ─▶ per kolom: waar de engine de waarde vindt
 *   e-dienst (identifier = decision-id)
 *
 * De beslistabel heeft de vorm van `dmn/dmnModel.js`: elke kolom bindt aan een
 * veld van het canonieke model (`fieldRef.veldpad`, bv.
 * `GehandicaptenparkeerkaartAanvraag.GpkAanvraagKaart.soort`). De traceregels
 * van het objecttype zeggen waar dat veld in de dossierinhoud staat (de
 * Verzoek-plugin kopieert `data` uit de envelop): `/soort`, of `/bijlagen` voor
 * een veld in een meervoudig GE. Een envelopveld (`envelop:bsn`) is een
 * procesvariabele. Dat levert `invoer`, die de BPMN-schrijver op de
 * businessRuleTask zet (bpmnArtefact, regelset bpmn-naar-gzac).
 *
 * Zelfde artefactvorm als de andere inrichtingsartefacten; de payload is de
 * XML-tekst en payloadHash = sha256 over de UTF-8-tekst (zoals bpmn).
 *
 * Puur op de hashfunctie na, die wordt meegegeven.
 */
import { jcsHash } from "../../transformatie/jcs.js";
import { schrijfDmn } from "../../transformatie/dmnXmlSchrijver.js";

export const SCHRIJVER_ID = "dmn-xml-schrijver@0.1.0";
export const REGELSET = { id: "dmn-beslistabel", versie: "0.1.0" };

const DATA = "/jsonSchema/properties/data";

/**
 * Waar een modelveld in de dossierinhoud staat, volgens de traceregels van het
 * objecttype-artefact.
 * @returns {{bron: "dossier", pointer: string, lijst: boolean} | {bron: "variabele", variabele: string} | null}
 */
export function invoerVoorVeld(veldpad, objecttype) {
  const t = (objecttype?.traceregels || []).find((x) => x.bronGE === veldpad && typeof x.doelPad === "string");
  if (!t) return null;
  if (veldpad.startsWith("envelop:")) return { bron: "variabele", variabele: veldpad.slice("envelop:".length) };
  if (!t.doelPad.startsWith(`${DATA}/`)) return null;
  const delen = t.doelPad.slice(DATA.length).split("/").filter((d) => d && d !== "properties");
  const i = delen.indexOf("items");
  const pad = i < 0 ? delen : delen.slice(0, i);
  return { bron: "dossier", pointer: `/${pad.join("/")}`, lijst: i >= 0 };
}

/**
 * @param {Object} invoer
 * @param {any} invoer.modelBestand          - het DMN-model ({model_naam, model: {elements, diagrams}}) of het model zelf
 * @param {any} invoer.edienst               - het e-dienst-inrichtingsmodel
 * @param {string} invoer.identifier         - de identifier van het artefact = decision-id
 * @param {any} [invoer.objecttype]          - het objecttype-artefact (traceregels: waar elk veld staat)
 * @param {string|null} [invoer.peiltijdstip]
 * @param {string} [invoer.versienummer]
 * @param {(tekst: string) => string | Promise<string>} invoer.sha256Hex
 * @returns {Promise<{artefact: any, diagnostics: any[], invoer: any[]}>}
 */
export async function maakDmnArtefact({ modelBestand, edienst, identifier, objecttype = null, peiltijdstip = null, versienummer, sha256Hex }) {
  const model = modelBestand?.model || modelBestand;
  const keuzes = (edienst?.artefacten || []).find((a) => a.identifier === identifier && a.soort === "dmn");
  if (!keuzes) throw new Error(`Geen dmn-artefact "${identifier}" in het e-dienstmodel.`);
  const naam = keuzes.bron?.beslissing;
  const el = Object.values(model?.elements || {}).find((e) => e.elementType === "decision" && (e.naam === naam || e.id === naam));
  if (!el) throw new Error(`Beslissing "${naam}" niet gevonden in het DMN-model.`);
  const tabel = el.data?.beslistabel;
  if (!tabel) throw new Error(`Beslissing "${el.naam}" heeft geen beslistabel.`);

  const diagnostics = [];
  if (!objecttype) diagnostics.push({ severity: "error", code: "DMN-OBJECTTYPE", message: "Geen objecttype-artefact: daaruit volgt waar elk veld in het dossier staat", sourceId: null, path: null });

  // Per kolom: waar de engine de waarde vindt.
  const invoer = [];
  for (const c of tabel.inputs || []) {
    const veldpad = c.fieldRef?.veldpad;
    const naamVar = c.naam || c.fieldRef?.veldnaam;
    if (!veldpad) {
      diagnostics.push({ severity: "error", code: "DMN-VELD", message: `Kolom "${c.label || c.id}" is niet gebonden aan een modelveld`, sourceId: c.id, path: null });
      continue;
    }
    const plek = objecttype ? invoerVoorVeld(veldpad, objecttype) : null;
    if (!plek) {
      if (objecttype) {
        diagnostics.push({ severity: "warning", code: "DMN-VELD", message: `Veld "${veldpad}" (kolom "${c.label || naamVar}") staat niet in het objecttype; de waarde is leeg tot het veld in het model en het formulier staat`, sourceId: c.id, path: null });
      }
      invoer.push({ naam: naamVar, bron: "dossier", pointer: `/${c.fieldRef.veldnaam || naamVar}`, lijst: false, veldpad });
      continue;
    }
    if (plek.bron === "dossier" && plek.lijst && !c.expressie) {
      diagnostics.push({ severity: "warning", code: "DMN-LIJST", message: `Kolom "${c.label || naamVar}" leest een lijst (${plek.pointer}) zonder expressie`, sourceId: c.id, path: null });
    }
    if (plek.bron === "variabele" && plek.variabele !== naamVar) {
      diagnostics.push({ severity: "warning", code: "DMN-VELD", message: `Kolom "${c.label || naamVar}" heet anders dan de procesvariabele "${plek.variabele}"`, sourceId: c.id, path: null });
    }
    invoer.push({ naam: naamVar, ...plek, veldpad });
  }

  const { xml, diagnostics: schrijf } = schrijfDmn({ beslissing: { id: keuzes.identifier, naam: keuzes.naam || el.naam, tabel }, namespace: keuzes.namespace });
  diagnostics.push(...schrijf);

  const traceregels = [
    { bronGE: el.id, regel: "Beslistabel → decisionTable", doelPad: `#${keuzes.identifier}`, actie: "aangemaakt" },
    ...invoer.map((x) => ({ bronGE: x.veldpad, regel: x.bron === "variabele" ? "Envelopveld → procesvariabele" : "Modelveld → dossierwaarde (JSON-pointer)", doelPad: `#${keuzes.identifier}/input/${x.naam}`, actie: "aangemaakt" })),
  ];
  const artefact = {
    artefactIdentificatie: {
      soort: keuzes.soort,
      identifier: keuzes.identifier,
      naam: keuzes.naam || el.naam,
      versienummer: versienummer || keuzes.versienummer || edienst?.edienst?.versienummer || "0.1.0",
    },
    artefactInhoud: { formaat: keuzes.formaat, payload: xml, payloadHash: await sha256Hex(xml) },
    artefactHerkomst: {
      regelsetId: REGELSET.id,
      regelsetVersie: REGELSET.versie,
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
  return { artefact, diagnostics, invoer: invoer.map(({ veldpad, ...x }) => x) };
}
