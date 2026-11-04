/**
 * studio — taal=studio van de render-API: een Studio-diagram (elk profiel) als SVG.
 *
 * Dunne laag, bewust een opstap: kiest het diagram uit het aangeleverde project,
 * laat de bestaande schets (transformatie/sjabloon/schets.js) tekenen en werkt de
 * uitvoer af tot de SVG-eisen van de render-API (docs/RENDER_API.md). Wie later de
 * tekenaar vervangt (vormen als SVG-sjablonen in het M2), hoeft alleen de aanroep van
 * de schets en `werkAf` om te zetten; invoer en foutcontract blijven gelijk.
 *
 * De schets kent zeven vormfamilies (ellips, actor, kader, notitie, afgerond, vak,
 * punt), dus de vormen zijn nog niet die van het canvas.
 *
 * De descriptors komen via `descriptorVan` binnen: de profielen bevatten JSX en worden
 * voor de sidecar apart gebundeld (render-svc/studioProfielen.js), zodat deze module
 * met gewone Node te testen blijft.
 */
import { schetsDiagramSvg } from "../transformatie/sjabloon/schets.js";
import { vindShapeSet, descriptorMetShapeSet } from "../diagramcore/model/shapeSet.js";
import { leesModel, normaliseerOpties } from "./index.js";
import { ongeldigModel, ongeldigeParameter, nietGevonden } from "./fout.js";
import { maakPalet, veiligeKleur, tekstOp } from "./thema.js";
import { el, esc, fnv1a } from "./svg.js";

/** De parameters van taal=studio; de V3-weergaveopties gelden hier niet. */
export const STUDIO_VELDEN = new Set(["taal", "model", "code", "profiel", "diagram", "theme", "idPrefix"]);

const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

// ───────────── invoer ─────────────

/** Project of los profiel → [{ profielId, elements, diagrams }]. */
function profielenUit(model, profiel) {
  if (profiel !== undefined && typeof profiel !== "string") throw ongeldigeParameter("'profiel' moet tekst zijn.");
  if (model === null || typeof model !== "object" || Array.isArray(model)) {
    throw ongeldigModel("Het model moet een object zijn.", "", "");
  }
  let lijst;
  if (model.profielen && typeof model.profielen === "object") {
    lijst = Object.entries(model.profielen).map(([id, p]) => ({ profielId: id, elements: p?.elements || {}, diagrams: p?.diagrams || {} }));
  } else if (model.diagrams && typeof model.diagrams === "object") {
    lijst = [{ profielId: profiel || model.diagramTypeId || "", elements: model.elements || {}, diagrams: model.diagrams }];
  } else {
    throw ongeldigModel("Geen Studio-model: verwacht een project met 'profielen', of één profiel met 'elements' en 'diagrams'.", "", "");
  }
  if (!profiel) return lijst;
  const gekozen = lijst.filter((p) => p.profielId === profiel);
  if (!gekozen.length) {
    throw nietGevonden(`Profiel '${profiel}' zit niet in dit model.`, { profielen: lijst.map((p) => p.profielId) });
  }
  return gekozen;
}

function weergavenVan(profielen) {
  return profielen.flatMap((p) =>
    Object.entries(p.diagrams).map(([sleutel, diagram]) => ({
      id: diagram?.id || sleutel,
      naam: diagram?.naam || sleutel,
      profiel: p.profielId,
      diagram,
      inhoud: p,
    })),
  );
}

const zonderInhoud = ({ id, naam, profiel }) => ({ id, naam, profiel });

/** Op id, anders op naam. Geen of meer dan één treffer: een fout mét de keuzes. */
function kiesDiagram(weergaven, gevraagd) {
  const keuzes = { diagrammen: weergaven.map(zonderInhoud) };
  if (!weergaven.length) throw ongeldigModel("Dit model bevat geen diagrammen.", "", "diagrams");
  if (!gevraagd) {
    if (weergaven.length === 1) return weergaven[0];
    throw ongeldigeParameter("Dit model heeft meer diagrammen: kies er één met 'diagram'.", keuzes);
  }
  const opId = weergaven.filter((w) => w.id === gevraagd);
  const treffers = opId.length ? opId : weergaven.filter((w) => w.naam === gevraagd);
  if (treffers.length === 1) return treffers[0];
  if (!treffers.length) throw nietGevonden(`Geen diagram '${gevraagd}' in dit model.`, keuzes);
  throw ongeldigeParameter(`Meer diagrammen heten '${gevraagd}': kies op id, of beperk met 'profiel'.`, { diagrammen: treffers.map(zonderInhoud) });
}

/** Knopen die de schets niet kan tekenen: een 422 die het element noemt. Geeft de elementnamen terug. */
function controleer(weergave, descriptor) {
  const typen = new Set((descriptor.elementTypes || []).map((t) => t.id));
  const getal = (v) => v === undefined || v === null || Number.isFinite(v);
  const namen = [];
  for (const [i, n] of (weergave.diagram?.nodes || []).entries()) {
    // Een knoop zonder element slaat het canvas ook over.
    const element = weergave.inhoud.elements[n?.elementId];
    if (!element) continue;
    const wie = element.naam || n.elementId;
    if (!typen.has(element.elementType)) {
      throw ongeldigModel(`Element '${wie}' heeft type '${element.elementType}', dat profiel '${weergave.profiel}' niet kent.`, wie, `elements.${n.elementId}.elementType`);
    }
    if (![n.position?.x, n.position?.y, n.size?.width, n.size?.height].every(getal)) {
      throw ongeldigModel(`Element '${wie}' heeft een positie of maat die geen getal is.`, wie, `diagram.nodes[${i}]`);
    }
    if (element.naam) namen.push(element.naam);
  }
  return namen;
}

// ───────────── afwerking ─────────────

/** Vaste schetskleuren → themakleur; bij tekst apart, omdat randgrijs daar "muted" is. */
const OP_TEKST = { "#0f172a": "text", "#475569": "muted", "#6d28d9": "accent" };
const OP_VORM = {
  "#ffffff": "surface",
  "#fff": "surface",
  "#f8fafc": "surface",
  "#0f172a": "text",
  "#475569": "border",
  "#94a3b8": "border",
  "#cbd5e1": "border",
  "#6d28d9": "accent",
};
const VORMEN = new Set(["rect", "ellipse", "circle", "path", "polygon"]);

/**
 * Schets-SVG → SVG volgens de eisen: alleen viewBox, titel en aria-label, themakleuren.
 * Elke fill en stroke gaat door een witte lijst, dus een kleur uit het model die geen
 * #hex is (bv. url(...)) komt er niet door. Tekst op een gekleurd element kiest zijn
 * kleur op contrast, net als bij taal=v3.
 */
function werkAf(svg, { titel, label, p, palet }) {
  const open = /^<svg\b([^>]*)>/.exec(svg);
  const viewBox = /viewBox="([^"]*)"/.exec(open[1])[1];
  const [x, y, breedte, hoogte] = viewBox.split(" ").map(Number);

  let achter = null; // kleur van de vorm waarop de volgende tekst staat
  const binnen = svg
    .slice(open[0].length, -"</svg>".length)
    .replace(/<([a-z]+)\b([^<>]*)>/g, (_, tag, attrs) => {
      if (tag === "line") achter = null;
      if (VORMEN.has(tag)) {
        const hex = veiligeKleur(/\bfill="([^"]*)"/.exec(attrs)?.[1], null);
        achter = hex && !OP_VORM[hex] ? hex : null;
      }
      const uit = attrs.replace(/\b(fill|stroke)="([^"]*)"/g, (__, soort, waarde) => {
        if (waarde === "none") return `${soort}="none"`;
        if (tag === "text" && achter) return `${soort}="${tekstOp(achter)}"`;
        const hex = veiligeKleur(waarde, null);
        const token = (tag === "text" ? OP_TEKST : OP_VORM)[hex];
        if (token) return `${soort}="${palet(token)}"`;
        return `${soort}="${hex || palet(soort === "fill" ? "surface" : "border")}"`;
      });
      return `<${tag}${uit}>`;
    });

  return (
    el(
      "svg",
      { xmlns: "http://www.w3.org/2000/svg", viewBox, role: "img", "aria-label": label, class: "omnium-diagram", "font-family": FONT },
      [
        el("title", { id: `${p}titel` }, esc(titel)),
        el("rect", { class: "achtergrond", x, y, width: breedte, height: hoogte, fill: palet("surface") }),
        binnen,
      ],
    ) + "\n"
  );
}

// ───────────── publieke API ─────────────

/** De keuzes in een project: { diagrammen: [naam], domeinen: [], weergaven: [{ id, naam, profiel }] }. */
export function studioViews(invoer) {
  const weergaven = weergavenVan(profielenUit(leesModel(invoer), invoer.profiel));
  return { diagrammen: weergaven.map((w) => w.naam), domeinen: [], weergaven: weergaven.map(zonderInhoud) };
}

/**
 * Teken een Studio-diagram. Gooit RenderFout (400/404/422).
 * @param invoer { taal, model | code, profiel?, diagram?, theme?, idPrefix? }
 * @param {(profielId: string) => object|undefined} descriptorVan
 */
export function renderStudioSvg(invoer, descriptorVan) {
  const model = leesModel(invoer);
  const opties = normaliseerOpties(invoer);
  const profielen = profielenUit(model, invoer.profiel);
  const weergave = kiesDiagram(weergavenVan(profielen), opties.diagram);
  const descriptor = descriptorVan(weergave.profiel);
  if (!descriptor) {
    throw ongeldigModel(`Profiel '${weergave.profiel}' is hier niet bekend (eigen profielen uit de ontwerper worden nog niet getekend).`, weergave.naam, "profiel");
  }
  const namen = controleer(weergave, descriptor);

  const { diagram, inhoud } = weergave;
  const p = opties.idPrefix ? `${opties.idPrefix}-` : `o${fnv1a(JSON.stringify([weergave.profiel, diagram, inhoud.elements, opties]))}-`;
  const svg = schetsDiagramSvg({
    diagram,
    elements: inhoud.elements,
    descriptor: descriptorMetShapeSet(descriptor, vindShapeSet(descriptor, diagram.shapeSetId, diagram)),
    idPrefix: p.slice(0, -1),
    verwijzingNaam: (v) => model.profielen?.[v?.profielId]?.diagrams?.[v?.diagramId]?.naam || null,
  });
  if (!svg) throw ongeldigModel(`Het diagram '${weergave.naam}' bevat geen elementen.`, weergave.naam, "diagram.nodes");

  const titel = `${model.project?.naam || model.naam || "Model"} — ${weergave.naam}`;
  const label = `${titel}: ${namen.length} ${namen.length === 1 ? "element" : "elementen"}${namen.length ? ` (${namen.join(", ")})` : ""}`;
  return werkAf(svg, { titel, label, p, palet: maakPalet(opties.theme) });
}
