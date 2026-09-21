// @ts-check
/**
 * canoniekResolutie — rest van stap 3: de kolom-kant van kruisverbanden
 * resolven naar échte elementen van het canoniek-model-profiel op de motor
 * (diagram05), in plaats van pad-strings.
 *
 * Granulariteit: het canoniek profiel kent entiteiten en GE's/relaties als
 * elementen; velden zijn compartiment-regels en dus geen koppelbare
 * elementen. Een registerpad resolvet daarom naar het diepste koppelbare
 * niveau — de GE als die (verbonden aan de entiteit) te vinden is, anders de
 * entiteit. De veld-granulariteit blijft bewaard in de data van het
 * toegangsregel-element (verwijzingselement = volledig pad).
 */

export const PROFIELTYPE_CANONIEK_MOTOR = "diagram05";

const sleutel = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * @param pad         registerpad, bv. "NatuurlijkPersoon.naam.achternaam"
 * @param elementen   niet-connector-elementen uit de canoniek-store
 * @param connectoren connector-elementen (source/target) uit dezelfde store
 * @returns {{ elementId: string, niveau: "entiteit"|"ge" } | null}
 */
export function resolveerCanoniekElement(pad, elementen, connectoren = []) {
  const segmenten = String(pad || "").split(".").filter(Boolean);
  if (!segmenten.length) return null;

  const entiteit = elementen.find(
    (el) => el.elementType === "entiteit" && sleutel(el.naam) === sleutel(segmenten[0])
  );
  if (!entiteit) return null;

  if (segmenten.length >= 2) {
    // GE alleen accepteren als hij daadwerkelijk met de entiteit verbonden is
    // (GE-namen als "Naam" komen bij meerdere entiteiten voor).
    const verbonden = new Set();
    for (const c of connectoren) {
      if (c.source === entiteit.id) verbonden.add(c.target);
      if (c.target === entiteit.id) verbonden.add(c.source);
    }
    const ge = elementen.find(
      (el) =>
        (el.elementType === "gegevenselement" || el.elementType === "relatie") &&
        sleutel(el.naam) === sleutel(segmenten[1]) &&
        verbonden.has(el.id)
    );
    if (ge) return { elementId: ge.id, niveau: "ge" };
  }
  return { elementId: entiteit.id, niveau: "entiteit" };
}

/**
 * Herschrijf kruisverband-links: pad-gebaseerde canoniek-kolommen worden waar
 * mogelijk echte (profiel, element)-verwijzingen naar de motor-store; wat
 * niet te resolven is, blijft pad-gebaseerd staan (niets gaat verloren).
 *
 * @param links        kruisverband-links (uit kruisverbandenUit)
 * @param padProfielId het pad-gebaseerde profiel-id (PROFIEL_CANONIEK)
 * @param storeState   state van de canoniek-motor-store ({elements})
 */
export function resolveerKolommen(links, padProfielId, storeState) {
  const alle = Object.values(storeState?.elements || {});
  const elementen = alle.filter((el) => !el.source && !el.target);
  const connectoren = alle.filter((el) => el.source && el.target);
  if (!elementen.length) return links;
  return links.map((link) => {
    if (link.kolom.profielId !== padProfielId) return link;
    const res = resolveerCanoniekElement(link.kolom.elementId, elementen, connectoren);
    if (!res) return link;
    return { ...link, kolom: { profielId: PROFIELTYPE_CANONIEK_MOTOR, elementId: res.elementId } };
  });
}
