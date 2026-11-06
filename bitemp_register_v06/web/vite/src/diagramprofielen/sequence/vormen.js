// @ts-check
/**
 * sequence/vormen — de sequence-vormen als ShapeType (plan 2026-11-04 Eén tekenaar, stap 4):
 *
 *   - punt (occurrence): in documenten onzichtbaar (UML tekent hem niet; `opacity: 0`), op het
 *     canvas zichtbaar bij hover of selectie (diagramcore.css `.dc-seq-punt`);
 *   - activatie: smalle staande balk;
 *   - fragment: kader met de soort (alt/opt/loop/par) als chip linksboven, de naam ernaast;
 *   - levenslijn: gestippelde lijn met de kop erbovenop, haar activaties en een lengte die
 *     meegroeit met haar laagste punt — op het canvas, in documenten en op de server dezelfde
 *     renderer (sinds 05-11; daarvoor tekende het canvas hem met een eigen React-component).
 *     De kop is een rechthoek met de naam ("naam:Type" onderstreept bij `instantieVan`), een
 *     icoon-kop uit `KOP_ICONEN` met de naam eronder, of — is het type een element uit een
 *     ander profiel en is er geen kop gekozen — de vorm van dat type (een ArchiMate-
 *     applicatiecomponent als kop). De activaties leidt de renderer af uit de berichten
 *     (`activaties.js`) via `ctx.diagram` + `ctx.elementen`; het type komt van de host
 *     (`tekenaar/host.js`: `verwijzingLabel`, `verwijzingVorm`; op de server null: rechthoek
 *     met alleen de naam).
 *
 * Pure `.js`.
 */
import { registreerShapeType, registreerRenderer, vorm, tekenbareVorm } from "../../diagramcore/types/shapeType.js";
import { randRechthoek } from "../../diagramcore/tekenaar/bibliotheek.js";
import { tekstBreedte } from "../../diagramsvg/tekstmaat.js";
import { n3 } from "../../diagramcore/tekenaar/glyphs.js";
import { host } from "../../diagramcore/tekenaar/host.js";
import { bouwVoorkomen, tekenVoorkomen } from "../../diagramcore/tekenaar/voorkomen.js";
import { leidActivatiesAf } from "./activaties.js";
import { BERICHTEN } from "./labels.js";

const KOP_BREED = 148;
const LIJN_X = 7;

/** Punt: open ringetje, standaard onzichtbaar. */
const punt = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    return vorm("g", { opacity: 0 }, vorm("circle", { cx: w / 2, cy: h / 2, r: Math.min(w, h) / 2 - 0.8, fill: "none", stroke: ctx.thema.rand, "stroke-width": 1.6 }));
  },
  inhoudsvak: () => null,
  rand(ctx, hoek) {
    const { w, h } = ctx.maat;
    const r = Math.min(w, h) / 2;
    return { x: w / 2 + r * Math.cos((hoek * Math.PI) / 180), y: h / 2 + r * Math.sin((hoek * Math.PI) / 180) };
  },
};

/** Activatie (execution specification): smalle balk, lichte vulling. */
const activatie = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    return vorm("rect", { x: 0.75, y: 0.75, width: w - 1.5, height: h - 1.5, rx: 2, fill: ctx.parameters.vulling || "#e2e8f0", stroke: ctx.thema.rand, "stroke-width": 1.5 });
  },
  inhoudsvak: () => null,
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

const CHIP_H = 18;
const chipBreedte = (soort) => Math.ceil(tekstBreedte(soort, 11, { vet: true })) + 22;

/** Fragment: kader met de soort-chip (het afgeknipte vijfhoekje) linksboven; de naam ernaast. */
const fragment = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const soort = String(ctx.element?.data?.soort || "alt");
    const cw = chipBreedte(soort);
    return vorm(
      "g",
      {},
      vorm("rect", { x: 0.8, y: 0.8, width: w - 1.6, height: h - 1.6, rx: 3, fill: ctx.thema.rand, "fill-opacity": 0.06, stroke: ctx.thema.rand, "stroke-width": 1.6 }),
      vorm("polygon", { points: `0.8,0.8 ${n3(cw)},0.8 ${n3(cw)},${n3(CHIP_H * 0.55)} ${n3(cw - 6)},${CHIP_H} 0.8,${CHIP_H}`, fill: ctx.thema.surface, stroke: ctx.thema.rand, "stroke-width": 1.6, "stroke-linejoin": "round" }),
      vorm("text", { x: 8, y: 13.5, "font-size": 11, "font-weight": 700, fill: ctx.thema.inkt }, soort)
    );
  },
  inhoudsvak(ctx) {
    const cw = chipBreedte(String(ctx.element?.data?.soort || "alt"));
    return { x: cw - 2, y: -3, w: ctx.maat.w - cw, h: 24, uitlijning: "boven" };
  },
  kindervak: (ctx) => ({ x: 0, y: CHIP_H, w: ctx.maat.w, h: ctx.maat.h - CHIP_H }),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

/**
 * Icoon-koppen van de levenslijn (`data.kop`): actor (poppetje) en de robustness-stereotypes
 * van Jacobson — boundary (cirkel met staander links), control (cirkel met pijlpunt bovenop) en
 * entity (cirkel op een streep); de business-varianten dragen een schuine streep. Viewbox 48×40,
 * als gegevens: de tekenaar zet ze in de omtrek van de levenslijn.
 */
const ICOON_W = 48;
const ICOON_H = 40;
const KOP_ICONEN = {
  actor: (s, f) =>
    vorm(
      "g",
      { stroke: s, "stroke-width": 1.6, fill: "none", "stroke-linecap": "round" },
      vorm("circle", { cx: 24, cy: 7, r: 5.5, fill: f }),
      vorm("line", { x1: 24, y1: 12.5, x2: 24, y2: 26 }),
      vorm("line", { x1: 14, y1: 17, x2: 34, y2: 17 }),
      vorm("line", { x1: 24, y1: 26, x2: 16, y2: 38 }),
      vorm("line", { x1: 24, y1: 26, x2: 32, y2: 38 })
    ),
  boundary: (s, f) => vorm("g", { stroke: s, "stroke-width": 1.6 }, vorm("line", { x1: 7, y1: 8, x2: 7, y2: 32 }), vorm("line", { x1: 7, y1: 20, x2: 15, y2: 20 }), vorm("circle", { cx: 28, cy: 20, r: 13, fill: f })),
  control: (s, f) => vorm("g", { stroke: s, "stroke-width": 1.6 }, vorm("circle", { cx: 24, cy: 22, r: 13, fill: f }), vorm("polyline", { points: "28,4 23,9 28,14", fill: "none", "stroke-linejoin": "round" })),
  entity: (s, f) => vorm("g", { stroke: s, "stroke-width": 1.6 }, vorm("circle", { cx: 24, cy: 18, r: 13, fill: f }), vorm("line", { x1: 11, y1: 35, x2: 37, y2: 35 })),
};
// Business-varianten: hetzelfde icoon met een schuine streep door de cirkel.
const STREEP = { "business-boundary": [20, 31, 36, 9], "business-control": [16, 33, 32, 11], "business-entity": [16, 29, 32, 7] };
for (const [soort, [x1, y1, x2, y2]] of Object.entries(STREEP)) {
  const basis = KOP_ICONEN[soort.replace("business-", "")];
  KOP_ICONEN[soort] = (s, f) => vorm("g", {}, basis(s, f), vorm("line", { x1, y1, x2, y2, stroke: s, "stroke-width": 1.6 }));
}

/** Het icoon van een kop als VormBoom (48×40), of null als de kop de rechthoek is. */
export function kopIcoon(soort, { rand, vulling }) {
  const maak = KOP_ICONEN[soort];
  return maak ? maak(rand, vulling || "#e0f2fe") : null;
}

const LIJN_MIN_HOOGTE = 500;
const LIJN_MARGE = 120;
const PUNT = 12;
const BALK_BREED = 14;
const TYPEKOP_H = 52;
/** Vormen die als kop niets toevoegen of niet passen: dan de rechthoek met naam:Type. */
const GEEN_TYPEKOP = new Set(["class-box", "edge", "seq-levenslijn", "note"]);

/**
 * Lengte van de lijn: standaard ruim (500, zoals EA tot onderaan), en altijd tot onder haar
 * laagste punt — anders valt een bericht onder de lijn op het lege vlak (15-10). Alleen de
 * rand-elementen van deze lijn tellen (`data.randVan`, positie relatief aan de lijn).
 */
function lijnHoogte({ element, diagram, elementen }) {
  let laagste = 0;
  if (diagram && elementen && element?.id) {
    for (const n of diagram.nodes || []) {
      const kind = elementen[n?.elementId];
      if (kind?.data?.randVan !== element.id) continue;
      const onder = (n.position?.y ?? 0) + (n.size?.height ?? (kind.elementType === "activatie" ? 44 : PUNT));
      if (onder > laagste) laagste = onder;
    }
  }
  return Math.max(LIJN_MIN_HOOGTE, laagste + LIJN_MARGE);
}

/**
 * Activaties van één levenslijn, afgeleid uit de berichten (activaties.js): de punten op het
 * diagram geven per bericht de lijn en de hoogte; niets wordt opgeslagen, de balken volgen de
 * berichten. Geneste activaties (zelf-aanroep) schuiven per niveau 5 px naar rechts, zoals EA.
 * @returns {{top: number, hoogte: number, diepte: number}[]} top relatief aan de levenslijn
 */
export function activatiesVan({ element, diagram, elementen }) {
  if (!diagram || !elementen || !element?.id) return [];
  const nodes = diagram.nodes || [];
  const lijnY = new Map();
  for (const n of nodes) if (elementen[n?.elementId]?.elementType === "levenslijn") lijnY.set(n.elementId, n.position?.y ?? 0);
  if (!lijnY.has(element.id)) return [];
  /** punt → { lijn, y (absoluut, midden van het punt) } */
  const punten = new Map();
  for (const n of nodes) {
    const e = elementen[n?.elementId];
    if (e?.elementType !== "punt" || !lijnY.has(e.data?.randVan)) continue;
    punten.set(e.id, { lijn: e.data.randVan, y: lijnY.get(e.data.randVan) + (n.position?.y ?? 0) + PUNT / 2 });
  }
  if (!punten.size) return [];
  const berichten = [];
  for (const c of Object.values(elementen)) {
    if (!BERICHTEN.includes(c?.elementType)) continue;
    const a = punten.get(c.source);
    const b = punten.get(c.target);
    if (!a || !b) continue;
    berichten.push({ id: c.id, bron: a.lijn, doel: b.lijn, y: a.y, yEind: b.y, soort: c.elementType });
  }
  const mijnY = lijnY.get(element.id);
  return leidActivatiesAf(berichten)
    .filter((a) => a.lijn === element.id)
    .map((a) => ({ top: a.van - mijnY, hoogte: a.tot - a.van, diepte: a.diepte }));
}

/**
 * Welke kop: de vorm van het type (instantie van een element uit een ander profiel, geen kop
 * gekozen, en de host kent het), een icoon-kop, of de rechthoek. Een gekozen kop wint.
 */
function kopVan(element) {
  const d = element?.data || {};
  if (d.instantieVan && !d.kop) {
    const type = host().verwijzingVorm?.(d.instantieVan) || null;
    const et = type?.elementType;
    if (type?.element && et && !et.isConnector && !GEEN_TYPEKOP.has(et.shape)) {
      const info = tekenbareVorm(et.shape);
      if (info) return { soort: "type", type, info };
    }
  }
  return { soort: KOP_ICONEN[d.kop] ? "icoon" : "rechthoek" };
}

/**
 * `hooks.naamWeergave` van de levenslijn: zonder type de naam; met `instantieVan` de
 * UML-objectnotatie "naam:Type" onderstreept (onvindbaar type: naam + ⚠; zonder host, op de
 * server, alleen de naam); tekent de kop de vorm van het type, dan geen naamregel ("") — die
 * vorm draagt "naam:Type" zelf.
 */
export function levenslijnNaam(element, context = {}) {
  const ref = element?.data?.instantieVan;
  if (!ref) return element?.naam ? undefined : "(levenslijn)";
  if (kopVan(element).soort === "type") return "";
  const label = context.verwijzingLabel ? context.verwijzingLabel(ref) : null;
  const naam = element.naam || (label ? "" : "(levenslijn)");
  if (label) return { tekst: `${naam}:${label}`, onderstreept: true };
  return { tekst: context.verwijzingLabel ? `${naam} ⚠` : naam, onderstreept: true };
}

/** De vorm van het type als kop (148×52): zonder compartimenten, met naam:Type; via de tekenaar zelf. */
function typeKop(ctx, kop) {
  const { type, info } = kop;
  const naam = `${ctx.element?.naam || ""}:${type.element.naam || type.element.id}`;
  const box = bouwVoorkomen({
    element: { ...type.element, naam, compartimenten: [] },
    elementType: type.elementType,
    shapeType: info.shapeType,
    renderer: info.renderer,
    maat: { w: KOP_BREED, h: TYPEKOP_H },
    basis: ctx.thema,
    idPrefix: `${ctx.idPrefix}-kop`,
  });
  const { omtrek, inhoud, ornament } = tekenVoorkomen(box);
  return vorm("g", { transform: `translate(${LIJN_X - KOP_BREED / 2} 0)` }, omtrek, inhoud, ornament);
}

/** Hoogte van de kop: de vorm van het type, het icoon met de naam eronder, of de rechthoek om de naam. */
function kopHoogte(ctx, soort) {
  if (soort === "type") return TYPEKOP_H;
  const naamH = ctx.inhoud?.h ?? 26;
  return soort === "icoon" ? ICOON_H + 2 + naamH + 2 : Math.max(30, naamH + 4);
}

/**
 * Levenslijn: gestippelde lijn met de kop (148 breed) erbovenop en haar afgeleide activaties.
 * De node blijft 14 breed, hoe lang de naam ook is (de kop steekt uit); daarom bepaalt `maat` de
 * doos en meet de motor de naam op de kopbreedte (`factorW` = 148/14). `ondergrens` houdt de
 * lijn ook bij een bewaarde maat tot onder haar laagste punt. `leestDiagram`: het canvas geeft
 * deze renderer het levende diagram (posities tijdens slepen) en de elementen mee.
 */
const levenslijn = {
  leestDiagram: true,
  maat: (p) => ({ w: 14, h: lijnHoogte(p) }),
  ondergrens: (p) => ({ h: lijnHoogte(p) }),
  // Nooit breder dan de lijn zelf: een bewaarde breedte (de MCP en imports schreven 160) zou de
  // lijn links in een onzichtbaar kader zetten, met de berichten aan de randen van dat kader.
  bovengrens: () => ({ w: 14 }),
  omtrek(ctx) {
    const { h } = ctx.maat;
    const kop = kopVan(ctx.element);
    let kopVorm = null;
    let soort = kop.soort;
    if (soort === "type") {
      // Valt de vreemde vorm buiten zijn eigen profiel om, dan de gewone rechthoek.
      try {
        kopVorm = typeKop(ctx, kop);
      } catch {
        soort = "rechthoek";
      }
    }
    const kopH = kopHoogte(ctx, soort);
    if (soort === "icoon") kopVorm = vorm("g", { transform: `translate(${LIJN_X - ICOON_W / 2} 0)` }, kopIcoon(ctx.element?.data?.kop, { rand: ctx.thema.rand, vulling: ctx.stijl?.kleur }));
    else if (soort === "rechthoek") kopVorm = vorm("rect", { x: LIJN_X - KOP_BREED / 2, y: 0.8, width: KOP_BREED, height: kopH - 1.6, rx: 4, fill: ctx.thema.vulling, stroke: ctx.thema.rand, "stroke-width": 1.6 });
    const lijn = vorm("line", { x1: LIJN_X, y1: kopH, x2: LIJN_X, y2: h, stroke: ctx.thema.rand, "stroke-width": 1.4, "stroke-dasharray": "6 4" });
    const balken = activatiesVan(ctx).map((a) =>
      vorm("rect", { class: "dc-seq-activatie", "data-diepte": a.diepte, x: a.diepte * 5 + 0.75, y: n3(a.top), width: BALK_BREED - 1.5, height: n3(Math.max(1, a.hoogte)), rx: 2, fill: "#e2e8f0", stroke: ctx.thema.rand, "stroke-width": 1.5 })
    );
    return vorm("g", {}, lijn, balken, kopVorm);
  },
  inhoudsvak(ctx) {
    const soort = kopVan(ctx.element).soort;
    const kopH = kopHoogte(ctx, soort);
    if (soort === "icoon") return { x: LIJN_X - KOP_BREED / 2, y: ICOON_H + 2, w: KOP_BREED, h: kopH - ICOON_H - 2, uitlijning: "boven" };
    return { x: LIJN_X - KOP_BREED / 2, y: 0, w: KOP_BREED, h: kopH, uitlijning: "midden" };
  },
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

registreerRenderer("seq-punt", punt);
registreerRenderer("seq-activatie", activatie);
registreerRenderer("seq-fragment", fragment);
registreerRenderer("seq-levenslijn", levenslijn);

/** @type {import("../../diagramcore/types/schema.js").ShapeType[]} */
export const SEQUENCE_SHAPETYPES = [
  { id: "seq-punt", renderer: "seq-punt", parameters: { inhoud: "geen", klasse: "dc-seq-punt" }, minMaat: { w: 12, h: 12 } },
  { id: "seq-activatie", renderer: "seq-activatie", parameters: { inhoud: "geen", klasse: "dc-punt-node" }, minMaat: { w: 14, h: 44 } },
  { id: "seq-fragment", renderer: "seq-fragment", parameters: { inhoud: "naam", naamGrootte: 11, tekstAnker: "links", kleurAls: "rand" }, minMaat: { w: 260, h: 160 } },
  { id: "seq-levenslijn", renderer: "seq-levenslijn", parameters: { inhoud: "naam", naamGrootte: 12, factorW: KOP_BREED / 14, vulling: "#f8fafc" }, minMaat: { w: 14, h: 200 } },
];

for (const st of SEQUENCE_SHAPETYPES) registreerShapeType(st);
