// @ts-check
/**
 * doelVersie — welke versie van de doelcomponent een transformatie aanneemt
 * (`artefactIdentificatie.doelVersieRange`).
 *
 * Besluit Mark 07-11 (via FUNDAMENT): `uitrol.ps1` toetst vóór elke uitrol de
 * draaiende componentversie (image-tag uit het cluster) tegen het
 * `doelVersieRange` van elk artefact; het bereik per e-dienstversie leidt de
 * uitrol zelf af (de doorsnede over de artefacten), dat leveren wij niet mee.
 * Leeg of `*` = geen eis; een bereik dat niet gehaald wordt, stopt de uitrol.
 *
 * Het bereik hoort bij de **regelset**, niet bij de e-dienst: het zegt tegen
 * welke doel-API de schrijver is gebouwd (de vorm van de export van Open
 * Formulieren 4.0, de bundelbestanden van GZAC 13.50, …). Een e-dienst kan het
 * per artefact overschrijven met `doelVersieRange` op het artefact, bv. als een
 * omgeving een oudere component draait die voor dat artefact volstaat.
 *
 * Syntaxis als FUNDAMENT die toetst: `^13.0`, `~4.0`, `>=1.30 <2`, `13.x`,
 * exact, alternatieven met `||`. Stand cg-test 07-11: openzaak 1.31.0,
 * openobject 4.3.0, openforms 4.0.3, gzac 13.50.0.
 */

/** Per doelcomponent het bereik dat de regelsets aannemen. */
export const DOEL_VERSIE = {
  // Objecttypen API v2 met json-schema draft 2020-12 en de verzoek-envelop (objecttype-regelset 0.4.0).
  openobject: "^4.3",
  // Catalogi API 1.x: zaaktype, informatieobjecttypen, rol-, status- en resultaattypen als concept (zaaktype-regelset).
  openzaak: "^1.31",
  // Exportformaat 4.0: objects_api-registratie versie 2 met variables_mapping, formVariables, verkleinen bij upload (formulier-regelset 0.2.0).
  openforms: "^4.0",
  // Bundelimport van GZAC 13.50: case-definition, document-definition, form, case-tab, zaaktype-link,
  // process-document-link, zgw-document-list-column, internal-case-status, process-link (dossier-regelset 0.4.0, bpmn-naar-gzac 0.6.0).
  gzac: "^13.50",
};

/** Geen eis. */
export const GEEN_EIS = "*";

/**
 * Het bereik voor één artefact: de keuze van de e-dienst gaat voor, dan het
 * bereik van de doelcomponent, anders `*`.
 * @param {{doelVersieRange?: string, doelcomponent?: string}} keuzes
 * @returns {string}
 */
export function doelVersieRange(keuzes) {
  return keuzes?.doelVersieRange || DOEL_VERSIE[keuzes?.doelcomponent || ""] || GEEN_EIS;
}
