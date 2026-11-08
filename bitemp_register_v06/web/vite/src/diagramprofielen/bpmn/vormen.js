// @ts-check
/**
 * bpmn/vormen — de BPMN-vormen als ShapeType (plan 2026-11-04 Eén tekenaar, stap 4). Eigen
 * renderers waar de vorm van het element of het type afhangt (event-ring en -icoon, gateway-
 * symbool, taaktype-icoon, subproces-markering, data-object/-store met de naam eronder, pool met
 * staande naamband); de lane op de bibliotheek-`kader`. Pure `.js`.
 */
import { registreerShapeType, registreerRenderer, vorm } from "../../diagramcore/types/shapeType.js";
import { randRechthoek, randCirkel, geschaald } from "../../diagramcore/tekenaar/bibliotheek.js";
import { n3 } from "../../diagramcore/tekenaar/glyphs.js";
import { veiligeKleur } from "../../diagramsvg/thema.js";

/** Iconen óp een lichte taakvulling blijven donker, ook in donker thema. */
const INKT = "#334155";
const graden = (hoek) => (hoek * Math.PI) / 180;

// ── Events ───────────────────────────────────────────────────────────────────────────────────────
/** Soort-icoontje ín een event (viewBox 20, kleur = ringkleur). */
const lijn = (k, extra = {}) => ({ stroke: k, "stroke-width": 1.4, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round", ...extra });
const EVENT_ICONEN = {
  bericht: (k) => [vorm("rect", { x: 5, y: 6.5, width: 10, height: 7, rx: 0.8, ...lijn(k) }), vorm("path", { d: "M5 7 L10 10.5 L15 7", ...lijn(k) })],
  timer: (k) => [vorm("circle", { cx: 10, cy: 10, r: 4.6, ...lijn(k) }), vorm("path", { d: "M10 7.2 V10 L12 11.6", ...lijn(k) })],
  fout: (k) => [vorm("path", { d: "M7 14 L9.2 8.5 L11 11.5 L13.2 6", ...lijn(k) })],
  signaal: (k) => [vorm("path", { d: "M10 6.2 L14 13.4 H6 Z", ...lijn(k) })],
  escalatie: (k) => [vorm("path", { d: "M10 5.5 L14 13.5 L10 10.5 L6 13.5 Z", ...lijn(k) })],
  compensatie: (k) => [vorm("path", { d: "M10 10 L14 6.5 V13.5 Z M6 10 L10 6.5 V13.5 Z", ...lijn(k) })],
  conditioneel: (k) => [vorm("rect", { x: 6, y: 5.5, width: 8, height: 9, rx: 0.6, ...lijn(k) }), vorm("path", { d: "M7.5 8 H12.5 M7.5 10 H12.5 M7.5 12 H12.5", ...lijn(k) })],
  link: (k) => [vorm("path", { d: "M5.5 8 H10.5 V5.5 L14.5 10 L10.5 14.5 V12 H5.5 Z", ...lijn(k) })],
  annulering: (k) => [vorm("path", { d: "M6.5 6.5 L13.5 13.5 M13.5 6.5 L6.5 13.5", ...lijn(k, { "stroke-width": 1.8 }) })],
  terminate: (k) => [vorm("circle", { cx: 10, cy: 10, r: 4.2, fill: k, stroke: "none" })],
};

/**
 * Event-ring: dun (start), dubbel (tussen, boundary), dik (eind); gestippeld als niet-
 * onderbrekend; het soort-icoon erin. Vult de maat (EA-import: 45px), anders 30 (boundary 26).
 */
const event = {
  omtrek(ctx) {
    const id = ctx.elementType?.id || "";
    const dubbel = id === "tussen-event" || id === "boundary-event";
    const dik = id === "eind-event";
    const stippel = ctx.element?.data?.onderbrekend === false ? { "stroke-dasharray": "3 2.4" } : {};
    const k = ctx.thema.rand;
    const kinderen = [vorm("circle", { cx: 10, cy: 10, r: 9, fill: ctx.thema.vulling, stroke: k, "stroke-width": dik ? 2.6 : 1.3, ...stippel })];
    if (dubbel) kinderen.push(vorm("circle", { cx: 10, cy: 10, r: 7.1, fill: "none", stroke: k, "stroke-width": 1.1, ...stippel }));
    const icoon = EVENT_ICONEN[ctx.element?.data?.soort];
    if (icoon) kinderen.push(...icoon(k));
    return geschaald(ctx, 20, kinderen);
  },
  maat: ({ elementType }) => (elementType?.id === "boundary-event" ? { w: 26, h: 26 } : { w: 30, h: 30 }),
  inhoudsvak: () => null,
  rand: randCirkel,
};

// ── Gateways ─────────────────────────────────────────────────────────────────────────────────────
/** Ruit met het symbool van het type: × + ○ ✱ en de event-gateway (ring met vijfhoek). */
const gateway = {
  omtrek(ctx) {
    const k = ctx.thema.rand;
    const sym = { stroke: k, "stroke-width": 1.7, fill: "none", "stroke-linecap": "round" };
    const kinderen = [vorm("path", { d: "M17 2 L32 17 L17 32 L2 17 Z", fill: ctx.thema.vulling, stroke: k, "stroke-width": 1.5, "stroke-linejoin": "round" })];
    switch (ctx.elementType?.id) {
      case "exclusief": kinderen.push(vorm("path", { ...sym, d: "M12.5 12.5 L21.5 21.5 M21.5 12.5 L12.5 21.5" })); break;
      case "parallel": kinderen.push(vorm("path", { ...sym, d: "M17 10.5 V23.5 M10.5 17 H23.5" })); break;
      case "inclusief": kinderen.push(vorm("circle", { ...sym, cx: 17, cy: 17, r: 5.6 })); break;
      case "complex": kinderen.push(vorm("path", { ...sym, d: "M17 10.5 V23.5 M10.5 17 H23.5 M12.4 12.4 L21.6 21.6 M21.6 12.4 L12.4 21.6" })); break;
      case "event-gateway":
        kinderen.push(vorm("circle", { ...sym, "stroke-width": 1.2, cx: 17, cy: 17, r: 6.6 }));
        kinderen.push(vorm("path", { ...sym, "stroke-width": 1.2, "stroke-linejoin": "round", d: "M17 12.6 L21.1 15.6 L19.5 20.4 H14.5 L12.9 15.6 Z" }));
        break;
      default: break;
    }
    return geschaald(ctx, 34, kinderen);
  },
  inhoudsvak: () => null,
  rand(ctx, hoek) {
    const { w, h } = ctx.maat;
    const dx = Math.cos(graden(hoek));
    const dy = Math.sin(graden(hoek));
    const s = 1 / (Math.abs(dx) / (w / 2) + Math.abs(dy) / (h / 2) || 1);
    return { x: w / 2 + dx * s, y: h / 2 + dy * s };
  },
};

// ── Taak en subproces ────────────────────────────────────────────────────────────────────────────
/** Taaktype-icoontje linksboven (BPMN 2.0 §10.3; viewBox 16). `vlak` = de taakvulling (open vlakken). */
const TAAK_ICONEN = {
  user: (k) => [vorm("circle", { cx: 8, cy: 5, r: 2.6, ...lijn(k, { "stroke-width": 1.2 }) }), vorm("path", { d: "M2.8 14 C3.3 10.6 5.3 9.2 8 9.2 C10.7 9.2 12.7 10.6 13.2 14", ...lijn(k, { "stroke-width": 1.2 }) })],
  service: (k) => [vorm("circle", { cx: 8, cy: 8, r: 2.2, ...lijn(k, { "stroke-width": 1.2 }) }), vorm("path", { d: "M8 2.2 V4 M8 12 V13.8 M2.2 8 H4 M12 8 H13.8 M3.9 3.9 L5.2 5.2 M10.8 10.8 L12.1 12.1 M12.1 3.9 L10.8 5.2 M5.2 10.8 L3.9 12.1", ...lijn(k, { "stroke-width": 1.2 }) })],
  send: (k, vlak) => [vorm("rect", { x: 2, y: 4, width: 12, height: 8.5, rx: 0.8, fill: k, stroke: k, "stroke-width": 1.2 }), vorm("path", { d: "M2 4.5 L8 9 L14 4.5", ...lijn(vlak, { "stroke-width": 1.2 }) })],
  receive: (k) => [vorm("rect", { x: 2, y: 4, width: 12, height: 8.5, rx: 0.8, ...lijn(k, { "stroke-width": 1.2 }) }), vorm("path", { d: "M2 4.5 L8 9 L14 4.5", ...lijn(k, { "stroke-width": 1.2 }) })],
  manual: (k) => [vorm("path", { d: "M3 9.5 V6.5 C3 5.5 4.4 5.5 4.4 6.5 V5 C4.4 4 5.8 4 5.8 5 V4.5 C5.8 3.5 7.2 3.5 7.2 4.5 V5.5 C7.2 4.5 8.6 4.5 8.6 5.5 V10 L10.5 8 C11.3 7.2 12.4 8.2 11.6 9 L8.8 12.8 C8.2 13.6 7.4 14 6.2 14 H5.6 C4 14 3 13 3 11.4 Z", ...lijn(k, { "stroke-width": 1.2 }) })],
  script: (k) => [vorm("path", { d: "M11 2.5 C8.5 2.5 9 5 7 5.5 C5 6 5.5 8 7.5 8.5 C9.5 9 9 11 7 11.5 C5 12 5.5 13.5 3 13.5 M5.5 2.5 H11 M3.5 13.5 H9", ...lijn(k, { "stroke-width": 1.2 }) })],
  businessRule: (k) => [vorm("rect", { x: 2, y: 3.5, width: 12, height: 9, ...lijn(k, { "stroke-width": 1.2 }) }), vorm("path", { d: "M2 6.5 H14 M2 9.5 H14 M6 6.5 V12.5", ...lijn(k, { "stroke-width": 1.2 }) }), vorm("rect", { x: 2, y: 3.5, width: 12, height: 3, fill: k, stroke: "none" })],
};

/** Rand van taak/subproces; `dik` = de call activity (BPMN 2.0 §10.3.6: een dikke rand). */
const afgerondeRechthoek = (ctx, dik = false) => {
  const { w, h } = ctx.maat;
  const s = dik ? 4 : 2;
  return vorm("rect", { x: s / 2, y: s / 2, width: w - s, height: h - s, rx: 10, fill: ctx.thema.vulling, stroke: ctx.thema.rand, "stroke-width": s });
};
/** ⊞ onderaan in het midden: samengevouwen subproces, of een call activity die een proces aanroept. */
const plusMarkering = (ctx) => {
  const { w, h } = ctx.maat;
  return vorm(
    "g",
    { class: "dc-subproces-markering", transform: `translate(${n3(w / 2 - 6)} ${n3(h - 14)})` },
    vorm("rect", { x: 0.8, y: 0.8, width: 10.4, height: 10.4, rx: 1.5, fill: "none", stroke: INKT, "stroke-width": 1.1 }),
    vorm("path", { d: "M6 3.2 V8.8 M3.2 6 H8.8", stroke: INKT, "stroke-width": 1.1, "stroke-linecap": "round", fill: "none" })
  );
};
/** Een taak met een aangeroepen proces is een call activity. */
const isCallActivity = (ctx) => !!String(ctx.element?.data?.aangeroepenProces || "").trim();

/**
 * Taak: afgeronde rechthoek, naam gecentreerd, taaktype-icoon linksboven (`data.taakSoort`).
 * Met `data.aangeroepenProces` een call activity: dikke rand en ⊞ onderaan (FUNDAMENT 08-11).
 */
const taak = {
  omtrek: (ctx) => afgerondeRechthoek(ctx, isCallActivity(ctx)),
  inhoudsvak(ctx) {
    const icoon = !!TAAK_ICONEN[ctx.element?.data?.taakSoort];
    const onder = isCallActivity(ctx) ? 10 : 0;
    return { x: 0, y: icoon ? 10 : 0, w: ctx.maat.w, h: ctx.maat.h - (icoon ? 10 : 0) - onder, uitlijning: "midden" };
  },
  kindervak: (ctx) => ({ x: 0, y: 0, w: ctx.maat.w, h: ctx.maat.h }),
  ornament(ctx) {
    const teken = TAAK_ICONEN[ctx.element?.data?.taakSoort];
    const icoon = teken ? vorm("g", { class: "dc-taak-icoon", transform: "translate(6 4)" }, ...teken(INKT, ctx.thema.vulling)) : null;
    if (!isCallActivity(ctx)) return icoon;
    return icoon ? vorm("g", {}, icoon, plusMarkering(ctx)) : plusMarkering(ctx);
  },
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

/** Subproces: taak-rechthoek met ⊞ onderaan; uitgeklapt (`data.uitgeklapt`) de naam linksboven. */
const subproces = {
  omtrek: (ctx) => afgerondeRechthoek(ctx),
  inhoudsvak(ctx) {
    const { w, h } = ctx.maat;
    return ctx.element?.data?.uitgeklapt ? { x: 0, y: 0, w, h: 26, uitlijning: "boven", tekstAnker: "links" } : { x: 0, y: 0, w, h: h - 10, uitlijning: "midden" };
  },
  kindervak: (ctx) => ({ x: 0, y: 26, w: ctx.maat.w, h: ctx.maat.h - 26 }),
  ornament: plusMarkering,
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

// ── Data ─────────────────────────────────────────────────────────────────────────────────────────
const FIGUUR_H = 38;
/** Figuur (breedte `fw`) bovenaan gecentreerd, de naam eronder binnen de doos. */
const figuurMetNaam = (fw, teken) => ({
  omtrek(ctx) {
    return vorm("g", { transform: `translate(${n3((ctx.maat.w - fw) / 2)} 0)` }, ...teken(ctx));
  },
  inhoudsvak: (ctx) => ({ x: 0, y: FIGUUR_H - 2, w: ctx.maat.w, h: ctx.maat.h - FIGUUR_H + 2, uitlijning: "boven" }),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
});

/** Data-object: dokje met omgevouwen hoek; verzameling = drie streepjes. */
const dataObject = figuurMetNaam(30, (ctx) => {
  const k = ctx.thema.rand;
  const uit = [
    vorm("path", { d: "M2 2 H20 L28 10 V36 H2 Z", fill: ctx.thema.vulling, stroke: k, "stroke-width": 1.5, "stroke-linejoin": "round" }),
    vorm("path", { d: "M20 2 V10 H28", fill: "none", stroke: k, "stroke-width": 1.5, "stroke-linejoin": "round" }),
  ];
  if (ctx.element?.data?.verzameling) uit.push(vorm("path", { d: "M11 27 V33 M15 27 V33 M19 27 V33", fill: "none", stroke: k, "stroke-width": 1.6, "stroke-linecap": "round" }));
  return uit;
});

/** Data store: cilinder. */
const dataStore = figuurMetNaam(34, (ctx) => {
  const k = ctx.thema.rand;
  return [
    vorm("path", { d: "M3 7 V31 A14 5 0 0 0 31 31 V7", fill: ctx.thema.vulling, stroke: k, "stroke-width": 1.5 }),
    vorm("ellipse", { cx: 17, cy: 7, rx: 14, ry: 5, fill: ctx.thema.vulling, stroke: k, "stroke-width": 1.5 }),
    vorm("path", { d: "M3 12 A14 5 0 0 0 31 12 M3 17 A14 5 0 0 0 31 17", fill: "none", stroke: k, "stroke-width": 1 }),
  ];
});

// ── Pool ─────────────────────────────────────────────────────────────────────────────────────────
const BAND = 30;
/** Pool: stevige rand, de naam in een staande band links (BPMN-conventie); de leden rechts ervan. */
const pool = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const eigen = veiligeKleur(ctx.stijl.kleur, null);
    const achtergrond = veiligeKleur(ctx.element?.data?.achtergrondKleur, null);
    const attrs = { x: 1, y: 1, width: w - 2, height: h - 2, rx: 2, stroke: ctx.thema.rand, "stroke-width": 2 };
    if (achtergrond) attrs.fill = achtergrond;
    else {
      attrs.fill = eigen || ctx.thema.rand;
      attrs["fill-opacity"] = eigen ? 0.1 : 0.05;
    }
    return vorm("g", {}, vorm("rect", attrs), vorm("line", { x1: BAND, y1: 1, x2: BAND, y2: h - 1, stroke: ctx.thema.rand, "stroke-width": 2 }));
  },
  // De band: een liggend vak van h × 30, een kwartslag gedraaid om het midden van de band.
  inhoudsvak: (ctx) => ({ x: BAND / 2 - ctx.maat.h / 2, y: ctx.maat.h / 2 - BAND / 2, w: ctx.maat.h, h: BAND, rotatie: -90, uitlijning: "midden" }),
  kindervak: (ctx) => ({ x: BAND, y: 0, w: ctx.maat.w - BAND, h: ctx.maat.h }),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

registreerRenderer("bpmn-event", event);
registreerRenderer("bpmn-gateway", gateway);
registreerRenderer("bpmn-taak", taak);
registreerRenderer("bpmn-subproces", subproces);
registreerRenderer("bpmn-data", dataObject);
registreerRenderer("bpmn-datastore", dataStore);
registreerRenderer("bpmn-pool", pool);

/** @type {import("../../diagramcore/types/schema.js").ShapeType[]} */
export const BPMN_SHAPETYPES = [
  { id: "bpmn-event", renderer: "bpmn-event", parameters: { inhoud: "geen" }, minMaat: { w: 26, h: 26 } },
  { id: "bpmn-gateway", renderer: "bpmn-gateway", parameters: { inhoud: "geen" }, minMaat: { w: 34, h: 34 } },
  { id: "bpmn-taak", renderer: "bpmn-taak", parameters: { inhoud: "naam", naamGrootte: 12, rand: "#7dd3fc" }, minMaat: { w: 180, h: 48 } },
  { id: "bpmn-subproces", renderer: "bpmn-subproces", parameters: { inhoud: "naam", naamGrootte: 12, rand: "#7dd3fc" }, minMaat: { w: 180, h: 52 } },
  { id: "bpmn-data", renderer: "bpmn-data", parameters: { inhoud: "naam", naamGrootte: 11, maxBreedte: 120, extraHoogte: FIGUUR_H - 2 }, minMaat: { w: 46, h: 40 } },
  { id: "bpmn-datastore", renderer: "bpmn-datastore", parameters: { inhoud: "naam", naamGrootte: 11, maxBreedte: 120, extraHoogte: FIGUUR_H - 2 }, minMaat: { w: 46, h: 40 } },
  { id: "bpmn-lane", renderer: "kader", parameters: { inhoud: "naam", naamGrootte: 12, tekstAnker: "midden", lijn: "solid", hoekRadius: 4, kopHoogte: 26, kopLijn: true, tint: true, kleurAls: "rand" }, minMaat: { w: 240, h: 100 } },
  { id: "bpmn-pool", renderer: "bpmn-pool", parameters: { inhoud: "naam", naamGrootte: 12, tekstAnker: "midden", kleurAls: "rand", rand: "#64748b" }, minMaat: { w: 320, h: 160 } },
];

for (const st of BPMN_SHAPETYPES) registreerShapeType(st);
