/**
 * studio — taal=studio van de render-API: een Studio-diagram (elk profiel) als SVG.
 *
 * Dunne laag: kiest het diagram uit het aangeleverde project, laat de ene tekenaar
 * (diagramcore/tekenaar, plan 2026-11-04 Eén tekenaar) tekenen en maakt de uitvoer af tot
 * de eisen van de render-API (docs/RENDER_API.md).
 *
 * Tekenaar en descriptors komen samen binnen, uit dezelfde profielbundel
 * (render-svc/studioProfielen.js). Dat is nodig: de ShapeTypes staan in een register in
 * modulestaat, dus een tekenaar die hier los geïmporteerd is, zou de vormen die een profiel
 * in de bundel registreert niet zien en stil op de terugval tekenen.
 */
import { vindShapeSet, descriptorMetShapeSet } from "../diagramcore/model/shapeSet.js";
import { leesModel, normaliseerOpties } from "./index.js";
import { ongeldigModel, ongeldigeParameter, nietGevonden } from "./fout.js";
import { maakPalet } from "./thema.js";
import { fnv1a } from "./svg.js";

/** De parameters van taal=studio; de V3-weergaveopties gelden hier niet. */
export const STUDIO_VELDEN = new Set(["taal", "model", "code", "profiel", "diagram", "theme", "idPrefix"]);

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

/** Knopen die de tekenaar niet kan tekenen: een 422 die het element noemt. Geeft de elementnamen terug. */
function controleer(weergave, descriptor) {
  const typen = new Set((descriptor.elementTypes || []).map((t) => t.id));
  const getal = (v) => v === undefined || v === null || Number.isFinite(v);
  const namen = [];
  const knopen = weergave.diagram?.nodes ?? [];
  if (!Array.isArray(knopen) || knopen.some((n) => n === null || typeof n !== "object")) {
    throw ongeldigModel(`Het diagram '${weergave.naam}' heeft een ongeldige lijst 'nodes'.`, weergave.naam, "diagram.nodes");
  }
  for (const [i, n] of knopen.entries()) {
    // Een knoop zonder element slaat het canvas ook over.
    const element = weergave.inhoud.elements[n.elementId];
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

/** Wat een fill of stroke mag zijn: geen, een #hex, of een thema-token met #hex-terugval. */
const VEILIGE_KLEUR = /^(none|#[0-9a-f]{3}|#[0-9a-f]{6}|var\(--diagram-[a-z]+, #[0-9a-f]{6}\))$/i;

/**
 * Vangnet over de hele boom: elke fill en stroke door de witte lijst. De tekenaar laat alleen
 * veilige kleuren door, maar een ShapeRenderer kiest in zijn eigen boom vrij een waarde.
 */
function kleurenVeilig(knoop, palet) {
  if (!knoop || typeof knoop !== "object") return knoop;
  const attrs = { ...knoop.attrs };
  for (const soort of ["fill", "stroke"]) {
    if (attrs[soort] !== undefined && !VEILIGE_KLEUR.test(String(attrs[soort]))) {
      attrs[soort] = palet(soort === "fill" ? "surface" : "border");
    }
  }
  return { ...knoop, attrs, kinderen: (knoop.kinderen || []).map((k) => kleurenVeilig(k, palet)) };
}

/** Getekende boom → de boom van de API: titel, aria-label, achtergrond en de witte lijst. */
function werkAf({ boom, viewBox }, { titel, label, p, palet }) {
  const { xmlns, viewBox: vb, role, ...rest } = boom.attrs;
  return {
    tag: "svg",
    attrs: { xmlns, viewBox: vb, role, "aria-label": label, ...rest },
    kinderen: [
      { tag: "title", attrs: { id: `${p}titel` }, kinderen: [titel] },
      { tag: "rect", attrs: { class: "achtergrond", x: viewBox.x, y: viewBox.y, width: viewBox.w, height: viewBox.h, fill: palet("surface") }, kinderen: [] },
      ...kleurenVeilig(boom, palet).kinderen,
    ],
  };
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
 * @param bundel { descriptorVan, tekenDiagram, naarSvg }: uit één bundel, zie de kop van dit bestand
 */
export function renderStudioSvg(invoer, { descriptorVan, tekenDiagram, naarSvg }) {
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
  const getekend = tekenDiagram({
    diagram,
    elements: inhoud.elements,
    descriptor: descriptorMetShapeSet(descriptor, vindShapeSet(descriptor, diagram.shapeSetId, diagram)),
    idPrefix: p.slice(0, -1),
    thema: opties.theme,
    maatAttributen: false,
    controleer: true, // tags, on*, style, href: de SVG-eisen gelden ook voor elke ShapeRenderer
    verwijzingNaam: (v) => model.profielen?.[v?.profielId]?.diagrams?.[v?.diagramId]?.naam || null,
  });
  if (!getekend.boom) throw ongeldigModel(`Het diagram '${weergave.naam}' bevat geen elementen.`, weergave.naam, "diagram.nodes");

  const titel = `${model.project?.naam || model.naam || "Model"} — ${weergave.naam}`;
  const label = `${titel}: ${namen.length} ${namen.length === 1 ? "element" : "elementen"}${namen.length ? ` (${namen.join(", ")})` : ""}`;
  return naarSvg(werkAf(getekend, { titel, label, p, palet: maakPalet(opties.theme) })) + "\n";
}
