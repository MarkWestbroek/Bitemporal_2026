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
 * Naam en uuid (besluit Mark 31-10, BACKLOG §40): binnen het model bindt een
 * kolom via de `uuid` van het veld, zodat een hernoeming meegaat; bij de export
 * is het naampad van dát moment de identificatie (Operaton, documentatie,
 * register). Met het V3-model erbij zoekt de aansluiting daarom elke
 * `fieldRef` met een uuid op in het actuele model (`verversFieldRef`) en
 * schrijft het naampad van nu; een ref zonder uuid werkt op zijn naampad. De
 * traceregels dragen de uuid mee (`bronUuid`), zodat een artefact ook na een
 * hernoeming naar zijn bron terug te voeren is.
 *
 * Keten (16-11): leest een kolom het resultaat van een andere beslissing (pijl in het DRD), dan gaat
 * die beslissing mee in hetzelfde DMN-bestand als `requiredDecision`, en zo verder terug. De kolom
 * leest de uitvoer onder de naam van de uitvoerkolom; `invoer` bevat de dossierwaarden van de hele
 * keten.
 *
 * Zelfde artefactvorm als de andere inrichtingsartefacten; de payload is de
 * XML-tekst en payloadHash = sha256 over de UTF-8-tekst (zoals bpmn).
 *
 * Puur op de hashfunctie na, die wordt meegegeven.
 */
import { jcsHash } from "../../transformatie/jcs.js";
import { afhankelijkhedenVan } from "../../transformatie/afhankelijkheden.js";
import { doelVersieRange } from "../../transformatie/doelVersie.js";
import { schrijfDmn } from "../../transformatie/dmnXmlSchrijver.js";
import { fieldRefsOpUuid, verversFieldRef } from "../../modelpicker/modelTree.js";
import { pickerTypesUitV3 } from "../../modelpicker/pickerTypesUitV3.js";
import { bronnenVan, metInvoerUitDrd } from "./invoerUitDrd.js";
import { bpmnIdUit } from "../../transformatie/bpmnXmlSchrijver.js";

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
 * Het modelpad (Entiteit.GE.veld, zoals de traceregels van het objecttype het
 * noemen) van een FieldRef. De ModelPicker schrijft in `veldpad` de
 * collectienaam (`GehandicaptenparkeerkaartAanvraag.gpkaanvraag_kaarten.soort`,
 * de vorm van /api/schema/model/code); `typenaam` is dan de GE-hub
 * (`GehandicaptenparkeerkaartAanvraag_GpkAanvraagKaart`).
 */
function modelPad(ref) {
  if (!ref?.typenaam || !ref?.veldnaam) return null;
  const i = ref.typenaam.indexOf("_");
  return i < 0 ? `${ref.typenaam}.${ref.veldnaam}` : `${ref.typenaam.slice(0, i)}.${ref.typenaam.slice(i + 1)}.${ref.veldnaam}`;
}

/**
 * @param {Object} invoer
 * @param {any} invoer.modelBestand          - het DMN-model ({model_naam, model: {elements, diagrams}}) of het model zelf
 * @param {any} invoer.edienst               - het e-dienst-inrichtingsmodel
 * @param {string} invoer.identifier         - de identifier van het artefact = decision-id
 * @param {any} [invoer.objecttype]          - het objecttype-artefact (traceregels: waar elk veld staat)
 * @param {any} [invoer.v3Model]             - het canonieke V3-model: ververst elke fieldRef met uuid naar het naampad van nu
 * @param {string|null} [invoer.peiltijdstip]
 * @param {string} [invoer.versienummer]
 * @param {(tekst: string) => string | Promise<string>} invoer.sha256Hex
 * @returns {Promise<{artefact: any, diagnostics: any[], invoer: any[]}>}
 */
export async function maakDmnArtefact({ modelBestand, edienst, identifier, objecttype = null, v3Model = null, peiltijdstip = null, versienummer, sha256Hex }) {
  const model = modelBestand?.model || modelBestand;
  const keuzes = (edienst?.artefacten || []).find((a) => a.identifier === identifier && a.soort === "dmn");
  if (!keuzes) throw new Error(`Geen dmn-artefact "${identifier}" in het e-dienstmodel.`);
  const naam = keuzes.bron?.beslissing;
  const el = Object.values(model?.elements || {}).find((e) => e.elementType === "decision" && (e.naam === naam || e.id === naam));
  if (!el) throw new Error(`Beslissing "${naam}" niet gevonden in het DMN-model.`);
  const opgeslagen = el.data?.beslistabel;
  if (!opgeslagen) throw new Error(`Beslissing "${el.naam}" heeft geen beslistabel.`);

  const diagnostics = [];
  // Binding via de uuid: het naampad van nu uit het V3-model.
  const index = v3Model ? fieldRefsOpUuid(pickerTypesUitV3(v3Model)) : null;
  const elements = model?.elements || {};

  /**
   * De tabel van een beslissing zoals ze de deur uitgaat. Kolommen uit het DRD
   * (invoerUitDrd.js, 16-11): naam en veld volgen het invoergegeven van nu. De export voegt
   * geen kolommen toe; dat doet de editor bij het opslaan. Daarna: elke FieldRef via de uuid
   * naar het naampad van nu.
   */
  const tabelVan = (b) => {
    const bijgewerkt = metInvoerUitDrd(
      b.data.beslistabel,
      bronnenVan(elements, b.id),
      (gegeven, kolom) => (gegeven?.uuid && index?.get(gegeven.uuid)) || (kolom?.fieldRef?.uuid && kolom.fieldRef.uuid === gegeven?.uuid ? kolom.fieldRef : null) || (index ? null : kolom?.fieldRef || null),
      { alleenBestaand: true }
    );
    return {
      ...bijgewerkt,
      inputs: (bijgewerkt.inputs || []).map((c) => {
        const ref = c.fieldRef;
        if (!ref?.uuid || !index) return c;
        if (!index.has(ref.uuid)) {
          diagnostics.push({ severity: "warning", code: "DMN-UUID", message: `Veld "${ref.veldpad}" (kolom "${c.label || c.naam || ref.veldnaam}") staat niet meer in het model; het opgeslagen naampad is gebruikt`, sourceId: c.id, path: null });
          return c;
        }
        const nieuw = verversFieldRef(ref, index);
        return nieuw === ref ? c : { ...c, fieldRef: nieuw };
      }),
    };
  };

  // De keten (16-11): de hoofdbeslissing en alle beslissingen die zij, direct of verder terug,
  // als invoer heeft (information requirement in het DRD). Ze gaan samen in één DMN-bestand.
  const keten = [];
  const perElement = new Map();
  const ids = new Set();
  const uniekId = (basis) => {
    let id = basis;
    for (let i = 2; ids.has(id); i++) id = `${basis}-${i}`;
    ids.add(id);
    return id;
  };
  const voegToe = (b, id) => {
    const schakel = { el: b, id, tabel: tabelVan(b), vereistIds: [] };
    perElement.set(b.id, schakel);
    keten.push(schakel);
    return schakel;
  };
  const wachtrij = [voegToe(el, uniekId(keuzes.identifier))];
  while (wachtrij.length) {
    const schakel = wachtrij.shift();
    const vereist = [...new Set(schakel.tabel.inputs.filter((c) => c.bron?.soort === "beslissing" && !c.bronWeg).map((c) => c.bron.elementId))];
    for (const vid of vereist) {
      const v = elements[vid];
      if (!v?.data?.beslistabel) {
        diagnostics.push({ severity: "error", code: "DMN-KETEN", message: `Beslissing "${v?.naam || vid}" is invoer van "${schakel.el.naam}", maar heeft geen beslistabel`, sourceId: vid, path: null });
        continue;
      }
      // Een kring kan het DRD niet hebben (een pijl wijst naar een beslissing die al in de keten
      // staat): dan alleen de vereiste aangeven, niet nog eens toevoegen.
      const bestaand = perElement.get(vid) || null;
      const doel = bestaand || voegToe(v, uniekId(bpmnIdUit(v.naam) || vid));
      if (!bestaand) wachtrij.push(doel);
      schakel.vereistIds.push(doel.id);
    }
  }
  // Een kolom uit een andere beslissing leest de uitvoer daarvan onder de naam van die uitvoer.
  for (const schakel of keten) {
    schakel.tabel = {
      ...schakel.tabel,
      inputs: schakel.tabel.inputs.map((c) => {
        if (c.bron?.soort !== "beslissing" || c.bronWeg) return c;
        const outs = perElement.get(c.bron.elementId)?.tabel.outputs || [];
        const out = c.bron.uitvoerId ? outs.find((o) => o.id === c.bron.uitvoerId) : outs[0];
        const uitvoerNaam = out?.naam || out?.fieldRef?.veldnaam;
        if (!uitvoerNaam) {
          diagnostics.push({ severity: "error", code: "DMN-KETEN", message: `Kolom "${c.naam}" in "${schakel.el.naam}": de uitvoer van "${elements[c.bron.elementId]?.naam || c.bron.elementId}" is niet gevonden of heeft geen naam`, sourceId: c.id, path: null });
          return c;
        }
        return { ...c, naam: uitvoerNaam, label: c.label || c.naam };
      }),
    };
  }
  if (!objecttype) diagnostics.push({ severity: "error", code: "DMN-OBJECTTYPE", message: "Geen objecttype-artefact: daaruit volgt waar elk veld in het dossier staat", sourceId: null, path: null });

  // Per kolom (van alle beslissingen in de keten): waar de engine de waarde vindt. De uitvoer van
  // een vereiste beslissing rekent de engine zelf uit; die hoort hier niet bij.
  const invoer = [];
  const gezien = new Set();
  for (const c of keten.flatMap((s) => s.tabel.inputs || [])) {
    if (c.bronWeg) {
      const b = c.bron?.soort === "beslissing" ? elements[c.bron.elementId] : null;
      // Een beslissing die nog wel in het diagram staat maar haar tabel kwijt is: dat zeggen.
      if (b?.elementType === "decision" && !b.data?.beslistabel) diagnostics.push({ severity: "error", code: "DMN-KETEN", message: `Kolom "${c.naam || c.id}" leest het resultaat van "${b.naam}", maar die beslissing heeft geen beslistabel`, sourceId: c.id, path: null });
      else diagnostics.push({ severity: "warning", code: "DMN-BRON", message: `De bron van kolom "${c.naam || c.id}" staat niet meer in het diagram`, sourceId: c.id, path: null });
    }
    if (c.bron?.soort === "beslissing") continue;
    let veldpad = c.fieldRef?.veldpad;
    const naamVar = c.naam || c.fieldRef?.veldnaam;
    if (gezien.has(naamVar)) continue;
    gezien.add(naamVar);
    if (!veldpad) {
      diagnostics.push({ severity: "error", code: "DMN-VELD", message: `Kolom "${c.label || c.id}" is niet gebonden aan een modelveld`, sourceId: c.id, path: null });
      continue;
    }
    let plek = objecttype ? invoerVoorVeld(veldpad, objecttype) : null;
    const pad = modelPad(c.fieldRef);
    if (!plek && objecttype && pad && pad !== veldpad && (plek = invoerVoorVeld(pad, objecttype))) veldpad = pad;
    if (!plek) {
      if (objecttype) {
        diagnostics.push({ severity: "warning", code: "DMN-VELD", message: `Veld "${veldpad}" (kolom "${c.label || naamVar}") staat niet in het objecttype; de waarde is leeg tot het veld in het model en het formulier staat`, sourceId: c.id, path: null });
      }
      invoer.push({ naam: naamVar, bron: "dossier", pointer: `/${c.fieldRef.veldnaam || naamVar}`, lijst: false, veldpad, uuid: c.fieldRef.uuid });
      continue;
    }
    if (plek.bron === "dossier" && plek.lijst && !c.expressie) {
      diagnostics.push({ severity: "warning", code: "DMN-LIJST", message: `Kolom "${c.label || naamVar}" leest een lijst (${plek.pointer}) zonder expressie`, sourceId: c.id, path: null });
    }
    if (plek.bron === "variabele" && plek.variabele !== naamVar) {
      diagnostics.push({ severity: "warning", code: "DMN-VELD", message: `Kolom "${c.label || naamVar}" heet anders dan de procesvariabele "${plek.variabele}"`, sourceId: c.id, path: null });
    }
    invoer.push({ naam: naamVar, ...plek, veldpad, uuid: c.fieldRef.uuid });
  }

  const [hoofd, ...vereist] = keten;
  const { xml, diagnostics: schrijf } = schrijfDmn({
    beslissing: { id: hoofd.id, naam: keuzes.naam || el.naam, tabel: hoofd.tabel, vereistIds: hoofd.vereistIds },
    vereist: vereist.map((s) => ({ id: s.id, naam: s.el.naam, tabel: s.tabel, vereistIds: s.vereistIds })),
    namespace: keuzes.namespace,
  });
  diagnostics.push(...schrijf);

  const traceregels = [
    { bronGE: el.id, regel: "Beslistabel → decisionTable", doelPad: `#${keuzes.identifier}`, actie: "aangemaakt" },
    ...vereist.map((s) => ({ bronGE: s.el.id, regel: "Vereiste beslissing → decision + requiredDecision", doelPad: `#${s.id}`, actie: "aangemaakt" })),
    ...invoer.map((x) => ({ bronGE: x.veldpad, regel: x.bron === "variabele" ? "Envelopveld → procesvariabele" : "Modelveld → dossierwaarde (JSON-pointer)", doelPad: `#${keuzes.identifier}/input/${x.naam}`, actie: "aangemaakt", ...(x.uuid ? { bronUuid: x.uuid } : {}) })),
  ];
  const artefact = {
    artefactIdentificatie: {
      soort: keuzes.soort,
      identifier: keuzes.identifier,
      naam: keuzes.naam || el.naam,
      versienummer: versienummer || keuzes.versienummer || edienst?.edienst?.versienummer || "0.1.0",
      doelVersieRange: doelVersieRange(keuzes),
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
    afhankelijkheden: afhankelijkhedenVan(edienst, keuzes),
  };
  return { artefact, diagnostics, invoer: invoer.map(({ veldpad, uuid, ...x }) => x) };
}
