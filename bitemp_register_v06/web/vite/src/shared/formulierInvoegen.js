// @ts-check
/**
 * formulierInvoegen — `invoegen {formulier: <code>}` in een FormulierDefinitie-layout oplossen
 * (10-11, FD-uitbreiding voor e-diensten; FORMULIERDEFINITIES.md §2.6).
 *
 * Een sjabloon (bv. een algemeen Aanvraag-formulier: aanvrager, bijlagen, indienen) wordt bij het
 * LEZEN ingevoegd, niet bij het opslaan gekopieerd: een wijziging in het sjabloon geldt dan meteen
 * voor elke dienst die het invoegt. Het `invoegen`-element wordt vervangen door de `elementen` van
 * de wortel van het ingevoegde formulier, op dezelfde plek.
 *
 * Synchroon en zonder netwerk: de aanroeper haalt de sjablonen op (zie `invoegCodes`) en geeft een
 * opzoekfunctie mee. Zo gebruiken de renderer, de preview en de generator dezelfde regels.
 *
 * Fouten (FormulierInvoegFout): een cyclus (A voegt B in, B voegt A in), een onbekende code, of
 * een `invoegen` zonder code. Geen stille terugval: een generator mag niet half genereren.
 */

export class FormulierInvoegFout extends Error {
  /** @param {string} bericht @param {string[]} pad */
  constructor(bericht, pad = []) {
    super(bericht);
    this.name = "FormulierInvoegFout";
    this.pad = pad;
  }
}

/** Kinderen van een layout-element, met de sleutel waar ze staan. */
function kinderSleutel(el) {
  if (el?.type === "conditioneel") return "dan";
  return Array.isArray(el?.elementen) ? "elementen" : null;
}

/**
 * De codes die een layout direct invoegt (niet recursief; de sjablonen zelf kunnen weer
 * invoegen, haal die op na het ophalen van de eerste ronde).
 * @param {any} layout
 * @returns {string[]}
 */
export function invoegCodes(layout) {
  const codes = new Set();
  const loop = (el) => {
    if (!el || typeof el !== "object") return;
    if (el.type === "invoegen" && el.formulier) codes.add(String(el.formulier));
    const s = kinderSleutel(el);
    if (s) for (const k of el[s]) loop(k);
  };
  loop(layout);
  return [...codes];
}

/**
 * Los alle `invoegen`-elementen op.
 *
 * @param {any} layout  de wortel ({type:"formulier", elementen})
 * @param {(code: string) => any} zoek  code → layout-wortel van het sjabloon, of null/undefined
 * @param {{ code?: string, maxDiepte?: number }} [opties]  `code` = de code van `layout` zelf
 *   (zodat een formulier dat zichzelf invoegt ook als cyclus telt)
 * @returns {any} een nieuwe layout zonder `invoegen` (het origineel blijft onaangeroerd)
 */
export function losInvoegingenOp(layout, zoek, opties = {}) {
  const maxDiepte = opties.maxDiepte ?? 16;

  /** @param {any} el @param {string[]} stapel */
  const loop = (el, stapel) => {
    if (!el || typeof el !== "object") return [el];
    if (el.type === "invoegen") {
      const code = el.formulier ? String(el.formulier) : "";
      if (!code) throw new FormulierInvoegFout("`invoegen` zonder formulier-code.", stapel);
      if (stapel.includes(code)) throw new FormulierInvoegFout(`Cyclus bij invoegen: ${[...stapel, code].join(" → ")}.`, [...stapel, code]);
      if (stapel.length >= maxDiepte) throw new FormulierInvoegFout(`Te diep ingevoegd (meer dan ${maxDiepte}).`, stapel);
      const sjabloon = zoek(code);
      if (!sjabloon) throw new FormulierInvoegFout(`Onbekend formulier om in te voegen: "${code}".`, [...stapel, code]);
      const kinderen = Array.isArray(sjabloon.elementen) ? sjabloon.elementen : [];
      return kinderen.flatMap((k) => loop(k, [...stapel, code]));
    }
    const s = kinderSleutel(el);
    if (!s) return [{ ...el }];
    return [{ ...el, [s]: el[s].flatMap((k) => loop(k, stapel)) }];
  };

  const start = opties.code ? [String(opties.code)] : [];
  const [uit] = loop(layout, start);
  return uit;
}
