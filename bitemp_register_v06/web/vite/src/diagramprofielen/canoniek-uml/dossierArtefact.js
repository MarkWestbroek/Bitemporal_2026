// @ts-check
/**
 * dossierArtefact — aansluiting "canoniek model + e-dienst → GZAC-dossier-
 * bundel" voor de inrichting van e-diensten (docs/TRANSFORMATIES.md §11.9).
 * Eén artefact per bestand van de bundel: de definitie van het dossier
 * (`dossierdefinitie`), documentdefinitie (`dossierschema`), form.io-formulier
 * (`dossierformulier`), tabbladen (`dossiertabbladen`), de koppeling aan het
 * zaaktype (`dossierzaaktypelink`), de processen bij het dossier
 * (`dossierprocessen`), de kolommen van het documentenoverzicht
 * (`dossierdocumentkolommen`), de statussen van het dossier
 * (`dossierstatussen`), de tabbladen met widgets (`dossierwidgettabbladen`,
 * 08-11: velden en lijsten uit de dossierinhoud, zoals het tabblad Aanvraag)
 * of de kolommen van de dossierlijst (`dossierlijstkolommen`, 08-11).
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
import { afhankelijkhedenVan } from "../../transformatie/afhankelijkheden.js";
import { doelVersieRange } from "../../transformatie/doelVersie.js";
import { CANONIEK_NAAR_DOSSIER } from "./dossierRegels.js";
import { kebab } from "../../transformatie/sleutel.js";

export const SCHRIJVER_ID = "gzac-dossier-schrijver@0.1.0";

export const DOSSIER_SOORTEN = ["dossierdefinitie", "dossierschema", "dossierformulier", "dossiertabbladen", "dossierzaaktypelink", "dossierprocessen", "dossierdocumentkolommen", "dossierstatussen", "dossierwidgettabbladen", "dossierlijstkolommen"];

/** Dossierdelen die de inhoud van het dossier niet lezen (geen objecttype nodig). */
const ZONDER_INHOUD = {
  dossierdefinitie: schrijfDefinitie,
  dossiertabbladen: schrijfTabbladen,
  dossierzaaktypelink: schrijfZaaktypelink,
  dossierprocessen: schrijfProcessen,
  dossierdocumentkolommen: schrijfDocumentkolommen,
  dossierstatussen: schrijfStatussen,
};

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

/**
 * Het schema bij een veldpad: "kenteken", of met een punt een veld in een
 * object ("aanvraagtype.omschrijving", "partij.bsn" in een tabelrij). In het
 * formulier wordt zo'n pad een container per stap (inContainers).
 */
function defOp(schema, pad) {
  let def = schema;
  for (const deel of String(pad).split(".")) {
    def = def?.type === "object" || def?.properties ? def.properties?.[deel] : undefined;
    if (!def) return null;
  }
  return def;
}

/**
 * Een veld in een object ("partij.bsn") als Form.io-container per stap: de
 * data blijft genest ({partij: {bsn}}), zonder te leunen op punten in een
 * sleutel. In een tabel draagt de buitenste container het kolomlabel.
 */
function inContainers(pad, veld, { label, alleenLezen, kolom = false }) {
  const delen = String(pad).split(".");
  if (delen.length === 1) return veld;
  let c = { ...veld, key: delen[delen.length - 1], ...(kolom ? { hideLabel: true } : {}) };
  for (let i = delen.length - 2; i >= 0; i -= 1) {
    c = { type: "container", key: delen[i], label: i === 0 && kolom ? label : labelUitNaam(delen[i]), hideLabel: !(i === 0 && kolom), input: true, tableView: false, components: [c] };
    if (alleenLezen) c.disabled = true;
  }
  return c;
}

const isObjectLijst = (def) => def?.type === "array" && (def.items?.type === "object" || def.items?.properties);

/**
 * Een lijst van objecten (partijen, bijlagen) als alleen-lezen tabel: een
 * datagrid met een kolom per gekozen veld (`kolommen`, ook met een punt:
 * "partij.bsn", als container); zonder keuze de enkelvoudige velden van het item.
 */
function schrijfTabel(v, def, { inhoud, regelset, alleenLezen, diagnostics, traceregels, pad }) {
  const item = def.items;
  const kolommen = v.kolommen || Object.keys(item.properties || {}).filter((k) => !["object", "array"].includes(item.properties[k]?.type));
  const components = [];
  for (const kol of kolommen) {
    const k = typeof kol === "string" ? { key: kol } : kol;
    const kdef = defOp(item, k.key);
    if (!kdef || kdef.type === "object" || kdef.type === "array") {
      diagnostics.push(fout("DOS-VELD", `Kolom "${k.key}" van "${v.key}" is geen enkelvoudig veld van het item`, `${v.key}.${k.key}`));
      continue;
    }
    const regel = componentType(kdef, false, regelset);
    const label = k.label || labelUitNaam(k.key.split(".").pop());
    const c = { type: regel.type === "textarea" ? "textfield" : regel.type, key: k.key, label, input: true, tableView: true };
    if (alleenLezen) c.disabled = true;
    components.push(inContainers(k.key, c, { label, alleenLezen, kolom: true }));
  }
  const t = regelset.tabel;
  const c = { type: t.type, key: v.key, label: v.label || labelUitNaam(v.key), input: true, tableView: false, components };
  if (alleenLezen) Object.assign(c, { disabled: true, disableAddingRemovingRows: true, reorder: false });
  traceregels.push({ bronGE: inhoud.bron.get(v.key) || null, regel: t.naam, doelPad: pad, actie: "aangemaakt" });
  return c;
}

function schrijfComponent(veld, ctx) {
  const { inhoud, regelset, alleenLezen, diagnostics, traceregels, pad } = ctx;
  const v = typeof veld === "string" ? { key: veld } : veld;
  const def = defOp(inhoud.schema, v.key);
  if (!def) {
    diagnostics.push(fout("DOS-VELD", `Veld "${v.key}" staat niet in de dossierinhoud (objecttype + behandelvelden)`, v.key));
    return null;
  }
  if (isObjectLijst(def)) return schrijfTabel(v, def, ctx);
  if (def.type === "object") {
    diagnostics.push(fout("DOS-VELD", `Veld "${v.key}" is een object; kies een veld daarin, bv. "${v.key}.${Object.keys(def.properties || {})[0] || "…"}"`, v.key));
    return null;
  }
  const top = v.key.split(".")[0];
  const regel = componentType(def, inhoud.behandelvelden.has(top), regelset);
  const c = { type: regel.type, key: v.key, label: v.label || labelUitNaam(v.key.split(".").pop()), input: true };
  if (alleenLezen) c.disabled = true;
  c.tableView = true;
  if (!alleenLezen && v.verplicht) c.validate = { required: true };
  if (regel.type === "radio") c.values = def.enum.map((w) => ({ label: v.opties?.[w] || labelUitNaam(w), value: w }));
  if (regel.type === "textarea") c.rows = v.rijen || (alleenLezen ? regelset.formulier.rijen.alleenLezen : regelset.formulier.rijen.invoer);
  traceregels.push({ bronGE: inhoud.bron.get(v.key) || inhoud.bron.get(top) || null, regel: regel.naam, doelPad: pad, actie: "aangemaakt" });
  return inContainers(v.key, c, { label: c.label, alleenLezen });
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

function schrijfTabbladen({ keuzes, edienst, regelset, traceregels }) {
  const lijst = zonderToelichting(keuzes.tabbladen || regelset.tabbladen).map((t) => ({ ...t, regel: keuzes.tabbladen ? "Tabbladen (e-dienst)" : "Standaardtabbladen (regelset)" }));
  // Tabbladen met widgets van hetzelfde dossier (dossierwidgettabbladen) komen
  // erbij, na het tabblad dat `na` noemt (standaard de samenvatting).
  const widgets = (edienst?.artefacten || []).find((a) => a.soort === "dossierwidgettabbladen" && a.identifier === keuzes.identifier);
  for (const w of zonderToelichting(widgets?.tabbladen || [])) {
    const na = lijst.findIndex((t) => t.key === (w.na || regelset.widgets.na));
    lijst.splice(na >= 0 ? na + 1 : lijst.length, 0, { key: w.key, name: w.naam || labelUitNaam(w.key), type: "widgets", contentKey: w.key, showTasks: !!w.showTasks, regel: "Tabblad met widgets (dossierwidgettabbladen)" });
  }
  return lijst.map((t, i) => {
    traceregels.push({ bronGE: null, regel: t.regel, doelPad: `/${i}`, actie: "aangemaakt" });
    return { key: t.key, name: t.name, type: t.type || "standard", contentKey: t.contentKey, showTasks: !!t.showTasks };
  });
}

/** Weergavetype van een veld in een widget (displayProperties.type), de eerste regel die past. */
function weergaveType(def, regelset) {
  for (const r of regelset.widgets.weergave) {
    const a = r.als;
    if (a.type && ![].concat(a.type).includes(def.type)) continue;
    if (a.format && def.format !== a.format) continue;
    return r;
  }
  return regelset.widgets.weergave[regelset.widgets.weergave.length - 1];
}

/**
 * Tabbladen met widgets (GZAC 13: case/widget-tab/<dossier>.case-widget-tab.json).
 * Per tabblad de widgets uit de e-dienst; de waarden komen uit de dossierinhoud
 * (`doc:/pad`), het weergavetype uit het schema. Twee soorten:
 * - `fields`: velden over `kolommen` kolommen, kolom voor kolom gevuld; een
 *   pad met een punt kiest een veld in een object (aanvraagtype.omschrijving).
 * - `collection`: een lijst van objecten (`veld`), met `titelVeld` als kop van
 *   elk item en `velden` eronder (relatief pad, met / bij een object).
 * Vorm overgenomen uit de export van een met de hand ingericht tabblad op
 * cg-test (INRICHTEN_VIZ 08-11, gzac-handwerk/…case-widget-tab.json).
 */
function schrijfWidgettabbladen({ keuzes, edienst, inhoud, regelset, diagnostics, traceregels }) {
  const r = regelset.widgets;
  const definitie = (edienst?.artefacten || []).find((a) => a.soort === "dossierdefinitie" && a.identifier === keuzes.identifier);
  if (!definitie?.versie) diagnostics.push(fout("DOS-VERSIE", `Geen dossierdefinitie met versie voor "${keuzes.identifier}"; de widgettabbladen horen bij een dossierversie`));
  const veldDef = (pad, basis = inhoud.schema) => {
    const def = defOp(basis, pad);
    if (!def) {
      diagnostics.push(fout("DOS-VELD", `Veld "${pad}" staat niet in de dossierinhoud (objecttype + behandelvelden)`, pad));
      return null;
    }
    if (def.type === "object" || def.type === "array") {
      diagnostics.push(fout("DOS-VELD", `Veld "${pad}" is geen enkelvoudig veld`, pad));
      return null;
    }
    return def;
  };
  // Een veld mag zelf een weergave kiezen (v.weergave, uit r.toegestaan); anders de eerste regel die past.
  const weergave = (def, v = {}, wkey = "") => {
    if (v.weergave && !r.toegestaan.includes(v.weergave)) diagnostics.push(fout("DOS-WIDGET", `Widget "${wkey}": weergave "${v.weergave}" kent de regelset niet (${r.toegestaan.join(", ")})`, wkey));
    return { type: v.weergave && r.toegestaan.includes(v.weergave) ? v.weergave : weergaveType(def, regelset).type, hideWhenEmpty: false };
  };
  const bronVan = (pad) => inhoud.bron.get(pad) || inhoud.bron.get(pad.split(".")[0]) || null;
  const gewoon = (v) => (typeof v === "string" ? { key: v } : v);
  const rel = (p) => String(p).replace(/\./g, "/");
  const laatste = (p) => String(p).split(".").pop();

  return zonderToelichting(keuzes.tabbladen || []).map((tab, ti) => ({
    caseDefinitionKey: keuzes.identifier,
    caseDefinitionVersionTag: definitie?.versie || "",
    key: tab.key,
    widgets: (tab.widgets || []).map((w, wi) => {
      const pad = `/${ti}/widgets/${wi}`;
      const basis = { type: w.type, key: w.key, title: w.titel || labelUitNaam(w.key), icon: null, color: r.kleur, width: w.breedte || r.breedte[w.type] || 2, highContrast: false, isCompact: null, actions: [], displayConditions: [] };
      if (w.type === "fields") {
        const velden = (w.velden || []).map(gewoon).map((v) => ({ v, def: veldDef(v.key) })).filter((x) => x.def);
        const n = Math.max(1, w.kolommen || r.kolommen);
        const perKolom = Math.ceil(velden.length / n) || 1;
        const columns = [];
        velden.forEach((x, i) => {
          const k = Math.floor(i / perKolom);
          if (!columns[k]) columns[k] = [];
          columns[k].push({ key: laatste(x.v.key), title: x.v.label || labelUitNaam(laatste(x.v.key)), value: `doc:/${rel(x.v.key)}`, displayProperties: weergave(x.def, x.v, w.key) });
          traceregels.push({ bronGE: bronVan(x.v.key), regel: "Veld van de dossierinhoud: fields-widget", doelPad: `${pad}/properties/columns/${k}/${columns[k].length - 1}`, actie: "aangemaakt" });
        });
        return { ...basis, properties: { columns } };
      }
      if (w.type === "collection") {
        const veld = w.veld || w.key;
        const lijst = defOp(inhoud.schema, veld);
        if (!isObjectLijst(lijst)) {
          diagnostics.push(fout("DOS-VELD", `Widget "${w.key}": "${veld}" is geen lijst van objecten in de dossierinhoud`, w.key));
          return { ...basis, properties: {} };
        }
        const titelDef = w.titelVeld ? veldDef(w.titelVeld, lijst.items) : null;
        const fields = (w.velden || []).map(gewoon).map((v) => ({ v, def: veldDef(v.key, lijst.items) })).filter((x) => x.def)
          .map((x) => ({ key: laatste(x.v.key), title: x.v.label || labelUitNaam(laatste(x.v.key)), value: rel(x.v.key), width: x.v.breedte || "full", displayProperties: weergave(x.def, x.v, w.key) }));
        // GZAC 13.50 weigert een collection zonder velden ("fields: must not be empty", uitrol 25, 08-11).
        if (!fields.length) diagnostics.push(fout("DOS-WIDGET", `Widget "${w.key}": een collection heeft minstens één veld nodig (velden); GZAC weigert hem anders`, w.key));
        traceregels.push({ bronGE: bronVan(veld), regel: "Lijst van de dossierinhoud: collection-widget", doelPad: pad, actie: "aangemaakt" });
        return {
          ...basis,
          properties: {
            collection: `doc:/${rel(veld)}`,
            defaultPageSize: w.paginagrootte || r.paginagrootte,
            title: titelDef ? { value: rel(w.titelVeld), displayProperties: weergave(titelDef) } : null,
            fields,
          },
        };
      }
      if (w.type === "custom") {
        // Een eigen widget in de GZAC-frontend (CUSTOM_WIDGET_TOKEN, @valtimo/layout): GZAC geeft
        // componentValue letterlijk als inputs door. Afspraak met GZAC-WIDGET (08-11): het component
        // documentAfbeeldingen toont afbeeldingen uit de lijst `bijlagen` (JSON-pointer), met een
        // optioneel filter `naam`. Een lijst in de dossierinhoud wordt getoetst.
        // GZAC 13 geeft de dossierinhoud niet aan de frontend (includeDocumentContentInResponse=false);
        // het widget leest daarom de gegevens van een collection-widget op hetzelfde tabblad:
        // `bron` noemt die widget (GZAC-WIDGET/FUNDAMENT 08-11). Die moet bestaan.
        if (!w.component) diagnostics.push(fout("DOS-WIDGET", `Widget "${w.key}": een custom widget noemt zijn component`, w.key));
        const waarden = Object.fromEntries(Object.entries(w.waarden || {}).map(([k, v]) => [k, String(v)]));
        for (const [k, v] of Object.entries(waarden)) {
          if (!v.startsWith("/")) continue;
          if (!defOp(inhoud.schema, v.slice(1).split("/").join("."))) diagnostics.push(fout("DOS-VELD", `Widget "${w.key}": ${k} = "${v}" staat niet in de dossierinhoud`, w.key));
        }
        if (waarden.bron && !(tab.widgets || []).some((x) => x.type === "collection" && x.key === waarden.bron)) {
          diagnostics.push(fout("DOS-WIDGET", `Widget "${w.key}": bron "${waarden.bron}" is geen collection-widget op tabblad "${tab.key}"`, w.key));
        }
        traceregels.push({ bronGE: null, regel: "Eigen widget (e-dienst): custom", doelPad: pad, actie: "aangemaakt" });
        return { ...basis, width: w.breedte || 1, properties: { componentKey: w.component || "", componentValue: waarden } };
      }
      diagnostics.push(fout("DOS-WIDGET", `Widget "${w.key}": soort "${w.type}" kent de regelset niet (fields, collection, custom)`, w.key));
      return { ...basis, properties: {} };
    }),
    widgetLayout: r.layout,
  }));
}

/**
 * De definitie van het dossier: sleutel, naam, versie en beschrijving uit de
 * e-dienst. De versie is een inrichtingskeuze: een andere versie maakt in GZAC
 * een nieuwe dossierversie (FUNDAMENT 05-11).
 */
function schrijfDefinitie({ keuzes, regelset, diagnostics, traceregels }) {
  if (!keuzes.versie) diagnostics.push(fout("DOS-VERSIE", `De dossierdefinitie "${keuzes.identifier}" noemt geen versie`));
  const r = regelset.definitie;
  const uitEdienst = (veld) => traceregels.push({ bronGE: null, regel: "Dossierdefinitie (e-dienst)", doelPad: `/${veld}`, actie: "aangemaakt" });
  const keuze = (veld, sleutel) => {
    const eigen = keuzes[sleutel] !== undefined;
    traceregels.push({ bronGE: null, regel: eigen ? "Toewijzing (e-dienst)" : "Toewijzing (regelset)", doelPad: `/${veld}`, actie: "aangemaakt" });
    return eigen ? !!keuzes[sleutel] : r[veld];
  };
  ["key", "name", "versionTag", "description"].forEach(uitEdienst);
  return {
    key: keuzes.identifier,
    name: keuzes.dossiernaam || keuzes.naam || keuzes.identifier,
    versionTag: keuzes.versie || "",
    description: keuzes.beschrijving || "",
    canHaveAssignee: keuze("canHaveAssignee", "behandelaar"),
    autoAssignTasks: keuze("autoAssignTasks", "takenAutomatischToewijzen"),
  };
}

/**
 * De processen bij het dossier: elk bpmn-artefact van de e-dienst, of de
 * lijst `processen` (proces-id's) als de e-dienst die noemt.
 */
function schrijfProcessen({ keuzes, edienst, regelset, diagnostics, traceregels }) {
  const bpmn = (edienst?.artefacten || []).filter((a) => a.soort === "bpmn").map((a) => a.identifier);
  const lijst = keuzes.processen || bpmn;
  return lijst.map((proces, i) => {
    if (!bpmn.includes(proces)) diagnostics.push(fout("DOS-PROCES", `Proces "${proces}" is geen bpmn-artefact van de e-dienst`, proces));
    traceregels.push({ bronGE: null, regel: keuzes.processen ? "Processen (e-dienst)" : "Elk bpmn-artefact van de e-dienst", doelPad: `/${i}`, actie: "aangemaakt" });
    return { processDefinitionKey: proces, ...regelset.processen };
  });
}

/**
 * De kolommen van de dossierlijst (GZAC 13: case/list/<dossier>.case-list.json,
 * vorm van Valtimo's CaseListExporter). Bestaat de lijst, dan vervangt hij de
 * standaardkolommen helemaal; de e-dienst noemt daarom ook aanmaakdatum,
 * behandelaar en status. Per kolom óf `veld` (de dossierinhoud, `doc:<veld>`,
 * alleen een veld bovenaan; weergave uit het schema) óf `dossier` (een gegeven
 * van GZAC zelf, `case:<naam>`, weergave uit de regelset). `sorteerbaar` en
 * `sortering` (ASC/DESC, hooguit één kolom) uit de e-dienst.
 */
function schrijfLijstkolommen({ keuzes, inhoud, regelset, diagnostics, traceregels }) {
  const r = regelset.lijst;
  const kolommen = zonderToelichting(keuzes.kolommen || []);
  if (!kolommen.length) diagnostics.push(fout("DOS-LIJST", `Dossierlijst "${keuzes.identifier}" zonder kolommen; GZAC toont dan een lege lijst in plaats van de standaardkolommen`));
  const gesorteerd = kolommen.filter((k) => k.sortering);
  if (gesorteerd.length > 1) diagnostics.push(fout("DOS-LIJST", `Hooguit één kolom met sortering (nu: ${gesorteerd.map((k) => k.veld || k.dossier).join(", ")})`));
  const bronVan = (pad) => inhoud.bron.get(pad) || null;
  return kolommen.map((k, i) => {
    let path, type, key, bronGE = null;
    if (k.dossier) {
      type = r.dossier[k.dossier];
      if (!type) diagnostics.push(fout("DOS-LIJST", `Kolom ${i}: dossiergegeven "${k.dossier}" kent de regelset niet (${Object.keys(r.dossier).join(", ")})`, k.dossier));
      path = `case:${k.dossier}`;
      key = k.key || k.dossier;
    } else {
      const def = k.veld && !String(k.veld).includes(".") ? defOp(inhoud.schema, k.veld) : null;
      if (!def || def.type === "object" || def.type === "array") {
        diagnostics.push(fout("DOS-VELD", `Kolom ${i}: "${k.veld}" is geen enkelvoudig veld bovenaan de dossierinhoud`, k.veld || null));
      }
      type = def ? (r.weergave.find((w) => (!w.als.type || [].concat(w.als.type).includes(def.type)) && (!w.als.format || w.als.format === def.format)) || r.weergave.at(-1)).type : "text";
      path = `doc:${k.veld}`;
      key = k.key || k.veld;
      bronGE = bronVan(k.veld);
    }
    if (k.sortering && !["ASC", "DESC"].includes(k.sortering)) diagnostics.push(fout("DOS-LIJST", `Kolom ${i}: sortering "${k.sortering}" is geen ASC of DESC`, key));
    traceregels.push({ bronGE, regel: k.dossier ? "Dossiergegeven van GZAC: lijstkolom" : "Veld van de dossierinhoud: lijstkolom", doelPad: `/${i}`, actie: "aangemaakt" });
    return {
      key,
      title: k.label || labelUitNaam(key),
      path,
      displayType: { type: type || "text", displayTypeParameters: { ...(r.parameters[type] || {}) } },
      sortable: k.sorteerbaar === true || !!k.sortering,
      defaultSort: k.sortering || null,
      order: i,
    };
  });
}

/** De kolommen van het documentenoverzicht: uit de regelset, of de lijst `kolommen` van de e-dienst. */
function schrijfDocumentkolommen({ keuzes, regelset, traceregels }) {
  const lijst = zonderToelichting(keuzes.kolommen || regelset.documentkolommen);
  return lijst.map((k, i) => {
    traceregels.push({ bronGE: null, regel: keuzes.kolommen ? "Documentkolommen (e-dienst)" : "Standaardkolommen (regelset)", doelPad: `/${i}`, actie: "aangemaakt" });
    return { key: k.key, defaultSort: k.sortering || null };
  });
}

/**
 * De dossierstatussen die de processen van de e-dienst zetten: per bpmn-artefact
 * de servicetaken met een `dossierstatus` in het diagram van dat artefact.
 * @returns {{gezet: Array<{waarde: string, taak: string, proces: string}>, ontbreekt: string[]}}
 */
export function gezetteStatussen(edienst, bpmnModellen = {}) {
  const gezet = [];
  const ontbreekt = [];
  for (const a of (edienst?.artefacten || []).filter((x) => x.soort === "bpmn")) {
    const bestand = bpmnModellen[a.bron?.model];
    const model = bestand?.model || bestand;
    const diagram = Object.values(model?.diagrams || {}).find((d) => d.naam === a.bron?.diagram || d.id === a.bron?.diagram);
    if (!diagram) {
      ontbreekt.push(a.identifier);
      continue;
    }
    for (const knoop of diagram.nodes || []) {
      const el = model.elements?.[knoop.elementId];
      if (el?.elementType === "taak" && el.data?.dossierstatus) gezet.push({ waarde: el.data.dossierstatus, taak: el.naam, proces: a.identifier });
    }
  }
  return { gezet, ontbreekt };
}

/**
 * De statussen van het dossier: waarden uit de statuslijst van het model die
 * de e-dienst noemt (`statuslijst`, de naam van een enum). Welke waarden: de
 * lijst `waarden` van de e-dienst, anders wat de processen zetten.
 */
function schrijfStatussen({ keuzes, edienst, model, bpmnModellen, regelset, diagnostics, traceregels }) {
  const lijstNaam = keuzes.statuslijst;
  const lijst = (model?.enums || []).find((e) => e.goType === lijstNaam);
  if (!lijstNaam) diagnostics.push(fout("DOS-STATUSLIJST", `De dossierstatussen "${keuzes.identifier}" noemen geen statuslijst`));
  else if (!lijst) diagnostics.push(fout("DOS-STATUSLIJST", `Statuslijst "${lijstNaam}" staat niet in het model`));
  const inModel = new Set((lijst?.waarden || []).map((w) => w.waarde));

  let waarden = keuzes.waarden;
  if (!waarden) {
    const { gezet, ontbreekt } = gezetteStatussen(edienst, bpmnModellen);
    if (ontbreekt.length) {
      diagnostics.push({ severity: "warning", code: "DOS-STATUS", message: `BPMN-model niet meegegeven voor ${ontbreekt.join(", ")}: welke statussen die processen zetten is onbekend`, sourceId: null, path: null });
    }
    waarden = [...new Set(gezet.map((g) => g.waarde))];
    for (const g of gezet) {
      if (lijst && !inModel.has(g.waarde)) diagnostics.push(fout("DOS-STATUS", `Taak "${g.taak}" (${g.proces}) zet dossierstatus "${g.waarde}", maar die staat niet in statuslijst ${lijstNaam}`, g.waarde));
    }
  } else {
    for (const w of waarden) if (lijst && !inModel.has(w)) diagnostics.push(fout("DOS-STATUS", `Dossierstatus "${w}" staat niet in statuslijst ${lijstNaam}`, w));
  }

  const eigen = zonderToelichting(keuzes.statussen || {});
  return waarden.map((w, i) => {
    traceregels.push({ bronGE: lijstNaam ? `${lijstNaam}.${w}` : null, regel: keuzes.waarden ? "Waarde uit de statuslijst (e-dienst kiest)" : "Waarde uit de statuslijst die een proces zet", doelPad: `/${i}`, actie: "aangemaakt" });
    const e = eigen[w] || {};
    return {
      key: kebab(w),
      title: e.titel || labelUitNaam(w),
      visibleInCaseListByDefault: e.zichtbaarInLijst ?? regelset.statussen.zichtbaarInLijst,
      color: e.kleur || regelset.statussen.kleur,
      ...regelset.statussen.vast,
    };
  });
}

/**
 * Koppeling dossier ↔ zaaktype: het zaaktype en `zaakBijDossier` uit de
 * e-dienst, de omgevingsgegevens als plaatshouder uit de regelset.
 */
function schrijfZaaktypelink({ keuzes, edienst, regelset, diagnostics, traceregels }) {
  const zaaktype = keuzes.zaaktype;
  if (!zaaktype) diagnostics.push(fout("DOS-ZAAKTYPE", `De zaaktypekoppeling "${keuzes.identifier}" noemt geen zaaktype`));
  else if (!(edienst?.artefacten || []).some((a) => a.soort === "zaaktype" && a.identifier === zaaktype)) {
    diagnostics.push({ severity: "warning", code: "DOS-ZAAKTYPE", message: `Zaaktype "${zaaktype}" is geen artefact van deze e-dienst; het moet in de omgeving al bestaan`, sourceId: null, path: null });
  }
  const r = regelset.zaaktypelink;
  traceregels.push({ bronGE: null, regel: "Zaaktype (e-dienst) → plaatshouder voor de url in de omgeving", doelPad: "/zaakTypeUrl", actie: "aangemaakt" });
  traceregels.push({ bronGE: null, regel: "Zaken API-plugin: plaatshouder (omgeving)", doelPad: "/zakenApiPluginConfigurationId", actie: "aangemaakt" });
  traceregels.push({ bronGE: null, regel: "Zaak aanmaken bij het dossier (e-dienst)", doelPad: "/createWithDossier", actie: "aangemaakt" });
  traceregels.push({ bronGE: null, regel: "RSIN van de organisatie: plaatshouder (omgeving)", doelPad: "/rsin", actie: "aangemaakt" });
  return {
    zaakTypeUrl: r.zaakTypeUrl.replace("{zaaktype}", zaaktype || ""),
    zakenApiPluginConfigurationId: r.zakenApiPluginConfigurationId,
    createWithDossier: !!keuzes.zaakBijDossier,
    rsin: r.rsin,
  };
}

/**
 * @param {Object} invoer
 * @param {any} invoer.modelBestand          - het V3-bestand ({model_naam, model}) of het model zelf (voor de bronmodel-hash)
 * @param {any} invoer.edienst               - het e-dienst-inrichtingsmodel
 * @param {string} invoer.identifier         - identifier van het artefact in de e-dienst
 * @param {string} [invoer.soort]            - de soort, nodig omdat de dossierdelen dezelfde identifier dragen
 * @param {any} [invoer.objecttype]          - het objecttype-artefact (bron van de dossierinhoud; alleen nodig voor schema en formulier)
 * @param {Record<string, any>} [invoer.bpmnModellen] - BPMN-modellen per naam (`bron.model`); voor de dossierstatussen die de processen zetten
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
  bpmnModellen = {},
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
  if (ZONDER_INHOUD[keuzes.soort]) {
    payload = ZONDER_INHOUD[keuzes.soort]({ keuzes, edienst, model, bpmnModellen, regelset, diagnostics, traceregels });
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
        : keuzes.soort === "dossierwidgettabbladen"
          ? schrijfWidgettabbladen({ keuzes, edienst, inhoud, regelset, diagnostics, traceregels })
          : keuzes.soort === "dossierlijstkolommen"
            ? schrijfLijstkolommen({ keuzes, inhoud, regelset, diagnostics, traceregels })
            : schrijfFormulier({ keuzes, edienst, inhoud, regelset, diagnostics, traceregels });
  }

  const payloadHash = await jcsHash(payload, sha256Hex);
  const artefact = {
    artefactIdentificatie: {
      soort: keuzes.soort,
      identifier: keuzes.identifier,
      naam: keuzes.naam || keuzes.identifier,
      versienummer: versienummer || keuzes.versienummer || edienst?.edienst?.versienummer || "0.1.0",
      doelVersieRange: doelVersieRange(keuzes),
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
    afhankelijkheden: afhankelijkhedenVan(edienst, keuzes),
  };
  return { artefact, diagnostics };
}
