/**
 * sjabloon/schets — een Studio-diagram als eenvoudige, deterministische SVG,
 * zonder DOM en zonder profielkennis: posities en maten uit het diagram,
 * de vorm uit `elementType.shape` (familie: ellips, actor, kader, notitie,
 * afgerond, vak, punt), lijnen uit `edgePresentatie` (streep, pijlpunt).
 *
 * Dit is de tekening voor documenten (`{{svg}}` in een sjabloon). Het is een
 * schets: geen compartiment-opmaak of handmatige knikken; de headless
 * V3-tekenaar (`diagramsvg`) blijft voor canonieke modellen de rijke optie.
 * Hergebruikt de svg-helpers van diagramsvg (vaste attribuutvolgorde,
 * afronding), zodat dezelfde invoer altijd dezelfde tekst geeft.
 */
import { el as svgEl, esc, num } from "../../diagramsvg/svg.js";

const DASHES = { "dash-6-3": "6 3", "dash-4-3": "4 3", "dash-4-4": "4 4" };

/** Vorm-familie uit een shape-id (basisShapes + profielen). */
export function vormFamilie(shape = "") {
  if (/ellips|^bol$|cmmn-mijlpaal/.test(shape)) return "ellips";
  if (/actor/.test(shape)) return "actor";
  if (/boundary|systeem|package|partitie|pool|lane|stage|caseplan|fragment|composiet|laag/.test(shape)) return "kader";
  if (/note|notitie/.test(shape)) return "notitie";
  if (/begin|eind|event|junction|historie|punt|gateway|keuze|beslissing|fork|^anker$/.test(shape)) return "punt";
  if (/rounded|taak|bpmn-subproces|chip|am-blok/.test(shape)) return "afgerond";
  return "vak";
}

const STANDAARD_MAAT = {
  ellips: [160, 64],
  actor: [70, 92],
  kader: [240, 160],
  notitie: [160, 80],
  punt: [32, 32],
  afgerond: [160, 56],
  vak: [180, 60],
};

/** Maat van een voorkomen: opgeslagen maat, anders standaard per familie (+ velden bij een vak). */
export function schetsMaat(node, element, elementType) {
  // Achtergrond-typen (kaders, groeperingen, lagen) zijn altijd een kader.
  const fam = elementType?.achtergrond ? "kader" : vormFamilie(elementType?.shape);
  const [bw, bh] = STANDAARD_MAAT[fam] || STANDAARD_MAAT.vak;
  let w = node?.size?.width || elementType?.minBreedte || bw;
  let h = node?.size?.height || bh;
  if (!node?.size && fam === "vak") {
    const velden = (element?.compartimenten || []).reduce((t, c) => t + (c.velden || []).length, 0);
    h = Math.max(h, 40 + velden * 16);
  }
  return { w: Math.max(w, elementType?.minBreedte || 0), h: Math.max(h, elementType?.minHoogte || 0), fam };
}

/** Snijpunt van de lijn vanuit het midden van een rechthoek naar (px,py) met de rand. */
function randPunt(box, px, py) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const dx = px - cx;
  const dy = py - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const sx = dx ? box.w / 2 / Math.abs(dx) : Infinity;
  const sy = dy ? box.h / 2 / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

function regelsVanTekst(tekst, maxTekens) {
  const woorden = String(tekst || "").split(/\s+/).filter(Boolean);
  const regels = [];
  let huidig = "";
  for (const w of woorden) {
    if (huidig && (huidig + " " + w).length > maxTekens) {
      regels.push(huidig);
      huidig = w;
    } else huidig = huidig ? huidig + " " + w : w;
  }
  if (huidig) regels.push(huidig);
  return regels.length ? regels : [""];
}

function tekstBlok(x, y, regels, { anker = "middle", gewicht = "normal", grootte = 12, kleur = "#0f172a" } = {}) {
  const lh = grootte * 1.25;
  const start = y - ((regels.length - 1) * lh) / 2;
  return regels
    .map((r, i) => svgEl("text", { x, y: start + i * lh, "text-anchor": anker, "font-size": grootte, "font-weight": gewicht, fill: kleur, "dominant-baseline": "middle" }, esc(r)))
    .join("");
}

function tekenNode(box, element, elementType) {
  const { x, y, w, h, fam } = box;
  const kleur = element?.data?.kleur || elementType?.kleur || "#ffffff";
  const rand = "#475569";
  const naam = element?.naam || "";
  const delen = [];
  if (fam === "ellips") {
    delen.push(svgEl("ellipse", { cx: x + w / 2, cy: y + h / 2, rx: w / 2, ry: h / 2, fill: kleur, stroke: rand, "stroke-width": 1.2 }));
    delen.push(tekstBlok(x + w / 2, y + h / 2, regelsVanTekst(naam, Math.max(8, Math.floor(w / 8))), { gewicht: 600 }));
  } else if (fam === "actor") {
    const cx = x + w / 2;
    const r = Math.min(10, h / 9);
    const top = y + 4;
    delen.push(svgEl("circle", { cx, cy: top + r, r, fill: "none", stroke: rand, "stroke-width": 1.4 }));
    const nek = top + 2 * r;
    const heup = nek + h * 0.3;
    delen.push(svgEl("path", { d: `M ${num(cx)} ${num(nek)} V ${num(heup)} M ${num(cx - w * 0.3)} ${num(nek + 8)} H ${num(cx + w * 0.3)} M ${num(cx)} ${num(heup)} L ${num(cx - w * 0.28)} ${num(heup + h * 0.3)} M ${num(cx)} ${num(heup)} L ${num(cx + w * 0.28)} ${num(heup + h * 0.3)}`, fill: "none", stroke: rand, "stroke-width": 1.4, "stroke-linecap": "round" }));
    delen.push(tekstBlok(cx, y + h + 10, regelsVanTekst(naam, 16), { gewicht: 600, grootte: 11 }));
  } else if (fam === "kader") {
    const laag = /laag/.test(elementType?.shape || "");
    delen.push(svgEl("rect", { x, y, width: w, height: h, rx: 8, fill: element?.data?.achtergrondKleur || (laag ? "#f8fafc" : "none"), stroke: element?.data?.kleur || (laag ? "#cbd5e1" : "#94a3b8"), "stroke-width": 1.5, "stroke-dasharray": /boundary/.test(elementType?.shape || "") ? "6 4" : null }));
    delen.push(tekstBlok(x + 10, y + 14, [naam], { anker: "start", gewicht: 700, grootte: 11, kleur: "#475569" }));
  } else if (fam === "notitie") {
    const v = 10;
    delen.push(svgEl("path", { d: `M ${num(x)} ${num(y)} H ${num(x + w - v)} L ${num(x + w)} ${num(y + v)} V ${num(y + h)} H ${num(x)} Z`, fill: kleur === "#ffffff" ? "#fef9c3" : kleur, stroke: rand, "stroke-width": 1 }));
    delen.push(tekstBlok(x + 8, y + h / 2, regelsVanTekst(element?.data?.tekst || naam, Math.max(8, Math.floor(w / 7))), { anker: "start", grootte: 11 }));
  } else if (fam === "punt") {
    const r = Math.min(w, h) / 2;
    const dicht = /eind|end/.test(elementType?.shape || "");
    delen.push(svgEl("circle", { cx: x + w / 2, cy: y + h / 2, r, fill: dicht ? "#0f172a" : "none", stroke: "#0f172a", "stroke-width": 2 }));
    if (naam) delen.push(tekstBlok(x + w / 2, y + h + 10, [naam], { grootte: 11 }));
  } else {
    delen.push(svgEl("rect", { x, y, width: w, height: h, rx: fam === "afgerond" ? 14 : 4, fill: kleur, stroke: rand, "stroke-width": 1.2 }));
    const velden = (element?.compartimenten || []).flatMap((c) => c.velden || []);
    if (fam === "vak" && velden.length) {
      delen.push(tekstBlok(x + w / 2, y + 16, [naam], { gewicht: 700 }));
      delen.push(svgEl("line", { x1: x, y1: y + 30, x2: x + w, y2: y + 30, stroke: rand, "stroke-width": 1 }));
      velden.slice(0, Math.floor((h - 34) / 16)).forEach((v, i) => {
        const t = v.data?.typeLabel ? `${v.naam}: ${v.data.typeLabel}` : v.naam;
        delen.push(tekstBlok(x + 8, y + 40 + i * 16, [t], { anker: "start", grootte: 11 }));
      });
    } else {
      delen.push(tekstBlok(x + w / 2, y + h / 2, regelsVanTekst(naam, Math.max(8, Math.floor(w / 8))), { gewicht: 600 }));
    }
  }
  return delen.join("");
}

/**
 * Teken een diagram als SVG-tekst.
 * @param {{ diagram: Object, elements: Record<string,Object>, descriptor: Object, idPrefix?: string }} invoer
 * @returns {string} SVG, of "" als er niets te tekenen is
 */
export function schetsDiagramSvg({ diagram, elements, descriptor, idPrefix = "s" }) {
  const typen = Object.fromEntries((descriptor?.elementTypes || []).map((t) => [t.id, t]));
  const boxen = new Map();
  for (const n of diagram?.nodes || []) {
    const element = elements?.[n.elementId];
    if (!element) continue;
    const et = typen[element.elementType];
    if (et?.isConnector) continue;
    const { w, h, fam } = schetsMaat(n, element, et);
    const sleutel = n.nodeId || n.elementId;
    boxen.set(sleutel, { x: n.position?.x || 0, y: n.position?.y || 0, w, h, fam, element, et, elementId: n.elementId });
  }
  if (!boxen.size) return "";
  const perElement = new Map();
  for (const b of boxen.values()) if (!perElement.has(b.elementId)) perElement.set(b.elementId, b);

  // Volgorde: kaders (achtergrond) eerst, dan de rest; stabiel op positie.
  const items = [...boxen.values()].sort((a, b) => {
    const za = a.et?.achtergrond || a.fam === "kader" ? 0 : 1;
    const zb = b.et?.achtergrond || b.fam === "kader" ? 0 : 1;
    return za - zb || a.y - b.y || a.x - b.x;
  });
  const marge = 24;
  const minX = Math.min(...items.map((b) => b.x)) - marge;
  const minY = Math.min(...items.map((b) => b.y)) - marge;
  const maxX = Math.max(...items.map((b) => b.x + b.w)) + marge;
  const maxY = Math.max(...items.map((b) => b.y + b.h + (b.fam === "actor" || b.fam === "punt" ? 18 : 0))) + marge;

  const delen = [];
  for (const b of items) delen.push(tekenNode(b, b.element, b.et));

  // Lijnen: connectoren met beide uiteinden op het diagram.
  const markers = new Set();
  for (const c of Object.values(elements || {})) {
    const et = typen[c.elementType];
    if (!et?.isConnector || !c.source || !c.target) continue;
    const a = perElement.get(c.source);
    const b = perElement.get(c.target);
    if (!a || !b) continue;
    const p = et.edgePresentatie || {};
    if (p.verbergBijNesting) continue; // lidmaatschap: het kind ligt al in het kader
    // Lijnen gaan om het naamlabel onder een actor/punt heen (anders landt
    // een pijlpunt precies op de naam).
    const metLabel = (bx) => (bx.fam === "actor" || bx.fam === "punt" ? { ...bx, h: bx.h + 24 } : bx);
    const ra = metLabel(a);
    const rb = metLabel(b);
    const ca = { x: ra.x + ra.w / 2, y: ra.y + ra.h / 2 };
    const cb = { x: rb.x + rb.w / 2, y: rb.y + rb.h / 2 };
    const van = a === b ? { x: ca.x, y: a.y } : randPunt(ra, cb.x, cb.y);
    const naar = a === b ? { x: cb.x + 20, y: b.y } : randPunt(rb, ca.x, ca.y);
    const marker = p.markerEnd && ["pijl-open", "driehoek", "pijl-dicht"].includes(p.markerEnd) ? p.markerEnd : null;
    if (marker) markers.add(marker);
    delen.push(
      svgEl("line", {
        x1: van.x, y1: van.y, x2: naar.x, y2: naar.y,
        stroke: p.kleur || "#475569", "stroke-width": p.dikte || 1.3,
        "stroke-dasharray": DASHES[p.lijn] || null,
        "marker-end": marker ? `url(#${idPrefix}-${marker})` : null,
      })
    );
    const label = c.naam || (et.stereotype ? et.stereotype : /include|extend/.test(et.id) ? `«${et.id}»` : "");
    if (label) delen.push(tekstBlok((van.x + naar.x) / 2, (van.y + naar.y) / 2 - 6, [label], { grootte: 10, kleur: "#475569" }));
  }

  const defs = [...markers].map((m) => {
    const id = `${idPrefix}-${m}`;
    if (m === "pijl-open") return svgEl("marker", { id, markerWidth: 12, markerHeight: 10, refX: 10, refY: 5, orient: "auto", markerUnits: "userSpaceOnUse" }, svgEl("path", { d: "M 1 1 L 10 5 L 1 9", fill: "none", stroke: "#475569", "stroke-width": 1.2 }));
    if (m === "driehoek") return svgEl("marker", { id, markerWidth: 14, markerHeight: 14, refX: 13, refY: 7, orient: "auto", markerUnits: "userSpaceOnUse" }, svgEl("path", { d: "M 1 1 L 13 7 L 1 13 Z", fill: "#ffffff", stroke: "#475569", "stroke-width": 1.2 }));
    return svgEl("marker", { id, markerWidth: 12, markerHeight: 12, refX: 11, refY: 6, orient: "auto", markerUnits: "userSpaceOnUse" }, svgEl("path", { d: "M 1 1.5 L 11 6 L 1 10.5 Z", fill: "#475569" }));
  });

  return svgEl(
    "svg",
    { xmlns: "http://www.w3.org/2000/svg", viewBox: `${num(minX)} ${num(minY)} ${num(maxX - minX)} ${num(maxY - minY)}`, width: num(maxX - minX), height: num(maxY - minY), "font-family": "system-ui, Segoe UI, sans-serif", role: "img" },
    (defs.length ? svgEl("defs", {}, defs.join("")) : "") + delen.join("")
  );
}
