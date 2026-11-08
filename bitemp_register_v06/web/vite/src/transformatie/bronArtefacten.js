// @ts-check
/**
 * bronArtefacten — de **bronnen** van de inrichtingsartefacten van een
 * e-dienst als eigen artefacten (docs/TRANSFORMATIES.md §11.14; besluit Mark
 * 05-11, voorstel in de Fundament-repo: docs/inrichtingsmodel-wijziging-
 * bronnen.md). Het inrichting-register legt zo vast waaruit een artefact is
 * gemaakt, en kan van een bron met diagrammen een tekening maken.
 *
 * Per e-dienst, versie 1:
 *
 * | soort           | formaat                   | inhoud                                        |
 * |-----------------|---------------------------|-----------------------------------------------|
 * | `edienstmodel`  | `omnium-edienstmodel-json`| het e-dienstmodel, zoals gelezen              |
 * | `logisch-model` | `omnium-studio-json`      | het canonieke model: elementen en diagrammen  |
 * | `bpmn-bron`     | `omnium-studio-json`      | het BPMN-model: elementen en diagrammen       |
 * | `dmn-bron`      | `omnium-studio-json`      | het DMN-model, met de beslistabellen          |
 *
 * - **Identifier** = de code van de e-dienst (`edienst.code`); de soort maakt
 *   hem uniek. Leest een e-dienst meer dan één BPMN- of DMN-modelbestand, dan
 *   komt de naam van het bestand erachter.
 * - **`omnium-studio-json`** is de vorm van een Studio-project met één
 *   profiel: `{formaat, versie, profielen: {<profiel-id>: {elements, diagrams}}}`.
 *   Dat is ook de invoer van de render-API (`taal=studio`), zodat het
 *   registratiescript van elke bron los een tekening kan vragen. De
 *   diagrammen staan in `profielen.<profiel-id>.diagrams` (id → {id, naam, …}).
 * - **Zelfstandig**: een bron bevat alles wat hij toont, ook elementen die uit
 *   een gedeeld domein geleend zijn. Elk canoniek element draagt zijn domein
 *   (`data.domein`), zodat te zien is wat eigen is en wat geleend.
 * - **payloadHash** = sha256 over JCS van de payload. Er staat geen tijdstip
 *   in de payload: dezelfde bron geeft dezelfde hash. De opmaak (posities)
 *   telt mee.
 * - Een gegenereerd artefact noemt zijn bronnen in `bronnen: [{soort,
 *   identifier, payloadHash}]`. `artefactHerkomst.bronmodelHash` blijft de
 *   hash van de hoofdbron zoals de regelset die las (V3, of het BPMN-/DMN-
 *   model).
 * - Een traceregel krijgt `bronElementId`: het id van het element in de bron,
 *   zoals de Studio en de tekeningen het kennen (`data-element-id`): het
 *   BPMN-/DMN-element, of het element van het canonieke model (besluit Mark
 *   08-11, was: de uuid). Een veld krijgt het id van zijn gegevenselement,
 *   een pad over een relatie het element aan het eind. De uuid van het
 *   modelelement gaat apart mee als `bronUuid`, als het model die heeft.
 *   `bronGE` (de naam) blijft.
 *
 * Nog niet: een verwijzing naar een bron van een andere eigenaar, en het
 * canonieke model zelf als bron per domein. Het canonieke model is van geen
 * e-dienst; waar het in het register hangt, is nog niet besloten.
 *
 * Puur op de hashfunctie na, die wordt meegegeven.
 */
import { jcsHash } from "./jcs.js";
import { importeerV3 } from "../diagramprofielen/canoniek-uml/serialisatie.js";

export const SCHRIJVER_ID = "omnium-bron-schrijver@0.1.0";
export const FORMAAT_STUDIO = "omnium-studio-json";
export const FORMAAT_EDIENST = "omnium-edienstmodel-json";

/** Profiel-id's zoals een Studio-project ze draagt (en de render-API ze kent). */
export const PROFIEL = { canoniek: "diagram05", bpmn: "bpmnMotor05", dmn: "dmnDrd05" };

export const BRON_SOORTEN = ["edienstmodel", "logisch-model", "bpmn-bron", "dmn-bron"];

/** Welke bronnen een artefactsoort leest, naast het e-dienstmodel (dat leest elk artefact). */
const LEEST = {
  objecttype: ["logisch-model"],
  formulier: ["logisch-model"],
  zaaktype: [],
  dossierdefinitie: [],
  dossierschema: ["logisch-model"],
  dossierformulier: ["logisch-model"],
  dossiertabbladen: [],
  dossierwidgettabbladen: ["logisch-model"],
  dossierlijstkolommen: ["logisch-model"],
  dossierzaaktypelink: [],
  dossierprocessen: [],
  dossierdocumentkolommen: [],
  dossierstatussen: ["logisch-model", "bpmn-bron"],
  dmn: ["dmn-bron", "logisch-model"],
  bpmn: ["bpmn-bron"],
  proceskoppeling: ["bpmn-bron"],
};

const meld = (severity, code, message, sourceId = null) => ({ severity, code, message, sourceId, path: null });
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const stam = (bestandsnaam) => slug(String(bestandsnaam || "").replace(/\.json$/i, "").replace(/\.(bpmn|dmn)-model$/i, ""));

/** Eén profiel als Studio-project: de vorm die ook de render-API aanneemt. */
export function studioPayload(profielId, deel) {
  return { formaat: FORMAAT_STUDIO, versie: 1, profielen: { [profielId]: { elements: deel?.elements || {}, diagrams: deel?.diagrams || {} } } };
}

/**
 * De bronartefacten van een e-dienst.
 *
 * @param {Object} invoer
 * @param {any} invoer.edienst                        - het e-dienst-inrichtingsmodel
 * @param {any} invoer.modelBestand                   - het canonieke model als V3 (bestand of model)
 * @param {{elements: any, diagrams: any}|null} [invoer.canoniekDeel] - het canonieke profiel uit de Studio-map
 *   (met de diagrammen); zonder dit komt de bron uit V3, met alleen het diagram dat V3 draagt
 * @param {Record<string, any>} [invoer.bpmnModellen] - BPMN- en DMN-modellen per naam (`bron.model`)
 * @param {string|null} [invoer.peiltijdstip]
 * @param {(tekst: string) => string | Promise<string>} invoer.sha256Hex
 * @returns {Promise<{bronnen: Array<{soort: string, identifier: string, bestandsnaam: string, artefact: any, model: string|null}>, diagnostics: any[]}>}
 */
export async function maakBronArtefacten({ edienst, modelBestand, canoniekDeel = null, bpmnModellen = {}, peiltijdstip = null, sha256Hex }) {
  const diagnostics = [];
  const e = edienst?.edienst || {};
  let code = e.code;
  if (!code) {
    code = slug(e.naam);
    diagnostics.push(meld("warning", "BRON-CODE", `Het e-dienstmodel heeft geen code (edienst.code); de bronnen krijgen "${code}" uit de naam, en die verandert als de naam verandert`));
  }

  const bronnen = [];
  const voegToe = async ({ soort, identifier, naam, formaat, payload, model = null }) => {
    const payloadHash = await jcsHash(payload, sha256Hex);
    bronnen.push({
      soort,
      identifier,
      model,
      bestandsnaam: `${identifier}.${soort}.artefact.json`,
      artefact: {
        artefactIdentificatie: { soort, identifier, naam, versienummer: e.versienummer || "0.1.0" },
        artefactInhoud: { formaat, payload, payloadHash },
        artefactHerkomst: { regelsetId: null, regelsetVersie: null, bronmodelHash: null, bronmodelVersie: null, schrijverId: SCHRIJVER_ID, peiltijdstip },
        traceregels: [],
        edienstversie: { edienst: e.naam, versienummer: e.versienummer },
        afhankelijkheden: [],
      },
    });
  };

  await voegToe({ soort: "edienstmodel", identifier: code, naam: `E-dienstmodel ${e.naam || code}`, formaat: FORMAAT_EDIENST, payload: edienst });

  const canoniek = canoniekDeel || (modelBestand ? importeerV3(modelBestand) : null);
  if (canoniek && Object.keys(canoniek.elements || {}).length) {
    await voegToe({ soort: "logisch-model", identifier: code, naam: `Logisch model ${e.naam || code}`, formaat: FORMAAT_STUDIO, payload: studioPayload(PROFIEL.canoniek, canoniek) });
  } else {
    diagnostics.push(meld("warning", "BRON-MODEL", "Geen canoniek model: de bron logisch-model ontbreekt"));
  }

  // BPMN- en DMN-modellen die een artefact van de e-dienst leest (bron.model), één bron per bestand.
  for (const [artefactSoort, soort, profielId, label] of [["bpmn", "bpmn-bron", PROFIEL.bpmn, "Processen"], ["dmn", "dmn-bron", PROFIEL.dmn, "Beslissingen"]]) {
    const namen = [...new Set((edienst?.artefacten || []).filter((a) => a.soort === artefactSoort && a.bron?.model).map((a) => a.bron.model))];
    for (const naam of namen) {
      const bestand = bpmnModellen[naam];
      const deel = bestand?.model || bestand;
      if (!deel?.elements) {
        diagnostics.push(meld("warning", "BRON-MODEL", `Model "${naam}" is niet meegegeven: de bron ${soort} ontbreekt`, naam));
        continue;
      }
      await voegToe({
        soort,
        identifier: namen.length === 1 ? code : `${code}.${stam(naam)}`,
        naam: `${label} ${e.naam || code}${bestand?.model_naam ? ` (${bestand.model_naam})` : ""}`,
        formaat: FORMAAT_STUDIO,
        payload: studioPayload(profielId, deel),
        model: naam,
      });
    }
  }
  return { bronnen, diagnostics };
}

/** De verwijzing naar een bron zoals een gegenereerd artefact hem noemt. */
const verwijzing = (b) => ({ soort: b.soort, identifier: b.identifier, payloadHash: b.artefact.artefactInhoud.payloadHash });

/**
 * De bronnen van één gegenereerd artefact: het e-dienstmodel, en wat zijn
 * soort verder leest. Bij een BPMN- of DMN-bron alleen het model dat het
 * artefact (of het proces waar het bij hoort) noemt; de dossierstatussen lezen
 * alle processen.
 * @param {any} keuzes   - het artefact in de e-dienst
 * @param {any} edienst
 * @param {Array<{soort: string, identifier: string, model: string|null, artefact: any}>} bronnen
 */
export function bronnenVan(keuzes, edienst, bronnen) {
  const eigenModel =
    keuzes.bron?.model || (edienst?.artefacten || []).find((a) => a.soort === "bpmn" && a.identifier === keuzes.identifier)?.bron?.model || null;
  const uit = [];
  for (const soort of LEEST[keuzes.soort] || []) {
    for (const b of bronnen.filter((x) => x.soort === soort)) {
      if (b.model && eigenModel && keuzes.soort !== "dossierstatussen" && b.model !== eigenModel) continue;
      uit.push(verwijzing(b));
    }
  }
  const eigen = bronnen.find((b) => b.soort === "edienstmodel");
  if (eigen) uit.push(verwijzing(eigen));
  return uit;
}

/**
 * Naampad → uuid voor het canonieke model (V3): Entiteit, Entiteit.GE,
 * Entiteit.GE.veld, Entiteit.Relatie en Entiteit.Relatie.veld. Alleen wat een
 * uuid heeft; een model dat niet uit de Studio komt, heeft ze niet.
 */
export function uuidIndex(modelBestand) {
  const model = modelBestand?.model || modelBestand;
  const index = new Map();
  const zet = (pad, uuid) => {
    if (uuid && !index.has(pad)) index.set(pad, uuid);
  };
  for (const ent of model?.entiteiten || []) {
    const e = ent.typenaam || ent.naam;
    zet(e, ent.uuid);
    for (const deel of [...(ent.gegevenselementen || []), ...(ent.relaties || [])]) {
      const d = deel.naam || deel.typenaam;
      zet(`${e}.${d}`, deel.uuid);
      for (const v of deel.velden || []) zet(`${e}.${d}.${v.naam}`, v.uuid);
    }
  }
  return index;
}

/**
 * Naampad → Studio-id van het element in het canonieke model (de core-store uit
 * de Studio, of importeerV3 van het V3-model). Een element houdt zijn id bij
 * hernoemen; alleen de naam verandert. Zo blijven links uit de traceregels
 * werken na een hernoeming (Imprint zoekt op `data-element-id` van de tekening).
 * Een veld wijst naar het element waarin het staat (entiteit, gegevenselement,
 * relatie), een enumwaarde naar haar enumeratie.
 * @param {{elements?: Record<string, any>}|null} core
 */
export function studioIdIndex(core) {
  const els = Object.values(core?.elements || {}).filter(Boolean);
  const index = new Map();
  const zet = (pad, id) => {
    if (id && pad && !index.has(pad)) index.set(pad, id);
  };
  const naam = (el) => el.naam || el.data?.naam || el.data?.typenaam || el.id;
  /** Alle namen waaronder een element in een naampad kan staan: de naam, de typenaam en,
   *  als laatste, het id. Een pad uit een ouder e-dienstbestand noemt soms nog de naam
   *  van vóór een hernoeming (Aanvraag.AanvraagPartij, nu Aanvraagpartij); in de Studio
   *  is dat vaak het id, want een element houdt zijn id. Eerst alle namen, dan pas de ids
   *  (tweede ronde), zodat een id nooit de huidige naam van een ander element verdringt. */
  let ronde = 1;
  const namen = (el) =>
    ronde === 1 ? [...new Set([naam(el), el.data?.typenaam, el.data?.klassenaam].filter(Boolean))] : /^[A-Za-z]\w*$/.test(el.id) ? [el.id] : [];
  const velden = (el) => (el.compartimenten || []).flatMap((c) => c.velden || []).map((v) => v.naam).filter(Boolean);
  /** Gegevenselement → entiteit, via de compositie. */
  const ouder = new Map();
  for (const c of els) if (c.elementType === "compositie" && c.source && c.target) ouder.set(c.target, c.source);
  const byId = new Map(els.map((e) => [e.id, e]));
  for (; ronde <= 2; ronde += 1) for (const el of els) {
    if (el.elementType === "entiteit") {
      for (const n of namen(el)) {
        zet(n, el.id);
        for (const v of velden(el)) zet(`${n}.${v}`, el.id);
      }
    } else if (el.elementType === "gegevenselement" || el.elementType === "relatie") {
      const ent = byId.get(el.elementType === "relatie" ? el.source : ouder.get(el.id));
      // Zonder bekende eigenaar (in de Studio-store hangt een relatie soms alleen via
      // lijnen in een diagram) de naam alleen: namen zijn uniek per domein, en
      // uuidVanPad vindt dan het eind van het pad.
      for (const voor of ent ? [...namen(ent).map((n) => `${n}.`), ""] : [""]) {
        for (const n of namen(el)) {
          zet(`${voor}${n}`, el.id);
          for (const v of velden(el)) zet(`${voor}${n}.${v}`, el.id);
        }
      }
    } else if (el.elementType === "enumeratie") {
      for (const n of namen(el)) {
        zet(n, el.id);
        for (const v of velden(el)) zet(`${n}.${v}`, el.id);
      }
    }
  }
  return index;
}

/**
 * De uuid bij een naampad uit een traceregel. Een pad kan over een relatie
 * naar een andere entiteit lopen (`Aanvraag.AanvraagPartij.Partij.PartijNaam.naam`);
 * het eind van het pad (`Partij.PartijNaam.naam`) is dan het modelelement.
 */
export function uuidVanPad(uuids, pad) {
  const delen = String(pad || "").split(".");
  for (let i = 0; i < delen.length; i += 1) {
    const uuid = uuids.get(delen.slice(i).join("."));
    if (uuid) return uuid;
  }
  return null;
}

/**
 * Zet `bronElementId` en `bronUuid` op de traceregels van een gegenereerd
 * artefact (besluit Mark 08-11). `bronElementId`: het element-id in het BPMN-
 * of DMN-model als `bronGE` dat is, anders het Studio-id van het modelelement
 * met dat naampad (`studioIds`). `bronUuid`: de uuid die een regel al draagt
 * (kolom van een beslistabel) of de uuid van het modelelement, als er een is.
 * Alleen de traceregels veranderen; de payload en zijn hash blijven gelijk.
 * @param {any} artefact
 * @param {{uuids?: Map<string, string>, studioIds?: Map<string, string>, elementen?: Record<string, any>}} bron
 */
export function zetBronElementIds(artefact, { uuids = new Map(), studioIds = new Map(), elementen = {} } = {}) {
  for (const t of artefact?.traceregels || []) {
    if (!t.bronGE) continue;
    if (elementen[t.bronGE]) {
      t.bronElementId = t.bronGE;
      continue;
    }
    const id = uuidVanPad(studioIds, t.bronGE);
    const uuid = t.bronUuid || uuidVanPad(uuids, t.bronGE);
    if (id) t.bronElementId = id;
    if (uuid) t.bronUuid = uuid;
  }
  return artefact;
}
