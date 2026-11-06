// @ts-check
/**
 * lijnen — de connectoren van een diagram als SVG, **zoals het canvas ze tekent**. De gedaanten
 * en de presentatie komen uit `canvas/materialiseerConnectoren.js` (puur; dezelfde code als het
 * canvas): kaal of gematerialiseerd (anker + box), handles, knikken, labels, `verbergBijNesting`,
 * verborgen connectoren, meerdere voorkomens. Hier wordt alleen de geometrie bepaald, met
 * dezelfde bouwstenen als `canvas/ConnectorEdge.jsx` (sinds 05-11; daarvóór had de tekenaar een
 * eigen "rand tot rand"-regel uit diagramsvg, en week een rechte of gebogen lijn tussen twee
 * schuin geplaatste dozen zichtbaar af van de Studio):
 *
 *   - de uiteinden via `zwevendeRand.zwevendeUiteinden`: een vaste handle (gekozen, of de
 *     dichtstbijzijnde zijde uit materialiseerConnectoren) op het midden van die zijde; een
 *     zwevend uiteinde (ElementType.randAanhechting) op de dominante zijde, geschoven langs die
 *     zijde; toppen; hoekig zonder knikken "zo recht mogelijk" (Z-regel, Mark 05-11); met
 *     knikken mikt elk uiteinde op zijn knik;
 *   - het pad met de padfuncties van React Flow (`@xyflow/system`): bezier, hoekig
 *     (smoothstep, radius 4), recht; knikken als polylijn; boom (EA tree style: dwarslat op 40
 *     van de ouder); een zelf-lus als oortje langs de handles (hoekig of gebogen, 56 uit);
 *   - markers met dezelfde maten en `markerUnits="strokeWidth"` als het canvas; de ruit van
 *     compositie/aggregatie als polygon op het begin van de lijn;
 *   - labels als chip (achtergrond, rand) op het labelpunt van de padfunctie; bron- en
 *     doellabels op 70% richting dat uiteinde (zelfde heuristiek als het canvas); meerdere
 *     labels op dezelfde zijde stapelen 18 px onder elkaar.
 *
 * Puur en deterministisch; markers staan één keer in `<defs>` per soort en kleur.
 */
import { getBezierPath, getSmoothStepPath, getStraightPath } from "@xyflow/system";
import { vorm } from "../types/shapeType.js";
import { num } from "../../diagramsvg/svg.js";
import { veiligeKleur } from "../../diagramsvg/thema.js";
import { tekstBreedte } from "../../diagramsvg/tekstmaat.js";
import { zwevendeUiteinden } from "../canvas/zwevendeRand.js";
import { isPuntNode } from "./voorkomen.js";

const DASHES = { "dash-6-3": "6 3", "dash-4-3": "4 3", "dash-4-4": "4 4", gestippeld: "2 3" };
/** Vaste slate-tinten van profielen (gekozen voor een wit canvas) → de randkleur van het thema. */
const SLATE = new Set(["#1f2937", "#334155", "#475569", "#64748b", "#94a3b8", "#cbd5e1"]);
const LABEL = 10;
const CHIP_H = 16;
/** Afstand tussen labels op dezelfde zijde van een lijn (ConnectorEdge: 18). */
const LABEL_STAPEL = 18;
const LABEL_GAP = 4;

/**
 * De stijl van één labeldeel, zoals `.dc-edge-<soort>` in diagramcore.css: rolnaam vet,
 * kardinaliteit paars en vet, constraint klein en cursief, een naam-soort cursief. Een eigen
 * kleur van het deel wint. Zonder soort: de tekstkleur als het label de relatienaam draagt,
 * anders gedempt.
 * @param {{soort?: string, kleur?: string, veld?: string}} deel
 * @param {{text: string, muted: string}} thema
 * @param {boolean} heeftNaam - het label bevat het naamveld van de relatie
 * @returns {Record<string, string|number>} SVG-attributen (fill, font-weight, font-style, font-size)
 */
function deelStijl(deel, thema, heeftNaam) {
  const s = deel.soort;
  const stijl = { fill: deel.kleur || (s === "kardinaliteit" ? "#7c3aed" : s === "rolnaam" || heeftNaam ? thema.text : thema.muted) };
  if (s === "kardinaliteit" || s === "rolnaam") stijl["font-weight"] = 600;
  if (s === "constraint" || s === "naam") stijl["font-style"] = "italic";
  if (s === "constraint") stijl["font-size"] = 9;
  return stijl;
}
const LUS_UIT = 56;
const BOOM_LAT = 40;
const RUIT_LENGTE = 22;
const RUIT_BREEDTE = 16;
const UIT = { top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

const zijdeVan = (handle) => (handle || "").replace(/^(source|target)-/, "");

/**
 * Het punt van een vaste handle: midden van de zijde, een stukje buiten de doos — React Flow laat
 * een lijn beginnen op de buitenkant van de handle-stip (8 px + rand, gecentreerd op de rand: 5);
 * op een punt-node liggen de stippen 8 px naar buiten (diagramcore.css `.dc-punt-node`: 12,5).
 */
const HANDLE_UIT = 5;
const HANDLE_UIT_PUNT = 12.5;
function handlePunt(box, zijde) {
  const { x, y, w, h } = box;
  const uit = isPuntNode(box.ctx?.shapeType, box.et) ? HANDLE_UIT_PUNT : HANDLE_UIT;
  if (zijde === "top") return { x: x + w / 2, y: y - uit };
  if (zijde === "bottom") return { x: x + w / 2, y: y + h + uit };
  if (zijde === "left") return { x: x - uit, y: y + h / 2 };
  return { x: x + w + uit, y: y + h / 2 };
}

const padVan = (pts) => pts.map((q, i) => `${i ? "L" : "M"} ${num(q.x)} ${num(q.y)}`).join(" ");

/** Alle coördinaten uit een pad (M/L/Q/C), voor de omvang van het diagram. */
function padPunten(d) {
  const getallen = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  const pts = [];
  for (let i = 0; i + 1 < getallen.length; i += 2) pts.push({ x: getallen[i], y: getallen[i + 1] });
  return pts;
}

/** Zelf-lus: het oortje van ConnectorEdge.lusPad — hoekig buitenom, anders gebogen. */
function lusPad(u, hoekig) {
  const nS = UIT[u.sourcePosition] || UIT.right;
  const nT = UIT[u.targetPosition] || UIT.right;
  const L = LUS_UIT;
  const s = { x: u.sourceX, y: u.sourceY };
  const t = { x: u.targetX, y: u.targetY };
  if (hoekig) {
    const p1 = { x: s.x + nS.x * L, y: s.y + nS.y * L };
    const p2 = { x: t.x + nT.x * L, y: t.y + nT.y * L };
    const sVert = nS.x === 0;
    const tVert = nT.x === 0;
    let pts = null;
    if (sVert !== tVert) {
      pts = [p1, sVert ? { x: p2.x, y: p1.y } : { x: p1.x, y: p2.y }, p2];
    } else if (nS.x === nT.x && nS.y === nT.y) {
      const d = { x: -nS.y, y: nS.x };
      if (Math.abs(s.x - t.x) < 1 && Math.abs(s.y - t.y) < 1) {
        pts = [p1, { x: p1.x + d.x * 34, y: p1.y + d.y * 34 }, { x: s.x + d.x * 34, y: s.y + d.y * 34 }];
      } else if (sVert) {
        const yUit = nS.y < 0 ? Math.min(p1.y, p2.y) : Math.max(p1.y, p2.y);
        pts = [{ x: s.x, y: yUit }, { x: t.x, y: yUit }];
      } else {
        const xUit = nS.x < 0 ? Math.min(p1.x, p2.x) : Math.max(p1.x, p2.x);
        pts = [{ x: xUit, y: s.y }, { x: xUit, y: t.y }];
      }
    }
    if (pts) {
      const apex = pts[Math.floor((pts.length - 1) / 2)];
      return [padVan([s, ...pts, t]), apex.x, apex.y];
    }
  }
  let c1 = { x: s.x + nS.x * L, y: s.y + nS.y * L };
  let c2 = { x: t.x + nT.x * L, y: t.y + nT.y * L };
  if (Math.abs(c1.x - c2.x) < 8 && Math.abs(c1.y - c2.y) < 8) {
    const d = { x: -nS.y, y: nS.x };
    c1 = { x: c1.x + d.x * 34, y: c1.y + d.y * 34 };
    c2 = { x: c2.x - d.x * 34, y: c2.y - d.y * 34 };
  }
  return [`M ${num(s.x)} ${num(s.y)} C ${num(c1.x)} ${num(c1.y)}, ${num(c2.x)} ${num(c2.y)}, ${num(t.x)} ${num(t.y)}`, (c1.x + c2.x) / 2, (c1.y + c2.y) / 2];
}

/** Boomstijl: korte stam, één dwarslat op vaste afstand van de ouder, rechte poot per kind. */
function boomPad(u) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition } = u;
  if (sourcePosition === "left" || sourcePosition === "right") {
    const latX = sourceX + (sourcePosition === "right" ? BOOM_LAT : -BOOM_LAT);
    return [padVan([{ x: sourceX, y: sourceY }, { x: latX, y: sourceY }, { x: latX, y: targetY }, { x: targetX, y: targetY }]), latX, (sourceY + targetY) / 2];
  }
  const latY = sourceY + (sourcePosition === "top" ? -BOOM_LAT : BOOM_LAT);
  return [padVan([{ x: sourceX, y: sourceY }, { x: sourceX, y: latY }, { x: targetX, y: latY }, { x: targetX, y: targetY }]), (sourceX + targetX) / 2, latY];
}

/** Polylijn door de knikken; het label op het midden van het middelste segment. */
function knikPad(u, knikken) {
  const pts = [{ x: u.sourceX, y: u.sourceY }, ...knikken, { x: u.targetX, y: u.targetY }];
  const midI = Math.floor(pts.length / 2);
  return [padVan(pts), (pts[midI - 1].x + pts[midI].x) / 2, (pts[midI - 1].y + pts[midI].y) / 2];
}

const KRAAIENPOTEN = {
  "kraai-een": { veel: false, optioneel: false },
  "kraai-nul-of-een": { veel: false, optioneel: true },
  "kraai-een-of-meer": { veel: true, optioneel: false },
  "kraai-nul-of-meer": { veel: true, optioneel: true },
};

/**
 * Markers zoals ConnectorEdge ze definieert (maat, refX/refY, geometrie, markerUnits
 * "strokeWidth"). `inhoud(kleur, vulling)`; `start` = alleen aan het begin (orient
 * auto-start-reverse), `beide` = één marker voor beide kanten.
 */
const MARKERS = {
  "pijl-open": { w: 12, h: 10, refX: 9, refY: 5, inhoud: (k) => vorm("path", { d: "M 1 2 L 9 5 L 1 8", fill: "none", stroke: k, "stroke-width": 1, "stroke-linecap": "round", "stroke-linejoin": "round" }) },
  "pijl-dicht": { w: 12, h: 12, refX: 10, refY: 6, inhoud: (k) => vorm("path", { d: "M 1 1.5 L 10.5 6 L 1 10.5 Z", fill: k }) },
  pijl: { w: 12, h: 12, refX: 10, refY: 6, inhoud: (k) => vorm("path", { d: "M 1 1.5 L 10.5 6 L 1 10.5 Z", fill: k }) },
  driehoek: { w: 14, h: 14, refX: 13, refY: 7, inhoud: (k, v) => vorm("path", { d: "M 1 1 L 13 7 L 1 13 Z", fill: v, stroke: k, "stroke-width": 1.2 }) },
  bol: { w: 10, h: 10, refX: 7.6, refY: 5, inhoud: (k) => vorm("circle", { cx: 5, cy: 5, r: 3, fill: k }) },
  "cirkel-open": { w: 10, h: 10, refX: 1, refY: 5, inhoud: (k, v) => vorm("circle", { cx: 5, cy: 5, r: 3.4, fill: v, stroke: k, "stroke-width": 1 }) },
  "kruis-cirkel": { w: 16, h: 16, refX: 1, refY: 8, inhoud: (k, v) => vorm("g", {}, vorm("circle", { cx: 8, cy: 8, r: 6, fill: v, stroke: k, "stroke-width": 1.2 }), vorm("path", { d: "M8 2.6 V13.4 M2.6 8 H13.4", fill: "none", stroke: k, "stroke-width": 1.2, "stroke-linecap": "round" })) },
  "schuine-streep": { w: 16, h: 14, refX: 0, refY: 7, inhoud: (k) => vorm("path", { d: "M 5 11.5 L 11 2.5", fill: "none", stroke: k, "stroke-width": 1.3, "stroke-linecap": "round" }) },
  kruisje: { w: 20, h: 10, refX: 15, refY: 5, beide: true, inhoud: (k) => vorm("path", { d: "M 4 1.5 L 11 8.5 M 11 1.5 L 4 8.5", fill: "none", stroke: k, "stroke-width": 1.1, "stroke-linecap": "round" }) },
};
for (const [soort, k] of Object.entries(KRAAIENPOTEN)) {
  MARKERS[soort] = {
    w: 22, h: 14, refX: 21, refY: 7, refXStart: 1, spiegelStart: true,
    inhoud: (kleur, vulling) => {
      const s = { fill: "none", stroke: kleur, "stroke-width": 1.2, "stroke-linecap": "round" };
      return vorm("g", {},
        vorm("path", { ...s, d: k.veel ? "M 12 7 L 21 1.5 M 12 7 L 21 7 M 12 7 L 21 12.5" : "M 20 1.5 L 20 12.5" }),
        k.optioneel
          ? vorm("circle", { ...s, cx: k.veel ? 8 : 14, cy: 7, r: 3.2, fill: vulling })
          : vorm("path", { ...s, d: k.veel ? "M 9 1.5 L 9 12.5" : "M 15 1.5 L 15 12.5" }));
    },
  };
}

const kleurSleutel = (k) => String(k).replace(/[^a-z0-9]/gi, "").slice(-12) || "x";

/** Ruit (compositie ◆ / aggregatie ◇) als polygon op het begin van het pad, zoals het canvas. */
function ruitPolygon(d, open, kleur, vulling) {
  const pts = padPunten(d);
  if (pts.length < 2) return null;
  const p0 = pts[0];
  const naar = pts[1];
  const l = Math.hypot(naar.x - p0.x, naar.y - p0.y) || 1;
  const u = { x: (naar.x - p0.x) / l, y: (naar.y - p0.y) / l };
  const n = { x: -u.y * (RUIT_BREEDTE / 2), y: u.x * (RUIT_BREEDTE / 2) };
  const pm = { x: p0.x + u.x * (RUIT_LENGTE / 2), y: p0.y + u.y * (RUIT_LENGTE / 2) };
  const p1 = { x: p0.x + u.x * RUIT_LENGTE, y: p0.y + u.y * RUIT_LENGTE };
  const punten = [p0, { x: pm.x + n.x, y: pm.y + n.y }, p1, { x: pm.x - n.x, y: pm.y - n.y }];
  return vorm("polygon", { points: punten.map((q) => `${num(q.x)},${num(q.y)}`).join(" "), fill: open ? vulling : kleur, stroke: kleur, "stroke-width": 1.2, "stroke-linejoin": "round" });
}

/**
 * @param {Object} p
 * @param {Object[]} p.edges                     - uit materialiseerConnectoren
 * @param {Map<string, Object>} p.boxen          - voorkomen-id → {x, y, w, h}
 * @param {Record<string, Object>} p.elements
 * @param {Object} p.diagram
 * @param {Record<string, Object>} p.typen
 * @param {{border: string, surface: string, muted: string, text: string}} p.thema
 * @param {string} p.idPrefix
 * @returns {{defs: Object[], boom: Object, punten: {x: number, y: number}[]}}
 */
export function tekenLijnen({ edges, boxen, elements, thema, idPrefix }) {
  const defs = new Map();
  const kinderen = [];
  const punten = [];
  const markerId = (soort, kleur, start) => {
    const m = MARKERS[soort];
    if (!m) return null;
    const id = `${idPrefix}-${soort}-${kleurSleutel(kleur)}${start && !m.beide ? "-s" : ""}`;
    if (!defs.has(id)) {
      const inhoud = m.inhoud(kleur, thema.surface);
      defs.set(id, vorm("marker", {
        id, markerWidth: m.w, markerHeight: m.h,
        refX: start && m.refXStart !== undefined ? m.refXStart : m.refX, refY: m.refY,
        orient: m.beide || (start && !m.spiegelStart) ? "auto-start-reverse" : "auto",
        markerUnits: "strokeWidth",
      }, start && m.spiegelStart ? vorm("g", { transform: `translate(${m.w},0) scale(-1,1)` }, inhoud) : inhoud));
    }
    return id;
  };
  const rect = (b) => ({ x: b.x, y: b.y, width: b.w, height: b.h });

  for (const e of edges) {
    if (e.hidden) continue;
    const a = boxen.get(e.source);
    const b = boxen.get(e.target);
    if (!a || !b) continue;
    const p = e.data?.presentatie || {};
    if (p.lijn === "onzichtbaar") continue;
    const el = elements[e.data?.connectorId] || {};
    const isLus = e.source === e.target;
    const knikken = Array.isArray(e.data?.knikken) && e.data.knikken.length ? e.data.knikken : null;
    const zA = zijdeVan(e.sourceHandle) || (isLus ? "top" : "right");
    const zB = zijdeVan(e.targetHandle) || (isLus ? "right" : "left");
    const sM = handlePunt(a, zA);
    const tM = handlePunt(b, zB);
    // Dezelfde aanroep als ConnectorEdge: vaste handles tenzij het uiteinde zweeft.
    const u = zwevendeUiteinden({
      bronRect: rect(a),
      doelRect: rect(b),
      zwevendBron: !!p.zwevendBron && (!isLus || !!knikken),
      zwevendDoel: !!p.zwevendDoel && (!isLus || !!knikken),
      bronRicht: knikken ? knikken[0] : null,
      doelRicht: knikken ? knikken[knikken.length - 1] : null,
      orthogonaal: p.vorm === "hoekig" && !knikken,
      bronOmtrek: p.bronOmtrek || "rechthoek",
      doelOmtrek: p.doelOmtrek || "rechthoek",
      bronToppen: !!p.bronToppen,
      doelToppen: !!p.doelToppen,
      vast: { sourceX: sM.x, sourceY: sM.y, targetX: tM.x, targetY: tM.y, sourcePosition: zA, targetPosition: zB },
    });
    const [d, labelX, labelY] = knikken
      ? knikPad(u, knikken)
      : isLus
        ? lusPad(u, p.vorm === "hoekig")
        : p.vorm === "boom"
          ? boomPad(u)
          : p.vorm === "hoekig"
            ? getSmoothStepPath({ ...u, borderRadius: 4 })
            : p.vorm === "recht"
              ? getStraightPath(u)
              : getBezierPath(u);
    punten.push(...padPunten(d));

    const hex = veiligeKleur(p.kleur, null);
    const kleur = !hex || SLATE.has(hex) ? thema.border : hex;
    const attrs = { class: "dc-lijn", "data-connector-id": el.id, ...(el.id || !e.id ? {} : { "data-edge-id": e.id }), d, fill: "none", stroke: kleur, "stroke-width": p.dikte || 1.5, "stroke-linejoin": "round" };
    if (DASHES[p.lijn]) attrs["stroke-dasharray"] = DASHES[p.lijn];
    if (p.opacity !== undefined) attrs.opacity = p.opacity;
    const mEnd = p.markerEnd ? markerId(p.markerEnd, kleur, false) : null;
    const heeftRuit = p.markerStart === "ruit" || p.markerStart === "ruit-open";
    const mStart = p.markerStart && !heeftRuit ? markerId(p.markerStart, kleur, true) : null;
    if (mEnd) attrs["marker-end"] = `url(#${mEnd})`;
    if (mStart) attrs["marker-start"] = `url(#${mStart})`;
    kinderen.push(vorm("path", attrs));
    if (heeftRuit) {
      const ruit = ruitPolygon(d, p.markerStart === "ruit-open", kleur, thema.surface);
      if (ruit) kinderen.push(ruit);
    }

    // Labels: op het labelpunt van de padfunctie (midden), of 70% richting het uiteinde (bron,
    // doel); een handmatige verschuiving (labelOffsets) telt mee. Chip zoals .dc-edge-label.
    const posities = {
      midden: { x: labelX, y: labelY - (p.labelsBoven ? 13 : 0) },
      doel: { x: labelX + (u.targetX - labelX) * 0.7, y: labelY + (u.targetY - labelY) * 0.7 },
      bron: { x: labelX + (u.sourceX - labelX) * 0.7, y: labelY + (u.sourceY - labelY) * 0.7 },
    };
    // Meerdere labels op dezelfde zijde (een BPMN-stroom met conditie én naam, kardinaliteit +
    // {ordered}) zouden exact op elkaar vallen: elk volgend label op die zijde schuift 18 px
    // omlaag, bovenop een eventuele verschuiving — dezelfde stapeling als ConnectorEdge. Tot
    // render 0.3.0 ontbrak ze hier en lag de naamchip midden op de conditie (RENDER-API, 05-11).
    const stapel = {};
    for (const label of p.labels || []) {
      const zijde = posities[label.zijde] ? label.zijde : "midden";
      const stapelIdx = (stapel[zijde] = (stapel[zijde] ?? -1) + 1);
      const delen = (label.delen || []).filter((x) => x.tekst);
      if (!delen.length) continue;
      const basis = posities[zijde];
      const pos = { x: basis.x + (label.offset?.x || 0), y: basis.y + (label.offset?.y || 0) + stapelIdx * LABEL_STAPEL };
      const naamDeel = delen.find((x) => x.veld === "naam");
      // Elk deel in zijn eigen stijl, zoals het canvas (.dc-edge-<soort>): een rolnaam vet,
      // een kardinaliteit paars en vet, een constraint klein en cursief. Tot 06-11 kreeg het
      // hele label de stijl van zijn eerste deel ("Naam 0..1 {enkelvoudig}" als één zwarte tekst).
      const stijlen = delen.map((deel) => deelStijl(deel, thema, !!naamDeel));
      // Tussen de delen 4 px (de gap van .dc-edge-label); een staart sluit aan op zijn naam.
      const tussen = delen.map((deel, i) => (i === 0 || deel.soort === "staart" ? 0 : LABEL_GAP));
      const bw = delen.reduce((som, deel, i) => som + tussen[i] + tekstBreedte(deel.tekst, stijlen[i]["font-size"] || LABEL, { vet: stijlen[i]["font-weight"] === 600 }), 0) + 12;
      kinderen.push(vorm("rect", { x: pos.x - bw / 2, y: pos.y - CHIP_H / 2, width: bw, height: CHIP_H, rx: 4, fill: thema.surface, "fill-opacity": 0.9, stroke: thema.border, "stroke-opacity": 0.4 }));
      // data-dc-label: de connector van dit label (voor tests en voor wie de SVG naloopt).
      const attrsT = { x: pos.x, y: pos.y + 3.5, "text-anchor": "middle", "font-size": LABEL, ...(el.id || e.id ? { "data-dc-label": el.id || e.id } : {}) };
      if (naamDeel) attrsT["data-dc-veld"] = `connector:${el.id}:naam`;
      if (delen.length === 1) {
        // Eén deel: de stijl op de tekst zelf.
        kinderen.push(vorm("text", { ...attrsT, ...stijlen[0], "font-size": stijlen[0]["font-size"] || LABEL }, delen[0].tekst));
      } else {
        // Meer delen: één gecentreerde tekst met een tspan per deel; de browser zet ze achter elkaar.
        kinderen.push(vorm("text", attrsT, ...delen.map((deel, i) => vorm("tspan", { ...(tussen[i] ? { dx: tussen[i] } : {}), ...stijlen[i] }, deel.tekst))));
      }
      punten.push({ x: pos.x - bw / 2, y: pos.y - CHIP_H / 2 }, { x: pos.x + bw / 2, y: pos.y + CHIP_H / 2 });
    }
  }
  return { defs: [...defs.values()], boom: vorm("g", { class: "dc-lijnen" }, ...kinderen), punten };
}
