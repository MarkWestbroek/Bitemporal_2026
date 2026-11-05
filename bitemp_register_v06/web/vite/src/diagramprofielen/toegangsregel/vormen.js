// @ts-check
/**
 * toegangsregel/vormen — de vormentaal van Toegangsspraak als ShapeType (plan 2026-11-04 Eén
 * tekenaar, stap 4; ontwerp-antwoord docs/plans/2026-07-24 … vormentaal). Elk zinsdeel krijgt
 * een silhouet dat zijn rol naspeelt, herkenbaar zónder kleurkennis:
 *
 *   tr-kaft         Policy: kopkaart met boekrug (dikke gevulde linkerband)
 *   tr-regelkaart   Toegangsregel: kaart met modaliteitsband; "mag niet" = gearceerde band + ⃠
 *   tr-badge        Subject: naambadge met clip-inkeping + persoon
 *   tr-pijlblok     Handeling: chevron — het werkwoord duwt de zin vooruit
 *   tr-cilinder     Gegevensselectie: gegevenscilinder, ▦ bij cross-profiel
 *   tr-poort        Voorwaardepoort: ruit met + / ○ / × (BPMN-taal), de soort eronder
 *   tr-vergelijking Voorwaarde: strook "links · teken · rechts" (eigen inhoud via hooks)
 *   tr-vaandel      Plicht: wimpel met zwaluwstaart + ⚑
 *   tr-tag          Begrip: label met oogje, gestippeld (referentie)
 *
 * De vorm is de omtrek (plus ornament); naam en deelregels tekent de motor. Pure `.js`.
 */
import { registreerShapeType, registreerRenderer, vorm } from "../../diagramcore/types/shapeType.js";
import { randRechthoek } from "../../diagramcore/tekenaar/bibliotheek.js";
import { n3 } from "../../diagramcore/tekenaar/glyphs.js";
import { num } from "../../diagramsvg/svg.js";

const pts = (p) => p.map(([x, y]) => `${num(x)},${num(y)}`).join(" ");
const rand = (ctx, dikte = 1.5) => ({ stroke: ctx.thema.rand, "stroke-width": dikte, "stroke-linejoin": "round" });
const vol = (ctx) => ({ x: 0, y: 0, w: ctx.maat.w, h: ctx.maat.h, uitlijning: "midden" });

// ── Policy: kaft met boekrug ─────────────────────────────────────────────────────────────────────
const RUG = 9;
const kaft = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    return vorm(
      "g",
      {},
      vorm("rect", { x: 0.75, y: 0.75, width: w - 1.5, height: h - 1.5, rx: 4, fill: ctx.thema.vulling, ...rand(ctx) }),
      vorm("path", { d: `M 0.75 4.75 a 4 4 0 0 1 4 -4 H ${RUG} V ${num(h - 0.75)} H 4.75 a 4 4 0 0 1 -4 -4 Z`, fill: "#a5b4fc", ...rand(ctx) })
    );
  },
  inhoudsvak: (ctx) => ({ x: RUG + 2, y: 0, w: ctx.maat.w - RUG - 4, h: ctx.maat.h, uitlijning: "midden" }),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

// ── Toegangsregel: kaart met modaliteitsband ─────────────────────────────────────────────────────
const BAND = 11;
const KOP = 18;
export const isVerbod = (modaliteit) => /niet|verbod/i.test(String(modaliteit || ""));
const regelkaart = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const verbod = isVerbod(ctx.element?.data?.modaliteit);
    const clip = `${ctx.idPrefix}-kaart`;
    const clipBand = `${ctx.idPrefix}-band`;
    const band = [vorm("rect", { x: 0, y: 0, width: BAND, height: h, fill: verbod ? "#fecaca" : "#16a34a" })];
    if (verbod) {
      // Diagonale arcering: nooit alleen rood (ook zonder kleurzicht leesbaar). De lijnen lopen
      // schuin over de hele hoogte en zijn dus veel breder dan de band: binnen de band geknipt
      // (tot 05-11 alleen op de kaart geknipt, waardoor de arcering als een wig over de kaart lag).
      const arcering = [];
      for (let x = -h; x < BAND + 4; x += 5) arcering.push(vorm("line", { x1: x, y1: h, x2: x + h, y2: 0, stroke: "#dc2626", "stroke-width": 2 }));
      band.push(vorm("g", { "clip-path": `url(#${clipBand})` }, ...arcering));
    }
    band.push(vorm("line", { x1: BAND, y1: 0, x2: BAND, y2: h, stroke: verbod ? "#dc2626" : "#15803d", "stroke-width": 1 }));
    const modaliteit = [vorm("text", { x: BAND + (w - BAND) / 2 + (verbod ? 8 : 0), y: 14, "text-anchor": "middle", "font-size": 9.5, "font-weight": 700, fill: verbod ? "#b91c1c" : "#15803d" }, verbod ? "mag niet" : "mag")];
    if (verbod) {
      const cx = BAND + (w - BAND) / 2 - 20;
      modaliteit.push(vorm("circle", { cx, cy: 10, r: 4.6, fill: "none", stroke: "#dc2626", "stroke-width": 1.6 }), vorm("line", { x1: cx - 3.1, y1: 13.1, x2: cx + 3.1, y2: 6.9, stroke: "#dc2626", "stroke-width": 1.6, "stroke-linecap": "round" }));
    }
    return vorm(
      "g",
      {},
      vorm(
        "defs",
        {},
        vorm("clipPath", { id: clip }, vorm("rect", { x: 0.75, y: 0.75, width: w - 1.5, height: h - 1.5, rx: 10 })),
        vorm("clipPath", { id: clipBand }, vorm("rect", { x: 0, y: 0, width: BAND, height: h }))
      ),
      vorm("rect", { x: 0.75, y: 0.75, width: w - 1.5, height: h - 1.5, rx: 10, fill: ctx.thema.vulling, ...rand(ctx) }),
      vorm("g", { "clip-path": `url(#${clip})` }, ...band),
      ...modaliteit
    );
  },
  inhoudsvak: (ctx) => ({ x: BAND + 4, y: KOP, w: ctx.maat.w - BAND - 8, h: ctx.maat.h - KOP - 4, uitlijning: "boven" }),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

// ── Subject: naambadge met clip en persoon ───────────────────────────────────────────────────────
const badge = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    return vorm(
      "g",
      {},
      vorm("rect", { x: 0.75, y: 0.75, width: w - 1.5, height: h - 1.5, rx: 11, fill: ctx.thema.vulling, ...rand(ctx) }),
      // De clip van het pasje, net boven de bovenrand.
      vorm("rect", { x: w / 2 - 10, y: -3, width: 20, height: 7, rx: 4, fill: ctx.thema.surface, ...rand(ctx, 1.3) })
    );
  },
  inhoudsvak: (ctx) => ({ x: 28, y: 0, w: ctx.maat.w - 36, h: ctx.maat.h, uitlijning: "midden" }),
  ornament(ctx) {
    const s = { fill: "none", stroke: "#475569", "stroke-width": 1.4 };
    return vorm("g", { transform: `translate(8 ${n3(ctx.maat.h / 2 - 9)})` }, vorm("circle", { cx: 9, cy: 6.2, r: 3.1, ...s }), vorm("path", { d: "M3.2 15a5.8 5.8 0 0 1 11.6 0", ...s }));
  },
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

// ── Handeling: pijlblok ──────────────────────────────────────────────────────────────────────────
const PUNT = 14;
const pijlblok = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    return vorm("polygon", { points: pts([[0.75, 0.75], [w - PUNT, 0.75], [w - 0.75, h / 2], [w - PUNT, h - 0.75], [0.75, h - 0.75]]), fill: ctx.thema.vulling, ...rand(ctx) });
  },
  inhoudsvak: (ctx) => ({ x: 0, y: 0, w: ctx.maat.w - PUNT, h: ctx.maat.h, uitlijning: "midden" }),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

// ── Gegevensselectie: cilinder ───────────────────────────────────────────────────────────────────
const cilinder = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const ry = Math.min(9, h / 6);
    const rx = w / 2 - 1;
    return vorm(
      "g",
      {},
      vorm("path", { d: `M 1 ${num(ry)} V ${num(h - ry - 1)} a ${num(rx)} ${num(ry)} 0 0 0 ${num(2 * rx)} 0 V ${num(ry)}`, fill: ctx.thema.vulling, ...rand(ctx) }),
      vorm("ellipse", { cx: w / 2, cy: ry, rx, ry, fill: ctx.thema.vulling, ...rand(ctx) })
    );
  },
  inhoudsvak(ctx) {
    const ry = Math.min(9, ctx.maat.h / 6);
    return { x: 10, y: 2 * ry, w: ctx.maat.w - 20, h: ctx.maat.h - 3 * ry, uitlijning: "midden" };
  },
  ornament(ctx) {
    const d = ctx.element?.data || {};
    if (!(d.verwijzingselement || d.verwijzingsprofiel)) return null;
    // ▦: verwijst naar een element in een ander profiel.
    const s = { fill: "none", stroke: "#475569", "stroke-width": 1.1 };
    return vorm("g", { transform: `translate(${n3(ctx.maat.w - 20)} 8)` }, vorm("rect", { x: 1, y: 1, width: 11, height: 11, rx: 1.5, fill: ctx.thema.surface, stroke: "#475569", "stroke-width": 1.1 }), vorm("path", { d: "M1 6.5h11M6.5 1v11", ...s }));
  },
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

// ── Voorwaardepoort: ruit met symbool ────────────────────────────────────────────────────────────
/** Symbool per poortsoort (BPMN-taal): alle = +, ten minste één = ○, precies één = ×. */
export function poortSymbool(soort) {
  const s = String(soort || "").toLowerCase();
  if (s.includes("minste") || s.includes("≥")) return "○";
  if (s.includes("precies") || s.includes("één van") || s.includes("xof")) return "×";
  return "+";
}
const poort = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    const soort = ctx.element?.data?.soort || "alle";
    return vorm(
      "g",
      {},
      vorm("polygon", { points: pts([[w / 2, 2], [w - 2, h / 2], [w / 2, h - 2], [2, h / 2]]), fill: ctx.thema.vulling, stroke: "#9333ea", "stroke-width": 1.6, "stroke-linejoin": "round" }),
      vorm("text", { x: w / 2, y: h / 2 + 7, "text-anchor": "middle", "font-size": 20, "font-weight": 700, fill: "#6b21a8" }, poortSymbool(soort))
    );
  },
  inhoudsvak: () => null,
  // De soort als label onder de ruit (decoratie, telt niet mee in de maat).
  ornament: (ctx) => vorm("text", { class: "dc-tr-poortsoort", x: ctx.maat.w / 2, y: ctx.maat.h + 12, "text-anchor": "middle", "font-size": 9.5, "font-weight": 600, fill: "#7e22ce" }, String(ctx.element?.data?.soort || "alle")),
  rand(ctx, hoek) {
    const { w, h } = ctx.maat;
    const dx = Math.cos((hoek * Math.PI) / 180);
    const dy = Math.sin((hoek * Math.PI) / 180);
    const s = 1 / (Math.abs(dx) / (w / 2) + Math.abs(dy) / (h / 2) || 1);
    return { x: w / 2 + dx * s, y: h / 2 + dy * s };
  },
};

// ── Voorwaarde: vergelijkingsstrook ──────────────────────────────────────────────────────────────
const vergelijking = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    return vorm("rect", { x: 0.65, y: 0.65, width: w - 1.3, height: h - 1.3, rx: (h - 1.3) / 2, fill: ctx.thema.vulling, ...rand(ctx, 1.3) });
  },
  inhoudsvak: (ctx) => ({ x: ctx.maat.h / 4, y: 0, w: ctx.maat.w - ctx.maat.h / 2, h: ctx.maat.h, uitlijning: "midden" }),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

// ── Plicht: vaandel met zwaluwstaart ─────────────────────────────────────────────────────────────
const STAART = 12;
const vaandel = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    return vorm("polygon", { points: pts([[0.75, 0.75], [w - 0.75, 0.75], [w - STAART, h / 2], [w - 0.75, h - 0.75], [0.75, h - 0.75]]), fill: ctx.thema.vulling, ...rand(ctx) });
  },
  inhoudsvak: (ctx) => ({ x: 24, y: 0, w: ctx.maat.w - 24 - STAART - 4, h: ctx.maat.h, uitlijning: "midden" }),
  ornament: (ctx) => vorm("path", { transform: `translate(10 ${n3(ctx.maat.h / 2 - 7.5)})`, d: "M3 14V1.5l8 3-8 3", fill: "none", stroke: "#0f766e", "stroke-width": 1.5, "stroke-linejoin": "round" }),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

// ── Begrip: gestippelde tag met oogje ────────────────────────────────────────────────────────────
const TAG_PUNT = 14;
const tag = {
  omtrek(ctx) {
    const { w, h } = ctx.maat;
    return vorm(
      "g",
      {},
      vorm("path", { d: `M ${TAG_PUNT} 0.75 H ${num(w - 8.75)} a 8 8 0 0 1 8 8 V ${num(h - 8.75)} a 8 8 0 0 1 -8 8 H ${TAG_PUNT} L 0.75 ${num(h / 2)} Z`, fill: ctx.thema.vulling, stroke: ctx.thema.rand, "stroke-width": 1.4, "stroke-dasharray": "4 3", "stroke-linejoin": "round" }),
      vorm("circle", { cx: TAG_PUNT + 4, cy: h / 2, r: 2.75, fill: "none", stroke: "#64748b", "stroke-width": 1.3 })
    );
  },
  inhoudsvak: (ctx) => ({ x: TAG_PUNT + 12, y: 0, w: ctx.maat.w - TAG_PUNT - 22, h: ctx.maat.h, uitlijning: "midden" }),
  rand: (ctx, hoek) => randRechthoek(ctx.maat, hoek),
};

registreerRenderer("tr-kaft", kaft);
registreerRenderer("tr-regelkaart", regelkaart);
registreerRenderer("tr-badge", badge);
registreerRenderer("tr-pijlblok", pijlblok);
registreerRenderer("tr-cilinder", cilinder);
registreerRenderer("tr-poort", poort);
registreerRenderer("tr-vergelijking", vergelijking);
registreerRenderer("tr-vaandel", vaandel);
registreerRenderer("tr-tag", tag);

/**
 * `factorW`: het inhoudsvak is smaller dan de doos (rug, band, clip-icoon, punt, staart, oogje);
 * zo meet de motor de natuurlijke breedte op het vak en loopt de naam niet in de band.
 * @type {import("../../diagramcore/types/schema.js").ShapeType[]}
 */
export const TOEGANGSREGEL_SHAPETYPES = [
  { id: "tr-kaft", renderer: "tr-kaft", parameters: { inhoud: "volledig", naamGrootte: 12, stereotype: false, factorW: 0.9 }, minMaat: { w: 170, h: 48 } },
  { id: "tr-regelkaart", renderer: "tr-regelkaart", parameters: { inhoud: "naam", naamGrootte: 12, factorW: 0.85 }, minMaat: { w: 170, h: 52 } },
  { id: "tr-badge", renderer: "tr-badge", parameters: { inhoud: "naam", naamGrootte: 12, factorW: 0.74 }, minMaat: { w: 150, h: 44 } },
  { id: "tr-pijlblok", renderer: "tr-pijlblok", parameters: { inhoud: "naam", naamGrootte: 12, factorW: 0.9 }, minMaat: { w: 150, h: 44 } },
  { id: "tr-cilinder", renderer: "tr-cilinder", parameters: { inhoud: "naam", naamGrootte: 12, factorW: 0.86 }, minMaat: { w: 150, h: 60 } },
  { id: "tr-poort", renderer: "tr-poort", parameters: { inhoud: "geen" }, minMaat: { w: 48, h: 48 } },
  { id: "tr-vergelijking", renderer: "tr-vergelijking", parameters: { inhoud: "volledig", naamGrootte: 11.5, stereotype: false, factorW: 0.85 }, minMaat: { w: 150, h: 36 } },
  { id: "tr-vaandel", renderer: "tr-vaandel", parameters: { inhoud: "naam", naamGrootte: 12, factorW: 0.72 }, minMaat: { w: 150, h: 44 } },
  { id: "tr-tag", renderer: "tr-tag", parameters: { inhoud: "naam", naamGrootte: 11.5, factorW: 0.74 }, minMaat: { w: 150, h: 40 } },
];

for (const st of TOEGANGSREGEL_SHAPETYPES) registreerShapeType(st);

/**
 * Eigen inhoud van een policy: "vanaf … · doel" onder de naam, klein en gedempt.
 * @type {(element: Object) => import("../../diagramcore/types/schema.js").InhoudsRegel[]}
 */
export function policyInhoud(element) {
  const d = element?.data || {};
  const delen = [d.geldigVanaf && `vanaf ${d.geldigVanaf}`, d.doel].filter(Boolean);
  return delen.length ? [{ anker: "midden", grootte: 9.5, delen: [{ tekst: delen.join(" · "), soort: "staart" }] }] : [];
}

/** Heeft een voorwaarde delen (links/rechts)? Dan tonen die in plaats van de naam. */
const heeftDelen = (element) => !!(element?.data?.links || element?.data?.rechts);

/**
 * Weergavenaam van een voorwaarde: leeg als de delen de strook vullen.
 * @type {(element: Object) => string|undefined}
 */
export function voorwaardeNaam(element) {
  return heeftDelen(element) ? "" : undefined;
}

/**
 * Eigen inhoud van een voorwaarde: links · teken · rechts, gecentreerd.
 * @type {(element: Object) => import("../../diagramcore/types/schema.js").InhoudsRegel[]}
 */
export function voorwaardeInhoud(element) {
  if (!heeftDelen(element)) return [];
  const d = element.data || {};
  return [{ anker: "midden", delen: [{ tekst: String(d.links || ""), veld: "links" }, { tekst: String(d.vergelijking || "="), vet: true, kleur: "#6b21a8", veld: "vergelijking" }, { tekst: String(d.rechts || ""), veld: "rechts" }] }];
}
