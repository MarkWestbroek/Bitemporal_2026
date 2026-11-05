// @ts-check
/**
 * afhankelijkheden — de afhankelijkheden van één artefact uit de lijst
 * `afhankelijkheden` van de e-dienst, voor alle inrichtingsartefacten
 * (docs/TRANSFORMATIES.md §11.9).
 *
 * Een identifier is niet uniek over soorten: een proces en zijn
 * proceskoppeling dragen dezelfde, en de delen van een dossier ook. Een regel
 * in de e-dienst noemt daarom de soort aan beide kanten (`soort` en
 * `afhankelijkVanSoort`), en die soort gaat mee in het artefact: het register
 * weigert een afhankelijkheid die dubbelzinnig is (FUNDAMENT 05-11).
 */

/**
 * @param {any} edienst                       - het e-dienst-inrichtingsmodel
 * @param {{identifier: string, soort: string}} keuzes - het artefact in de e-dienst
 * @param {Object} [opties]
 * @param {boolean} [opties.alleenMetSoort]   - neem alleen regels die deze soort noemen (voor een
 *   artefact dat zijn identifier deelt met een ouder artefact waarvan de regels geen soort hadden)
 * @returns {Array<{identifier: string, soort?: string, reden?: string}>}
 */
export function afhankelijkhedenVan(edienst, keuzes, { alleenMetSoort = false } = {}) {
  return (edienst?.afhankelijkheden || [])
    .filter((a) => a.artefact === keuzes.identifier && (alleenMetSoort ? a.soort === keuzes.soort : !a.soort || a.soort === keuzes.soort))
    .map((a) => ({ identifier: a.afhankelijkVan, ...(a.afhankelijkVanSoort ? { soort: a.afhankelijkVanSoort } : {}), reden: a.reden }));
}
