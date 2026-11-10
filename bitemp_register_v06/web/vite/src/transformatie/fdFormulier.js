// @ts-check
/**
 * fdFormulier — de vorm van een e-dienstformulier als Omnium FormulierDefinitie (FD).
 * Besluit Mark 10-11 (werkplaats-plan §5.11): de stappen en vragen staan niet meer in de
 * e-dienst-JSON (`formulier.stappen`) maar in een FD in het Studio-project (profiel
 * `formulier`), die de werkplaats per veld bewerkt. Zie docs/TRANSFORMATIES.md §11.19 en
 * docs/FORMULIERDEFINITIES.md §2.6.
 *
 *   FD (layout_json) ── fdNaarStappen ──▶ formulier.stappen ── formulierGraaf … ▶ Open Formulieren / neutraal
 *   formulier.stappen ── stappenNaarFd ──▶ FD                 (eenmalige omzetting, en de toets)
 *
 * Beide richtingen zijn puur; de aanroeper lost `invoegen` vooraf op (shared/formulierInvoegen.js,
 * dezelfde regels als renderer en preview) en geeft het canonieke model mee om elementId's
 * (Studio-id's) naar naampaden te vertalen. Een vraag wijst naar het model met `elementId`
 * (het gegevenselement) + de veldnaam; het veldpad (`ENT.rol.veld`) is leesbaarheid.
 *
 * Wat in de FD staat: stappen (key, label), per vraag key, label, beschrijving (hulptekst),
 * verplicht, voorwaarde (conditioneel, op "=="), vorm (bestand, tekstvak, …). Wat in de e-dienst
 * blijft (instellingen van het doel, Open Formulieren): naam, inloggen, registratie.
 */

/** Vorm in de FD ↔ component in de e-dienst (alleen waar de e-dienst een vorm noemt). */
const VORM_NAAR_COMPONENT = { bestand: "file", "text-area": "textarea", "radio-group": "radio", combobox: "select" };
const COMPONENT_NAAR_VORM = Object.fromEntries(Object.entries(VORM_NAAR_COMPONENT).map(([v, c]) => [c, v]));

const naamVan = (el) => el?.naam || el?.data?.naam || el?.data?.typenaam || el?.id || "";
// JSON-rolnaam = meervoud van het GE, anders lower(naam)+"s" (zoals codegen; BACKEND 10-11).
const meervoudVan = (el) => el?.data?.meervoud || el?.data?.bron?.meervoud || `${naamVan(el).toLowerCase()}s`;

/** Studio-id → {eigenaar, element} voor GE's, relaties en entiteiten van het canonieke model. */
function modelIndex(core) {
  const els = Object.values(core?.elements || {}).filter(Boolean);
  const byId = new Map(els.map((e) => [e.id, e]));
  const ouder = new Map();
  /** GE-id → momentvoorkomen: dat staat op de compositie (entiteit → GE), niet op het GE. */
  const moment = new Map();
  for (const c of els) {
    if (c.elementType !== "compositie" || !c.source || !c.target) continue;
    ouder.set(c.target, c.source);
    if (c.data?.momentvoorkomen) moment.set(c.target, c.data.momentvoorkomen);
  }
  const eigenaarVan = (el) => byId.get(el.elementType === "relatie" ? el.source : ouder.get(el.id)) || null;
  const meervoudig = (el) => (moment.get(el?.id) || el?.data?.momentvoorkomen || el?.data?.bron?.momentvoorkomen) === "meervoudig";
  return { byId, eigenaarVan, meervoudig };
}

/** Naampad zoals de e-dienst het schrijft: Eigenaar.GE.veld, of Entiteit.veld. */
function naampad(idx, elementId, veld) {
  const el = idx.byId.get(elementId);
  if (!el) return null;
  if (el.elementType === "entiteit") return `${naamVan(el)}.${veld}`;
  const eig = idx.eigenaarVan(el);
  return eig ? `${naamVan(eig)}.${naamVan(el)}.${veld}` : `${naamVan(el)}.${veld}`;
}

const laatste = (pad) => String(pad || "").split(".").pop();
const kinderen = (el) => (el?.type === "conditioneel" ? el.dan : el?.elementen) || [];

/**
 * FD-layout → `stappen` van het e-dienstformulier.
 * @param {any} layout  opgeloste layout (geen `invoegen` meer), wortel {type:"formulier"}
 * @param {{core: any, meta?: any}} invoer  core = canoniek model (Studio-elementen)
 * @returns {{stappen: any[], diagnostics: any[]}}
 */
export function fdNaarStappen(layout, { core, meta = {} }) {
  const diagnostics = [];
  const meld = (severity, code, message, sourceId = null) => diagnostics.push({ severity, code, message, sourceId, path: null });
  const idx = modelIndex(core);
  if (layout?.type !== "formulier") throw new Error("FD: de wortel is geen formulier");
  const wortel = kinderen(layout);
  if (wortel.some((k) => k?.type === "invoegen") ) throw new Error("FD: los `invoegen` eerst op (losInvoegingenOp)");
  const stappenEl = wortel.filter((k) => k?.type === "stap");
  if (stappenEl.length && stappenEl.length !== wortel.length) meld("error", "FD-STAP", "Een formulier met stappen heeft alleen stappen onder de wortel");
  const stappenIn = stappenEl.length ? stappenEl : [{ type: "stap", key: meta.code || "formulier", label: meta.naam || "Formulier", elementen: wortel }];

  // Eerst alle vragen, zodat een voorwaarde naar de key van een andere vraag kan wijzen.
  /** veldpad of elementId|veld → key */
  const keyVan = new Map();
  const vragen = []; // {stapIndex, veld, toonAls}
  const loop = (el, stapIndex, toonAls, lijst) => {
    if (!el) return;
    if (el.type === "veld") {
      if (lijst && el.vasteWaarde !== undefined) return; // vaste rij-waarde: die zet de registratie (e-dienst)
      if (el.vasteWaarde !== undefined) return meld("warning", "FD-VAST", `Vaste waarde op ${el.veld} hoort in de registratie van de e-dienst; overgeslagen`, el.veld);
      const veldnaam = laatste(el.veld);
      const pad = el.elementId ? naampad(idx, el.elementId, veldnaam) : null;
      if (!pad) meld(el.elementId ? "error" : "warning", "FD-ELEMENT", el.elementId ? `elementId ${el.elementId} staat niet in het model` : `Vraag ${el.key || el.veld} heeft geen elementId; het veldpad wordt gebruikt`, el.veld);
      const key = el.key || veldnaam;
      keyVan.set(el.veld, key);
      if (el.elementId) keyVan.set(`${el.elementId}|${veldnaam}`, key);
      vragen.push({ stapIndex, el, pad: pad || el.veld, key, toonAls });
      return;
    }
    if (el.type === "conditioneel") {
      const c = el.conditie || {};
      if (c.op !== "==") meld("warning", "FD-CONDITIE", `Voorwaarde met "${c.op}" kent het e-dienstformulier nog niet; alleen "==" (de vragen staan er zonder voorwaarde)`, c.veld);
      const nieuw = c.op === "==" ? { veld: c.veld, waarde: c.waarde } : toonAls;
      for (const k of kinderen(el)) loop(k, stapIndex, nieuw, lijst);
      return;
    }
    if (el.type === "lijst") {
      const max = Number(el.max);
      if (!(max === 1)) meld("warning", "FD-LIJST", `Lijst ${el.bron}: een herhaalbare groep kent het e-dienstformulier nog niet; alleen de eerste rij komt in het formulier`, el.bron);
      for (const k of kinderen(el)) loop(k, stapIndex, toonAls, el);
      return;
    }
    if (el.type === "groep" || el.type === "rij") {
      for (const k of kinderen(el)) loop(k, stapIndex, toonAls, lijst);
      return;
    }
    meld("warning", "FD-ELEMENT", `Element "${el.type}" kent het e-dienstformulier niet; overgeslagen`);
  };
  stappenIn.forEach((s, i) => kinderen(s).forEach((k) => loop(k, i, null, null)));

  const stappen = stappenIn.map((s) => ({ naam: s.label || s.key, slug: s.key || s.label, velden: [] }));
  for (const { stapIndex, el, pad, key, toonAls } of vragen) {
    const v = { veld: pad, key, label: el.label || laatste(el.veld) };
    if (el.beschrijving) v.toelichting = el.beschrijving;
    if (el.verplicht === true) v.verplicht = true;
    if (toonAls) {
      const doel = keyVan.get(toonAls.veld) || laatste(toonAls.veld);
      v.toonAls = { [doel]: toonAls.waarde };
    }
    const component = el.vorm ? VORM_NAAR_COMPONENT[el.vorm] : null;
    if (el.vorm && !component) meld("info", "FD-VORM", `Vorm "${el.vorm}" geeft in Open Formulieren de standaardvorm`, key);
    if (component) v.component = component;
    if (el.vorm === "bestand") {
      const c = el.vormConfig || {};
      const bestand = {};
      if (Array.isArray(c.accept) && c.accept.length) bestand.typen = c.accept;
      if (c.resizeTo) bestand.verkleinTot = { breedte: c.resizeTo.width, hoogte: c.resizeTo.height };
      if (c.documentTitle) bestand.registratie = { titel: c.documentTitle };
      if (Object.keys(bestand).length) v.bestand = bestand;
    }
    stappen[stapIndex].velden.push(v);
  }
  return { stappen, diagnostics };
}

/**
 * `stappen` van het e-dienstformulier → FD-layout (eenmalige omzetting, en de toets dat de weg
 * terug hetzelfde geeft). Een vraag op een meervoudig GE wordt een lijst met één rij, met de
 * vaste waarden van de registratie op dat GE als vaste rij-waarden (zo wijst de FD de bijlage
 * "pasfoto" aan).
 * @param {any} keuzes   het formulier in de e-dienst
 * @param {{core: any, studioIds: Map<string, string>, doeltype?: string}} invoer
 * @returns {{layout: any, meta: any, diagnostics: any[]}}
 */
export function stappenNaarFd(keuzes, { core, studioIds, doeltype = keuzes.bron }) {
  const diagnostics = [];
  const idx = modelIndex(core);
  const vind = (pad) => {
    const delen = String(pad).split(".");
    for (let i = 0; i < delen.length - 1; i += 1) {
      const id = studioIds.get(delen.slice(i, -1).join("."));
      if (id) return id;
    }
    return null;
  };
  const vast = keuzes.registratie?.vasteWaarden || {};
  // Veldpad ENT.rol.veld: een geërfd GE staat onder zijn eigenaar (Aanvraag.aanvraagbijlagen.documentUrl),
  // niet onder het subtype; zo heet het in het register (BACKEND 10-11). Alleen leesbaarheid: de
  // identiteit is elementId.
  const eigenaarNaam = (el) => naamVan(idx.eigenaarVan(el)) || doeltype;
  const veldpadVan = (el, veld) => (el && el.elementType !== "entiteit" ? `${eigenaarNaam(el)}.${meervoudVan(el)}.${veld}` : `${el ? naamVan(el) : doeltype}.${veld}`);
  const keyPad = new Map(); // key → veldpad, voor voorwaarden
  const veldEl = (v, elementId, el, relatief) => {
    const veldnaam = laatste(v.veld);
    const uit = { type: "veld", veld: relatief ? veldnaam : veldpadVan(el, veldnaam), key: v.key };
    if (v.label) uit.label = v.label;
    if (v.toelichting) uit.beschrijving = v.toelichting;
    if (v.verplicht === true) uit.verplicht = true;
    if (elementId) uit.elementId = elementId;
    else diagnostics.push({ severity: "warning", code: "FD-ELEMENT", message: `Geen modelelement voor ${v.veld}`, sourceId: v.veld, path: null });
    const vorm = v.component ? COMPONENT_NAAR_VORM[v.component] : null;
    if (vorm) uit.vorm = vorm;
    if (vorm === "bestand" && v.bestand) {
      const c = {};
      if (v.bestand.typen) c.accept = v.bestand.typen;
      if (v.bestand.verkleinTot) c.resizeTo = { width: v.bestand.verkleinTot.breedte, height: v.bestand.verkleinTot.hoogte };
      if (v.bestand.registratie?.titel) c.documentTitle = v.bestand.registratie.titel;
      if (Object.keys(c).length) uit.vormConfig = c;
    }
    keyPad.set(v.key, relatief ? veldpadVan(el, veldnaam) : uit.veld);
    return uit;
  };
  const stappen = (keuzes.stappen || []).map((s) => {
    const elementen = [];
    for (const v of s.velden || []) {
      const elementId = vind(v.veld);
      const el = elementId ? idx.byId.get(elementId) : null;
      const meervoudig = idx.meervoudig(el);
      let blok;
      if (meervoudig && el) {
        const ge = v.veld.split(".").slice(0, -1).join(".");
        const vasteRij = Object.entries(vast).filter(([p]) => p.startsWith(`${ge}.`) && p.split(".").length === ge.split(".").length + 1)
          .map(([p, w]) => ({ type: "veld", veld: laatste(p), vasteWaarde: w }));
        blok = { type: "lijst", bron: `${eigenaarNaam(el)}.${meervoudVan(el)}`, min: 1, max: 1, elementen: [...vasteRij, veldEl(v, elementId, el, true)] };
      } else blok = veldEl(v, elementId, el, false);
      const [[k, w] = []] = Object.entries(v.toonAls || {});
      const vorige = elementen[elementen.length - 1];
      if (k === undefined) elementen.push(blok);
      else if (vorige?.type === "conditioneel" && vorige._key === k && vorige.conditie.waarde === w) vorige.dan.push(blok);
      else elementen.push({ type: "conditioneel", _key: k, conditie: { veld: k, op: "==", waarde: w }, dan: [blok] });
    }
    return { type: "stap", key: s.slug, label: s.naam, elementen };
  });
  // Voorwaarden wijzen naar het veldpad van de vraag met die key.
  for (const s of stappen) for (const e of s.elementen) if (e.type === "conditioneel") {
    e.conditie.veld = keyPad.get(e._key) || e._key;
    delete e._key;
  }
  const layout = { type: "formulier", elementen: stappen };
  const meta = { naam: keuzes.naam, code: keuzes.identifier, doeltype };
  return { layout, meta, diagnostics };
}

/**
 * Vervang in de e-dienst de stappen van elk formulier dat naar een FD wijst
 * (`formulierDefinitie: {code}`) door die uit de FD. De rest van de e-dienst blijft.
 * @param {any} edienst
 * @param {Record<string, {layout: any, meta: any}>} fds  code → opgeloste FD
 * @param {any} core
 * @returns {{edienst: any, diagnostics: any[]}}
 */
export function pasFormulierDefinitiesToe(edienst, fds, core) {
  const diagnostics = [];
  const artefacten = (edienst?.artefacten || []).map((a) => {
    const code = a.soort === "formulier" ? a.formulierDefinitie?.code : null;
    if (!code) return a;
    const fd = fds[code];
    if (!fd) {
      diagnostics.push({ severity: "error", code: "FD-ONTBREEKT", message: `FormulierDefinitie "${code}" staat niet in het project`, sourceId: a.identifier, path: null });
      return a;
    }
    const r = fdNaarStappen(fd.layout, { core, meta: fd.meta });
    diagnostics.push(...r.diagnostics.map((d) => ({ ...d, sourceId: d.sourceId ? `${a.identifier}: ${d.sourceId}` : a.identifier })));
    const { formulierDefinitie, ...rest } = a;
    return { ...rest, stappen: r.stappen };
  });
  return { edienst: { ...edienst, artefacten }, diagnostics };
}

/**
 * De FD's in het Studio-profiel `formulierdiagram` (diagramtype formulier) van een project, per code. Een profiel kan meer
 * formulieren bevatten: per formulier-element de deelboom via `bevat`. `naarLayout` is
 * formulierModelNaarLayout uit diagramprofielen/formulier/adapter.js (meegegeven, zodat dit
 * puur blijft); `invoegen` lost de aanroeper daarna op.
 * @param {{elements?: Record<string, any>}} profiel
 * @param {(core: any) => {layout: any, meta: any}} naarLayout
 * @returns {Record<string, {layout: any, meta: any, elementId: string}>}
 */
export function fdsUitProfiel(profiel, naarLayout) {
  const elements = profiel?.elements || {};
  const kinderenVan = new Map();
  for (const e of Object.values(elements)) {
    if (e?.elementType !== "bevat" || !e.source || !e.target) continue;
    if (!kinderenVan.has(e.source)) kinderenVan.set(e.source, []);
    kinderenVan.get(e.source).push(e);
  }
  const uit = {};
  for (const wortel of Object.values(elements).filter((e) => e?.elementType === "formulier")) {
    const deel = {};
    const loop = (id) => {
      if (deel[id] || !elements[id]) return;
      deel[id] = elements[id];
      for (const b of kinderenVan.get(id) || []) {
        deel[b.id] = b;
        loop(b.target);
      }
    };
    loop(wortel.id);
    const { layout, meta } = naarLayout({ elements: deel });
    const code = meta?.code || wortel.data?.code;
    if (code) uit[code] = { layout, meta, elementId: wortel.id };
  }
  return uit;
}
