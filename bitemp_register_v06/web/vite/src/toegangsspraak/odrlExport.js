// @ts-check
/**
 * odrlExport — de export "Toegangsspraak → ODRL (ODRL-AP-NL)" als Turtle.
 *
 * Route (zie docs/TRANSFORMATIES.md §3):
 *
 *   beleid (AST) ──graafbeeld──▶ brongraaf ──regelset──▶ plan ──schrijver──▶ Turtle
 *                  graaf.js       odrlApNlRegels.js       turtleSchrijver.js
 *                                 + transformatie/regels.js
 *
 * Dit bestand kent alleen de aansluiting: de context van de schrijver (welke
 * predicaten tekst, verwijzing of datum zijn, en welke prefixes er gelden) en
 * de volgorde van de uitvoer. Wat een onderdeel van het beleid in ODRL wordt
 * staat in de regelset; wat het in de taal is in het graafbeeld.
 *
 * De **trace** die terugkomt is het verliesrapport van de export: elk onderdeel
 * met actie "geen-regel" of "overgeslagen" zit niet in de ODRL.
 *
 * Naast deze vorm bestaat `odrl.js` (JSON-LD, de export uit de editor); die
 * blijft zoals hij is. Het verschil staat in docs/TOEGANGSSPRAAK.md.
 *
 * Puur en node-testbaar; geen store, geen React.
 */
import { parseBeleid } from "./parser.js";
import { renderBeleid } from "./renderer.js";
import { slug } from "./woorden.js";
import { beleidNaarGraaf } from "./graaf.js";
import { TOEGANGSSPRAAK_NAAR_ODRL_AP_NL } from "./odrlApNlRegels.js";
import { pasRegelsToe } from "../transformatie/regels.js";
import { schrijfTurtle } from "../transformatie/turtleSchrijver.js";

export const TS_NAMESPACE = "https://omnium.example/toegangsspraak/";

const TEKST = { soort: "tekst" };
const IRI = { soort: "iri" };
const DATUM = { soort: "datum" };
const LIJST = { soort: "lijst" };

/**
 * De context van de schrijver voor één beleid.
 *
 * @param {{beleidSlug: string, modelNaam?: string, basisUrl?: string}} o
 */
export function odrlContext({ beleidSlug, modelNaam = "model", basisUrl = "https://omnium.example" }) {
  return {
    prefixes: {
      odrl: "http://www.w3.org/ns/odrl/2/",
      rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
      rdfs: "http://www.w3.org/2000/01/rdf-schema#",
      xsd: "http://www.w3.org/2001/XMLSchema#",
      skos: "http://www.w3.org/2004/02/skos/core#",
      dct: "http://purl.org/dc/terms/",
      prov: "http://www.w3.org/ns/prov#",
      dpv: "https://w3id.org/dpv#",
      schema: "https://schema.org/",
      apnl: "https://standaarden.overheid.nl/odrl-ap-nl/",
      ts: TS_NAMESPACE,
      reg: `${basisUrl}/register/${modelNaam}/`,
      b: `${basisUrl}/toegangsbeleid/${beleidSlug}/`,
    },
    basis: "b",
    taal: "nl",
    naam: {
      standaard: "rdfs:label",
      perType: { "odrl:Set": "dct:title", "odrl:Permission": "dct:title", "odrl:Prohibition": "dct:title", "odrl:Duty": "dct:title", "odrl:Profile": "dct:title" },
    },
    predicaten: {
      "dct:description": TEKST,
      "skos:definition": TEKST,
      "skos:note": TEKST,
      "rdfs:comment": TEKST,
      "dct:issued": DATUM,
      "schema:validFrom": DATUM,
      "schema:validThrough": DATUM,
      "odrl:leftOperand": IRI,
      "odrl:operator": IRI,
      "odrl:action": IRI,
      "rdf:value": IRI,
      "dct:source": IRI,
      "odrl:and": LIJST,
      "odrl:or": LIJST,
      "odrl:xone": LIJST,
    },
    secties: [
      { titel: "Het beleid", types: ["odrl:Set"] },
      // De handeling per regel (een knoop met rdf:value) staat bij haar regel.
      { titel: "Regels en plichten", types: ["odrl:Permission", "odrl:Prohibition", "odrl:Duty"], iri: "^b:handeling-" },
      { titel: "Voorwaarden (benoemd, dus herbruikbaar en realiseerbaar)", types: ["odrl:Constraint", "odrl:LogicalConstraint"] },
      { titel: "Wie en wat: begrippen uit de beleidstekst", types: ["odrl:PartyCollection", "odrl:AssetCollection", "dct:LegalResource", "skos:Concept"] },
      { titel: "Het register: paden als assets met partOf", types: ["odrl:Asset"] },
      { titel: "Realisatie: wat de regels uitvoert", types: ["apnl:RegoModule", "apnl:CedarPolicySet", "apnl:PolicyArtifact", "apnl:PolicyBundle"] },
      { titel: "Woordenschat van Toegangsspraak (labels komen uit de klare taal)", types: ["odrl:Profile", "odrl:LeftOperand", "odrl:Operator", "odrl:Action", "rdfs:Class"] },
    ],
  };
}

/** Het profiel waar de eigen woordenschat onder valt (de waarde van odrl:profile). */
const PROFIEL_KNOOP = {
  id: "ts:profiel",
  aard: "profiel",
  tekst: "Toegangsspraak-woordenschat (Omnium Studio, werkversie)",
  toelichting:
    "De termen die Toegangsspraak nodig heeft bovenop ODRL 2.2 en ODRL-AP-NL: operanden uit de van-vorm, een paar vergelijkingen en handelingen. Elk label is de zinsnede uit de klare taal.",
};
const PROFIEL_REGEL = { naam: "Profiel van de woordenschat", bij: "knoop", als: { aard: "profiel" }, maak: { type: "odrl:Profile", data: { "dct:description": "{toelichting}" } } };

/**
 * Beleid (tekst of AST) → ODRL in Turtle.
 *
 * @param {string | object} beleidOfTekst
 * @param {Object} [opties]
 * @param {string} [opties.uitgegeven]        publicatiedatum (ISO); weglaten = geen dct:issued
 * @param {string} [opties.modelNaam]         naam van het model, voor de reg:-namespace
 * @param {string} [opties.basisUrl]
 * @param {(pad: string) => string} [opties.resolveerPad]
 * @param {(pad: string) => string[]} [opties.kinderenVan]
 * @param {(graaf: any, beleid: any) => {knopen?: any[], verbindingen?: any[]}} [opties.aanvulling]
 *        extra knopen en verbindingen uit een andere bron (bv. wat de regels uitvoert)
 * @param {any[]} [opties.extraRegels]        regels vóór de regelset (voor die aanvulling)
 * @param {Record<string, any>} [opties.extraPredicaten]
 * @param {string} [opties.bron]              pad van de brontekst, voor de kopregel
 * @returns {{ok: boolean, turtle: string, plan: any, graaf: any, trace: any[], diagnostics: any[]}}
 */
export function toegangsspraakNaarOdrl(beleidOfTekst, opties = {}) {
  let beleid = beleidOfTekst;
  if (typeof beleidOfTekst === "string") {
    const r = parseBeleid(beleidOfTekst);
    if (!r.ok) {
      return {
        ok: false,
        turtle: "",
        plan: null,
        graaf: null,
        trace: [],
        diagnostics: r.fouten.map((f) => ({ severity: "error", code: "TS-SYNTAX", message: f.bericht, sourceId: null, path: `regel ${f.regel}, kolom ${f.kolom}` })),
      };
    }
    beleid = r.beleid;
  }

  const graaf = beleidNaarGraaf(beleid, opties);
  graaf.knopen.push(PROFIEL_KNOOP);
  const extra = opties.aanvulling?.(graaf, beleid) || {};
  graaf.knopen.push(...(extra.knopen || []));
  graaf.verbindingen.push(...(extra.verbindingen || []));

  const regelset = {
    ...TOEGANGSSPRAAK_NAAR_ODRL_AP_NL,
    regels: [...(opties.extraRegels || []), PROFIEL_REGEL, ...TOEGANGSSPRAAK_NAAR_ODRL_AP_NL.regels],
  };
  const plan = pasRegelsToe(graaf, regelset);

  const context = odrlContext({ beleidSlug: slug(beleid.naam), modelNaam: opties.modelNaam, basisUrl: opties.basisUrl });
  Object.assign(context.predicaten, opties.extraPredicaten || {});
  const canoniek = renderBeleid(beleid).trimEnd().split("\n");
  const kop = [
    `# ${beleid.naam} — Toegangsspraak → ODRL (ODRL-AP-NL), regelset ${regelset.id} v${regelset.versie}.`,
    "# Gegenereerd; niet met de hand wijzigen." + (opties.bron ? ` Bron in klare taal: ${opties.bron}` : ""),
    "#",
    ...canoniek.map((r) => `#   ${r}`.trimEnd()),
  ].join("\n");
  const uit = schrijfTurtle(plan, context, { kop });

  return { ok: true, turtle: uit.tekst, plan, graaf, trace: plan.trace, diagnostics: [...plan.diagnostics, ...uit.diagnostics] };
}
