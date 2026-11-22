// @ts-check
/**
 * boomZicht — een gefilterde projectboom (plan "Sidecar-project" §9, stap 9 deel 2; Mark 22-11).
 *
 * Mark: "De profielen-activiteit filtert de M2-mappen met diagram(men) en elementen. De
 * transformaties-activiteit filtert de t's: ook in mappen met diagram(men) en elementen." Eén
 * project (profielen en transformaties), twee zichten. Een zicht noemt de talen (profiel-id's van
 * Modelleren) die het toont; de boom laat dan alleen zien:
 *
 *   - de mappen waarin (ergens diep) een diagram of element van die talen staat, met hun
 *     voormappen;
 *   - in die mappen alleen de diagrammen en elementen van die talen;
 *   - in de root alleen de diagrammen van die talen.
 *
 * Een element kan onder een element hangen (uitwerking, plaatsing `el::… → el::…`); dan telt de map
 * van het bovenste element. Er verandert niets aan het model of de structuur: het zicht is alleen
 * een filter in de boom.
 *
 * Puur en store-loos.
 */

/** De taal (profiel-id) van een plaatsingssleutel: `el::<profiel>::<element>` of `<profiel>::<diagram>`. */
export function profielVanSleutel(sleutel) {
  const delen = String(sleutel).split("::");
  return delen[0] === "el" ? delen[1] : delen[0];
}

/**
 * De mappen die in het zicht vallen: waarin iets van de talen staat, plus hun voormappen.
 * @param {Record<string, {id: string, ouderId?: string|null}>} mappen
 * @param {Record<string, string>} plaatsing - sleutel → map-id of element-sleutel
 * @param {Set<string>|string[]} profielIds - de talen van het zicht
 * @returns {Set<string>}
 */
export function mappenInZicht(mappen, plaatsing, profielIds) {
  const talen = profielIds instanceof Set ? profielIds : new Set(profielIds);
  const uit = new Set();
  for (const [sleutel, doel] of Object.entries(plaatsing || {})) {
    if (!talen.has(profielVanSleutel(sleutel))) continue;
    // Onder een element: naar de plek van dat element, tot een map (of niets: de root).
    let plek = doel;
    for (let stap = 0; plek && String(plek).startsWith("el::") && stap < 64; stap++) plek = plaatsing[plek];
    // De map en zijn voormappen (met een rem tegen een kring in de structuur).
    for (let stap = 0; plek && mappen?.[plek] && !uit.has(plek) && stap < 256; stap++) {
      uit.add(plek);
      plek = mappen[plek].ouderId || null;
    }
  }
  return uit;
}

/** Hoort deze plaatsingssleutel bij het zicht? Zonder zicht: alles. */
export const inZicht = (zicht, sleutel) => !zicht || zicht.talen.has(profielVanSleutel(sleutel));
