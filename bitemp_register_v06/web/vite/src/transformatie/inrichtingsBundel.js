// @ts-check
/**
 * inrichtingsBundel — alle inrichtingsartefacten van één e-dienst in één keer
 * (docs/TRANSFORMATIES.md §11.10). Eén plek voor wat de CLI
 * (scripts/maak_inrichtingsartefact.mjs) per artefact deed: de soort kiest de
 * transformatie, en een formulier of dossierdeel krijgt het objecttype-artefact
 * waarin het registreert. Daarom komen de objecttypen eerst. Een bpmn-artefact
 * komt uit een BPMN-model (§11.11), niet uit het canonieke model: dat model
 * komt mee in `bpmnModellen`, op de naam uit `bron.model` van het artefact.
 * Een dmn-artefact (beslistabel, §11.12) komt net zo uit een DMN-model in
 * dezelfde map; het komt vóór de processen, want een businessRuleTask krijgt
 * de kolommen van de tabel als invoer.
 *
 * Puur op de hashfunctie na (node:crypto of SubtleCrypto); zo draait dezelfde
 * code in de CLI, in de Studio (exportstap "Inrichtingsartefacten") en in de
 * tests, en geeft dezelfde invoer overal dezelfde payloadHash.
 */
import { maakObjecttypeArtefact } from "../diagramprofielen/canoniek-uml/objecttypeArtefact.js";
import { maakFormulierArtefact } from "../diagramprofielen/canoniek-uml/formulierArtefact.js";
import { maakZaaktypeArtefact } from "../diagramprofielen/canoniek-uml/zaaktypeArtefact.js";
import { maakDossierArtefact, DOSSIER_SOORTEN } from "../diagramprofielen/canoniek-uml/dossierArtefact.js";
import { maakBpmnArtefact } from "../diagramprofielen/bpmn/bpmnArtefact.js";
import { maakDmnArtefact } from "../diagramprofielen/dmn-drd/dmnArtefact.js";
import { maakProcesLinkArtefact, SOORT as PROCESKOPPELING } from "../diagramprofielen/bpmn/procesLinkArtefact.js";
import { bronnenVan, uuidIndex, studioIdIndex, zetBronElementIds } from "./bronArtefacten.js";
import { importeerV3 } from "../diagramprofielen/canoniek-uml/serialisatie.js";

/**
 * Plaatshouders in een payload, die de uitrol (FUNDAMENT) per omgeving invult
 * (afspraak 05-11):
 *
 * - naar een type dat een ander artefact aanmaakt: `${OBJECTTYPE_URL:<id>}`,
 *   `${OBJECTTYPE_VERSION:<id>}`, `${OBJECTTYPE_ID:<id>}`, `${ZAAKTYPE_URL:<id>}`,
 *   `${ROLTYPE_URL:<id>:<omschrijvingGeneriek>}`, `${STATUSTYPE_URL:<id>:<volgnummer>}`.
 *   `<id>` is de identifier van het objecttype- of zaaktype-artefact. Dat moet
 *   eerder uitgerold zijn; op een lege omgeving klopt de volgorde alleen als
 *   de afhankelijkheid in de e-dienst staat.
 * - omgevingsgegevens, zonder afhankelijkheid: `${PLUGINCONFIG_ID:<pluginDefinitionKey>}`
 *   en de kale namen in OMGEVING.
 *
 * Elke andere kale `${NAAM}` leest de uitrol als een geheim (sleutel uit een
 * Secret); dat hoort niet in een artefact.
 */
const PLAATSHOUDER = /\$\{(OBJECTTYPE_URL|OBJECTTYPE_VERSION|OBJECTTYPE_ID|ZAAKTYPE_URL|ROLTYPE_URL|STATUSTYPE_URL):([^:}]+)(?::[^}]*)?\}/g;
const KAAL = /\$\{([A-Z][A-Z0-9_]*)\}/g;
const OMGEVING = new Set(["OBJECTS_API_GROUP", "CATALOGUS_DOMEIN", "CATALOGUS_RSIN", "ORGANISATIE_RSIN"]);

/**
 * Toetsen op de plaatshouders in de payload:
 * - `ART-PLAATSHOUDER`: een verwijzing naar een type zonder afhankelijkheid op
 *   het artefact dat het aanmaakt;
 * - `ART-GEHEIM`: een kale `${NAAM}` die geen omgevingsgegeven is.
 * @param {any} artefact
 * @returns {any[]} diagnostics
 */
export function toetsPlaatshouders(artefact) {
  const payload = artefact?.artefactInhoud?.payload;
  const tekst = typeof payload === "string" ? payload : JSON.stringify(payload ?? "");
  const heeft = new Set((artefact?.afhankelijkheden || []).map((a) => a.identifier));
  const mist = new Map();
  for (const m of tekst.matchAll(PLAATSHOUDER)) if (!heeft.has(m[2]) && !mist.has(m[2])) mist.set(m[2], m[0]);
  const geheim = new Set();
  for (const m of tekst.matchAll(KAAL)) if (!OMGEVING.has(m[1])) geheim.add(m[1]);
  const meld = (code, message) => ({ severity: "warning", code, message, sourceId: null, path: null });
  return [
    ...[...mist].map(([id, plaatshouder]) =>
      meld("ART-PLAATSHOUDER", `De payload verwijst naar "${id}" (${plaatshouder}), maar het artefact heeft daar geen afhankelijkheid op; op een lege omgeving kan de uitrol dan in de verkeerde volgorde lopen`),
    ),
    ...[...geheim].map((naam) => meld("ART-GEHEIM", `De payload bevat \${${naam}}; de uitrol leest dat als een geheim, en dat hoort niet in een artefact`)),
  ];
}

/**
 * Toets `ART-AFHANKELIJKHEID`: elke afhankelijkheid noemt de soort van het
 * artefact waar ze naar wijst. Een identifier is niet uniek over soorten (een
 * proces en zijn proceskoppeling, de delen van een dossier), en het register
 * gokt niet: een afhankelijkheid zonder soort is dan dubbelzinnig en wordt
 * geweigerd (FUNDAMENT 05-11).
 * @param {any} artefact
 * @param {any} edienst
 * @returns {any[]} diagnostics
 */
export function toetsAfhankelijkheden(artefact, edienst) {
  const uit = [];
  for (const a of artefact?.afhankelijkheden || []) {
    if (a.soort) continue;
    const soorten = (edienst?.artefacten || []).filter((x) => x.identifier === a.identifier).map((x) => x.soort);
    uit.push({
      severity: "warning",
      code: "ART-AFHANKELIJKHEID",
      message:
        soorten.length > 1
          ? `De afhankelijkheid op "${a.identifier}" noemt geen soort en is dubbelzinnig (${soorten.join(", ")}); zet afhankelijkVanSoort in de e-dienst`
          : `De afhankelijkheid op "${a.identifier}" noemt geen soort; zet afhankelijkVanSoort in de e-dienst`,
      sourceId: null,
      path: null,
    });
  }
  return uit;
}

/** Volgorde van maken: wat een ander artefact nodig heeft komt eerst. */
const VOLGORDE = ["objecttype", "zaaktype", "formulier", "dossierdefinitie", "dossierschema", "dossierformulier", "dossiertabbladen", "dossierwidgettabbladen", "dossierlijstkolommen", "dossierzaaktypelink", "dossierdocumentkolommen", "dossierstatussen", "dmn", "bpmn", "dossierprocessen", PROCESKOPPELING];

/** Soorten waarvan de identifier niet uniek is over soorten: de bestandsnaam noemt de soort. */
export const SOORT_IN_BESTANDSNAAM = [...DOSSIER_SOORTEN, PROCESKOPPELING];

/**
 * Bestandsnaam zoals de CLI hem schrijft: `<identifier>.artefact.json`, bij de
 * dossiersoorten en de proceskoppeling met de soort erbij (de identifier is
 * daar niet uniek over soorten).
 * @param {{soort: string, identifier: string}} keuzes
 */
export function artefactBestandsnaam({ soort, identifier }) {
  const stam = SOORT_IN_BESTANDSNAAM.includes(soort) ? `${identifier}.${soort}` : identifier;
  return `${stam}.artefact.json`;
}

/** Het objecttype waarin een formulier of dossierdeel registreert, volgens de e-dienst. */
function objecttypeVoor(keuzes, edienst) {
  if (keuzes.soort === "formulier") return keuzes.registratie?.objecttype || null;
  if (keuzes.soort === "dossierschema" || keuzes.soort === "dmn") return keuzes.objecttype || null;
  if (keuzes.soort === "dossierformulier" || keuzes.soort === "dossierwidgettabbladen" || keuzes.soort === "dossierlijstkolommen") {
    const schema = (edienst.artefacten || []).find((a) => a.soort === "dossierschema" && a.identifier === keuzes.dossierschema);
    return schema?.objecttype || null;
  }
  return null;
}

/** Het bpmn-artefact waar een proceskoppeling bij hoort (zelfde identifier): daar staat het model. */
const procesVan = (keuzes, edienst) => (edienst.artefacten || []).find((a) => a.soort === "bpmn" && a.identifier === keuzes.identifier) || keuzes;

/** Het BPMN- of DMN-model van een artefact, of een fout die alleen dat artefact stopt. */
function bpmnModelVoor(keuzes, bpmnModellen) {
  const naam = keuzes.bron?.model;
  const model = naam ? bpmnModellen[naam] : null;
  if (!model) throw new Error(`${keuzes.soort === "dmn" ? "DMN" : "BPMN"}-model "${naam || "(geen bron.model)"}" is niet meegegeven.`);
  return model;
}

/**
 * Maak de artefacten van een e-dienst.
 *
 * @param {Object} invoer
 * @param {any} invoer.modelBestand                   - V3-bestand of -model
 * @param {any} invoer.edienst                        - het e-dienst-inrichtingsmodel
 * @param {any[]} [invoer.datatypen]                  - gedeelde datatypebibliotheek
 * @param {Record<string, any[]>} [invoer.referentielijsten] - M0-items per referentielijst
 * @param {string|null} [invoer.peiltijdstip]
 * @param {(tekst: string) => string | Promise<string>} invoer.sha256Hex
 * @param {Record<string, any>} [invoer.bpmnModellen] - BPMN- en DMN-modellen per naam (`bron.model` van een bpmn- of dmn-artefact)
 * @param {(keuzes: any) => boolean} [invoer.kies]    - welke artefacten (default: alle)
 * @param {any[]|null} [invoer.bronnen]               - de bronartefacten van de e-dienst (maakBronArtefacten); dan
 *   noemt elk artefact zijn bronnen in `bronnen` (§11.14)
 * @returns {Promise<Array<{bestandsnaam: string, soort: string, identifier: string,
 *   artefact: any|null, diagnostics: any[], fout: string|null}>>}
 *   in de volgorde van de e-dienst; een fout per artefact stopt de rest niet.
 */
export async function maakInrichtingsBundel({
  modelBestand,
  edienst,
  datatypen = [],
  referentielijsten = {},
  peiltijdstip = null,
  sha256Hex,
  bpmnModellen = {},
  kies = () => true,
  bronnen = null,
  canoniekDeel = null,
}) {
  const alle = (edienst?.artefacten || []).filter((a) => a && a.identifier && a.soort);
  const gekozen = alle.filter(kies);
  const invoer = { modelBestand, edienst, datatypen, referentielijsten, peiltijdstip, sha256Hex };

  // Objecttypen (en beslistabellen) die een gekozen artefact nodig heeft, ook als ze zelf niet gekozen zijn.
  const nodigDmn = new Set(gekozen.filter((k) => k.soort === "bpmn").flatMap((k) => (edienst.afhankelijkheden || []).filter((a) => a.artefact === k.identifier && a.afhankelijkVanSoort === "dmn").map((a) => a.afhankelijkVan)));
  const metDmn = alle.filter((a) => gekozen.includes(a) || (a.soort === "dmn" && nodigDmn.has(a.identifier)));
  const nodig = new Set(metDmn.map((k) => objecttypeVoor(k, edienst)).filter(Boolean));
  const teMaken = alle.filter((a) => metDmn.includes(a) || (a.soort === "objecttype" && nodig.has(a.identifier)));
  const rang = (s) => (VOLGORDE.indexOf(s) < 0 ? VOLGORDE.length : VOLGORDE.indexOf(s));
  const opVolgorde = [...teMaken].sort((a, b) => rang(a.soort) - rang(b.soort));

  /** @type {Map<string, any>} */
  const objecttypen = new Map();
  /** @type {Map<any, any>} */
  const uitkomst = new Map();
  /** Per decision-id de invoer van de beslistabel, voor de processen. */
  const beslissingen = {};
  /** Naampad → uuid in het canonieke model, voor `bronElementId` in de traceregels. */
  const uuids = uuidIndex(modelBestand);
  /** Naampad → Studio-id (de ids van de tekening), uit de Studio-map of anders uit het V3-model. */
  const studioIds = studioIdIndex(canoniekDeel || (modelBestand ? importeerV3(modelBestand) : null));
  for (const keuzes of opVolgorde) {
    const { soort, identifier } = keuzes;
    try {
      const otId = objecttypeVoor(keuzes, edienst);
      const objecttype = otId ? objecttypen.get(otId) || null : null;
      const r =
        soort === "objecttype"
          ? await maakObjecttypeArtefact({ ...invoer, identifier })
          : soort === "formulier"
            ? await maakFormulierArtefact({ ...invoer, identifier, objecttype })
            : soort === "zaaktype"
              ? await maakZaaktypeArtefact({ ...invoer, identifier })
              : DOSSIER_SOORTEN.includes(soort)
                ? await maakDossierArtefact({ ...invoer, identifier, soort, objecttype, bpmnModellen })
                : soort === "dmn"
                  ? await maakDmnArtefact({ ...invoer, modelBestand: bpmnModelVoor(keuzes, bpmnModellen), v3Model: modelBestand, identifier, objecttype })
                  : soort === "bpmn"
                    ? await maakBpmnArtefact({ ...invoer, modelBestand: bpmnModelVoor(keuzes, bpmnModellen), identifier, beslissingen })
                    : soort === PROCESKOPPELING
                      ? await maakProcesLinkArtefact({ ...invoer, modelBestand: bpmnModelVoor(procesVan(keuzes, edienst), bpmnModellen), identifier, beslissingen })
                      : null;
      if (!r) throw new Error(`Onbekende artefactsoort "${soort}".`);
      if (soort === "objecttype") objecttypen.set(identifier, r.artefact);
      if (soort === "dmn") beslissingen[identifier] = r.invoer;
      // Herkomst (§11.14): het element in de bron bij elke traceregel, en de bronnen van het artefact.
      const bronModel = soort === "bpmn" || soort === "dmn" ? bpmnModellen[keuzes.bron?.model] : soort === PROCESKOPPELING ? bpmnModellen[procesVan(keuzes, edienst).bron?.model] : null;
      zetBronElementIds(r.artefact, { uuids, studioIds, elementen: (bronModel?.model || bronModel)?.elements || {} });
      if (bronnen) r.artefact.bronnen = bronnenVan(keuzes, edienst, bronnen);
      uitkomst.set(keuzes, { artefact: r.artefact, diagnostics: [...(r.diagnostics || []), ...toetsPlaatshouders(r.artefact), ...toetsAfhankelijkheden(r.artefact, edienst)], fout: null });
    } catch (e) {
      uitkomst.set(keuzes, { artefact: null, diagnostics: e?.diagnostics || [], fout: e?.message || String(e) });
    }
  }

  return gekozen.map((keuzes) => ({
    bestandsnaam: artefactBestandsnaam(keuzes),
    soort: keuzes.soort,
    identifier: keuzes.identifier,
    ...uitkomst.get(keuzes),
  }));
}
