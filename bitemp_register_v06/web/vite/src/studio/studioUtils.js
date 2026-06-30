/**
 * studioUtils — kleine gedeelde helpers voor de Studio-activiteiten.
 *
 * Voorheen stonden deze (identiek) in dmn/bpmn/bericht-activity. Hier gebundeld
 * zodat er één bron is (DRY) en gedrag consistent blijft.
 */

/** API-basis: in dev draait Vite op :5174 en de Go-API op :8082; in de build
 *  serveert dezelfde origin de API, dus dan leeg. */
export function apiBase() {
  return window.location.port === "5174" ? "http://localhost:8082" : "";
}

/** Trigger een browser-download van een Blob met de gegeven inhoud. */
function downloadBlob(inhoud, bestandsnaam, mime) {
  const blob = new Blob([inhoud], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = bestandsnaam;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download een object als ingesprongen JSON-bestand. */
export function downloadJson(obj, bestandsnaam) {
  downloadBlob(JSON.stringify(obj, null, 2), bestandsnaam, "application/json");
}

/** Download tekst als bestand (mime instelbaar, bv. "text/xml"). */
export function downloadTekst(tekst, bestandsnaam, mime = "text/plain") {
  downloadBlob(tekst, bestandsnaam, mime);
}
