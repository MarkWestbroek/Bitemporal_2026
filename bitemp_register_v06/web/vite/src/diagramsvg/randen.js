/**
 * randen — de lijnen tussen elementen, met UML-uiteinden en kardinaliteiten.
 *
 * Soorten (afgeleid van edge.data uit v3ModelNaarEditor, zoals MetamodelEdge):
 *   comp      entiteit → gegevenselement   gevulde ruit bij de entiteit
 *   rel       entiteit → relatie → doel    doorgetrokken (accent), pijl als directioneel
 *   assoc     entiteit → anker → doel      idem, via het associatie-anker
 *   classlink anker ╌ relatie              gestreept (accent)
 *   dep       «use» naar enum/datatype     gestreept, open pijl
 *   gen       generalisatie                open driehoek bij het supertype
 *   scope     notitie/constraint ╌ element gestippeld
 *
 * Afwijking van Studio: rechte lijnen van rand tot rand (Studio tekent
 * bezier-curves tussen vaste handles). Dat leest in een statische figuur rustiger
 * en hangt niet af van de handle-keuze in de editor.
 */
import { el, tekst, num } from "./svg.js";

function soortVan(edge, bron, doel) {
  const d = edge.data || {};
  if (d.kind === "scope") return "scope";
  if (d.isGeneralization) return "gen";
  if (d.isAssociationClassLink) return "classlink";
  if (d.isDependency) return "dep";
  if (d.isAssociation) return "assoc";
  if (bron.type === "entiteit" && doel.type === "gegevenselement") return "comp";
  return "rel";
}

/** Punt waar de lijn vanuit het midden van `box` richting `naar` de rand verlaat. */
function randpunt(box, naar) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const dx = naar.x - cx;
  const dy = naar.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  if (box.rond) {
    const l = Math.hypot(dx, dy);
    return { x: cx + (dx / l) * (box.w / 2), y: cy + (dy / l) * (box.h / 2) };
  }
  const sx = dx === 0 ? Infinity : box.w / 2 / Math.abs(dx);
  const sy = dy === 0 ? Infinity : box.h / 2 / Math.abs(dy);
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

const midden = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** De markers die in <defs> moeten staan, per gebruikte soort. */
export function markerDefs(gebruikt, p, palet) {
  const defs = [];
  const pijl = (id, kleur) =>
    el(
      "marker",
      { id, viewBox: "0 0 12 12", refX: 11, refY: 6, markerWidth: 12, markerHeight: 12, markerUnits: "userSpaceOnUse", orient: "auto" },
      el("path", { d: "M1,1L11,6L1,11", fill: "none", stroke: kleur, "stroke-width": 1.5 }),
    );
  if (gebruikt.has("gen")) {
    defs.push(
      el(
        "marker",
        { id: `${p}mk-gen`, viewBox: "0 0 14 14", refX: 13, refY: 7, markerWidth: 14, markerHeight: 14, markerUnits: "userSpaceOnUse", orient: "auto" },
        el("path", { d: "M1,1L13,7L1,13Z", fill: palet("surface"), stroke: palet("border"), "stroke-width": 1.5 }),
      ),
    );
  }
  if (gebruikt.has("dep")) defs.push(pijl(`${p}mk-dep`, palet("muted")));
  if (gebruikt.has("pijl")) defs.push(pijl(`${p}mk-pijl`, palet("accent")));
  if (gebruikt.has("comp")) {
    defs.push(
      el(
        "marker",
        { id: `${p}mk-comp`, viewBox: "0 0 16 10", refX: 1, refY: 5, markerWidth: 16, markerHeight: 10, markerUnits: "userSpaceOnUse", orient: "auto" },
        el("path", { d: "M1,5L8,1L15,5L8,9Z", fill: palet("border") }),
      ),
    );
  }
  return defs;
}

/**
 * @param edge    React Flow-edge
 * @param bron    { node, box }  box = { x, y, w, h, rond? } op eindpositie
 * @param doel    idem
 * @param ctx     { p, palet, gebruikt: Set, id }
 * @returns SVG-string
 */
export function tekenRand(edge, bron, doel, ctx) {
  const { p, palet, gebruikt } = ctx;
  const d = edge.data || {};
  const soort = soortVan(edge, bron.node, doel.node);
  const a = randpunt(bron.box, midden(doel.box));
  const b = randpunt(doel.box, midden(bron.box));

  const stijl = {
    gen: { stroke: palet("border"), w: 1.5 },
    dep: { stroke: palet("muted"), w: 1.2, dash: "6 3" },
    classlink: { stroke: palet("accent"), w: 1.2, dash: "4 4" },
    assoc: { stroke: palet("accent"), w: 1.5 },
    rel: { stroke: palet("accent"), w: 1.5 },
    comp: { stroke: palet("border"), w: 1.5 },
    scope: { stroke: palet("muted"), w: 1, dash: "2 3" },
  }[soort];

  let eind = null;
  let begin = null;
  if (soort === "gen") eind = "gen";
  else if (soort === "dep") eind = "dep";
  else if ((soort === "rel" || soort === "assoc") && d.directioneel && doel.node.type === "entiteit") eind = "pijl";
  if (soort === "comp") begin = "comp";
  if (eind) gebruikt.add(eind);
  if (begin) gebruikt.add(begin);

  const delen = [
    el("path", {
      d: `M${num(a.x)},${num(a.y)}L${num(b.x)},${num(b.y)}`,
      fill: "none",
      stroke: stijl.stroke,
      "stroke-width": stijl.w,
      "stroke-dasharray": stijl.dash || null,
      "marker-start": begin ? `url(#${p}mk-${begin})` : null,
      "marker-end": eind ? `url(#${p}mk-${eind})` : null,
    }),
  ];

  const labelStijl = {
    "font-size": 10,
    fill: palet("text"),
    stroke: palet("surface"),
    "stroke-width": 3,
    "stroke-linejoin": "round",
    "paint-order": "stroke",
  };

  // Kardinaliteit bij één uiteinde: bij de doelkant, behalve de eerste helft
  // van een associatie (entiteit → anker): daar hoort hij bij de entiteit.
  const kard = soort === "comp" || soort === "rel" || soort === "assoc" ? d.kardinaliteit : "";
  if (kard) {
    const bijBron = soort === "assoc" && bron.node.type === "entiteit";
    const [P, Q] = bijBron ? [a, b] : [b, a];
    const l = Math.hypot(Q.x - P.x, Q.y - P.y) || 1;
    const ux = (Q.x - P.x) / l;
    const uy = (Q.y - P.y) / l;
    delen.push(tekst({ x: P.x + ux * 16 - uy * 9, y: P.y + uy * 16 + ux * 9 + 3.5, "text-anchor": "middle", ...labelStijl }, kard));
  }
  if (soort === "dep" && d.rolnaam) {
    delen.push(tekst({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 4, "text-anchor": "middle", ...labelStijl }, d.rolnaam));
  }

  return el("g", { id: ctx.id, class: `rand ${soort}` }, delen);
}
