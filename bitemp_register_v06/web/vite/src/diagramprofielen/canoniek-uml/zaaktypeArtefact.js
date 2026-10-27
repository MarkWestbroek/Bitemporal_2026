// @ts-check
/**
 * zaaktypeArtefact — aansluiting "canoniek model + e-dienst → zaaktype-
 * artefact (Catalogi API)" voor de inrichting van e-diensten
 * (docs/TRANSFORMATIES.md §11.7).
 *
 * Route:
 *
 *   aanvraagtype (M0) ┐
 *   e-dienst          ├─ zaaktypeRegels (afleidingen) ─▶ {catalogus, informatieobjecttypen, zaaktype} ─▶ artefact
 *   formulieren       ┘   + toetsen
 *
 * De payload is het formaat van `catalogi/<naam>.json` in de Fundament-repo,
 * dat de adapter `scripts/openzaak-catalogus.ps1` via de Catalogi API aanmaakt
 * en publiceert (afspraak FUNDAMENT 27-10). Selectielijst-verwijzingen zijn
 * namen (procestype {jaar, nummer}, resultaat als klasse "11.1.1"): de adapter
 * zoekt de url's op. Zelfde artefactvorm als het objecttype en het formulier:
 * identificatie, inhoud met payloadHash = sha256 over JCS(payload), herkomst,
 * traceregels.
 *
 * **Toetsen.** Een bijlage die een formulier van dezelfde e-dienst vastlegt
 * (`registratie.bijlagen.informatieobjecttype`) moet een informatieobjecttype
 * van het zaaktype zijn, en dat type moet in de catalogus staan. Zo ook: een
 * roltype met omschrijvingGeneriek `initiator` (de aanvrager), een
 * selectielijstklasse per resultaattype, en het aanvraagtype dat het formulier
 * als vaste waarde zet is dat van het zaaktype.
 *
 * Puur op de hashfunctie na, die wordt meegegeven.
 */
import { jcsHash } from "../../transformatie/jcs.js";
import { CANONIEK_NAAR_ZAAKTYPE } from "./zaaktypeRegels.js";

export const SCHRIJVER_ID = "catalogi-schrijver@0.1.0";

/** Sleutels die met `_` beginnen zijn toelichting in het e-dienstbestand, geen inhoud. */
const zonderToelichting = (waarde) =>
  Array.isArray(waarde)
    ? waarde.map(zonderToelichting)
    : waarde && typeof waarde === "object"
      ? Object.fromEntries(Object.entries(waarde).filter(([k]) => !k.startsWith("_")).map(([k, v]) => [k, zonderToelichting(v)]))
      : waarde;

const fout = (code, message, sourceId = null) => ({ severity: "error", code, message, sourceId, path: null });
const waarschuwing = (code, message, sourceId = null) => ({ severity: "warning", code, message, sourceId, path: null });

/**
 * @param {Object} invoer
 * @param {any} invoer.modelBestand          - het V3-bestand ({model_naam, model}) of het model zelf (voor de bronmodel-hash)
 * @param {any} invoer.edienst               - het e-dienst-inrichtingsmodel
 * @param {string} invoer.identifier         - de identificatie van het zaaktype (bv. GPK)
 * @param {Record<string, any[]>} [invoer.referentielijsten] - M0-items per referentielijst (Aanvraagtype)
 * @param {string|null} [invoer.peiltijdstip]
 * @param {string} [invoer.versienummer]
 * @param {(tekst: string) => string | Promise<string>} invoer.sha256Hex
 * @param {any} [invoer.regelset]
 */
export async function maakZaaktypeArtefact({
  modelBestand,
  edienst,
  identifier,
  referentielijsten = {},
  peiltijdstip = null,
  versienummer,
  sha256Hex,
  regelset = CANONIEK_NAAR_ZAAKTYPE,
}) {
  const model = modelBestand?.model || modelBestand;
  const keuzes = (edienst?.artefacten || []).find((a) => a.identifier === identifier);
  if (!keuzes) throw new Error(`Artefact "${identifier}" staat niet in het e-dienstmodel.`);
  if (keuzes.soort !== "zaaktype") throw new Error(`Artefact "${identifier}" is een ${keuzes.soort}, geen zaaktype.`);

  const diagnostics = [];
  const bronmodelHash = await jcsHash(model, sha256Hex);
  const verwacht = String(edienst?.bronmodel?.hash || "").replace(/^sha256:/, "");
  if (verwacht && verwacht !== bronmodelHash) {
    diagnostics.push(waarschuwing("ART-BRONMODEL", `Het model (sha256 ${bronmodelHash}) is niet de versie uit het e-dienstmodel (${verwacht})`));
  }

  // Het aanvraagtype: uit het register (M0), anders het nieuwe item uit de e-dienst.
  const code = keuzes.aanvraagtype;
  const lijst = edienst?.referentielijsten?.Aanvraagtype || {};
  let item = (referentielijsten.Aanvraagtype || []).find((i) => i.code === code) || null;
  if (!item && lijst.nieuwItem?.code === code) {
    item = lijst.nieuwItem;
    diagnostics.push({ severity: "info", code: "ZTT-NIEUW-ITEM", message: `Aanvraagtype "${code}" komt uit het e-dienstmodel (nieuwItem), niet uit het register`, sourceId: code, path: null });
  }
  if (!item) throw Object.assign(new Error(`Aanvraagtype "${code}" niet gevonden (referentielijst Aanvraagtype).`), { diagnostics });

  const zaaktype = zonderToelichting(keuzes.zaaktype || {});
  const payload = {
    catalogus: zonderToelichting(keuzes.catalogus || {}),
    informatieobjecttypen: zonderToelichting(keuzes.informatieobjecttypen || []),
    zaaktype,
  };

  // ── Afleidingen ──
  const traceregels = [];
  const bronnen = { edienst: edienst?.edienst || {} };
  for (const a of regelset.afleidingen) {
    const [, veld] = a.doel.split(".");
    const waarde = a.uit.referentielijst ? item[a.uit.veld] : bronnen.edienst[a.uit.edienst];
    const bronGE = a.uit.referentielijst ? `${a.uit.referentielijst}:${code}.${a.uit.veld}` : `e-dienst.${a.uit.edienst}`;
    const doelPad = `/zaaktype/${veld}`;
    if (waarde === undefined || waarde === null || waarde === "") {
      if (a.als === "altijd") diagnostics.push(fout("ZTT-AFLEIDING", `${a.naam}: geen waarde in ${bronGE}`, bronGE));
      continue;
    }
    if (veld in zaaktype && a.als === "ontbreekt") {
      traceregels.push({ bronGE: null, regel: "e-dienstmodel (letterlijk)", doelPad, actie: "letterlijk" });
      continue;
    }
    if (veld in zaaktype && zaaktype[veld] !== waarde) {
      diagnostics.push(fout("ZTT-AFWIJKING", `zaaktype.${veld} "${zaaktype[veld]}" in het e-dienstmodel wijkt af van ${bronGE} "${waarde}"`, bronGE));
    }
    zaaktype[veld] = waarde;
    traceregels.push({ bronGE, regel: a.naam, doelPad, actie: "gezet" });
  }
  if (zaaktype.identificatie && zaaktype.identificatie !== keuzes.identifier) {
    diagnostics.push(fout("ZTT-IDENTIFIER", `De identifier van het artefact ("${keuzes.identifier}") is niet de zaaktype-identificatie uit het aanvraagtype ("${zaaktype.identificatie}")`, keuzes.identifier));
  }
  for (const v of regelset.volgnummers) {
    const [, sleutel] = v.lijst.split(".");
    (zaaktype[sleutel] || []).forEach((x, i) => {
      if (x[v.veld] === undefined) x[v.veld] = i + 1;
    });
  }
  // De rest van het zaaktype is letterlijk de e-dienst.
  for (const sleutel of ["catalogus", "informatieobjecttypen"]) traceregels.push({ bronGE: null, regel: "e-dienstmodel (letterlijk)", doelPad: `/${sleutel}`, actie: "letterlijk" });
  const afgeleid = new Set(traceregels.map((t) => t.doelPad));
  for (const sleutel of Object.keys(zaaktype)) {
    if (!afgeleid.has(`/zaaktype/${sleutel}`)) traceregels.push({ bronGE: null, regel: "e-dienstmodel (letterlijk)", doelPad: `/zaaktype/${sleutel}`, actie: "letterlijk" });
  }

  // ── Toetsen ──
  const inCatalogus = new Set(payload.informatieobjecttypen.map((i) => i.omschrijving));
  const bijZaaktype = new Set((zaaktype.informatieobjecttypen || []).map((i) => i.omschrijving));
  for (const naam of bijZaaktype) {
    if (!inCatalogus.has(naam)) diagnostics.push(fout("ZTT-IOT", `Informatieobjecttype "${naam}" van het zaaktype staat niet onder informatieobjecttypen (catalogus)`, naam));
  }
  for (const f of (edienst?.artefacten || []).filter((a) => a.soort === "formulier")) {
    for (const [soort, wat] of [["bijlagen", "bijlagen"], ["rapport", "het inzendingsrapport"]]) {
      const iot = f.registratie?.[soort]?.informatieobjecttype;
      if (iot && !bijZaaktype.has(iot)) diagnostics.push(fout("ZTT-BIJLAGE", `Formulier "${f.identifier}" legt ${wat} vast als "${iot}", maar dat is geen informatieobjecttype van zaaktype ${keuzes.identifier}`, f.identifier));
    }
    const vast = Object.entries(f.registratie?.vasteWaarden || {}).find(([pad]) => pad.endsWith(".aanvraagtype"));
    if (vast && vast[1] !== code) diagnostics.push(waarschuwing("ZTT-AANVRAAGTYPE", `Formulier "${f.identifier}" zet aanvraagtype "${vast[1]}", het zaaktype hoort bij "${code}"`, f.identifier));
  }
  if (!(zaaktype.roltypen || []).some((r) => r.omschrijvingGeneriek === "initiator")) {
    diagnostics.push(waarschuwing("ZTT-INITIATOR", "Geen roltype met omschrijvingGeneriek initiator (de aanvrager)"));
  }
  for (const r of zaaktype.resultaattypen || []) {
    if (!r.selectielijstklasse) diagnostics.push(fout("ZTT-SELECTIELIJST", `Resultaattype "${r.omschrijving}" heeft geen selectielijstklasse`, r.omschrijving));
  }
  if (!zaaktype.selectielijstProcestype) diagnostics.push(fout("ZTT-SELECTIELIJST", "Geen selectielijstProcestype {jaar, nummer}"));

  const payloadHash = await jcsHash(payload, sha256Hex);
  const artefact = {
    artefactIdentificatie: {
      soort: keuzes.soort,
      identifier: keuzes.identifier,
      naam: keuzes.naam || `Zaaktype ${keuzes.identifier}`,
      versienummer: versienummer || keuzes.versienummer || edienst?.edienst?.versienummer || "0.1.0",
      ...(keuzes.doelVersieRange ? { doelVersieRange: keuzes.doelVersieRange } : {}),
    },
    artefactInhoud: { formaat: keuzes.formaat, payload, payloadHash },
    artefactHerkomst: {
      regelsetId: regelset.id,
      regelsetVersie: regelset.versie,
      bronmodelHash,
      bronmodelVersie: edienst?.bronmodel?.versie || null,
      schrijverId: SCHRIJVER_ID,
      peiltijdstip,
    },
    traceregels,
    edienstversie: { edienst: edienst?.edienst?.naam, versienummer: edienst?.edienst?.versienummer },
    doelcomponent: keuzes.doelcomponent,
    afhankelijkheden: (edienst?.afhankelijkheden || [])
      .filter((a) => a.artefact === keuzes.identifier)
      .map((a) => ({ identifier: a.afhankelijkVan, reden: a.reden })),
  };
  return { artefact, diagnostics };
}
