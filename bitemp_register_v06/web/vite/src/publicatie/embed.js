/**
 * Embed-modus voor de publicatiepagina (iframe-inbedding, bv. op commonground.nl).
 *
 * In embed-modus toont de pagina alleen het zoekveld, de tabel en de tabelnavigatie:
 * geen header (logo, titel, gebruikersbadge), geen "← Terug" en geen typetitel.
 *
 * Bepaling:
 *   - `?embed=1` in de querystring  → altijd embed
 *   - `?embed=0` in de querystring  → nooit embed (ook niet in een iframe)
 *   - anders: automatisch embed zodra de pagina in een iframe draait, zodat een
 *     bestaande iframe-code (`…/publicatie.html#/t/initiatieven`) zonder aanpassing werkt.
 *
 * Let op: de querystring staat vóór de hash, dus `publicatie.html?embed=1#/t/initiatieven`.
 */
export function isEmbedModus() {
  if (typeof window === "undefined") return false;
  const param = new URLSearchParams(window.location.search).get("embed");
  if (param === "1") return true;
  if (param === "0") return false;
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin toegang tot window.top gooit in sommige browsers: dan zitten we in een frame.
    return true;
  }
}
