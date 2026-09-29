/**
 * vormen — maat en SVG per elementtype (entiteit, gegevenselement, relatie, …).
 *
 * Volgt de class-boxes van de UML-editor in Studio (umleditor/components/nodes)
 * zo dicht als in pure SVG kan: stereotype-regel, vette naam, een compartiment
 * met velden (naam links, type rechts), relaties zonder velden als compact
 * naambadge, associatie-anker als stip. Maten komen uit tekstmaat.js, dus zijn
 * op elke machine gelijk.
 *
 * Twee stappen: `maakVorm(node, ctx)` berekent een beschrijving met breedte en
 * hoogte (die de layout nodig heeft); `tekenVorm(vorm, x, y, ctx)` schrijft de
 * SVG op de uiteindelijke positie.
 */
import { el, tekst } from "./svg.js";
import { tekstBreedte, breekAf } from "./tekstmaat.js";
import { tekstOp } from "./thema.js";

const PAD = 10;
const STEREO = 10;
const NAAM = 14;
const VELD = 11;
const TYPE = 10;
const RIJ = 16;
const MAX_WAARDEN = 12;
const MIN_BREEDTE = { entiteit: 180, gegevenselement: 180, relatie: 180, enumeratie: 140, gegevenstype: 140, referentielijstInstantie: 160 };
const NOTITIE_BREEDTE = 200;

const STEREOTYPE = {
  gegevenselement: "«gegevenselement»",
  relatie: "«relatie»",
  enumeratie: "«enumeratie»",
  gegevenstype: "«gegevenstype»",
  referentielijstInstantie: "«ref.lijst instantie»",
  constraint: "«constraint»",
};

function entiteitStereotype(data) {
  if (data.entiteitSubtype === "referentielijst") return "«referentielijst»";
  if (data.entiteitSubtype === "referentielijst_item") return "«ref.lijst item»";
  return "«entiteit»";
}

function veldType(v) {
  const basis = v.enumNaam || v.datatypeNaam || v.refNaam || v.type || "";
  return !v.enumNaam && !v.datatypeNaam && !v.refNaam && v.format ? `${basis} «${v.format}»` : basis;
}

function veldRijen(data) {
  const secties = [];
  const velden = (data.velden || []).map((v) => ({ naam: `${v.afgeleid ? "/" : ""}${v.naam}`, type: veldType(v), vet: !!v.verplicht }));
  if (velden.length) secties.push(velden);
  const afgeleid = (data.afgeleideVelden || []).map((av) => ({ naam: `/${av.naam}`, type: av.goType || "string", cursief: true }));
  if (afgeleid.length) secties.push(afgeleid);
  return secties;
}

function rijBreedte(r) {
  if (r.tekst !== undefined) return tekstBreedte(r.tekst, VELD);
  const n = tekstBreedte(r.naam, VELD, { vet: r.vet });
  return r.type ? n + 12 + tekstBreedte(r.type, TYPE) : n;
}

/**
 * @param node React Flow-node uit v3ModelNaarEditor
 * @param ctx  { velden: boolean, extern: boolean, vulling: "#hex" }
 */
export function maakVorm(node, ctx) {
  const d = node.data || {};
  const type = node.type;
  const naam = d.klassenaam || d.typenaam || d.naam || d.systeemnaam || node.id;

  if (type === "associatieAnker") return { soort: "anker", w: 12, h: 12 };

  if (type === "notitie" || type === "constraint") {
    const breedte = Math.min(400, Math.max(120, Number(d.breedte) || NOTITIE_BREEDTE));
    const inhoud = type === "notitie" ? d.tekst : d.expressie ? `{ ${d.expressie} }` : "";
    const regels = inhoud ? breekAf(inhoud, VELD, breedte - 2 * PAD) : [];
    const stereotype = type === "constraint" ? STEREOTYPE.constraint : null;
    const kopNaam = d.naam || "";
    let h = 8 + (stereotype ? 13 : 0) + (kopNaam ? 17 : 0) + regels.length * 15 + 8;
    h = Math.max(h, 36);
    return { soort: type, w: breedte, h: Math.ceil(h), stereotype, naam: kopNaam, regels, vulling: ctx.vulling };
  }

  const zonderVelden = (type === "relatie" && veldRijen(d).length === 0) || (type === "relatie" && !ctx.velden);
  if (type === "relatie" && zonderVelden) {
    const w = Math.max(80, Math.ceil(tekstBreedte(naam, 12, { vet: true }) + 2 * PAD + 4));
    return { soort: "badge", w, h: 28, naam, vulling: ctx.vulling, extern: ctx.extern, domein: d.domein };
  }

  let stereotype = type === "entiteit" ? entiteitStereotype(d) : STEREOTYPE[type] || "";
  if (ctx.extern) stereotype = d.domein ? `domein ${d.domein}` : "ander domein";

  let secties = [];
  if (!ctx.extern && ctx.velden) {
    if (type === "enumeratie") {
      const waarden = d.waarden || [];
      const rijen = waarden.slice(0, MAX_WAARDEN).map((w) => ({ tekst: String(w) }));
      if (waarden.length > MAX_WAARDEN) rijen.push({ tekst: `… +${waarden.length - MAX_WAARDEN}`, gedempt: true });
      if (rijen.length) secties.push(rijen);
    } else if (type === "gegevenstype") {
      secties.push([{ tekst: d.format ? `${d.basistype || "string"} «${d.format}»` : d.basistype || "string" }]);
    } else if (type === "entiteit" || type === "gegevenselement" || type === "relatie") {
      secties = veldRijen(d);
    }
  }

  const kopH = 6 + 13 + 18 + 5;
  const kopB = Math.max(tekstBreedte(stereotype, STEREO), tekstBreedte(naam, NAAM, { vet: true }));
  const rijB = Math.max(0, ...secties.flat().map(rijBreedte));
  const w = Math.ceil(Math.max(ctx.extern ? 120 : MIN_BREEDTE[type] || 160, kopB + 2 * PAD, rijB + 2 * PAD));
  const h = kopH + secties.reduce((som, s) => som + 1 + 4 + s.length * RIJ + 4, 0);
  return {
    soort: "kaart",
    w,
    h,
    stereotype,
    naam,
    cursief: !!d.isAbstract,
    secties,
    vulling: ctx.vulling,
    extern: ctx.extern,
    dik: type === "entiteit" && !ctx.extern,
  };
}

/**
 * Teken een vorm met linkerbovenhoek (x, y).
 * @param ctx { palet: token → kleur }
 */
export function tekenVorm(vorm, x, y, ctx) {
  const { palet } = ctx;
  const cx = x + vorm.w / 2;

  if (vorm.soort === "anker") {
    return el("circle", { cx, cy: y + 6, r: 5, fill: palet("surface"), stroke: palet("accent"), "stroke-width": 1.5 });
  }

  const extern = !!vorm.extern;
  const vulling = extern ? palet("surface") : vorm.vulling;
  const inkt = extern ? palet("text") : tekstOp(vorm.vulling);
  const rand = palet("border");
  const randAttrs = { stroke: rand, "stroke-width": vorm.dik ? 2 : 1.2, "stroke-dasharray": extern ? "5 3" : null };
  const delen = [];

  if (vorm.soort === "notitie" || vorm.soort === "constraint") {
    if (vorm.soort === "notitie") {
      const v = 10;
      delen.push(el("path", { d: `M${x},${y}H${x + vorm.w - v}L${x + vorm.w},${y + v}V${y + vorm.h}H${x}Z`, fill: vulling, ...randAttrs }));
      delen.push(el("path", { d: `M${x + vorm.w - v},${y}V${y + v}H${x + vorm.w}`, fill: "none", ...randAttrs }));
    } else {
      delen.push(el("rect", { x, y, width: vorm.w, height: vorm.h, rx: 4, fill: vulling, ...randAttrs }));
    }
    let ty = y + 8;
    if (vorm.stereotype) {
      ty += 10;
      delen.push(tekst({ x: x + PAD, y: ty, "font-size": STEREO, "font-style": "italic", fill: inkt, "fill-opacity": 0.7 }, vorm.stereotype));
      ty += 3;
    }
    if (vorm.naam) {
      ty += 13;
      delen.push(tekst({ x: x + PAD, y: ty, "font-size": 12, "font-weight": 700, fill: inkt }, vorm.naam));
      ty += 4;
    }
    for (const regel of vorm.regels) {
      ty += 15;
      delen.push(tekst({ x: x + PAD, y: ty - 3, "font-size": VELD, fill: inkt }, regel));
    }
    return delen.join("");
  }

  if (vorm.soort === "badge") {
    delen.push(el("rect", { x, y, width: vorm.w, height: vorm.h, rx: 14, fill: vulling, ...randAttrs }));
    delen.push(tekst({ x: cx, y: y + 18, "text-anchor": "middle", "font-size": 12, "font-weight": 700, fill: inkt }, vorm.naam));
    return delen.join("");
  }

  // kaart
  delen.push(el("rect", { x, y, width: vorm.w, height: vorm.h, rx: 8, fill: vulling, ...randAttrs }));
  delen.push(tekst({ x: cx, y: y + 16, "text-anchor": "middle", "font-size": STEREO, "font-style": "italic", fill: inkt, "fill-opacity": 0.7 }, vorm.stereotype));
  delen.push(
    tekst({ x: cx, y: y + 34, "text-anchor": "middle", "font-size": NAAM, "font-weight": 700, "font-style": vorm.cursief ? "italic" : null, fill: inkt }, vorm.naam),
  );
  let ry = y + 42;
  for (const sectie of vorm.secties) {
    delen.push(el("line", { x1: x, y1: ry, x2: x + vorm.w, y2: ry, stroke: inkt, "stroke-opacity": 0.25 }));
    ry += 1 + 4;
    for (const r of sectie) {
      const basis = ry + 12;
      if (r.tekst !== undefined) {
        delen.push(tekst({ x: x + PAD, y: basis, "font-size": VELD, fill: inkt, "fill-opacity": r.gedempt ? 0.7 : null }, r.tekst));
      } else {
        delen.push(
          tekst({ x: x + PAD, y: basis, "font-size": VELD, "font-weight": r.vet ? 700 : null, "font-style": r.cursief ? "italic" : null, fill: inkt }, r.naam),
        );
        if (r.type) {
          delen.push(tekst({ x: x + vorm.w - PAD, y: basis, "text-anchor": "end", "font-size": TYPE, fill: inkt, "fill-opacity": 0.7 }, r.type));
        }
      }
      ry += RIJ;
    }
    ry += 4;
  }
  return delen.join("");
}
