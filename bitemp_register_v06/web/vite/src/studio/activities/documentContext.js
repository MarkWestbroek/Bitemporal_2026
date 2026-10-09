/**
 * documentContext — Studio-kant van de documentsjablonen: van een map in de
 * projectboom naar de sjablooncontext (pure kern in transformatie/sjabloon),
 * met de schets-tekenaar voor `{{svg}}`, en de generator die een sjabloon
 * rendert en het voorbeeldvenster opent.
 */
import { collectMapModel } from "./transformaties.js";
import { useModellerenStore } from "./modellerenActivity.jsx";
import { getProfieltype } from "../profieltypeRegistry";
import { maakDocumentContext } from "../../transformatie/sjabloon/context.js";
import { schetsDiagramSvg } from "../../transformatie/sjabloon/schets.js";
import { vindShapeSet, descriptorMetShapeSet } from "../../diagramcore/model/shapeSet.js";
import { renderSjabloon } from "../../transformatie/sjabloon/renderer.js";
import { markdownNaarHtml, htmlDocument } from "../../transformatie/sjabloon/markdownNaarHtml.js";
import { useDocumentStore } from "./documentVoorbeeld.jsx";

/** Profielen met hun elementen en diagrammen die in één map geplaatst zijn. */
function profielenVanMap(mapId) {
  const model = collectMapModel(mapId);
  const profielen = [];
  for (const [profielId, inhoud] of Object.entries(model)) {
    const p = getProfieltype(profielId);
    if (!p) continue;
    profielen.push({ id: profielId, label: p.label || profielId, descriptor: p.descriptor, elements: inhoud.elements || {}, diagrams: inhoud.diagrams || {} });
  }
  return profielen;
}

/** Invoer voor maakDocumentContext: deze map + (recursief) zijn submappen, in boomvolgorde. */
function mapInvoer(mapId, mappen, diepteGrens = 8) {
  const m = mappen[mapId] || {};
  const kinderen =
    diepteGrens > 0
      ? Object.values(mappen)
          .filter((k) => k.ouderId === mapId)
          .sort((a, b) => (a.volgorde || 0) - (b.volgorde || 0))
          .map((k) => mapInvoer(k.id, mappen, diepteGrens - 1))
      : [];
  return { naam: m.naam || "", omschrijving: m.omschrijving || "", profielen: profielenVanMap(mapId), kinderen };
}

/** Context voor een map: alle profielen erin, de submappen, met lui getekende diagrammen. */
export function bouwDocumentContext(mapId, mapNaam) {
  const { mappen } = useModellerenStore.getState();
  const invoer = mapInvoer(mapId, mappen);
  let teller = 0;
  return maakDocumentContext({
    ...invoer,
    naam: mapNaam || invoer.naam,
    // De tekening volgt de gedaante (shape-set) die het diagram bewaart.
    svgVan: (diagram, { elements, descriptor }) =>
      schetsDiagramSvg({
        diagram,
        elements,
        descriptor: descriptorMetShapeSet(descriptor, vindShapeSet(descriptor, diagram.shapeSetId, diagram)),
        idPrefix: `d${(teller += 1)}`,
      }),
  });
}

/**
 * Render een sjabloon op een map en toon het resultaat. Geeft het
 * transformatie-resultaat terug (voor het Transformeren-scherm).
 */
export function maakDocumentVanMap({ sjabloon, mapId, mapNaam, partials }) {
  const context = bouwDocumentContext(mapId, mapNaam);
  const { tekst, meta } = renderSjabloon(sjabloon.tekst, context, { partials: { ...(sjabloon.partials || {}), ...(partials || {}) } });
  const titel = meta.titel || `${sjabloon.label} — ${mapNaam || ""}`;
  const html = htmlDocument({ titel, fragment: markdownNaarHtml(tekst) });
  useDocumentStore.getState().toon({ titel, bestandsnaam: titel, markdown: tekst, html });
  return {
    status: "success",
    summary: `Document "${titel}" staat in het voorbeeldvenster (${context.elementen.length} elementen, ${context.diagrammen.length} diagrammen).`,
  };
}
