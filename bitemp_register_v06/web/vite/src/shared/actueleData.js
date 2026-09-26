/**
 * actueleData.js — het ACTUELE data-record van een GE uit een /full-respons. Eén regel voor de
 * hele frontend (was vijf kopieën, waarvan vier terugvielen op de laatste versie van een
 * AFGEVOERDE hub; zo verscheen bv. FormulierDefinitie 18 met een afgevoerde meta toch in
 * "Invoer via", 27-09-2026):
 *  - een afgevoerde hub telt niet mee;
 *  - binnen een hub: de versie met opvoer en zonder afvoer;
 *  - meerdere actieve hubs (Meta/Layout zijn nog meervoudig): de laatst opgevoerde wint;
 *  - niets actueels → null (geen terugval op historie).
 */
const lijst = (a) => (Array.isArray(a) ? a : []);

/** Uit een lijst hubs: { data, relId } of null. */
export function actueleHubData(hubs) {
  let beste = null;
  let besteOpvoer = "";
  for (const hub of lijst(hubs)) {
    if (!hub || hub.afvoer) continue;
    const d = lijst(hub.data).find((x) => x?.opvoer && !x?.afvoer);
    if (!d) continue;
    const opvoer = String(hub.opvoer || d.opvoer || "");
    if (!beste || opvoer > besteOpvoer) {
      beste = { data: d, relId: d.rel_id ?? hub.rel_id };
      besteOpvoer = opvoer;
    }
  }
  return beste;
}

/** Het actuele data-record van GE `geJsonNaam` in een full-entiteit, of null. */
export function actueleData(fullEntity, geJsonNaam) {
  return actueleHubData(fullEntity?.[geJsonNaam])?.data ?? null;
}
