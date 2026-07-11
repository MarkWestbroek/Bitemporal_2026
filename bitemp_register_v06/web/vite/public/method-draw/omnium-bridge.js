/**
 * Omnium Studio bridge (toegevoegd, niet-upstream).
 *
 * Method Draw declareert `svgCanvas`/`editor` als lexicale globals (const) in
 * z'n classic scripts; die hangen NIET aan `window`, dus de omliggende app kan
 * ze niet via `iframe.contentWindow.svgCanvas` bereiken. Dit scriptje draait in
 * dezelfde realm (na start.js) en zet de referenties op `window`, zodat de
 * Studio-modal `getSvgString()`/`setSvgString()` kan aanroepen.
 *
 * Zie HERKOMST.md — dit is de enige toevoeging aan de gevendorde kopie.
 */
try {
  window.svgCanvas = svgCanvas;
  window.editor = editor;
} catch (e) {
  console.warn("[omnium-bridge] kon Method Draw-globals niet exposen:", e);
}
