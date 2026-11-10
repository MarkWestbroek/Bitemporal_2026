// @ts-check
/**
 * inrichtingsExport — de exportstap "Inrichtingsartefacten" zonder Studio:
 * e-dienst + model + referentielijsten → bundel → (optioneel) vergelijking met
 * het inrichting-register → bestanden voor de zip (docs/TRANSFORMATIES.md §11.10).
 *
 * De Studio-kant (studio/activities/inrichtingsExport.js) haalt alleen de
 * invoer op (map → V3, gekozen bestanden, fetch naar het register) en biedt
 * de zip aan. Puur en node-testbaar.
 */
import { maakInrichtingsBundel } from "./inrichtingsBundel.js";
import { maakBronArtefacten, zetModelvelden } from "./bronArtefacten.js";
import { importeerV3 } from "../diagramprofielen/canoniek-uml/serialisatie.js";
import { pasFormulierDefinitiesToe } from "./fdFormulier.js";
import { leesRegisterStand, vergelijkMetRegister, leesReferentielijst } from "./inrichtingsRegister.js";

const lijstUit = (inhoud) => (Array.isArray(inhoud) ? inhoud : Array.isArray(inhoud?.items) ? inhoud.items : []);

/**
 * Items per referentielijst uit de e-dienst. Volgorde van bronnen: een
 * meegegeven bestand waarvan de naam de lijstnaam bevat (aanvraagtypen.json →
 * Aanvraagtype), dan het register (bron "register: /full/…"), dan de
 * eersteVulling in de e-dienst.
 *
 * Na de rebuild van 08-11 is een referentielijst een instantie: de e-dienst
 * noemt naast de bron (het pad van de item-entiteit) de `instantie` (bv.
 * "Verzoekpartijrollen") en het `lidmaatschap` (de meervoud van de items-REL,
 * bv. "verzoekpartijrollen"); uit het register komen dan alleen de leden. Een
 * meegegeven bestand is al de lijst zelf en wordt niet gefilterd.
 *
 * @param {any} edienst
 * @param {Array<{naam: string, inhoud: any}>} bestanden
 * @param {((pad: string) => Promise<any>)|null} haalJson
 */
export async function verzamelReferentielijsten(edienst, bestanden = [], haalJson = null) {
  /** @type {Record<string, any[]>} */
  const lijsten = {};
  const diagnostics = [];
  for (const [naam, def] of Object.entries(edienst?.referentielijsten || {})) {
    const bestand = bestanden.find((b) => b.naam.toLowerCase().includes(naam.toLowerCase()));
    if (bestand) {
      lijsten[naam] = lijstUit(bestand.inhoud);
      diagnostics.push(info("INR-REFLIJST", `${naam}: ${lijsten[naam].length} items uit ${bestand.naam}`, naam));
      continue;
    }
    if (haalJson && /^register:/.test(String(def?.bron || ""))) {
      try {
        const lid = def.instantie ? { instantie: def.instantie, lidmaatschap: def.lidmaatschap, instantieBron: def.instantieBron, peildatum: def.peiltijdstip || undefined } : null;
        lijsten[naam] = await leesReferentielijst(haalJson, def.bron, lid);
        diagnostics.push(info("INR-REFLIJST", `${naam}: ${lijsten[naam].length} items uit het register (${def.bron.replace(/^register:\s*/, "")}${def.instantie ? `, leden van ${def.instantie}` : ""})`, naam));
        continue;
      } catch (e) {
        diagnostics.push(waarschuwing("INR-REFLIJST", `${naam}: niet uit het register te lezen (${e?.message || e})`, naam));
      }
    }
    const eerste = lijstUit(def?.eersteVulling);
    if (eerste.length) {
      lijsten[naam] = eerste;
      diagnostics.push(info("INR-REFLIJST", `${naam}: ${eerste.length} items uit de eersteVulling van de e-dienst`, naam));
    } else {
      diagnostics.push(waarschuwing("INR-REFLIJST", `${naam}: geen items (geen bestand, register of eersteVulling); keuzelijsten blijven leeg`, naam));
    }
  }
  return { lijsten, diagnostics };
}

function info(code, message, sourceId = null) {
  return { severity: "info", code, message, sourceId, path: null };
}
function waarschuwing(code, message, sourceId = null) {
  return { severity: "warning", code, message, sourceId, path: null };
}

/** Markdown-overzicht in de zip: welke artefacten, hun hash en de stand in het register. */
export function bundelOverzicht({ edienst, peiltijdstip, generatie = null, rijen, registerGelezen, bronnen = [] }) {
  const e = edienst?.edienst || {};
  const regels = [
    `# Inrichtingsartefacten — ${e.naam || "(e-dienst)"} ${e.versienummer || ""}`.trim(),
    "",
    `Omgeving: ${e.omgeving || "—"} · peiltijdstip: ${peiltijdstip || "—"}`,
    ...(generatie?.label || generatie?.studioProjectId
      ? [`Generatie: ${generatie.label || "—"} · Studio-project ${generatie.studioProjectId || "—"} t/m volgnummer ${generatie.totVolgnummer ?? "—"}`]
      : []),
    "",
    registerGelezen ? "Vergeleken met het inrichting-register (zelfde e-dienstversie, soort en identifier)." : "Niet vergeleken met het register.",
    "",
    "| Bestand | Soort | Identifier | Doel | payloadHash | Register |",
    "|---|---|---|---|---|---|",
    ...rijen.map((r) => {
      // Doel: component en het versiebereik dat de regelset aanneemt (uitrol.ps1 toetst erop, Mark 07-11).
      const doel = r.artefact ? `${r.artefact.doelcomponent || "—"} ${r.artefact.artefactIdentificatie?.doelVersieRange || "*"}` : "—";
      return `| ${r.fout ? "—" : r.bestandsnaam} | ${r.soort} | ${r.identifier} | ${doel} | ${r.artefact ? r.artefact.artefactInhoud.payloadHash.slice(0, 12) + "…" : "—"} | ${r.fout ? `fout: ${r.fout}` : r.status || "—"} |`;
    }),
    "",
    ...(bronnen.length
      ? [
          "## Bronnen",
          "",
          "Waaruit de artefacten zijn gemaakt; elk artefact noemt zijn bronnen met soort, identifier en payloadHash.",
          "",
          "| Bestand | Soort | Identifier | payloadHash |",
          "|---|---|---|---|",
          ...bronnen.map((b) => `| ${b.bestandsnaam} | ${b.soort} | ${b.identifier} | ${b.artefact.artefactInhoud.payloadHash.slice(0, 12)}… |`),
          "",
        ]
      : []),
    "Registreren: het script van FUNDAMENT (omnium-registreer-artefact.ps1, per bestand of met -Map); bronnen eerst.",
    "",
  ];
  return regels.join("\n");
}

/**
 * Het generatielabel in de herkomst van elk artefact (werkplaats §5.6): alleen
 * de velden die bekend zijn, zodat een levering zonder project ze niet als
 * leeg meestuurt. Register-velden van ArtefactHerkomst: generatie (AN40),
 * studioProjectId (AN200), totVolgnummer (Geheel).
 * @param {any[]} artefacten
 * @param {{label?: string|null, studioProjectId?: string|null, totVolgnummer?: number|null}|null} generatie
 */
export function zetGeneratie(artefacten, generatie) {
  if (!generatie) return;
  const velden = {
    ...(generatie.label ? { generatie: String(generatie.label).slice(0, 40) } : {}),
    ...(generatie.studioProjectId ? { studioProjectId: String(generatie.studioProjectId) } : {}),
    ...(Number.isInteger(generatie.totVolgnummer) ? { totVolgnummer: generatie.totVolgnummer } : {}),
  };
  for (const a of artefacten) if (a?.artefactHerkomst) Object.assign(a.artefactHerkomst, velden);
}

/**
 * @param {Object} invoer
 * @param {any} invoer.edienst
 * @param {any} invoer.modelBestand
 * @param {any[]} invoer.datatypen
 * @param {Array<{naam: string, inhoud: any}>} [invoer.referentieBestanden]
 * @param {{elements: any, diagrams: any}|null} [invoer.canoniekDeel] - het canonieke profiel uit de Studio-map, met de
 *   diagrammen; wordt de bron `logisch-model`. Zonder dit komt die bron uit het V3-model.
 * @param {string|null} [invoer.peiltijdstip]
 * @param {{label?: string|null, studioProjectId?: string|null, totVolgnummer?: number|null}|null} [invoer.generatie] - maakt
 *   de levering aanwijsbaar in het register (werkplaats §5.6, 09-11): het label (de leveringsmap, bv. 2026-11-08g),
 *   het Studio-project en het volgnummer t/m waar de ops gelezen zijn. Komt in artefactHerkomst van elk artefact
 *   en elke bron; de payload en zijn hash veranderen niet.
 * @param {Record<string, {layout: any, meta: any}>|null} [invoer.formulierDefinities] - FD's uit het project (code →
 *   opgeloste layout + meta, §11.19): een formulier met `formulierDefinitie: {code}` krijgt zijn stappen daaruit.
 *   Het e-dienstmodel (de bron) is dan de e-dienst mét die stappen.
 * @param {((pad: string) => Promise<any>)|null} [invoer.haalJson] - lezen uit het register; null = niet vergelijken
 * @param {(tekst: string) => string | Promise<string>} invoer.sha256Hex
 */
export async function voerInrichtingsExportUit({ edienst, modelBestand, datatypen, referentieBestanden = [], bpmnModellen = {}, canoniekDeel = null, peiltijdstip = null, generatie = null, formulierDefinities = null, haalJson = null, sha256Hex }) {
  /** @type {any[]} */
  const fdMeldingen = [];
  if ((edienst?.artefacten || []).some((a) => a.formulierDefinitie)) {
    const r = pasFormulierDefinitiesToe(edienst, formulierDefinities || {}, canoniekDeel || (modelBestand ? importeerV3(modelBestand) : null));
    edienst = r.edienst;
    fdMeldingen.push(...r.diagnostics);
  }
  if (!Array.isArray(edienst?.artefacten) || !edienst.artefacten.length) throw new Error("Het e-dienstmodel heeft geen artefacten.");
  const { lijsten, diagnostics } = await verzamelReferentielijsten(edienst, referentieBestanden, haalJson);
  diagnostics.push(...fdMeldingen);
  // De bronnen eerst: elk artefact verwijst ernaar met hun payloadHash (§11.14).
  const bron = await maakBronArtefacten({ edienst, modelBestand, canoniekDeel, bpmnModellen, peiltijdstip, sha256Hex });
  diagnostics.push(...bron.diagnostics);
  const bundel = await maakInrichtingsBundel({ modelBestand, edienst, datatypen, referentielijsten: lijsten, bpmnModellen, peiltijdstip, sha256Hex, bronnen: bron.bronnen, canoniekDeel });

  // Welke velden van het model de e-dienst gebruikt en welke niet (werkplaats §5.3).
  const eigen = bron.bronnen.find((b) => b.soort === "edienstmodel");
  if (eigen) zetModelvelden(eigen.artefact, canoniekDeel || (modelBestand ? importeerV3(modelBestand) : null), bundel.map((b) => b.artefact));
  zetGeneratie([...bron.bronnen.map((b) => b.artefact), ...bundel.map((b) => b.artefact)], generatie);

  let rijen = bundel.map((b) => ({ ...b, status: b.fout ? "fout" : null, register: null }));
  let registerGelezen = false;
  if (haalJson) {
    try {
      const stand = await leesRegisterStand(haalJson);
      rijen = vergelijkMetRegister(bundel, stand, edienst.edienst);
      registerGelezen = true;
    } catch (e) {
      diagnostics.push(waarschuwing("INR-REGISTER", `Register niet gelezen, geen vergelijking: ${e?.message || e}`));
    }
  }

  for (const r of rijen) {
    for (const d of r.diagnostics || []) diagnostics.push({ ...d, sourceId: d.sourceId || `${r.soort} ${r.identifier}` });
    if (r.fout) diagnostics.push({ severity: "error", code: "INR-ARTEFACT", message: r.fout, sourceId: `${r.soort} ${r.identifier}`, path: null });
  }

  const gelukt = rijen.filter((r) => r.artefact);
  const bestanden = [
    ...bron.bronnen.map((b) => ({ naam: b.bestandsnaam, inhoud: `${JSON.stringify(b.artefact, null, 2)}\n` })),
    ...gelukt.map((r) => ({ naam: r.bestandsnaam, inhoud: `${JSON.stringify(r.artefact, null, 2)}\n` })),
    { naam: "OVERZICHT.md", inhoud: bundelOverzicht({ edienst, peiltijdstip, generatie, rijen, registerGelezen, bronnen: bron.bronnen }) },
  ];
  const telling = (s) => rijen.filter((r) => r.status === s).length;
  const fouten = rijen.length - gelukt.length;
  const summary =
    `${gelukt.length} van ${rijen.length} artefacten gemaakt` +
    (registerGelezen ? ` — register: ${telling("nieuw")} nieuw, ${telling("gewijzigd")} gewijzigd, ${telling("ongewijzigd")} ongewijzigd` : "") +
    (fouten ? `, ${fouten} mislukt` : "") +
    `; ${bron.bronnen.length} bronnen` +
    ".";
  return { rijen, bestanden, diagnostics, summary, registerGelezen, bronnen: bron.bronnen };
}
