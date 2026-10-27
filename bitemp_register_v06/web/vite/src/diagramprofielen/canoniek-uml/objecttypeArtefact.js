// @ts-check
/**
 * objecttypeArtefact — aansluiting "canoniek model + e-dienst → objecttype-
 * artefact" voor de inrichting van e-diensten (docs/TRANSFORMATIES.md §11).
 *
 * Route:
 *
 *   V3-model ┐
 *   e-dienst ├─ v3Graaf ─▶ graaf ─ objecttypeRegels ─▶ plan ─ jsonSchemaSchrijver ─▶ jsonSchema
 *   (M0)     ┘                                                     + metadata + passthrough ─▶ artefact
 *
 * Het resultaat is één artefact in de vorm die het inrichting-register op
 * Fundament verwacht (afspraak FUNDAMENT, 25-10-2026): identificatie, inhoud
 * met payloadHash = sha256 over JCS(payload), herkomst (regelset, bronmodel,
 * schrijver, peiltijdstip) en traceregels per modelknoop. Wat deze module
 * níét doet: registreren of uitrollen — dat doet FUNDAMENT met het bestand.
 *
 * Puur op de hashfunctie na, die wordt meegegeven (node:crypto of SubtleCrypto).
 */
import { v3Graaf } from "../../transformatie/v3Graaf.js";
import { pasRegelsToe } from "../../transformatie/regels.js";
import { planNaarJsonSchema } from "../../transformatie/jsonSchemaSchrijver.js";
import { jcsHash } from "../../transformatie/jcs.js";
import { CANONIEK_NAAR_OBJECTTYPE } from "./objecttypeRegels.js";

export const SCHRIJVER_ID = "json-schema-schrijver@0.1.0";

const ACTIE = { gemaakt: "aangemaakt", genegeerd: "weggelaten", "geen-regel": "geen-regel", overgeslagen: "overgeslagen", opgegaan: "opgegaan", gezet: "gezet" };

/** Sleutels die met `_` beginnen zijn toelichting in het e-dienstbestand, geen inhoud. */
const zonderToelichting = (object) => Object.fromEntries(Object.entries(object || {}).filter(([k]) => !k.startsWith("_")));

/**
 * @param {Object} invoer
 * @param {any} invoer.modelBestand          - het V3-bestand ({model_naam, model}) of het model zelf
 * @param {any} invoer.edienst               - het e-dienst-inrichtingsmodel (aanvraag-edienst.json)
 * @param {string} invoer.identifier         - welk artefact uit het e-dienstmodel
 * @param {any[]} [invoer.datatypen]         - de gedeelde datatypebibliotheek
 * @param {Record<string, any[]>} [invoer.referentielijsten] - M0-items per referentielijst
 * @param {string|null} [invoer.peiltijdstip] - peilmoment van de M0-gegevens
 * @param {string} [invoer.versienummer]     - versie van het artefact (default: die van de e-dienst)
 * @param {(tekst: string) => string | Promise<string>} invoer.sha256Hex
 * @param {any} [invoer.regelset]
 */
export async function maakObjecttypeArtefact({
  modelBestand,
  edienst,
  identifier,
  datatypen = [],
  referentielijsten = {},
  peiltijdstip = null,
  versienummer,
  sha256Hex,
  regelset = CANONIEK_NAAR_OBJECTTYPE,
}) {
  const model = modelBestand?.model || modelBestand;
  const keuzes = (edienst?.artefacten || []).find((a) => a.identifier === identifier);
  if (!keuzes) throw new Error(`Artefact "${identifier}" staat niet in het e-dienstmodel.`);
  if (keuzes.soort !== "objecttype") throw new Error(`Artefact "${identifier}" is een ${keuzes.soort}, geen objecttype.`);

  const diagnostics = [];

  // Bronmodel: dezelfde hashregel als voor de payload; een afwijking van de
  // versie waartegen het e-dienstmodel is opgesteld is een waarschuwing.
  const bronmodelHash = await jcsHash(model, sha256Hex);
  const verwacht = String(edienst?.bronmodel?.hash || "").replace(/^sha256:/, "");
  if (verwacht && verwacht !== bronmodelHash) {
    diagnostics.push({ severity: "warning", code: "ART-BRONMODEL", message: `Het model (sha256 ${bronmodelHash}) is niet de versie uit het e-dienstmodel (${verwacht})`, sourceId: null, path: null });
  }

  const graaf = v3Graaf({ model, keuzes, datatypen, referentielijsten });
  for (const w of graaf.waarschuwingen) diagnostics.push({ severity: "warning", code: "V3-LEZER", message: w.melding, sourceId: w.tekst || null, path: null });

  const plan = pasRegelsToe(graaf, regelset);
  diagnostics.push(...plan.diagnostics);

  const geschreven = planNaarJsonSchema(plan);
  diagnostics.push(...geschreven.diagnostics);
  if (!geschreven.schema) throw Object.assign(new Error("Geen schema geschreven."), { diagnostics });
  const jsonSchema = geschreven.schema;

  // Passthrough: letterlijk doelformaat uit het e-dienstmodel, niet getransformeerd.
  const passthrough = zonderToelichting(keuzes.passthrough?.properties);
  // Een enkelvoudig, gebruikt GE is niet weggelaten maar opgegaan in het
  // omvattende object (zijn velden staan daar); dat onderscheid hoort in de
  // trace. Zo ook een ouder (velden in het subtype) en het doel van een
  // relatie zonder velden (velden in het relatie-object).
  const lostOp = (g) => (g.aard === "ge" && !g.meervoudig) || g.aard === "ouder" || (g.aard === "doel" && !g.metVelden);
  const opgegaan = new Set(graaf.groepen.filter((g) => g.geselecteerd && lostOp(g)).map((g) => g.id));
  const traceregels = plan.trace.map((spoor) => ({
    bronGE: spoor.bronId,
    regel: spoor.regel,
    doelPad: geschreven.paden.has(spoor.doel) ? `/jsonSchema${geschreven.paden.get(spoor.doel)}` : null,
    actie: spoor.actie === "genegeerd" && opgegaan.has(spoor.bronId) ? "opgegaan" : ACTIE[spoor.actie] || spoor.actie,
  }));
  for (const [naam, fragment] of Object.entries(passthrough)) {
    if (naam in (jsonSchema.properties || {})) {
      diagnostics.push({ severity: "error", code: "ART-PASSTHROUGH", message: `Passthrough-property "${naam}" bestaat al als gegenereerde property`, sourceId: naam, path: null });
      continue;
    }
    jsonSchema.properties = { ...(jsonSchema.properties || {}), [naam]: fragment };
    traceregels.push({ bronGE: null, regel: "passthrough (e-dienstmodel)", doelPad: `/jsonSchema/properties/${naam}`, actie: "letterlijk" });
  }

  const envelop = keuzes.projectie?.envelop;
  const payload = { ...zonderToelichting(keuzes.metadata), jsonSchema: envelop ? inEnvelop({ jsonSchema, envelop, regelset, traceregels, referentielijsten, diagnostics }) : jsonSchema };
  const payloadHash = await jcsHash(payload, sha256Hex);

  const artefact = {
    artefactIdentificatie: {
      soort: keuzes.soort,
      identifier: keuzes.identifier,
      naam: keuzes.naam || `Objecttype ${keuzes.identifier}`,
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
      // Tot ArtefactHerkomst er een veld voor heeft (open punt 7) een extra sleutel.
      peiltijdstip,
    },
    traceregels,
    edienstversie: { edienst: edienst?.edienst?.naam, versienummer: edienst?.edienst?.versienummer },
    doelcomponent: keuzes.doelcomponent,
    afhankelijkheden: (edienst?.afhankelijkheden || [])
      .filter((a) => a.artefact === keuzes.identifier)
      .map((a) => ({ identifier: a.afhankelijkVan, reden: a.reden })),
  };
  return { artefact, graaf, plan, diagnostics };
}

/**
 * Het schema in een envelop van de regelset (0.4.0): het schema wordt de
 * property `data`, de trace schuift mee, en elk envelopveld krijgt een trace
 * `envelop:<veld>`.
 */
function inEnvelop({ jsonSchema, envelop, regelset, traceregels, referentielijsten, diagnostics }) {
  const vorm = regelset.enveloppen?.[envelop.soort];
  if (!vorm) {
    diagnostics.push({ severity: "error", code: "ART-ENVELOP", message: `Envelop "${envelop.soort}" kent de regelset niet`, sourceId: null, path: null });
    return jsonSchema;
  }
  const codes = (referentielijsten.Aanvraagtype || []).map((i) => i.code);
  if (codes.length && !codes.includes(envelop.type)) {
    diagnostics.push({ severity: "warning", code: "ART-ENVELOP", message: `Envelop-type "${envelop.type}" is geen code van de referentielijst Aanvraagtype`, sourceId: envelop.type, path: null });
  }
  const { $schema, title, ...data } = jsonSchema;
  const binnen = `/jsonSchema/properties/${vorm.data}`;
  for (const t of traceregels) if (t.doelPad) t.doelPad = t.doelPad.replace(/^\/jsonSchema/, binnen);
  const properties = {};
  for (const [veld, fragment] of Object.entries(vorm.velden)) {
    properties[veld] = veld === vorm.data ? data : veld === "type" ? { ...fragment, const: envelop.type } : fragment;
    traceregels.push({ bronGE: `envelop:${veld}`, regel: `Envelop ${envelop.soort}: ${vorm.naam}`, doelPad: `/jsonSchema/properties/${veld}`, actie: "aangemaakt" });
  }
  return { $schema, title, type: "object", properties, required: vorm.required };
}

/**
 * Structureel verschil tussen twee JSON-waarden, als lijst JSON-Pointer-paden.
 * Voor de hash-toets: wat precies verschilt tussen het gegenereerde en het
 * handgemaakte artefact. Volgorde van sleutels telt niet (zoals bij JCS),
 * volgorde in lijsten wel.
 *
 * @returns {{pad: string, soort: "alleen-gegenereerd"|"alleen-doel"|"anders", gegenereerd?: any, doel?: any}[]}
 */
export function verschillen(gegenereerd, doel, pad = "") {
  const uit = [];
  const isObj = (w) => w !== null && typeof w === "object" && !Array.isArray(w);
  if (isObj(gegenereerd) && isObj(doel)) {
    const sleutels = [...new Set([...Object.keys(gegenereerd), ...Object.keys(doel)])].sort();
    for (const k of sleutels) {
      const sub = `${pad}/${String(k).replace(/~/g, "~0").replace(/\//g, "~1")}`;
      if (!(k in doel)) uit.push({ pad: sub, soort: "alleen-gegenereerd", gegenereerd: gegenereerd[k] });
      else if (!(k in gegenereerd)) uit.push({ pad: sub, soort: "alleen-doel", doel: doel[k] });
      else uit.push(...verschillen(gegenereerd[k], doel[k], sub));
    }
    return uit;
  }
  if (JSON.stringify(gegenereerd) !== JSON.stringify(doel)) uit.push({ pad: pad || "/", soort: "anders", gegenereerd, doel });
  return uit;
}
