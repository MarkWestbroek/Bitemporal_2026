// @ts-check
/**
 * dataIcoon — iconen als **data** (geïmporteerde/geplakte SVG) i.p.v. code.
 * Een icoon is pure SVG (paden in een viewBox), dus veel eenvoudiger dan een
 * data-shape: geen header/compartimenten eromheen. De renderer neemt de
 * viewBox van de bron-SVG over en tekent de inhoud op de gevraagde maat; met
 * `monochroom` volgt het icoon de tekstkleur (currentColor).
 *
 * DataIcoon-schema: { id, label, svg, monochroom?: boolean }
 *   svg        — volledige <svg>…</svg>-markup (bv. uit een .svg-bestand)
 *   monochroom — true → eigen fills/strokes weg, alles currentColor
 *
 * De SVG gaat eerst door svgSchoon (geen scripts, gebeurtenissen of verwijzingen naar buiten): een
 * icoon kan uit een weergaveproject komen dat iemand anders wijzigt. `$vlak` wordt de paneelkleur
 * (iconenAlsSvg.js).
 */
import { registreerTypeIcoon } from "./typeIconen.jsx";
import { schoonSvg } from "./svgSchoon.js";
import { vulVlakIn } from "./iconenAlsSvg.js";

/** Haal viewBox + binnen-markup uit een SVG-string (met nette fallbacks). */
export function ontleedSvg(svgTekst) {
  const bron = String(svgTekst || "").trim();
  let viewBox = "0 0 24 24";
  let inner = bron;
  const svgMatch = /<svg\b([^>]*)>([\s\S]*?)<\/svg>/i.exec(bron);
  if (svgMatch) {
    const attrs = svgMatch[1];
    inner = svgMatch[2];
    const vb = /viewBox\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (vb) {
      viewBox = vb[1];
    } else {
      const w = /(?:^|\s)width\s*=\s*["']?([\d.]+)/i.exec(attrs);
      const h = /(?:^|\s)height\s*=\s*["']?([\d.]+)/i.exec(attrs);
      if (w && h) viewBox = `0 0 ${w[1]} ${h[1]}`;
    }
  }
  return { viewBox, inner };
}

/** Maak een icoon-component (contract: ({maat}) => JSX) uit een DataIcoon. */
export function maakDataIcoonComponent(def) {
  const { viewBox, inner } = ontleedSvg(vulVlakIn(schoonSvg(def.svg).svg));
  // Monochroom: verwijder eigen fill/stroke-kleuren zodat currentColor wint.
  const markup = def.monochroom
    ? inner.replace(/(fill|stroke)\s*=\s*["'](?!none)[^"']*["']/gi, "")
    : inner;
  function DataIcoon({ maat = 14 }) {
    return (
      <svg
        width={maat}
        height={maat}
        viewBox={viewBox}
        fill={def.monochroom ? "currentColor" : undefined}
        style={{ flexShrink: 0 }}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    );
  }
  return DataIcoon;
}

/** Registreer één data-icoon in de gedeelde icoon-registry (idempotent). */
export function registreerDataIcoon(def) {
  if (!def?.id || !def?.svg) return;
  registreerTypeIcoon(def.id, maakDataIcoonComponent(def));
}
