// @ts-check
/**
 * tekenaar — één tekenaar voor Studio-diagrammen (plan docs/plans/2026-11-04 Eén tekenaar, stap 2).
 *
 * Een diagram uit een profielstore (diagram + elements + descriptor, met de shape-set al
 * toegepast) wordt een VormBoom en daarmee SVG: dezelfde view voor documenten (`{{svg}}`), de
 * gedeelde plaatjes, render-svc (`taal=studio`) en straks het canvas (stap 3). Per voorkomen:
 *
 *   1. maat     — opgeslagen maat of gemeten inhoud (maat.js);
 *   2. vorm     — de ShapeRenderer van het ShapeType, of de terugval per familie (vormen.js);
 *   3. inhoud   — naam, stereotype, badges, inhoudsregels, compartimenten in het inhoudsvak
 *                 (inhoud.js) — van de motor, nooit van de vorm;
 *   4. ornament en buitenlabel (`naamLabel: "buiten"`, of een vorm zonder inhoudsvak);
 *   5. lijnen   — gedaanten en presentatie uit canvas/materialiseerConnectoren.js, geometrie in
 *                 lijnen.js.
 *
 * Kleuren: thema-tokens `var(--diagram-*, …)` (diagramsvg/thema.js), tenzij het element of het
 * type een kleur zet — die staat letterlijk in de SVG, de tekst erop kiest op contrast.
 * Puur: geen DOM, geen stores; deterministisch (vaste attribuutvolgorde, afronding).
 *
 * `detail: "schets"` geeft de lichte stand (transformatie/sjabloon/schets.js, zeven families;
 * besluit Mark 04-11: die blijft voorlopig).
 */
import { maakPalet } from "../../diagramsvg/thema.js";
import { breekAf } from "../../diagramsvg/tekstmaat.js";
import { fnv1a } from "../../diagramsvg/svg.js";
import { schetsDiagramSvg } from "../../transformatie/sjabloon/schets.js";
import { materialiseerConnectoren, effectieveConnectorGedaante } from "../canvas/materialiseerConnectoren.js";
import { bepaalOpnames } from "../canvas/opname.js";
import { voorkomenId } from "../model/voorkomens.js";
import { lidConnectoren } from "../types/containerVoor.js";
import { vorm } from "../types/shapeType.js";
import { vormVoor } from "./vormen.js";
import { bouwVoorkomen, tekenVoorkomen, basisVanPalet, FONT } from "./voorkomen.js";
import { tekenLijnen } from "./lijnen.js";
import { naarSvg } from "./serialiseer.js";

export { naarSvg } from "./serialiseer.js";
export { vormVoor } from "./vormen.js";

const MARGE = 24;
const BUITENLABEL_BREEDTE = 132;

const perId = (lijst) => Object.fromEntries((lijst || []).map((t) => [t.id, t]));
const veiligId = (s) => String(s ?? "").replace(/[^A-Za-z0-9_-]/g, "-");

/**
 * De omvang van een inhoudsvak in element-coördinaten, zoals de motor het tekent: een gedraaid
 * vak (pool: -90) draait om zijn midden (inhoud.js), dus telt de omvang ná het draaien.
 * @param {{x: number, y: number, w: number, h: number, rotatie?: number}} vak
 * @returns {{x0: number, y0: number, x1: number, y1: number}}
 */
export function vakOmvang(vak) {
  const cx = vak.x + vak.w / 2;
  const cy = vak.y + vak.h / 2;
  const r = ((vak.rotatie || 0) * Math.PI) / 180;
  const halfW = (Math.abs(Math.cos(r)) * vak.w + Math.abs(Math.sin(r)) * vak.h) / 2;
  const halfH = (Math.abs(Math.sin(r)) * vak.w + Math.abs(Math.cos(r)) * vak.h) / 2;
  return { x0: cx - halfW, y0: cy - halfH, x1: cx + halfW, y1: cy + halfH };
}

/**
 * Teken een diagram als VormBoom.
 * @param {Object} invoer
 * @param {Object} invoer.diagram
 * @param {Record<string, Object>} invoer.elements
 * @param {Object} invoer.descriptor         - met de shape-set al toegepast (model/shapeSet.js)
 * @param {string} [invoer.idPrefix]         - voor marker-id's; standaard een hash van de invoer
 * @param {"auto"|"light"|"dark"} [invoer.thema]
 * @param {(verw: any) => string|null} [invoer.verwijzingNaam] - naam van een doeldiagram (diagramverwijzing)
 * @param {boolean} [invoer.maatAttributen]  - width/height op de <svg> (documenten); render-svc zet false
 * @param {string|null} [invoer.titel]
 * @param {boolean} [invoer.controleer]      - renderer-uitvoer toetsen aan het vormcontract (tests)
 * @returns {{boom: Object|null, viewBox: {x: number, y: number, w: number, h: number}|null, terugval: string[]}}
 */
export function tekenDiagram({ diagram, elements, descriptor, idPrefix = null, thema = "auto", verwijzingNaam = null, maatAttributen = true, titel = null, controleer = false }) {
  // De profiel-default voor randAanhechting inbakken, net als DiagramCanvas: zo ziet
  // materialiseerConnectoren hier dezelfde zwevende uiteinden als op het canvas.
  const randDefault = descriptor?.randAanhechting || "zijden";
  const typen = perId((descriptor?.elementTypes || []).map((et) => (et.randAanhechting ? et : { ...et, randAanhechting: randDefault })));
  const fieldTypesById = perId(descriptor?.fieldTypes);
  const compartmentTypesById = perId(descriptor?.compartmentTypes);
  const basis = basisVanPalet(maakPalet(thema));
  const prefix = idPrefix || `t${fnv1a(JSON.stringify([diagram?.id, Object.keys(elements || {}).length]))}`;
  const terugval = new Set();
  const fouten = [];

  const opnames = bepaalOpnames(elements || {}, diagram, typen);
  const posities = new Map((diagram?.nodes || []).map((n) => [n.elementId, n.position || { x: 0, y: 0 }]));

  /** Bouw de tekenstand van één voorkomen (zonder te tekenen); gedeeld met het canvas (voorkomen.js). */
  const maakBox = (ref, element, et, positie, soort = "node") => {
    const vormInfo = vormVoor(soort === "anker" ? "anker" : et?.shape || "class-box", et);
    if (vormInfo.terugval) terugval.add(vormInfo.shapeType.id);
    const box = bouwVoorkomen({
      element,
      elementType: et,
      shapeType: vormInfo.shapeType,
      renderer: vormInfo.renderer,
      ref,
      diagram,
      elements,
      fieldTypesById,
      compartmentTypesById,
      basis,
      idPrefix: `${prefix}-${veiligId(ref ? voorkomenId(ref) : element.id)}`,
      // Compartimenten verborgen op dit voorkomen (gedaante "kop", of diagram-breed).
      verborgen: !!ref && (ref.gedaante === "kop" || (!!diagram?.verbergCompartimenten && ref.gedaante !== "vol")),
      verwijzingNaam,
    });
    return { ...box, x: positie.x, y: positie.y, ref, soort };
  };

  const boxen = new Map();
  for (const ref of diagram?.nodes || []) {
    const element = elements?.[ref.elementId];
    if (!element) continue;
    const et = typen[element.elementType];
    if (et?.isConnector && effectieveConnectorGedaante(element, diagram) !== "box") continue;
    if (opnames.ingebedVoorkomens.has(voorkomenId(ref))) continue;
    // Een aangehecht rand-element staat relatief aan zijn gastheer.
    let positie = { x: ref.position?.x || 0, y: ref.position?.y || 0 };
    const gastheer = et?.randElement && element.data?.randVan ? posities.get(element.data.randVan) : null;
    if (gastheer) positie = { x: positie.x + gastheer.x, y: positie.y + gastheer.y };
    boxen.set(voorkomenId(ref), maakBox(ref, element, et, positie));
  }
  if (!boxen.size) return { boom: null, viewBox: null, terugval: [] };

  // Lijnen en hun ankers/boxen: dezelfde materialisatie als het canvas, met onze maten.
  const maten = Object.fromEntries([...boxen].map(([id, b]) => [id, { width: b.w, height: b.h }]));
  const { edges, extraNodes } = materialiseerConnectoren(elements, diagram, typen, maten);
  for (const n of extraNodes) {
    const element = elements[n.connectorId];
    if (!element) continue;
    const et = typen[element.elementType];
    if (n.soort === "anker") boxen.set(n.id, maakBox(null, { id: n.id, naam: "", elementType: element.elementType, data: {} }, { id: "__anker", shape: "anker" }, n.position, "anker"));
    else boxen.set(n.id, maakBox(null, element, et, n.position, "box"));
  }

  // Tekenvolgorde: achtergrondkaders, dan containers (groot eerst), dan de rest; stabiel op positie.
  const laag = (b) => (b.et.achtergrond ? 0 : lidConnectoren(b.et).length || b.ctx.shapeType.renderer === "kader" ? 1 : 2);
  const volgorde = [...boxen.values()].sort((a, b) => laag(a) - laag(b) || (laag(a) < 2 ? b.w * b.h - a.w * a.h : 0) || a.y - b.y || a.x - b.x);

  const punten = [];
  const knopen = [];
  for (const b of volgorde) {
    const { ctx, element, et } = b;
    const { omtrek, inhoud, ornament, vak, fouten: eigen } = tekenVoorkomen(b, { controleer });
    fouten.push(...eigen);
    const kinderen = [omtrek];
    if (inhoud) kinderen.push(inhoud);
    if (ornament) kinderen.push(ornament);
    // Buitenlabel: de naam onder een vorm die hem niet kan dragen.
    const buiten = element.naam && (et.naamLabel === "buiten" || (!vak && et.naamLabel !== "geen"));
    let onder = 0;
    if (buiten) {
      const regels = breekAf(element.naam, 11, BUITENLABEL_BREEDTE, { vet: true });
      regels.forEach((r, i) => kinderen.push(vorm("text", { class: "dc-buitenlabel", x: b.w / 2, y: b.h + 3 + 11 + i * 14, "text-anchor": "middle", "font-size": 11, "font-weight": 600, fill: basis.text, ...(i === 0 ? { "data-dc-naam": "" } : {}) }, r)));
      onder = 3 + regels.length * 14;
      punten.push({ x: b.x + b.w / 2 - BUITENLABEL_BREEDTE / 2, y: b.y }, { x: b.x + b.w / 2 + BUITENLABEL_BREEDTE / 2, y: b.y + b.h + onder });
    }
    const attrs = { class: `dc-voorkomen${b.soort === "anker" ? " is-anker" : ""}`, transform: `translate(${b.x} ${b.y})`, "data-element-id": element.id };
    if (b.ref?.nodeId) attrs["data-voorkomen-id"] = b.ref.nodeId;
    if (et.id) attrs["data-element-type"] = et.id;
    knopen.push(vorm("g", attrs, ...kinderen));
    punten.push({ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y + b.h + onder });
    // Een inhoudsvak dat buiten de doos valt hoort bij het beeld: de kop van een levenslijn is 148
    // breed op een node van 14, en viel aan de rand van het diagram buiten de viewBox (gevonden
    // 06-11 op de SVG-link van de app). Ook zonder tekst: een type-kop tekent zichzelf in dat vak.
    if (vak) {
      const o = vakOmvang(vak);
      punten.push({ x: b.x + o.x0, y: b.y + o.y0 }, { x: b.x + o.x1, y: b.y + o.y1 });
    }
    // De satellieten van een bol steken buiten de maat uit.
    if (ctx.shapeType.renderer === "bol") punten.push({ x: b.x - 40, y: b.y - 40 }, { x: b.x + b.w + 40, y: b.y + b.h + 40 });
  }

  const lijnen = tekenLijnen({ edges, boxen, elements, diagram, typen, thema: basis, idPrefix: prefix });
  punten.push(...lijnen.punten);
  if (controleer && fouten.length) throw new Error(fouten.join("\n"));

  const minX = Math.floor(Math.min(...punten.map((p) => p.x)) - MARGE);
  const minY = Math.floor(Math.min(...punten.map((p) => p.y)) - MARGE);
  const maxX = Math.ceil(Math.max(...punten.map((p) => p.x)) + MARGE);
  const maxY = Math.ceil(Math.max(...punten.map((p) => p.y)) + MARGE);
  const viewBox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

  const attrs = { xmlns: "http://www.w3.org/2000/svg", viewBox: `${minX} ${minY} ${viewBox.w} ${viewBox.h}` };
  if (maatAttributen) {
    attrs.width = viewBox.w;
    attrs.height = viewBox.h;
  }
  attrs.role = "img";
  attrs.class = "omnium-diagram";
  attrs["font-family"] = FONT;
  attrs["data-tekenaar"] = "vol";
  const boom = vorm(
    "svg",
    attrs,
    titel ? vorm("title", {}, titel) : null,
    lijnen.defs.length ? vorm("defs", {}, ...lijnen.defs) : null,
    vorm("g", { class: "dc-voorkomens" }, ...knopen),
    lijnen.boom
  );
  return { boom, viewBox, terugval: [...terugval].sort() };
}

/**
 * Diagram → SVG-tekst. Leeg diagram → "". `detail: "schets"` = de lichte stand.
 * @param {Parameters<typeof tekenDiagram>[0] & {detail?: "vol"|"schets"}} invoer
 */
export function diagramSvg(invoer) {
  if (invoer.detail === "schets") {
    return schetsDiagramSvg({ diagram: invoer.diagram, elements: invoer.elements, descriptor: invoer.descriptor, idPrefix: invoer.idPrefix || "s", verwijzingNaam: invoer.verwijzingNaam || null });
  }
  const { boom } = tekenDiagram(invoer);
  return boom ? naarSvg(boom) : "";
}
