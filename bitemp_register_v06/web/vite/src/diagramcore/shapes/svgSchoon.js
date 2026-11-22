// @ts-check
/**
 * svgSchoon — SVG-tekst uit een project veilig lezen (plan 2026-11-21 Sidecar-project, §3).
 *
 * Een icoon in een weergaveproject is SVG-tekst die iemand anders kan wijzigen. Die tekst gaat
 * nooit letterlijk de pagina in: hij wordt gelezen naar een **VormBoom** (types/shapeType.js) met
 * alleen de toegestane SVG-elementen (`VORMBOOM_TAGS`), zonder `style`, zonder `on…`-attributen en
 * zonder verwijzingen naar buiten de tekening. Wat overblijft tekent de tekenaar op het canvas, op
 * de server en in documenten op dezelfde manier.
 *
 * `schoonSvg` geeft dezelfde inhoud terug als tekst (voor de editor en de data-iconen), met een
 * lijst van wat er is weggelaten.
 *
 * Puur: geen DOM.
 */
import { VORMBOOM_TAGS } from "../types/shapeType.js";

const TOEGESTAAN = new Set(VORMBOOM_TAGS);
const TEKST = new Set(["text", "tspan"]);
const ELEMENT = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|([^<]+)/g;
const ATTR = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** Mag dit attribuut mee? Geeft de reden als het niet mag. */
function attribuutWeg(naam, waarde) {
  if (/^on/i.test(naam)) return "gebeurtenis";
  if (naam === "style") return "style";
  if (/href$/i.test(naam) && !String(waarde).startsWith("#")) return "verwijzing naar buiten";
  if (/javascript:|expression\(|url\((?!\s*['"]?#)/i.test(String(waarde))) return "verdachte waarde";
  return null;
}

const ontsnap = (s) => String(s).replace(/&(?!(?:[a-z]+|#\d+|#x[0-9a-f]+);)/gi, "&amp;").replace(/</g, "&lt;");

/**
 * Lees SVG-tekst naar een VormBoom.
 * @param {string} svgTekst
 * @returns {{viewBox: string, kinderen: any[], weg: string[]}} weg = wat er is weggelaten (uniek)
 */
export function svgNaarVormBoom(svgTekst) {
  const bron = String(svgTekst || "");
  const weg = new Set();
  let viewBox = null;
  let breedte = null;
  let hoogte = null;
  let genest = 0;
  const wortel = { kinderen: [] };
  /** @type {Array<{tag?: string, kinderen: any[]}|null>} null = overgeslagen element (met alles erin) */
  const stapel = [wortel];
  ELEMENT.lastIndex = 0;
  let m;
  while ((m = ELEMENT.exec(bron))) {
    const [geheel, sluit, naam, attrTekst, zelfSluitend, tekst] = m;
    const ouder = stapel[stapel.length - 1];
    if (tekst !== undefined) {
      if (ouder && ouder.tag && TEKST.has(ouder.tag) && tekst.trim()) ouder.kinderen.push(tekst.replace(/\s+/g, " "));
      continue;
    }
    if (!naam) {
      if (/^<!\[CDATA\[/.test(geheel)) weg.add("CDATA");
      continue;
    }
    const tag = naam.replace(/^svg:/, "");
    if (sluit) {
      if (tag === "svg") {
        if (genest > 0) {
          genest -= 1;
          stapel.pop();
        }
        continue;
      }
      if (stapel.length > 1) stapel.pop();
      continue;
    }
    if (tag === "svg") {
      // Alleen de buitenste svg geeft de maat; een geneste svg telt als groep die we niet kennen.
      if (viewBox === null && breedte === null) {
        ATTR.lastIndex = 0;
        let a;
        while ((a = ATTR.exec(attrTekst))) {
          const w = a[2] ?? a[3];
          if (a[1] === "viewBox") viewBox = w;
          if (a[1] === "width") breedte = parseFloat(w);
          if (a[1] === "height") hoogte = parseFloat(w);
        }
        continue;
      }
      weg.add("svg (genest)");
      if (!zelfSluitend) {
        genest += 1;
        stapel.push(null);
      }
      continue;
    }
    let knoop = null;
    if (ouder && TOEGESTAAN.has(tag)) {
      const attrs = {};
      ATTR.lastIndex = 0;
      let a;
      while ((a = ATTR.exec(attrTekst))) {
        const waarde = a[2] ?? a[3];
        const reden = attribuutWeg(a[1], waarde);
        if (reden) weg.add(`${a[1]} (${reden})`);
        else attrs[a[1]] = waarde;
      }
      knoop = { tag, attrs, kinderen: [] };
      ouder.kinderen.push(knoop);
    } else if (ouder && !["title", "desc", "metadata"].includes(tag)) {
      weg.add(tag);
    }
    if (!zelfSluitend) stapel.push(knoop);
  }
  if (!viewBox) viewBox = breedte && hoogte ? `0 0 ${breedte} ${hoogte}` : "0 0 24 24";
  return { viewBox, kinderen: wortel.kinderen, weg: [...weg] };
}

/** Een VormBoom-knoop terug naar tekst. */
function naarTekst(knoop) {
  if (typeof knoop === "string" || typeof knoop === "number") return ontsnap(knoop);
  const attrs = Object.entries(knoop.attrs || {}).map(([k, v]) => ` ${k}="${String(v).replace(/"/g, "&quot;")}"`).join("");
  const kinderen = (knoop.kinderen || []).map(naarTekst).join("");
  return kinderen ? `<${knoop.tag}${attrs}>${kinderen}</${knoop.tag}>` : `<${knoop.tag}${attrs}/>`;
}

/**
 * Schoon SVG-tekst: alleen wat de tekenaar kan tekenen blijft over.
 * @param {string} svgTekst
 * @returns {{svg: string, weg: string[]}}
 */
export function schoonSvg(svgTekst) {
  const { viewBox, kinderen, weg } = svgNaarVormBoom(svgTekst);
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${kinderen.map(naarTekst).join("")}</svg>`, weg };
}
