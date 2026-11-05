// @ts-check
/**
 * lijnen — de connectoren van een diagram als SVG. De gedaanten en de presentatie komen uit
 * `canvas/materialiseerConnectoren.js` (puur; dezelfde code als het canvas): kaal of
 * gematerialiseerd (anker + box), handles, knikken, labels, `verbergBijNesting`, verborgen
 * connectoren, meerdere voorkomens. Hier wordt alleen de geometrie bepaald:
 *
 *   - een uiteinde met een gekozen handle (of een vorm met "toppen") hecht aan op het midden van
 *     die zijde; anders op het snijpunt van de rand met de lijn naar de overkant ("rand tot
 *     rand", zoals diagramsvg);
 *   - knikken (ctrl-klik op het canvas, EA-import) worden een polylijn;
 *   - `vorm`: "recht", "hoekig" (orthogonaal; zonder gekozen handles en knikken met dezelfde
 *     regel als het canvas, `zwevendeRand.orthogonaleUiteinden`: recht boven of naast elkaar
 *     één rechte lijn, anders beide uiteinden op de zijde van de dominante as en een Z — tot
 *     05-11 kwam de zijde uit de handle en het punt uit het snijpunt met de rand, en die twee
 *     spraken elkaar tegen bij een doos schuin boven de ander: de lijn liep dan langs de rand),
 *     anders een bezier;
 *   - een zelf-lus is het oortje van boven naar rechts.
 *
 * Markers staan één keer in `<defs>` per soort en kleur; de start-variant is dezelfde vorm met
 * `orient="auto-start-reverse"`. Puur en deterministisch.
 */
import { vorm } from "../types/shapeType.js";
import { num } from "../../diagramsvg/svg.js";
import { veiligeKleur } from "../../diagramsvg/thema.js";
import { tekstBreedte } from "../../diagramsvg/tekstmaat.js";
import { normaliseerHandle } from "../canvas/materialiseerConnectoren.js";
import { orthogonaleUiteinden } from "../canvas/zwevendeRand.js";

const DASHES = { "dash-6-3": "6 3", "dash-4-3": "4 3", "dash-4-4": "4 4", gestippeld: "2 3" };
/** Vaste slate-tinten van profielen (gekozen voor een wit canvas) → de randkleur van het thema. */
const SLATE = new Set(["#1f2937", "#334155", "#475569", "#64748b", "#94a3b8", "#cbd5e1"]);
const LABEL = 10;

const zijdeVan = (handle) => (handle || "").replace(/^(source|target)-/, "");
const UIT = { top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

function zijdeMidden(box, zijde) {
  const { x, y, w, h } = box;
  if (zijde === "top") return { x: x + w / 2, y };
  if (zijde === "bottom") return { x: x + w / 2, y: y + h };
  if (zijde === "left") return { x, y: y + h / 2 };
  return { x: x + w, y: y + h / 2 };
}

/** Snijpunt van de rand met de lijn uit het midden naar (px, py); via de renderer als die een rand kent. */
function randPunt(box, px, py) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const dx = px - cx;
  const dy = py - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  if (box.rand) {
    const hoek = (Math.atan2(dy, dx) * 180) / Math.PI;
    const p = box.rand(hoek);
    return { x: box.x + p.x, y: box.y + p.y };
  }
  const sx = dx ? box.w / 2 / Math.abs(dx) : Infinity;
  const sy = dy ? box.h / 2 / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

const midden = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

function padTekst(pts) {
  return pts.map((p, i) => `${i ? "L" : "M"} ${num(p.x)} ${num(p.y)}`).join(" ");
}

/** Punt op de helft van een polylijn. */
function halverwege(pts) {
  let totaal = 0;
  const lengtes = [];
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    lengtes.push(l);
    totaal += l;
  }
  let rest = totaal / 2;
  for (let i = 1; i < pts.length; i++) {
    if (rest <= lengtes[i - 1] || i === pts.length - 1) {
      const t = lengtes[i - 1] ? rest / lengtes[i - 1] : 0;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t };
    }
    rest -= lengtes[i - 1];
  }
  return pts[0];
}

/** Orthogonaal pad tussen twee uiteinden, langs hun zijden (EA Auto Routing in het klein). */
function hoekigPad(p0, zA, p1, zB) {
  const a = { x: p0.x + UIT[zA].x * 12, y: p0.y + UIT[zA].y * 12 };
  const b = { x: p1.x + UIT[zB].x * 12, y: p1.y + UIT[zB].y * 12 };
  const horA = zA === "left" || zA === "right";
  const horB = zB === "left" || zB === "right";
  if (horA && horB) {
    const mx = (a.x + b.x) / 2;
    return [p0, a, { x: mx, y: a.y }, { x: mx, y: b.y }, b, p1];
  }
  if (!horA && !horB) {
    const my = (a.y + b.y) / 2;
    return [p0, a, { x: a.x, y: my }, { x: b.x, y: my }, b, p1];
  }
  return horA ? [p0, a, { x: b.x, y: a.y }, b, p1] : [p0, a, { x: a.x, y: b.y }, b, p1];
}

/** Marker-vorm, tekenend naar +x met de punt op refX. Geeft {w, h, refX, inhoud(kleur, vulling)}. */
const MARKERS = {
  "pijl-open": { w: 12, h: 10, refX: 10, inhoud: (k) => vorm("path", { d: "M 1 1 L 10 5 L 1 9", fill: "none", stroke: k, "stroke-width": 1.2 }) },
  "pijl-dicht": { w: 12, h: 12, refX: 11, inhoud: (k) => vorm("path", { d: "M 1 1.5 L 11 6 L 1 10.5 Z", fill: k }) },
  pijl: { w: 12, h: 12, refX: 11, inhoud: (k) => vorm("path", { d: "M 1 1.5 L 11 6 L 1 10.5 Z", fill: k }) },
  driehoek: { w: 14, h: 14, refX: 13, inhoud: (k, v) => vorm("path", { d: "M 1 1 L 13 7 L 1 13 Z", fill: v, stroke: k, "stroke-width": 1.2 }) },
  ruit: { w: 16, h: 14, refX: 15, inhoud: (k) => vorm("path", { d: "M 1 7 L 8 1 L 15 7 L 8 13 Z", fill: k }) },
  "ruit-open": { w: 16, h: 14, refX: 15, inhoud: (k, v) => vorm("path", { d: "M 1 7 L 8 1 L 15 7 L 8 13 Z", fill: v, stroke: k, "stroke-width": 1.2 }) },
  bol: { w: 14, h: 14, refX: 12, inhoud: (k) => vorm("circle", { cx: 7, cy: 7, r: 5, fill: k }) },
  "cirkel-open": { w: 14, h: 14, refX: 12, inhoud: (k, v) => vorm("circle", { cx: 7, cy: 7, r: 5, fill: v, stroke: k, "stroke-width": 1.2 }) },
  kruisje: { w: 12, h: 12, refX: 10, inhoud: (k) => vorm("path", { d: "M 2 2 L 10 10 M 10 2 L 2 10", fill: "none", stroke: k, "stroke-width": 1.4 }) },
  "kruis-cirkel": { w: 16, h: 16, refX: 14, inhoud: (k, v) => vorm("g", {}, vorm("circle", { cx: 8, cy: 8, r: 6, fill: v, stroke: k, "stroke-width": 1.2 }), vorm("path", { d: "M 4 4 L 12 12 M 12 4 L 4 12", fill: "none", stroke: k, "stroke-width": 1.2 })) },
  "schuine-streep": { w: 12, h: 14, refX: 6, inhoud: (k) => vorm("path", { d: "M 3 1 L 9 13", fill: "none", stroke: k, "stroke-width": 1.4 }) },
  "kraai-een": { w: 22, h: 14, refX: 21, inhoud: (k) => vorm("path", { d: "M 20 1.5 L 20 12.5 M 15 1.5 L 15 12.5", fill: "none", stroke: k, "stroke-width": 1.2 }) },
  "kraai-nul-of-een": { w: 22, h: 14, refX: 21, inhoud: (k, v) => vorm("g", {}, vorm("path", { d: "M 20 1.5 L 20 12.5", fill: "none", stroke: k, "stroke-width": 1.2 }), vorm("circle", { cx: 14, cy: 7, r: 3.2, fill: v, stroke: k, "stroke-width": 1.2 })) },
  "kraai-een-of-meer": { w: 22, h: 14, refX: 21, inhoud: (k) => vorm("path", { d: "M 12 7 L 21 1.5 M 12 7 L 21 7 M 12 7 L 21 12.5 M 9 1.5 L 9 12.5", fill: "none", stroke: k, "stroke-width": 1.2 }) },
  "kraai-nul-of-meer": { w: 22, h: 14, refX: 21, inhoud: (k, v) => vorm("g", {}, vorm("path", { d: "M 12 7 L 21 1.5 M 12 7 L 21 7 M 12 7 L 21 12.5", fill: "none", stroke: k, "stroke-width": 1.2 }), vorm("circle", { cx: 8, cy: 7, r: 3.2, fill: v, stroke: k, "stroke-width": 1.2 })) },
};

const kleurSleutel = (k) => String(k).replace(/[^a-z0-9]/gi, "").slice(-12) || "x";

/**
 * @param {Object} p
 * @param {Object[]} p.edges                     - uit materialiseerConnectoren
 * @param {Map<string, Object>} p.boxen          - voorkomen-id → {x, y, w, h, rand?, toppen?}
 * @param {Record<string, Object>} p.elements
 * @param {Object} p.diagram
 * @param {Record<string, Object>} p.typen
 * @param {{border: string, surface: string, muted: string, text: string}} p.thema
 * @param {string} p.idPrefix
 * @returns {{defs: Object[], boom: Object, punten: {x: number, y: number}[]}}
 */
export function tekenLijnen({ edges, boxen, elements, diagram, typen, thema, idPrefix }) {
  const defs = new Map();
  const kinderen = [];
  const punten = [];
  const markerId = (soort, kleur, start) => {
    const m = MARKERS[soort];
    if (!m) return null;
    const id = `${idPrefix}-${soort}-${kleurSleutel(kleur)}${start ? "-s" : ""}`;
    if (!defs.has(id)) {
      defs.set(id, vorm("marker", { id, markerWidth: m.w, markerHeight: m.h, refX: m.refX, refY: m.h / 2, orient: start ? "auto-start-reverse" : "auto", markerUnits: "userSpaceOnUse" }, m.inhoud(kleur, thema.surface)));
    }
    return id;
  };

  for (const e of edges) {
    if (e.hidden) continue;
    const a = boxen.get(e.source);
    const b = boxen.get(e.target);
    if (!a || !b) continue;
    const p = e.data?.presentatie || {};
    if (p.lijn === "onzichtbaar") continue;
    const el = elements[e.data?.connectorId] || {};
    const et = typen[el.elementType] || {};
    const lijn = { ...(el.data || {}), ...(diagram?.lijnen?.[el.id] || {}) };
    const hook = et.hooks?.edgePresentatie?.(el, { elements }) || {};
    const isLus = e.source === e.target;
    let zA = zijdeVan(e.sourceHandle) || "right";
    let zB = zijdeVan(e.targetHandle) || "left";
    const handleA = !!(normaliseerHandle(lijn.sourceHandle, "source") || normaliseerHandle(hook.sourceHandle, "source"));
    const handleB = !!(normaliseerHandle(lijn.targetHandle, "target") || normaliseerHandle(hook.targetHandle, "target"));
    const explicietA = isLus || handleA || !!p.bronToppen;
    const explicietB = isLus || handleB || !!p.doelToppen;
    const knikken = Array.isArray(e.data?.knikken) && e.data.knikken.length ? e.data.knikken : null;
    const hoekig = p.vorm === "hoekig" || p.vorm === "boom";

    let pts;
    if (isLus) {
      const t = zijdeMidden(a, "top");
      const r = zijdeMidden(a, "right");
      pts = [t, { x: t.x, y: t.y - 26 }, { x: r.x + 26, y: t.y - 26 }, { x: r.x + 26, y: r.y }, r];
    } else if (hoekig && !knikken && !handleA && !handleB) {
      // Beide uiteinden zonder gekozen handle: de canvasregel (zijde én punt uit één berekening;
      // "toppen" geldt daar alleen voor rechte lijnen). Het punt ligt op de omhullende
      // rechthoek; een ruit of ellips (box.rand) schuift het naar zijn omtrek.
      const o = orthogonaleUiteinden({ x: a.x, y: a.y, width: a.w, height: a.h }, { x: b.x, y: b.y, width: b.w, height: b.h });
      zA = o.sourcePosition;
      zB = o.targetPosition;
      const p0 = a.rand ? randPunt(a, o.sourceX + UIT[zA].x, o.sourceY + UIT[zA].y) : { x: o.sourceX, y: o.sourceY };
      const p1 = b.rand ? randPunt(b, o.targetX + UIT[zB].x, o.targetY + UIT[zB].y) : { x: o.targetX, y: o.targetY };
      pts = hoekigPad(p0, zA, p1, zB);
    } else {
      const naarA = knikken ? knikken[0] : midden(b);
      const naarB = knikken ? knikken[knikken.length - 1] : midden(a);
      const p0 = explicietA ? zijdeMidden(a, zA) : randPunt(a, naarA.x, naarA.y);
      const p1 = explicietB ? zijdeMidden(b, zB) : randPunt(b, naarB.x, naarB.y);
      if (knikken) pts = [p0, ...knikken, p1];
      else if (hoekig) pts = hoekigPad(p0, zA, p1, zB);
      else pts = [p0, p1];
    }
    const bezier = !isLus && !knikken && p.vorm !== "hoekig" && p.vorm !== "boom" && p.vorm !== "recht";
    let d;
    let mid;
    if (bezier) {
      const [p0, p1] = pts;
      const afstand = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const k = Math.min(140, Math.max(24, afstand * 0.4));
      const c1 = { x: p0.x + UIT[zA].x * k, y: p0.y + UIT[zA].y * k };
      const c2 = { x: p1.x + UIT[zB].x * k, y: p1.y + UIT[zB].y * k };
      d = `M ${num(p0.x)} ${num(p0.y)} C ${num(c1.x)} ${num(c1.y)} ${num(c2.x)} ${num(c2.y)} ${num(p1.x)} ${num(p1.y)}`;
      // Punt op t = 0,5 van de bezier: het labelmidden.
      mid = { x: (p0.x + 3 * c1.x + 3 * c2.x + p1.x) / 8, y: (p0.y + 3 * c1.y + 3 * c2.y + p1.y) / 8 };
      punten.push(c1, c2);
    } else {
      d = padTekst(pts);
      mid = halverwege(pts);
      punten.push(...pts);
    }

    const hex = veiligeKleur(p.kleur, null);
    const kleur = !hex || SLATE.has(hex) ? thema.border : hex;
    const attrs = { class: "dc-lijn", "data-connector-id": el.id, d, fill: "none", stroke: kleur, "stroke-width": p.dikte || 1.5 };
    if (DASHES[p.lijn]) attrs["stroke-dasharray"] = DASHES[p.lijn];
    const mEnd = p.markerEnd ? markerId(p.markerEnd, kleur, false) : null;
    const mStart = p.markerStart ? markerId(p.markerStart, kleur, true) : null;
    if (mEnd) attrs["marker-end"] = `url(#${mEnd})`;
    if (mStart) attrs["marker-start"] = `url(#${mStart})`;
    kinderen.push(vorm("path", attrs));

    // Labels: midden (naam, stereotype) boven het midden; bron/doel 16px van het uiteinde, iets
    // naast de lijn; een handmatige verschuiving (labelOffsets) telt mee.
    const eind = pts[pts.length - 1];
    const begin = pts[0];
    const richting = (van, naar) => {
      const l = Math.hypot(naar.x - van.x, naar.y - van.y) || 1;
      return { x: (naar.x - van.x) / l, y: (naar.y - van.y) / l };
    };
    for (const label of p.labels || []) {
      const tekst = (label.delen || []).map((x) => x.tekst).filter(Boolean).join(" ");
      if (!tekst) continue;
      let pos;
      if (label.zijde === "bron") {
        const u = richting(begin, pts[1] || eind);
        pos = { x: begin.x + u.x * 16 - u.y * 10, y: begin.y + u.y * 16 + u.x * 10 };
      } else if (label.zijde === "doel") {
        const u = richting(eind, pts[pts.length - 2] || begin);
        pos = { x: eind.x + u.x * 16 - u.y * 10, y: eind.y + u.y * 16 + u.x * 10 };
      } else pos = { x: mid.x, y: mid.y - 6 };
      if (label.offset) pos = { x: pos.x + (label.offset.x || 0), y: pos.y + (label.offset.y || 0) };
      const naamDeel = (label.delen || []).find((x) => x.veld === "naam");
      const kleurLabel = label.delen?.[0]?.soort === "kardinaliteit" || label.delen?.[0]?.soort === "rolnaam" ? thema.muted : naamDeel ? thema.text : thema.muted;
      const attrsT = { x: pos.x, y: pos.y, "text-anchor": "middle", "font-size": LABEL, fill: kleurLabel };
      if (naamDeel) attrsT["data-dc-veld"] = `connector:${el.id}:naam`;
      kinderen.push(vorm("text", attrsT, tekst));
      const bw = tekstBreedte(tekst, LABEL) / 2;
      punten.push({ x: pos.x - bw, y: pos.y - LABEL }, { x: pos.x + bw, y: pos.y + 2 });
    }
  }
  return { defs: [...defs.values()], boom: vorm("g", { class: "dc-lijnen" }, ...kinderen), punten };
}
