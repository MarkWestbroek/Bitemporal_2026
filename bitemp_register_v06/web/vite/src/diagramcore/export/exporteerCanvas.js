/**
 * exporteerCanvas — render (een deel van) de React Flow-viewport naar een
 * PNG/SVG en download of kopieer naar het klembord. Standaard-recept voor
 * @xyflow/react + html-to-image, met een filter dat de canvas-chrome
 * (minimap, controls, raster, panels) weglaat.
 *
 * Kleur: de nodes dragen hun eigen (thema-afhankelijke) kleuren; we zetten de
 * export-achtergrond op de canvas-achtergrond zodat lichte tekst op een donker
 * thema leesbaar blijft.
 */
import { toPng, toSvg } from "html-to-image";
import { maakExportFilter } from "./exportFilter.js";

function download(dataUrl, naam) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = naam;
  a.click();
}

/**
 * @param {object} p
 *   viewportEl: het `.react-flow__viewport` element (de te renderen laag)
 *   bounds: {x,y,width,height} in flow-coördinaten (van tekenBounds)
 *   formaat: "png" | "svg"
 *   doel: "download" | "clipboard"
 *   achtergrond: css-kleur (canvas-achtergrond)
 *   naam: bestandsnaam zonder extensie
 *   beperkTot: {nodeIds, edgeIds} — alleen deze elementen tekenen (selectie)
 * @returns {Promise<{ok:boolean, doel?:string, reden?:string}>}
 */
export async function exporteerViewport({ viewportEl, bounds, formaat = "png", doel = "download", achtergrond, naam = "diagram", marge = 24, schaal = 2, beperkTot }) {
  if (!viewportEl || !bounds || !bounds.width || !bounds.height) return { ok: false, reden: "niets te exporteren" };
  const neemMee = maakExportFilter({ beperkTot });
  const w = Math.ceil(bounds.width + marge * 2);
  const h = Math.ceil(bounds.height + marge * 2);
  // Render op zoom 1 met een vaste pixelmarge: verschuif zó dat de linker-
  // bovenhoek van de inhoud op (marge, marge) landt.
  const t = { x: -bounds.x + marge, y: -bounds.y + marge, zoom: 1 };
  const opties = {
    width: w,
    height: h,
    filter: neemMee,
    backgroundColor: achtergrond,
    style: {
      width: `${w}px`,
      height: `${h}px`,
      transform: `translate(${t.x}px, ${t.y}px) scale(${t.zoom})`,
    },
  };
  const dataUrl = formaat === "svg" ? await toSvg(viewportEl, opties) : await toPng(viewportEl, { ...opties, pixelRatio: schaal });

  if (doel === "clipboard") {
    // Klembord accepteert betrouwbaar PNG (voor plakken in chat/docs).
    const blob = await (await fetch(dataUrl)).blob();
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      return { ok: false, reden: "klembord niet beschikbaar" };
    }
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return { ok: true, doel: "clipboard" };
  }
  download(dataUrl, `${naam}.${formaat}`);
  return { ok: true, doel: "download" };
}
