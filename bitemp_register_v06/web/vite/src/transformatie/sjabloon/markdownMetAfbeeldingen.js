// @ts-check
/**
 * markdownMetAfbeeldingen — haal de inline `<svg>`-diagrammen uit een
 * gegenereerd document en vervang ze door gewone afbeeldingslinks naar losse
 * `.svg`-bestanden.
 *
 * Waarom: GitHub (en veel andere markdown-viewers) strippen inline `<svg>` uit
 * markdown, dus een gedownload document toonde daar geen plaatjes (Mark,
 * 10-10). Met `![titel](stam-d1.svg)` naast losse bestanden werkt het overal.
 * De studio bundelt het resultaat als zip (zie zip.js en documentVoorbeeld).
 *
 * Puur (node-testbaar); de alt-tekst komt uit de dichtstbijzijnde kop boven
 * het plaatje ("## Diagram: Overzicht" → "Overzicht").
 */

const SVG_BLOK = /<svg\b[\s\S]*?<\/svg>/g;

/** Bestandsveilige stam (zelfde regel als de downloadnaam in documentVoorbeeld). */
export function veiligeStam(naam) {
  return String(naam || "document").replace(/[^\w.-]+/g, "_");
}

/** Laatste markdown-kop vóór positie `index`, zonder "Diagram:"-voorvoegsel. */
function kopVoor(markdown, index) {
  const koppen = [...markdown.slice(0, index).matchAll(/^#{1,6}\s+(.+?)\s*$/gm)];
  const laatste = koppen.length ? koppen[koppen.length - 1][1] : "";
  return laatste.replace(/^diagram:\s*/i, "").trim();
}

/** Alt-tekst veilig voor `![...]`: geen haken of regeleinden. */
function schoneAlt(tekst) {
  return tekst.replace(/[[\]\r\n]+/g, " ").trim();
}

/**
 * @param {string} markdown - document met inline `<svg>…</svg>`-blokken
 * @param {string} stam - bestandsstam, bv. "Voorziening_Common_Ground"
 * @returns {{markdown: string, bestanden: Array<{naam: string, inhoud: string}>}}
 *   `markdown` met afbeeldingslinks; `bestanden` de losse SVG's (zelfde map).
 */
export function markdownMetAfbeeldingen(markdown, stam) {
  const veilig = veiligeStam(stam);
  /** @type {Array<{naam: string, inhoud: string}>} */
  const bestanden = [];
  const uit = String(markdown || "").replace(SVG_BLOK, (svg, offset, geheel) => {
    const naam = `${veilig}-d${bestanden.length + 1}.svg`;
    const inhoud = svg.includes("xmlns=") ? svg : svg.replace(/^<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
    bestanden.push({ naam, inhoud: `<?xml version="1.0" encoding="UTF-8"?>\n${inhoud}\n` });
    const alt = schoneAlt(kopVoor(geheel, offset)) || `Diagram ${bestanden.length}`;
    return `![${alt}](${naam})`;
  });
  return { markdown: uit, bestanden };
}
