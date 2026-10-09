// @ts-check
/**
 * archimate/blokSet — de shape-set **"Blokken (informeel)"**: dezelfde
 * ArchiMate-elementen, maar getekend als effen afgeronde blokken zonder
 * type-icoon, en Grouping als licht laagkader met de naam erboven. Bedoeld
 * voor overzichtsplaten voor een breder publiek (lagen, landschappen) waar de
 * formele notatie afleidt — het model blijft ArchiMate (zelfde Definitie,
 * andere gedaante; vgl. vormSet.js). Buiten scope? Geef het element een
 * eigen kleur (bv. grijs); die wint van de blokkleur.
 *
 * Pure data (node-testbaar); de shapes staan in blokShapes.jsx.
 */
import { ELEMENTEN } from "./elementen.js";

export const BLOK_KLEUR = "#eef2ff";

/** elementTypeId → skin. Grouping wordt het laagkader (achtergrond). */
export const BLOK_SHAPES = {
  ...Object.fromEntries(
    ELEMENTEN.map(([id]) => [
      id,
      id === "grouping" ? { shape: "am-blok-laag", achtergrond: true } : { shape: "am-blok", kleur: BLOK_KLEUR },
    ])
  ),
  // Leesrichting voor niet-ArchiMate-lezers: "A bedient B" wordt getekend als
  // "B gebruikt A" — de pijlpunt verhuist naar de bron (het model blijft
  // serving). Zo lezen lagenplaten van boven naar beneden, zoals in de
  // gangbare informele schetsen (2026-10-09, Mark: "lijnen andersom").
  bediening: { markerStart: "pijl-open", markerEnd: null },
};

export const BLOK_SET = {
  id: "blokken",
  label: "Blokken (informeel)",
  shapes: BLOK_SHAPES,
};
