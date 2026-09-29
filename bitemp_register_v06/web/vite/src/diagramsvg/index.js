/**
 * diagramsvg — een modeldiagram als pure SVG-tekst, zonder browser of DOM.
 *
 * Eén tekenaar voor Studio én voor de render-API (Imprint): hetzelfde model
 * met dezelfde opties geeft byte-gelijke SVG. De pijplijn:
 *
 *   V3-model ─ valideerV3 ─ v3ModelNaarEditor ─ kiesWeergave/snijBij
 *            ─ maakVorm (maten) ─ autoLayout of diagramposities ─ SVG
 *
 * Mapping en layout zijn dezelfde modules als in de UML-editor van Studio.
 * Contract en eisen: docs/RENDER_API.md.
 */
import { v3ModelNaarEditor } from "../umleditor/metamodel/v3ModelNaarEditor.js";
import { berekenAutoLayout } from "../umleditor/metamodel/autoLayout.js";
import { defaultKleur } from "../umleditor/metamodel/types.js";
import { valideerV3 } from "./validatie.js";
import { v3Views, kiesWeergave, snijBij } from "./selectie.js";
import { maakVorm, tekenVorm } from "./vormen.js";
import { tekenRand, markerDefs } from "./randen.js";
import { haalUitElkaar } from "./ontwarren.js";
import { jsonFoutIndex, regelKolom } from "./jsonPlaats.js";
import { maakPalet, veiligeKleur, THEMAS } from "./thema.js";
import { el, esc, idDeel, fnv1a } from "./svg.js";
import { RenderFout, ongeldigModel, ongeldigeParameter } from "./fout.js";

export { RenderFout } from "./fout.js";

export const TALEN = ["v3"];
const MARGE = 24;
const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const VULLING = {
  enumeratie: "#fef3c7",
  gegevenstype: "#e0f2fe",
  referentielijstInstantie: "#fef3c7",
  notitie: "#fef9c3",
  constraint: "#e0f2fe",
};

const ID_KIND = {
  entiteit: "ent",
  gegevenselement: "ge",
  relatie: "rel",
  enumeratie: "enum",
  gegevenstype: "dt",
  referentielijstInstantie: "ri",
  associatieAnker: "anker",
  notitie: "notitie",
  constraint: "constraint",
};
const ID_VOORVOEGSEL = /^(enum_|dt_|refinstantie_|anker_)/;

// ───────────── invoer ─────────────

/** JSON-tekst → object; een parsefout wordt een 422 met regel en kolom. */
function leesCode(code) {
  try {
    return JSON.parse(code);
  } catch (e) {
    const index = jsonFoutIndex(code);
    const plaats = index >= 0 ? regelKolom(code, index) : null;
    const waar = plaats ? ` (regel ${plaats.regel}, kolom ${plaats.kolom})` : "";
    throw ongeldigModel(`De modelcode is geen geldige JSON${waar}.`, "", "code", plaats || {});
  }
}

/** Studio-exports verpakken het model als { versie, bron, …, model: {…} }. */
function pakUit(model) {
  if (model && typeof model === "object" && !Array.isArray(model) && !model.entiteiten && model.model && typeof model.model === "object") {
    return model.model;
  }
  return model;
}

function haalModel(invoer) {
  const taal = String(invoer.taal ?? "v3").toLowerCase();
  if (!TALEN.includes(taal)) throw ongeldigeParameter(`Onbekende taal '${invoer.taal}'. Ondersteund: ${TALEN.join(", ")}.`);
  const heeftModel = invoer.model !== undefined && invoer.model !== null;
  const heeftCode = typeof invoer.code === "string" && invoer.code.trim() !== "";
  if (heeftModel === heeftCode) throw ongeldigeParameter("Geef precies één van 'model' (object) of 'code' (tekst) mee.");
  return pakUit(heeftModel ? invoer.model : leesCode(invoer.code));
}

function janee(v, standaard, naam) {
  if (v === undefined || v === null || v === "") return standaard;
  if (v === true || v === "true") return true;
  if (v === false || v === "false") return false;
  throw ongeldigeParameter(`'${naam}' moet true of false zijn.`);
}

export function normaliseerOpties(o = {}) {
  const theme = o.theme ?? "auto";
  if (!THEMAS.includes(theme)) throw ongeldigeParameter(`'theme' moet ${THEMAS.join(", ")} zijn.`);
  const richting = String(o.richting ?? "TB").toUpperCase();
  if (!["TB", "LR"].includes(richting)) throw ongeldigeParameter("'richting' moet TB of LR zijn.");
  const entiteiten = (Array.isArray(o.entiteiten) ? o.entiteiten : String(o.entiteiten ?? "").split(","))
    .map((s) => String(s).trim())
    .filter(Boolean);
  if (o.idPrefix !== undefined && o.idPrefix !== "" && !/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(o.idPrefix)) {
    throw ongeldigeParameter("'idPrefix' mag alleen letters, cijfers, '_' en '-' bevatten en moet met een letter beginnen.");
  }
  if (o.linkPattern !== undefined && o.linkPattern !== "" && !/^(\/|#|https?:\/\/)[^\s"'<>]*$/.test(o.linkPattern)) {
    throw ongeldigeParameter("'linkPattern' moet met '/', '#', 'http://' of 'https://' beginnen, zonder spaties of aanhalingstekens.");
  }
  for (const k of ["diagram", "domein"]) {
    if (o[k] !== undefined && o[k] !== null && typeof o[k] !== "string") throw ongeldigeParameter(`'${k}' moet tekst zijn.`);
  }
  return {
    diagram: o.diagram || "",
    domein: o.domein || "",
    theme,
    velden: janee(o.velden, true, "velden"),
    afhankelijkheden: janee(o.afhankelijkheden, false, "afhankelijkheden"),
    richting,
    entiteiten,
    idPrefix: o.idPrefix || "",
    linkPattern: o.linkPattern || "",
  };
}

// ───────────── publieke API ─────────────

/**
 * Welke weergaven biedt het model? → { diagrammen: [naam], domeinen: [naam] }
 * @param invoer { taal, model | code }
 */
export function diagramViews(invoer) {
  const model = haalModel(invoer);
  valideerV3(model);
  return v3Views(model);
}

/**
 * Render een diagram als SVG-tekst. Gooit RenderFout (400/404/422).
 * @param invoer { taal, model | code, diagram, domein, entiteiten, richting,
 *                 theme, velden, idPrefix, linkPattern }
 */
export function renderDiagramSvg(invoer) {
  const model = haalModel(invoer);
  const opties = normaliseerOpties(invoer);
  valideerV3(model);
  return renderV3(model, opties);
}

function renderV3(model, opties) {
  const weergave = kiesWeergave(model, opties);
  const { nodes: alleNodes, edges: alleEdges } = v3ModelNaarEditor(model);
  const sub = snijBij(model, alleNodes, alleEdges, weergave, opties.entiteiten);

  // «use»-afhankelijkheden (veld → enum/datatype) maken een figuur druk, terwijl
  // de veldkolom het type al noemt. Standaard: geen datatype-kaartjes en geen
  // «use»-lijnen; enums blijven (met hun waarden). De layout krijgt de lijnen
  // wél, zodat een enum bij zijn gebruikers staat.
  const layoutEdges = [...sub.edges];
  let tekenEdges = sub.edges;
  if (!opties.afhankelijkheden) {
    sub.nodes = sub.nodes.filter((n) => n.type !== "gegevenstype");
    const blijft = new Set(sub.nodes.map((n) => n.id));
    const typeVan = new Map(sub.nodes.map((n) => [n.id, n.type]));
    const isInstantie = (e) => typeVan.get(e.source) === "referentielijstInstantie" || typeVan.get(e.target) === "referentielijstInstantie";
    tekenEdges = sub.edges.filter((e) => blijft.has(e.source) && blijft.has(e.target) && (!e.data?.isDependency || isInstantie(e)));
    // Een externe stomp die alleen via een verborgen «use» vastzat, zweeft los: weg ermee.
    const geraakt = new Set(tekenEdges.flatMap((e) => [e.source, e.target]));
    sub.nodes = sub.nodes.filter((n) => !sub.extern.has(n.id) || geraakt.has(n.id));
    const over = new Set(sub.nodes.map((n) => n.id));
    tekenEdges = tekenEdges.filter((e) => over.has(e.source) && over.has(e.target));
    layoutEdges.splice(0, layoutEdges.length, ...layoutEdges.filter((e) => over.has(e.source) && over.has(e.target)));
  }
  if (sub.nodes.length === 0) {
    throw ongeldigModel(`De weergave '${weergave.label}' bevat geen elementen.`, weergave.label, weergave.soort === "diagram" ? "diagrammen" : "entiteiten");
  }

  // Standaard-prefix: stabiel per inhoud, zodat twee verschillende diagrammen
  // op één pagina nooit dezelfde id's hebben.
  const p = opties.idPrefix ? `${opties.idPrefix}-` : `o${fnv1a(JSON.stringify([model, opties]))}-`;
  const palet = maakPalet(opties.theme);

  const domeinKleur = new Map((model.domeinen || []).map((d) => [d?.naam, d?.kleur]));
  const ruweEntiteit = new Map((model.entiteiten || []).map((e) => [e.typenaam, e]));
  const vullingVan = (n) => {
    if (n.type === "entiteit") {
      const ruw = ruweEntiteit.get(n.id) || {};
      const standaard = defaultKleur("entiteit", ruw.entiteitSubtype || "");
      return veiligeKleur(ruw.kleur, veiligeKleur(domeinKleur.get(ruw.domein), standaard));
    }
    if (VULLING[n.type]) return veiligeKleur(n.data?.kleur, VULLING[n.type]);
    return veiligeKleur(n.data?.kleur, defaultKleur(n.type));
  };

  const vormen = new Map();
  for (const n of sub.nodes) {
    vormen.set(n.id, maakVorm(n, { velden: opties.velden, extern: sub.extern.has(n.id), vulling: vullingVan(n) }));
  }

  // Posities: opgeslagen diagram, of autoLayout met onze eigen maten.
  const posities = new Map();
  if (sub.layout) {
    const metMaat = sub.nodes.map((n) => ({ ...n, width: vormen.get(n.id).w, height: vormen.get(n.id).h, data: { ...n.data, layoutLocked: false } }));
    const uit = berekenAutoLayout(metMaat, layoutEdges, { richting: opties.richting, respecteerLocked: false, alleenZichtbaar: false });
    const items = sub.nodes.map((n) => {
      const pos = uit.get(n.id) || n.position || { x: 0, y: 0 };
      return { id: n.id, type: n.type, x: Math.round(pos.x), y: Math.round(pos.y), w: vormen.get(n.id).w, h: vormen.get(n.id).h };
    });
    haalUitElkaar(items);
    for (const it of items) posities.set(it.id, { x: it.x, y: it.y });
  } else {
    for (const n of sub.nodes) posities.set(n.id, n.position || { x: 0, y: 0 });
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of sub.nodes) {
    const pos = posities.get(n.id);
    const v = vormen.get(n.id);
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + v.w);
    maxY = Math.max(maxY, pos.y + v.h);
  }
  const boxen = new Map();
  for (const n of sub.nodes) {
    const pos = posities.get(n.id);
    const v = vormen.get(n.id);
    boxen.set(n.id, {
      x: Math.round(pos.x - minX + MARGE),
      y: Math.round(pos.y - minY + MARGE),
      w: v.w,
      h: v.h,
      rond: v.soort === "anker",
    });
  }
  const breedte = Math.ceil(maxX - minX + 2 * MARGE);
  const hoogte = Math.ceil(maxY - minY + 2 * MARGE);

  // Stabiele, unieke id's afgeleid van namen.
  const gebruikteIds = new Set();
  const uniek = (basis) => {
    let id = basis;
    for (let i = 2; gebruikteIds.has(id); i++) id = `${basis}-${i}`;
    gebruikteIds.add(id);
    return id;
  };
  const nodeId = new Map(sub.nodes.map((n) => [n.id, uniek(`${p}${sub.extern.has(n.id) ? "ext-" : ""}${ID_KIND[n.type] || "el"}-${idDeel(n.id.replace(ID_VOORVOEGSEL, ""))}`)]));

  const perId = new Map(sub.nodes.map((n) => [n.id, n]));
  const gebruikt = new Set();
  const randen = tekenEdges.map((e) =>
    tekenRand(e, { node: perId.get(e.source), box: boxen.get(e.source) }, { node: perId.get(e.target), box: boxen.get(e.target) }, {
      p,
      palet,
      gebruikt,
      id: uniek(`${p}e-${idDeel(e.id)}`),
    }),
  );

  const knopen = sub.nodes.map((n) => {
    const b = boxen.get(n.id);
    const g = el("g", { id: nodeId.get(n.id), class: `element ${n.type}${sub.extern.has(n.id) ? " extern" : ""}` }, tekenVorm(vormen.get(n.id), b.x, b.y, { palet }));
    if (n.type === "entiteit" && opties.linkPattern) {
      const href = opties.linkPattern
        .replace(/\{entiteit\}/g, encodeURIComponent(n.id))
        .replace(/\{domein\}/g, encodeURIComponent(n.data?.domein || ""));
      return el("a", { href }, g);
    }
    return g;
  });

  const entiteitNamen = sub.nodes.filter((n) => n.type === "entiteit" && !sub.extern.has(n.id)).map((n) => n.id);
  const titel = `${model.naam || "Model"} — ${weergave.label}`;
  const label = `${titel}: ${entiteitNamen.length} ${entiteitNamen.length === 1 ? "entiteit" : "entiteiten"}${entiteitNamen.length ? ` (${entiteitNamen.join(", ")})` : ""}`;
  const defs = markerDefs(gebruikt, p, palet);

  return (
    el(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: `0 0 ${breedte} ${hoogte}`,
        role: "img",
        "aria-label": label,
        class: "omnium-diagram",
        "font-family": FONT,
      },
      [
        el("title", { id: `${p}titel` }, esc(titel)),
        defs.length ? el("defs", {}, defs) : "",
        el("rect", { class: "achtergrond", x: 0, y: 0, width: breedte, height: hoogte, fill: palet("surface") }),
        el("g", { class: "randen" }, randen),
        el("g", { class: "elementen" }, knopen),
      ],
    ) + "\n"
  );
}
