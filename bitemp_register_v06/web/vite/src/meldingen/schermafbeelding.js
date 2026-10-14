/**
 * schermafbeelding — een stuk van het scherm als PNG, zonder browsertoestemming: html-to-image
 * tekent de pagina (projectboom, canvas, eigenschappen, menu's) en we snijden het kader eruit.
 * Proef 14-10: ±0,5 s, vrijwel gelijk aan een echte schermafbeelding; scrollbalken worden een
 * grijs blok. Iframes van andere origins komen niet mee.
 *
 * Zoals een knipprogramma: eerst het hele venster **bevriezen** (bevries), dan het kader trekken
 * op dat stilstaande beeld en daaruit knippen (knip). Zo komt ook een rechtsklikmenu of een
 * uitgeklapt menu mee, dat bij de eerste muisklik zou sluiten (melding #3, 14-10).
 */
import { toCanvas } from "html-to-image";

/**
 * Het hele venster als canvas.
 * @param {{negeer?: (el: Element) => boolean, pixelRatio?: number}} [opties]
 * @returns {Promise<{canvas: HTMLCanvasElement, pixelRatio: number}>}
 */
export async function bevries({ negeer = () => false, pixelRatio = Math.min(2, window.devicePixelRatio || 1) } = {}) {
  // De achtergrond van de Studio (of de pagina): vlakken zonder eigen achtergrond worden anders wit.
  const kandidaten = [document.querySelector(".studio"), document.body, document.documentElement].filter(Boolean);
  const achtergrond = kandidaten.map((el) => getComputedStyle(el).backgroundColor).find((c) => c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent");
  const canvas = await toCanvas(document.body, {
    pixelRatio,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: achtergrond || "#ffffff",
    filter: (n) => !(n instanceof Element && negeer(n)),
  });
  return { canvas, pixelRatio };
}

/**
 * Knip een kader (CSS-pixels van het venster) uit een bevroren beeld.
 * @returns {Promise<Blob>}
 */
export function knip({ canvas, pixelRatio }, kader) {
  const uit = document.createElement("canvas");
  uit.width = Math.max(1, Math.round(kader.w * pixelRatio));
  uit.height = Math.max(1, Math.round(kader.h * pixelRatio));
  uit.getContext("2d").drawImage(canvas, kader.x * pixelRatio, kader.y * pixelRatio, uit.width, uit.height, 0, 0, uit.width, uit.height);
  return new Promise((ok, mis) => uit.toBlob((b) => (b ? ok(b) : mis(new Error("Schermafbeelding maken mislukt."))), "image/png"));
}

/** Bevriezen en knippen in één keer. */
export async function maakSchermafbeelding(kader, opties) {
  return knip(await bevries(opties), kader);
}
