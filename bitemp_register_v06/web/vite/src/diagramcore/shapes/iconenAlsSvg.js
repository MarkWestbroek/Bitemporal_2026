// @ts-check
/**
 * iconenAlsSvg — de ingebouwde iconen als SVG-tekst (plan 2026-11-21 Sidecar-project §7 stap 2).
 *
 * De iconen staan in de code als JSX (`typeIconen.jsx`, `diagramprofielen/*\/iconen.jsx`): dat is de
 * **reserve** (niveau 3: volledig voor alles). Voor het weergaveproject is elk icoon ook SVG-tekst,
 * zoals een data-icoon (`{id, svg}`). Die tekst staat in `ingebouwdeIconen.js`, gegenereerd door
 * `render-svc: npm run iconen` (renderToStaticMarkup van elke JSX-component); `npm test` in
 * render-svc faalt als code en tekst uit elkaar lopen, en eist een exacte rondreis
 * (SVG-tekst → data-icoon → dezelfde SVG-tekst).
 *
 * Vorm van de tekst: `<svg xmlns viewBox><g …presentatie van de JSX-<svg>…>…</g></svg>`. De
 * presentatie-attributen van de buitenste `<svg>` (fill none, stroke currentColor, lijndikte) gaan
 * naar een `<g>`, omdat een data-icoon alleen de viewBox en de binnenkant van de bron overneemt.
 * Breedte, hoogte en `style` horen bij de plek waar het icoon staat en vallen weg.
 *
 * **`$vlak`** (een vlak dat open moet ogen, bv. de uitsteeksels van een ArchiMate-component) is een
 * afspraak van het data-icoon: in de tekst staat `$vlak`, bij het tekenen wordt het de paneelkleur.
 *
 * Puur: geen DOM, geen React.
 */
import { schoonSvg } from "./svgSchoon.js";

export const VLAK = "$vlak";
/** De paneelkleur waarmee `$vlak` in de Studio getekend wordt (zoals archimate/iconen.jsx). */
export const VLAK_CSS = "var(--s-panel, #fff)";

const WEG_VAN_BUITEN = new Set(["width", "height", "style", "class", "xmlns", "xmlns:xlink", "viewBox"]);

/**
 * Maak van de uitvoer van renderToStaticMarkup (een JSX-icoon) de SVG-tekst van het data-icoon.
 * @param {string} markup
 * @returns {{svg: string, weg: string[]}} weg = wat svgSchoon niet doorliet (hoort leeg te zijn)
 */
export function markupNaarIcoonSvg(markup) {
  const bron = String(markup || "").split(VLAK_CSS).join(VLAK);
  const m = /^\s*<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/i.exec(bron);
  if (!m) return schoonSvg(bron);
  const attrs = [...m[1].matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)];
  const viewBox = attrs.find(([, n]) => n === "viewBox")?.[2] || "0 0 24 24";
  const presentatie = attrs.filter(([, n]) => !WEG_VAN_BUITEN.has(n)).map(([, n, w]) => `${n}="${w}"`);
  const binnen = presentatie.length ? `<g ${presentatie.join(" ")}>${m[2]}</g>` : m[2];
  return schoonSvg(`<svg viewBox="${viewBox}">${binnen}</svg>`);
}

/** `$vlak` invullen met een kleur (voor het tekenen). */
export const vulVlakIn = (svg, kleur = VLAK_CSS) => String(svg || "").split(VLAK).join(kleur);
