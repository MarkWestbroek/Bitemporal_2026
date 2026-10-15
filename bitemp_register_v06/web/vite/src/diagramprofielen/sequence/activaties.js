// @ts-check
/**
 * activaties — activaties (execution specifications) **afleiden** uit de
 * berichten (2026-10-14). EA bewaart ze ook niet (`Activation=0` =
 * automatisch) maar rekent ze uit; dezelfde regel als het model in het plan
 * "Sequence — volgorde in het model, layout erbovenop" §2/§6A: een
 * **aanroepstapel** over de berichten in volgorde (v0: de hoogte).
 *
 *   - een bericht van A naar B: staat A niet op de stapel, dan begint een
 *     nieuwe episode (alles sluit) en wordt A de wortel; staat A er wel, dan
 *     sluit alles bóven A (die aanroepen zijn klaar). Daarna wordt B
 *     aangeroepen: een nieuwe activatie op B, genest onder A;
 *   - een zelf-bericht (A → A) nest een activatie op A onder A (dieper), vanaf
 *     het ontvangpunt — de "rugzak";
 *   - een retourbericht van A naar B sluit de activatie van A (en alles
 *     erboven) precies op de hoogte van de retour;
 *   - anders loopt een activatie van haar eerste tot haar laatste bericht
 *     plus een marge (EA: ±20px); een aanroep zonder vervolg is dus een
 *     kort balkje.
 *
 * Puur: berichten in → activaties uit. Geen opslag — de balken volgen de
 * berichten, ook na verschuiven.
 */

/** Hoogte voorbij het laatste bericht (px). */
export const MARGE = 18;

/**
 * @typedef {{id: string, bron: string, doel: string, y: number, soort?: string, yEind?: number}} Bericht
 * @typedef {{lijn: string, van: number, tot: number, diepte: number, berichten: string[]}} Activatie
 */

/**
 * @param {Bericht[]} berichten - bron/doel = levenslijn-id; y = hoogte van het bericht
 * @returns {Activatie[]} in volgorde van sluiten
 */
export function leidActivatiesAf(berichten) {
  const lijst = [...(berichten || [])].sort((a, b) => a.y - b.y);
  /** @type {Array<{lijn: string, van: number, laatste: number, diepte: number, berichten: string[]}>} */
  const stapel = [];
  /** @type {Activatie[]} */
  const uit = [];
  const sluit = (frame, tot = null) => {
    const eind = tot === null ? frame.laatste + MARGE : Math.max(tot, frame.van + 4);
    uit.push({ lijn: frame.lijn, van: frame.van, tot: eind, diepte: frame.diepte, berichten: frame.berichten });
  };
  /** Sluit alles boven positie `index` (−1 = alles). */
  const sluitBoven = (index, tot = null) => {
    while (stapel.length > index + 1) sluit(stapel.pop(), tot);
  };
  const open = (lijn, y, id) => {
    const diepte = stapel.filter((f) => f.lijn === lijn).length;
    stapel.push({ lijn, van: y, laatste: y, diepte, berichten: [id] });
  };
  const bovenste = (lijn) => {
    for (let i = stapel.length - 1; i >= 0; i -= 1) if (stapel[i].lijn === lijn) return i;
    return -1;
  };

  for (const b of lijst) {
    const yTot = Math.max(b.y, b.yEind ?? b.y);
    if (b.soort === "retour") {
      const i = bovenste(b.bron);
      if (i >= 0) {
        sluitBoven(i, b.y);
        const f = stapel.pop();
        f.berichten.push(b.id);
        sluit(f, b.y);
      }
      const j = bovenste(b.doel);
      if (j >= 0) stapel[j].laatste = Math.max(stapel[j].laatste, b.y);
      continue;
    }
    let i = bovenste(b.bron);
    if (i < 0) {
      sluitBoven(-1); // nieuwe episode: de vorige is klaar
      open(b.bron, b.y, b.id);
      i = stapel.length - 1;
    } else {
      sluitBoven(i); // de aanroepen boven de bron zijn klaar
      stapel[i].berichten.push(b.id);
    }
    stapel[i].laatste = Math.max(stapel[i].laatste, yTot);
    open(b.doel, yTot, b.id); // de aanroep begint op het ontvangpunt (zelf-bericht: lager)
  }
  sluitBoven(-1);
  return uit;
}
