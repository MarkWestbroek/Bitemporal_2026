// @ts-check
/**
 * dossierArtefact — aansluiting "canoniek model + e-dienst → GZAC-dossier-
 * bundel" voor de inrichting van e-diensten (docs/TRANSFORMATIES.md §11.9).
 * Eén artefact per bestand van de bundel: documentdefinitie
 * (`dossierschema`), form.io-formulier (`dossierformulier`) of tabbladen
 * (`dossiertabbladen`).
 *
 * Route:
 *
 *   V3-model ─ objecttype-artefact ┐
 *   e-dienst (behandelvelden,      ├─ dossierRegels ─▶ bestand ─▶ artefact
 *     panelen, labels)             ┘
 *
 * Het objecttype-artefact is de modelkant: het schema van de dossierinhoud is
 * het schema van het objecttype (de Verzoek-plugin kopieert `data` uit de
 * envelop), en zijn traceregels zeggen uit welke modelknoop elk veld komt. Zo
 * hoeft deze aansluiting het model niet opnieuw te lezen; de bronmodel-hash
 * staat wel in de herkomst.
 *
 * Zelfde artefactvorm als objecttype, formulier en zaaktype; de payload is de
 * inhoud van het bestand. Waar het in de bundel hoort, leidt FUNDAMENT af uit
 * soort + identifier (zie dossierRegels.js). Het dossierschema en de
 * tabbladen dragen daarom allebei de key van het dossier als identifier; de
 * soort onderscheidt ze.
 *
 * Puur op de hashfunctie na, die wordt meegegeven.
 */
import { jcsHash } from "../../transformatie/jcs.js";
import { CANONIEK_NAAR_DOSSIER } from "./dossierRegels.js";

export const SCHRIJVER_ID = "gzac-dossier-schrijver@0.1.0";

export const DOSSIER_SOORTEN = ["dossierschema", "dossierformulier", "dossiertabbladen"];

const fout = (code, message, sourceId = null) => ({ severity: "error", code, message, sourceId, path: null });
const info = (code, message, sourceId = null) => ({ severity: "info", code, message, sourceId, path: null });

/** Sleutels die met `_` beginnen zijn toelichting in het e-dienstbestand, geen inhoud. */
const zonderToelichting = (waarde) =>
  Array.isArray(waarde)
    ? waarde.map(zonderToelichting)
    : waarde && typeof waarde === "object"
      ? Object.fromEntries(Object.entries(waarde).filter(([k]) => !k.startsWith("_")).map(([k, v]) => [k, zonderToelichting(v)]))
      : waarde;

/** ingediendOp → "Ingediend op", loopafstandMeter → "Loopafstand meter". */
export function labelUitNaam(naam) {
  const woorden = String(naam).replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return woorden.charAt(0).toUpperCase() + woorden.slice(1);
}

const vul = (sjabloon, waarden) => sjabloon.replace(/\{(\w+)\}/g, (_, k) => waarden[k] ?? "");

/**
 * Het schema van de dossierinhoud uit het objecttype-artefact: zonder envelop
 * (het `data`-deel), en per property de modelknoop uit de traceregels.
 */
function objecttypeSchema(objecttype) {
  const js = objecttype?.artefactInhoud?.payload?.jsonSchema;
  if (!js) return null;
  const traces = objecttype.traceregels || [];
  const metEnvelop = traces.some((t) => t.bronGE === "envelop:data");
  const basis = metEnvelop ? "/jsonSchema/properties/data" : "/jsonSchema";
  const { $schema, title, ...schema } = metEnvelop ? js.properties.data : js;
  const bron = new Map();
  for (const t of traces) {
    const m = t.actie === "aangemaakt" && typeof t.doelPad === "string" && t.doelPad.match(new RegExp(`^${basis}/properties/([^/]+)$`));
    if (m && t.bronGE && !t.bronGE.startsWith("envelop:")) bron.set(m[1], t.bronGE);
  }
  return { schema, bron };
}

/** Laat formats weg die draft-07 niet kent (recursief, ook in anyOf/items). */
function alleenBekendeFormats(schema, bekend, weg) {
  if (Array.isArray(schema)) return schema.map((s) => alleenBekendeFormats(s, bekend, weg));
  if (!schema || typeof schema !== "object") return schema;
  const uit = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === "format" && typeof v === "string" && !bekend.has(v)) {
      weg.add(v);
      continue;
    }
    uit[k] = alleenBekendeFormats(v, bekend, weg);
  }
  return uit;
}

/** Het dossierschema-item uit de e-dienst bij een dossierformulier (of het item zelf). */
function schemaKeuzesVoor(edienst, keuzes) {
  if (keuzes.soort === "dossierschema") return keuzes;
  const naam = keuzes.dossierschema;
  return (edienst?.artefacten || []).find((a) => a.soort === "dossierschema" && (!naam || a.identifier === naam)) || null;
}

/** Een artefact uit de e-dienst; de identifier is per soort uniek. */
const zoek = (edienst, identifier, soorten) =>
  (edienst?.artefacten || []).find((a) => a.identifier === identifier && soorten.includes(a.soort));

/**
 * Het samengestelde schema van de dossierinhoud: objecttype + behandelvelden.
 * @returns {{schema: any, bron: Map<string,string>, behandelvelden: Set<string>}}
 */
function dossierInhoud(objecttype, schemaKeuzes, diagnostics) {
  const ot = objecttypeSchema(objecttype);
  if (!ot) {
    diagnostics.push(fout("DOS-OBJECTTYPE", "Geen objecttype-artefact (of zonder jsonSchema): de dossierinhoud komt uit het objecttype"));
    return { schema: { type: "object", properties: {} }, bron: new Map(), behandelvelden: new Set() };
  }
  const properties = { ...ot.schema.properties };
  const behandelvelden = new Set();
  for (const [key, def] of Object.entries(zonderToelichting(schemaKeuzes?.behandelvelden || {}))) {
    if (key in properties) {
      diagnostics.push(fout("DOS-BEHANDELVELD", `Behandelveld "${key}" bestaat al in het objecttype`, key));
      continue;
    }
    properties[key] = def;
    behandelvelden.add(key);
    ot.bron.set(key, `e-dienst:behandelveld.${key}`);
  }
  return { schema: { ...ot.schema, properties }, bron: ot.bron, behandelvelden };
}

// ── Schrijvers ──────────────────────────────────────────────────────────────

function schrijfSchema({ keuzes, inhoud, regelset, diagnostics, traceregels }) {
  const weg = new Set();
  const bekend = new Set(regelset.schema.formats);
  const properties = {};
  for (const [key, def] of Object.entries(inhoud.schema.properties)) {
    properties[key] = alleenBekendeFormats(def, bekend, weg);
    traceregels.push({
      bronGE: inhoud.bron.get(key) || null,
      regel: inhoud.behandelvelden.has(key) ? "Behandelveld uit de e-dienst" : "Veld van het objecttype (zonder envelop)",
      doelPad: `/properties/${key}`,
      actie: "aangemaakt",
    });
  }
  if (weg.size) diagnostics.push(info("DOS-FORMAT", `Formats buiten draft-07 weggelaten (het patroon controleert): ${[...weg].sort().join(", ")}`));
  const s = inhoud.schema;
  return {
    $id: vul(regelset.schema.$id, { id: keuzes.identifier }),
    $schema: regelset.schema.$schema,
    title: keuzes.naam || labelUitNaam(keuzes.identifier),
    ...(keuzes.beschrijving ? { description: keuzes.beschrijving } : {}),
    type: "object",
    properties,
    ...(s.required ? { required: s.required } : {}),
    ...(s.additionalProperties !== undefined && !regelset.schema.bovenaanOpen ? { additionalProperties: s.additionalProperties } : {}),
  };
}

/** Is dit veld vrije tekst (geen lengte, keuze, format of patroon)? */
const isVrijeTekst = (d) =>
  d.type === "string" && !d.enum && !d.format && !d.pattern && d.maxLength === undefined && !d.anyOf && d.const === undefined;

function componentType(def, behandelveld, regelset) {
  for (const r of regelset.componenten) {
    const a = r.als;
    if (a.enum && !def.enum) continue;
    if (a.behandelveld && !behandelveld) continue;
    if (a.type && ![].concat(a.type).includes(def.type)) continue;
    if (a.vrijeTekst && !isVrijeTekst(def)) continue;
    return r;
  }
  return regelset.componenten[regelset.componenten.length - 1];
}

function schrijfComponent(veld, { inhoud, regelset, alleenLezen, diagnostics, traceregels, pad }) {
  const v = typeof veld === "string" ? { key: veld } : veld;
  const def = inhoud.schema.properties[v.key];
  if (!def) {
    diagnostics.push(fout("DOS-VELD", `Veld "${v.key}" staat niet in de dossierinhoud (objecttype + behandelvelden)`, v.key));
    return null;
  }
  const regel = componentType(def, inhoud.behandelvelden.has(v.key), regelset);
  const c = { type: regel.type, key: v.key, label: v.label || labelUitNaam(v.key), input: true };
  if (alleenLezen) c.disabled = true;
  c.tableView = true;
  if (!alleenLezen && v.verplicht) c.validate = { required: true };
  if (regel.type === "radio") c.values = def.enum.map((w) => ({ label: v.opties?.[w] || labelUitNaam(w), value: w }));
  if (regel.type === "textarea") c.rows = v.rijen || (alleenLezen ? regelset.formulier.rijen.alleenLezen : regelset.formulier.rijen.invoer);
  traceregels.push({ bronGE: inhoud.bron.get(v.key) || null, regel: regel.naam, doelPad: pad, actie: "aangemaakt" });
  return c;
}

function schrijfPaneel(p, ctx) {
  const alleenLezen = p.alleenLezen !== false;
  const kolommen = p.kolommen ?? (alleenLezen ? ctx.regelset.formulier.kolommen : 1);
  const paneelPad = ctx.pad;
  const paneel = { type: "panel", key: p.key, title: p.titel || labelUitNaam(p.key), input: false, tableView: false, components: [] };
  const velden = p.velden || [];
  if (kolommen > 1) {
    // Rij voor rij gevuld: veld i in kolom i mod n.
    const kol = Array.from({ length: kolommen }, () => []);
    velden.forEach((veld, i) => {
      const k = i % kolommen;
      const c = schrijfComponent(veld, { ...ctx, alleenLezen, pad: `${paneelPad}/components/0/columns/${k}/components/${kol[k].length}` });
      if (c) kol[k].push(c);
    });
    paneel.components.push({
      type: "columns",
      key: "kolommen",
      input: false,
      tableView: false,
      columns: kol.map((components) => ({ components, width: 12 / kolommen, size: "md" })),
    });
  } else {
    for (const veld of velden) {
      const c = schrijfComponent(veld, { ...ctx, alleenLezen, pad: `${paneelPad}/components/${paneel.components.length}` });
      if (c) paneel.components.push(c);
    }
  }
  return paneel;
}

function schrijfFormulier({ keuzes, edienst, inhoud, regelset, diagnostics, traceregels }) {
  // Een paneel `{uit: <formulier>}` neemt de panelen van een ander dossierformulier over.
  const panelen = [];
  for (const p of keuzes.panelen || []) {
    if (p.uit) {
      const ander = zoek(edienst, p.uit, ["dossierformulier"]);
      if (!ander) diagnostics.push(fout("DOS-PANEEL", `Panelen uit "${p.uit}": geen dossierformulier met die identifier`, p.uit));
      else panelen.push(...(ander.panelen || []).filter((q) => !q.uit));
    } else panelen.push(p);
  }
  const components = panelen.map((p, i) => schrijfPaneel(zonderToelichting(p), { inhoud, regelset, diagnostics, traceregels, pad: `/components/${i}` }));
  if (keuzes.verzenden) {
    const label = typeof keuzes.verzenden === "string" ? keuzes.verzenden : regelset.formulier.verzendLabel;
    components.push({ type: "button", key: "submit", label, action: "submit", input: true, tableView: false, disableOnInvalid: true });
    traceregels.push({ bronGE: null, regel: "Verzendknop (e-dienst)", doelPad: `/components/${components.length - 1}`, actie: "aangemaakt" });
  }
  return { display: "form", components };
}

function schrijfTabbladen({ keuzes, regelset, traceregels }) {
  const lijst = zonderToelichting(keuzes.tabbladen || regelset.tabbladen);
  return lijst.map((t, i) => {
    traceregels.push({ bronGE: null, regel: keuzes.tabbladen ? "Tabbladen (e-dienst)" : "Standaardtabbladen (regelset)", doelPad: `/${i}`, actie: "aangemaakt" });
    return { key: t.key, name: t.name, type: t.type || "standard", contentKey: t.contentKey, showTasks: !!t.showTasks };
  });
}

/**
 * @param {Object} invoer
 * @param {any} invoer.modelBestand          - het V3-bestand ({model_naam, model}) of het model zelf (voor de bronmodel-hash)
 * @param {any} invoer.edienst               - het e-dienst-inrichtingsmodel
 * @param {string} invoer.identifier         - identifier van het artefact in de e-dienst
 * @param {string} [invoer.soort]            - de soort, nodig als schema en tabbladen dezelfde identifier dragen
 * @param {any} [invoer.objecttype]          - het objecttype-artefact (bron van de dossierinhoud; niet nodig voor tabbladen)
 * @param {string|null} [invoer.peiltijdstip]
 * @param {string} [invoer.versienummer]
 * @param {(tekst: string) => string | Promise<string>} invoer.sha256Hex
 * @param {any} [invoer.regelset]
 */
export async function maakDossierArtefact({
  modelBestand,
  edienst,
  identifier,
  soort,
  objecttype = null,
  peiltijdstip = null,
  versienummer,
  sha256Hex,
  regelset = CANONIEK_NAAR_DOSSIER,
}) {
  const model = modelBestand?.model || modelBestand;
  const keuzes = zoek(edienst, identifier, soort ? [soort] : DOSSIER_SOORTEN);
  if (!keuzes) throw new Error(`Geen ${soort || DOSSIER_SOORTEN.join("/")} "${identifier}" in het e-dienstmodel.`);

  const diagnostics = [];
  const traceregels = [];
  const bronmodelHash = await jcsHash(model, sha256Hex);
  const verwacht = String(edienst?.bronmodel?.hash || "").replace(/^sha256:/, "");
  if (verwacht && verwacht !== bronmodelHash) {
    diagnostics.push({ severity: "warning", code: "ART-BRONMODEL", message: `Het model (sha256 ${bronmodelHash}) is niet de versie uit het e-dienstmodel (${verwacht})`, sourceId: null, path: null });
  }

  let payload;
  if (keuzes.soort === "dossiertabbladen") {
    payload = schrijfTabbladen({ keuzes, regelset, traceregels });
  } else {
    const schemaKeuzes = schemaKeuzesVoor(edienst, keuzes);
    if (!schemaKeuzes) diagnostics.push(fout("DOS-SCHEMA", `Geen dossierschema in de e-dienst voor "${identifier}"`));
    const inhoud = dossierInhoud(objecttype, schemaKeuzes, diagnostics);
    if (objecttype && schemaKeuzes?.objecttype && objecttype.artefactIdentificatie?.identifier !== schemaKeuzes.objecttype) {
      diagnostics.push(fout("DOS-OBJECTTYPE", `Het objecttype-artefact is "${objecttype.artefactIdentificatie?.identifier}", de e-dienst noemt "${schemaKeuzes.objecttype}"`));
    }
    payload =
      keuzes.soort === "dossierschema"
        ? schrijfSchema({ keuzes, inhoud, regelset, diagnostics, traceregels })
        : schrijfFormulier({ keuzes, edienst, inhoud, regelset, diagnostics, traceregels });
  }

  const payloadHash = await jcsHash(payload, sha256Hex);
  const artefact = {
    artefactIdentificatie: {
      soort: keuzes.soort,
      identifier: keuzes.identifier,
      naam: keuzes.naam || keuzes.identifier,
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
    // Schema en tabbladen delen een identifier: een afhankelijkheid noemt dan de soort.
    afhankelijkheden: (edienst?.afhankelijkheden || [])
      .filter((a) => a.artefact === keuzes.identifier && (!a.soort || a.soort === keuzes.soort))
      .map((a) => ({ identifier: a.afhankelijkVan, ...(a.afhankelijkVanSoort ? { soort: a.afhankelijkVanSoort } : {}), reden: a.reden })),
  };
  return { artefact, diagnostics };
}
