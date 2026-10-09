// @ts-check
/**
 * xmlBoom — kleine, namespace-onverschillige hulpjes over een DOM-document
 * (browser-DOMParser of `@xmldom/xmldom` in tests). Lezers van XML-formaten
 * (BPMN, DMN) werken op lokale namen: `bpmn:task`, `semantic:task` en `task`
 * zijn hetzelfde element.
 */

/**
 * @param {string} tekst
 * @param {{DOMParser?: any, code?: string}} [opties]
 */
export function parseXml(tekst, { DOMParser = globalThis.DOMParser, code = "XML-ONGELDIG" } = {}) {
  if (!DOMParser) throw Object.assign(new Error("DOMParser is niet beschikbaar; injecteer opties.DOMParser."), { code: "XML-GEEN-PARSER" });
  const doc = new DOMParser().parseFromString(String(tekst || ""), "application/xml");
  const fout = doc.getElementsByTagName("parsererror")[0];
  if (fout || !doc.documentElement) {
    throw Object.assign(new Error(`Geen geldige XML${fout ? `: ${(fout.textContent || "").trim().slice(0, 160)}` : ""}`), { code });
  }
  return doc;
}

/** Lokale naam zonder prefix. */
export function lokaal(el) {
  if (!el) return "";
  return el.localName || String(el.nodeName || "").split(":").pop() || "";
}

/** Directe kind-elementen (optioneel op lokale naam). */
export function kinderen(el, naam = null) {
  const uit = [];
  for (let k = el?.firstChild; k; k = k.nextSibling) {
    if (k.nodeType !== 1) continue;
    if (naam == null || lokaal(k) === naam) uit.push(k);
  }
  return uit;
}

/** Eerste kind-element met deze lokale naam. */
export function kind(el, naam) {
  return kinderen(el, naam)[0] || null;
}

/** Alle afstammelingen (diepte-eerst) met deze lokale naam. */
export function afstammelingen(el, naam) {
  const uit = [];
  const loop = (n) => {
    for (const k of kinderen(n)) {
      if (lokaal(k) === naam) uit.push(k);
      loop(k);
    }
  };
  if (el) loop(el);
  return uit;
}

/** Attribuutwaarde (ongeacht prefix), of `""`. */
export function attr(el, naam) {
  if (!el?.attributes) return "";
  const direct = el.getAttribute?.(naam);
  if (direct != null && direct !== "") return direct;
  for (let i = 0; i < el.attributes.length; i += 1) {
    const a = el.attributes[i];
    if (lokaal(a) === naam) return a.value || "";
  }
  return "";
}

/** Tekstinhoud van een kind-element, getrimd. */
export function tekstVan(el, naam = null) {
  const doel = naam ? kind(el, naam) : el;
  return String(doel?.textContent || "").trim();
}

/** `href="#id"` of een kale verwijzing → id. */
export function idUitHref(waarde) {
  return String(waarde || "").replace(/^#/, "").trim();
}

/** Getal uit een attribuut (NaN → 0). */
export function getal(el, naam) {
  const n = Number(attr(el, naam));
  return Number.isFinite(n) ? n : 0;
}
