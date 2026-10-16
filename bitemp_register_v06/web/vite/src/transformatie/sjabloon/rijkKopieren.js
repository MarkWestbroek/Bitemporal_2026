// @ts-check
/**
 * rijkKopieren — een document kopiëren zodat Teams, Confluence, Word en Outlook het als opgemaakte
 * tekst mét plaatjes plakken (Mark, 16-10: "als we de md-export met ingebedde svg plakken in Teams
 * of Confluence, wordt de xml onder de svg getoond").
 *
 * Markdown met inline `<svg>` is voor zulke editors platte tekst; ze renderen geen markdown en geen
 * SVG. Wat ze wél plakken is HTML op het klembord (`text/html`) met `<img>`-elementen als PNG. Dus:
 * markdown → HTML (markdownNaarHtml), elke `<svg>` → `<img src="data:image/png…">`, en als
 * `text/plain` de markdown met een tekstregel per diagram.
 *
 * Het vervangen is puur (testbaar met een nep-rasteraar); het rasteren zelf (`svgNaarPng`) gebruikt
 * de browser (Image + canvas). De documentdiagrammen zijn pure SVG zonder foreignObject, dus het
 * canvas raakt niet "tainted".
 */

const SVG_BLOK = /<svg\b[\s\S]*?<\/svg>/g;

/** Breedte en hoogte uit width/height of anders de viewBox. */
export function svgMaat(svg) {
  const attr = (naam) => {
    const m = String(svg).match(new RegExp(`<svg\\b[^>]*\\s${naam}="([\\d.]+)(px)?"`, "i"));
    return m ? Number(m[1]) : null;
  };
  let breedte = attr("width"), hoogte = attr("height");
  if (!breedte || !hoogte) {
    const vb = String(svg).match(/<svg\b[^>]*\sviewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/i);
    if (vb) { breedte = breedte || Number(vb[1]); hoogte = hoogte || Number(vb[2]); }
  }
  return { breedte: Math.round(breedte || 800), hoogte: Math.round(hoogte || 600) };
}

const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * Vervang elke `<svg>` in een HTML-fragment door een `<img>` met wat `rasteriseer` levert.
 * @param {string} html
 * @param {(svg: string, maat: {breedte: number, hoogte: number}) => Promise<string>} rasteriseer - geeft een data-URL
 * @returns {Promise<string>}
 */
export async function svgNaarAfbeeldingen(html, rasteriseer) {
  const blokken = String(html || "").match(SVG_BLOK) || [];
  const urls = [];
  for (const svg of blokken) urls.push(await rasteriseer(svg, svgMaat(svg)));
  let i = 0;
  return String(html || "").replace(SVG_BLOK, (svg) => {
    const { breedte, hoogte } = svgMaat(svg);
    // Niet breder dan een gewone pagina; de hoogte schaalt mee.
    const b = Math.min(breedte, 900);
    const h = Math.round((hoogte * b) / breedte);
    const titel = (svg.match(/<title>([^<]*)<\/title>/i) || [])[1] || "Diagram";
    return `<img src="${escAttr(urls[i++])}" width="${b}" height="${h}" alt="${escAttr(titel)}">`;
  });
}

const HERKOMST = { profielId: "data-omnium-profiel", diagramId: "data-omnium-diagram", naam: "data-omnium-naam" };

/**
 * Zet de herkomst (profiel, diagram, naam) als data-attributen op de `<svg>`, zodat "Kopieer voor
 * Confluence" per plaatje weet welk diagram het is (gedeelde plaatjes, 16-10). Browsers, GitHub en
 * VS Code negeren de attributen.
 */
export function merkHerkomst(svg, { profielId, diagramId, naam = "" } = {}) {
  if (!svg || !profielId || !diagramId || !/^<svg\b/.test(svg)) return svg;
  const attrs = Object.entries({ profielId, diagramId, naam })
    .map(([k, v]) => ` ${HERKOMST[k]}="${escAttr(v)}"`)
    .join("");
  return svg.replace(/^<svg\b/, `<svg${attrs}`);
}

/** Herkomst uit een gemerkte `<svg>`, of null. */
export function svgHerkomst(svg) {
  const kop = (String(svg).match(/^<svg\b[^>]*>/) || [""])[0];
  const lees = (naam) => {
    const m = kop.match(new RegExp(`\\s${naam}="([^"]*)"`));
    return m ? m[1].replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&amp;/g, "&") : "";
  };
  const profielId = lees(HERKOMST.profielId);
  const diagramId = lees(HERKOMST.diagramId);
  return profielId && diagramId ? { profielId, diagramId, naam: lees(HERKOMST.naam) } : null;
}

/** Platte tekst bij het rijke klembord: de markdown met een regel per diagram i.p.v. de SVG-code. */
export function markdownZonderSvg(markdown) {
  let n = 0;
  return String(markdown || "").replace(SVG_BLOK, () => `[Diagram ${++n}]`);
}

/**
 * Rasteriseer een SVG tot PNG (browser). Schaal 2 voor scherpe plaatjes op hoge-dpi-schermen.
 * @param {string} svg
 * @param {{breedte: number, hoogte: number}} maat
 */
export function svgNaarPng(svg, { breedte, hoogte }, schaal = 2) {
  const bron = svg.includes("xmlns=") ? svg : svg.replace(/^<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
  const url = URL.createObjectURL(new Blob([bron], { type: "image/svg+xml;charset=utf-8" }));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(breedte * schaal));
        c.height = Math.max(1, Math.round(hoogte * schaal));
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#ffffff"; // Teams/Confluence in donkere modus: geen transparante achtergrond
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/png"));
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("SVG kon niet als afbeelding geladen worden")); };
    img.src = url;
  });
}
