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

const PADDING = 24;

/** Sla React Flow-chrome over bij het serialiseren (incl. connectie-handles). */
function neemMee(node) {
  if (!(node instanceof Element) || !node.classList) return true;
  const uit = ["react-flow__minimap", "react-flow__controls", "react-flow__background", "react-flow__panel", "react-flow__attribution", "react-flow__handle"];
  return !uit.some((c) => node.classList.contains(c));
}

function download(dataUrl, naam) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = naam;
  a.click();
}

/**
 * @param {object} p
 *   viewportEl: het `.react-flow__viewport` element (de te renderen laag)
 *   bounds: {x,y,width,height} in flow-coördinaten (van getNodesBounds)
 *   formaat: "png" | "svg"
 *   doel: "download" | "clipboard"
 *   achtergrond: css-kleur (canvas-achtergrond)
 *   naam: bestandsnaam zonder extensie
 * @returns {Promise<{ok:boolean, doel?:string, reden?:string}>}
 */
export async function exporteerViewport({ viewportEl, bounds, formaat = "png", doel = "download", achtergrond, naam = "diagram" }) {
  if (!viewportEl || !bounds || !bounds.width || !bounds.height) return { ok: false, reden: "niets te exporteren" };
  const w = Math.ceil(bounds.width + PADDING * 2);
  const h = Math.ceil(bounds.height + PADDING * 2);
  // Render op zoom 1 met een vaste pixelmarge: verschuif zó dat de linker-
  // bovenhoek van de inhoud op (PADDING, PADDING) landt.
  const t = { x: -bounds.x + PADDING, y: -bounds.y + PADDING, zoom: 1 };
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
  const dataUrl = formaat === "svg" ? await toSvg(viewportEl, opties) : await toPng(viewportEl, { ...opties, pixelRatio: 2 });

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
