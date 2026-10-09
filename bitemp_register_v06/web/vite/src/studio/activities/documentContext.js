/**
 * documentContext — Studio-kant van de documentsjablonen: van een map in de
 * projectboom naar de sjablooncontext (pure kern in transformatie/sjabloon),
 * met de schets-tekenaar voor `{{svg}}`, en de generator die een sjabloon
 * rendert en het voorbeeldvenster opent.
 */
import { collectMapModel } from "./transformaties.js";
import { getProfieltype } from "../profieltypeRegistry";
import { maakDocumentContext } from "../../transformatie/sjabloon/context.js";
import { schetsDiagramSvg } from "../../transformatie/sjabloon/schets.js";
import { renderSjabloon } from "../../transformatie/sjabloon/renderer.js";
import { markdownNaarHtml, htmlDocument } from "../../transformatie/sjabloon/markdownNaarHtml.js";
import { useDocumentStore } from "./documentVoorbeeld.jsx";

/** Context voor een map: alle profielen erin, met lui getekende diagrammen. */
export function bouwDocumentContext(mapId, mapNaam) {
  const model = collectMapModel(mapId);
  const profielen = [];
  for (const [profielId, inhoud] of Object.entries(model)) {
    const p = getProfieltype(profielId);
    if (!p) continue;
    profielen.push({ id: profielId, label: p.label || profielId, descriptor: p.descriptor, elements: inhoud.elements || {}, diagrams: inhoud.diagrams || {} });
  }
  let teller = 0;
  return maakDocumentContext({
    naam: mapNaam || "",
    profielen,
    svgVan: (diagram, { elements, descriptor }) =>
      schetsDiagramSvg({ diagram, elements, descriptor, idPrefix: `d${(teller += 1)}` }),
  });
}

/**
 * Render een sjabloon op een map en toon het resultaat. Geeft het
 * transformatie-resultaat terug (voor het Transformeren-scherm).
 */
export function maakDocumentVanMap({ sjabloon, mapId, mapNaam, partials }) {
  const context = bouwDocumentContext(mapId, mapNaam);
  const { tekst, meta } = renderSjabloon(sjabloon.tekst, context, { partials });
  const titel = meta.titel || `${sjabloon.label} — ${mapNaam || ""}`;
  const html = htmlDocument({ titel, fragment: markdownNaarHtml(tekst) });
  useDocumentStore.getState().toon({ titel, bestandsnaam: titel, markdown: tekst, html });
  return {
    status: "success",
    summary: `Document "${titel}" staat in het voorbeeldvenster (${context.elementen.length} elementen, ${context.diagrammen.length} diagrammen).`,
  };
}
