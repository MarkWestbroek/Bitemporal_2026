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
import { maakPalet, veiligeKleur, tekstOp } from "../../diagramsvg/thema.js";
import { breekAf } from "../../diagramsvg/tekstmaat.js";
import { fnv1a } from "../../diagramsvg/svg.js";
import { schetsDiagramSvg } from "../../transformatie/sjabloon/schets.js";
import { materialiseerConnectoren, effectieveConnectorGedaante } from "../canvas/materialiseerConnectoren.js";
import { bepaalOpnames } from "../canvas/opname.js";
import { voorkomenId } from "../model/voorkomens.js";
import { lidConnectoren } from "../types/containerVoor.js";
import { vorm, losStijlOp, inhoudsregelsVan, valideerVormBoom, valideerVak } from "../types/shapeType.js";
import { vormVoor } from "./vormen.js";
import { planInhoud, tekenInhoud } from "./inhoud.js";
import { meetVoorkomen } from "./maat.js";
import { tekenLijnen } from "./lijnen.js";
import { naarSvg } from "./serialiseer.js";

export { naarSvg } from "./serialiseer.js";
export { vormVoor } from "./vormen.js";

const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const MARGE = 24;
const BUITENLABEL_BREEDTE = 132;

const perId = (lijst) => Object.fromEntries((lijst || []).map((t) => [t.id, t]));
const veiligId = (s) => String(s ?? "").replace(/[^A-Za-z0-9_-]/g, "-");

/** De kleuren voor één voorkomen: thema-tokens, tenzij er een eigen kleur is. */
function kleurenVoor(basis, stijl, parameters) {
  const hex = veiligeKleur(stijl.kleur, null);
  const vast = veiligeKleur(parameters.vulling, null);
  const vulling = hex || vast || basis.surface;
  const inkt = hex ? tekstOp(hex) : vast ? tekstOp(vast) : basis.text;
  return {
    ...basis,
    vulling,
    rand: veiligeKleur(parameters.rand, null) || basis.border,
    inkt,
    gedempt: hex || vast ? inkt : basis.muted,
  };
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
  const typen = perId(descriptor?.elementTypes);
  const fieldTypesById = perId(descriptor?.fieldTypes);
  const compartmentTypesById = perId(descriptor?.compartmentTypes);
  const palet = maakPalet(thema);
  const basis = { palet, surface: palet("surface"), border: palet("border"), text: palet("text"), muted: palet("muted"), accent: palet("accent") };
  const prefix = idPrefix || `t${fnv1a(JSON.stringify([diagram?.id, Object.keys(elements || {}).length]))}`;
  const terugval = new Set();
  const fouten = [];

  const opnames = bepaalOpnames(elements || {}, diagram, typen);
  const posities = new Map((diagram?.nodes || []).map((n) => [n.elementId, n.position || { x: 0, y: 0 }]));

  /** Bouw de tekenstand van één voorkomen (zonder te tekenen). */
  const maakBox = (ref, element, et, positie, soort = "node") => {
    const parametersVanType = (vormInfo) => vormInfo.shapeType.parameters || {};
    // Diagramverwijzing zonder eigen naam: de naam van het doeldiagram (van de host).
    if (et?.shape === "diagramverwijzing" && !element.naam) {
      const doel = element.data?.verwijstNaar;
      element = { ...element, naam: (doel && verwijzingNaam?.(doel)) || "diagram" };
    }
    // Compartimenten verborgen op dit voorkomen (gedaante "kop", of diagram-breed).
    const verborgen = ref && (ref.gedaante === "kop" || (!!diagram?.verbergCompartimenten && ref.gedaante !== "vol"));
    if (verborgen && (element.compartimenten || []).length) element = { ...element, compartimenten: [] };
    const vormInfo = vormVoor(soort === "anker" ? "anker" : et?.shape || "class-box", et);
    if (vormInfo.terugval) terugval.add(vormInfo.shapeType.id);
    const parameters = parametersVanType(vormInfo);
    const stijl = losStijlOp(element, et);
    const inhoudsregels = inhoudsregelsVan(et, element, { elements, diagram });
    const planVoor = (breedte) => planInhoud({ element, elementType: et, breedte, parameters, fieldTypesById, compartmentTypesById, inhoudsregels });
    const { w, h, plan } = meetVoorkomen({ ref, elementType: et, shapeType: vormInfo.shapeType, planVoor });
    const ctx = {
      element,
      elementType: et || {},
      shapeType: vormInfo.shapeType,
      parameters,
      maat: { w, h },
      stijl,
      node: ref || null,
      diagram,
      thema: kleurenVoor(basis, stijl, parameters),
      idPrefix: `${prefix}-${veiligId(ref ? voorkomenId(ref) : element.id)}`,
    };
    const box = { x: positie.x, y: positie.y, w, h, element, et: et || {}, ctx, renderer: vormInfo.renderer, plan, ref, soort };
    if (vormInfo.renderer.rand) box.rand = (hoek) => vormInfo.renderer.rand(ctx, hoek);
    return box;
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
    const { ctx, renderer, plan, element, et } = b;
    const omtrek = renderer.omtrek(ctx);
    const vak = renderer.inhoudsvak(ctx);
    const ornament = renderer.ornament ? renderer.ornament(ctx) : null;
    if (controleer) {
      fouten.push(...valideerVormBoom(omtrek, { idPrefix: ctx.idPrefix }).map((f) => `${ctx.shapeType.id} omtrek ${f}`));
      if (vak) fouten.push(...valideerVak(vak).map((f) => `${ctx.shapeType.id} ${f}`));
      if (ornament) fouten.push(...valideerVormBoom(ornament, { idPrefix: ctx.idPrefix }).map((f) => `${ctx.shapeType.id} ornament ${f}`));
    }
    const kinderen = [omtrek];
    if (vak && plan) kinderen.push(tekenInhoud(vak, plan, ctx.thema, { tekstAnker: ctx.parameters.tekstAnker }));
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
