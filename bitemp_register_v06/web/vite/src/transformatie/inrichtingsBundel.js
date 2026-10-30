// @ts-check
/**
 * inrichtingsBundel — alle inrichtingsartefacten van één e-dienst in één keer
 * (docs/TRANSFORMATIES.md §11.10). Eén plek voor wat de CLI
 * (scripts/maak_inrichtingsartefact.mjs) per artefact deed: de soort kiest de
 * transformatie, en een formulier of dossierdeel krijgt het objecttype-artefact
 * waarin het registreert. Daarom komen de objecttypen eerst. Een bpmn-artefact
 * komt uit een BPMN-model (§11.11), niet uit het canonieke model: dat model
 * komt mee in `bpmnModellen`, op de naam uit `bron.model` van het artefact.
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

/** Volgorde van maken: wat een ander artefact nodig heeft komt eerst. */
const VOLGORDE = ["objecttype", "zaaktype", "formulier", "dossierschema", "dossierformulier", "dossiertabbladen", "bpmn"];

/**
 * Bestandsnaam zoals de CLI hem schrijft: `<identifier>.artefact.json`, bij de
 * dossiersoorten met de soort erbij (identifier is daar niet uniek over soorten).
 * @param {{soort: string, identifier: string}} keuzes
 */
export function artefactBestandsnaam({ soort, identifier }) {
  const stam = DOSSIER_SOORTEN.includes(soort) ? `${identifier}.${soort}` : identifier;
  return `${stam}.artefact.json`;
}

/** Het objecttype waarin een formulier of dossierdeel registreert, volgens de e-dienst. */
function objecttypeVoor(keuzes, edienst) {
  if (keuzes.soort === "formulier") return keuzes.registratie?.objecttype || null;
  if (keuzes.soort === "dossierschema") return keuzes.objecttype || null;
  if (keuzes.soort === "dossierformulier") {
    const schema = (edienst.artefacten || []).find((a) => a.soort === "dossierschema" && a.identifier === keuzes.dossierschema);
    return schema?.objecttype || null;
  }
  return null;
}

/** Het BPMN-model van een bpmn-artefact, of een fout die alleen dat artefact stopt. */
function bpmnModelVoor(keuzes, bpmnModellen) {
  const naam = keuzes.bron?.model;
  const model = naam ? bpmnModellen[naam] : null;
  if (!model) throw new Error(`BPMN-model "${naam || "(geen bron.model)"}" is niet meegegeven.`);
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
 * @param {Record<string, any>} [invoer.bpmnModellen] - BPMN-modellen per naam (`bron.model` van een bpmn-artefact)
 * @param {(keuzes: any) => boolean} [invoer.kies]    - welke artefacten (default: alle)
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
}) {
  const alle = (edienst?.artefacten || []).filter((a) => a && a.identifier && a.soort);
  const gekozen = alle.filter(kies);
  const invoer = { modelBestand, edienst, datatypen, referentielijsten, peiltijdstip, sha256Hex };

  // Objecttypen die een gekozen artefact nodig heeft, ook als ze zelf niet gekozen zijn.
  const nodig = new Set(gekozen.map((k) => objecttypeVoor(k, edienst)).filter(Boolean));
  const teMaken = alle.filter((a) => gekozen.includes(a) || (a.soort === "objecttype" && nodig.has(a.identifier)));
  const rang = (s) => (VOLGORDE.indexOf(s) < 0 ? VOLGORDE.length : VOLGORDE.indexOf(s));
  const opVolgorde = [...teMaken].sort((a, b) => rang(a.soort) - rang(b.soort));

  /** @type {Map<string, any>} */
  const objecttypen = new Map();
  /** @type {Map<any, any>} */
  const uitkomst = new Map();
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
                ? await maakDossierArtefact({ ...invoer, identifier, soort, objecttype })
                : soort === "bpmn"
                  ? await maakBpmnArtefact({ ...invoer, modelBestand: bpmnModelVoor(keuzes, bpmnModellen), identifier })
                  : null;
      if (!r) throw new Error(`Onbekende artefactsoort "${soort}".`);
      if (soort === "objecttype") objecttypen.set(identifier, r.artefact);
      uitkomst.set(keuzes, { artefact: r.artefact, diagnostics: r.diagnostics || [], fout: null });
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
