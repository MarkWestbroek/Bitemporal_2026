// @ts-check
/**
 * eaLezers — welke lezer welk EA-diagram krijgt, zonder UI.
 *
 * Gedeeld door de browser-import (`importQeaProject.js`, met dialogen) en de
 * node-sidecar (`sidecarImport.js`, zonder). De lezers zelf zijn pure
 * JavaScript (sql.js + JSON), dus ze draaien in beide.
 */
import { qeaNaarPuurUml } from "./qeaNaarPuurUml.js";
import { qeaNaarActivity } from "./qeaNaarActivity.js";
import { qeaNaarUsecase } from "./qeaNaarUsecase.js";
import { qeaNaarMim } from "./qeaNaarMim.js";
import { qeaNaarSequence } from "./qeaNaarSequence.js";
import { qeaNaarProfiel } from "./qeaNaarProfiel.js";
import { EA_PROFIEL_LEZERS, EIGEN_LEZER_DIAGRAMTYPEN } from "./eaProfielen.js";
import { stereotypenUitXref } from "./qeaHulp.js";

/** Diagramsoorten met een eigen lezer; de klasse-lezer slaat die over. */
export const EIGEN_LEZER_DIAGRAMMEN = new Set(["Activity", "Use Case", "Sequence", ...EIGEN_LEZER_DIAGRAMTYPEN]);

/** EA-objecttypen die de activity- of use case-lezer kent (dus geen "niet in een profiel"). */
export const ELDERS_GELEZEN = new Set([
  "UseCase", "Actor", "Collaboration", "CollaborationOccurrence",
  "Action", "ActionPin", "Activity", "Decision", "MergeNode", "StateNode", "Synchronization", "ActivityPartition", "Object", "ObjectNode",
]);

/** Profieltype-ids (= activiteit-ids) waar de lezers op landen. */
export const PROFIEL = { puurUml: "puurUml05", mim: "mim05", activity: "activity05", usecase: "usecase05", sequence: "sequence05" };

/** Draagt het bereik MIM-/MIG-stereotypen (dan is het een MIM-informatiemodel)? */
export function heeftMimStereotypen(bron) {
  for (const x of bron.t_xref || []) {
    if (x.Name !== "Stereotypes") continue;
    if (stereotypenUitXref(x.Description).some((s) => /^(MIM|MIG)::/i.test(s))) return true;
  }
  return false;
}

/** De wortel van het gelezen bereik: het pakket zonder ouder binnen de bron. */
export function wortelPakket(bron) {
  const ids = new Set((bron.t_package || []).map((p) => p.Package_ID));
  const wortel = (bron.t_package || []).find((p) => !ids.has(p.Parent_ID)) || bron.t_package?.[0];
  return wortel?.Package_ID || 0;
}

/**
 * De lezers in volgorde, voor één bron: klasse (UML of MIM), activity, use
 * case, sequence en de gegevensgestuurde profielen (M3-MOF, 10-10).
 * De klasse-lezer krijgt alle diagrammen zonder eigen lezer; ook
 * MDG-diagrammen (XSD, WSDL, Requirements op Custom) die een gegevensgestuurd
 * profiel claimt, blijven bij hem weg.
 * @param {any} bron
 * @returns {{profiel: string, naam: string, vertaal: (b: any, o: any) => any, isKlasseLezer: boolean}[]}
 */
export function eaLezersVoor(bron) {
  const isMim = heeftMimStereotypen(bron);
  const klasseDiagram = (d) => !EIGEN_LEZER_DIAGRAMMEN.has(d.Diagram_Type) && !EA_PROFIEL_LEZERS.some((p) => p.diagramPast?.(d, bron));
  return [
    {
      profiel: isMim ? PROFIEL.mim : PROFIEL.puurUml,
      vertaal: (b, o) => (isMim ? qeaNaarMim : qeaNaarPuurUml)(b, { ...o, diagramFilter: klasseDiagram }),
      naam: isMim ? "MIM" : "UML",
      isKlasseLezer: true,
    },
    { profiel: PROFIEL.activity, vertaal: qeaNaarActivity, naam: "Activity", isKlasseLezer: false },
    { profiel: PROFIEL.usecase, vertaal: qeaNaarUsecase, naam: "Use case", isKlasseLezer: false },
    { profiel: PROFIEL.sequence, vertaal: qeaNaarSequence, naam: "Sequence", isKlasseLezer: false },
    ...EA_PROFIEL_LEZERS.map((p) => ({
      profiel: p.profielId,
      vertaal: (b, o) => qeaNaarProfiel(b, { ...o, profiel: p }),
      naam: p.naam,
      isKlasseLezer: false,
    })),
  ];
}

/**
 * Lees één pakket met alle lezers; alleen lezers met inhoud blijven over
 * (zonder diagram alleen de klasse-lezer: die leest altijd elementen).
 * @returns {{profiel: string, naam: string, model: any}[]}
 */
export function leesPerProfiel(bron, packageId) {
  const uit = [];
  for (const { profiel, vertaal, naam, isKlasseLezer } of eaLezersVoor(bron)) {
    const model = vertaal(bron, { packageId });
    const aantalDiagrammen = Object.keys(model.diagrams).length;
    const aantalElementen = Object.keys(model.elements).length;
    if (!aantalElementen || (!aantalDiagrammen && !isKlasseLezer)) continue;
    uit.push({ profiel, naam, model });
  }
  return uit;
}

/**
 * Wat géén enkele lezer kent, voor het verslag: diagramsoorten die een lezer
 * bewust aan een andere laat en EA-typen die een ándere lezer wél kent, tellen niet.
 * @param {Record<string, number>} overgeslagen  wordt bijgewerkt
 */
export function telOvergeslagen(overgeslagen, model) {
  for (const [soort, n] of Object.entries(model.verslag?.overgeslagen || {})) {
    if (/^diagram /.test(soort) || ELDERS_GELEZEN.has(soort)) continue;
    overgeslagen[soort] = Math.max(overgeslagen[soort] || 0, n);
  }
  return overgeslagen;
}
