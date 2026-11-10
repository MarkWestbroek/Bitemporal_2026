// @ts-check
/**
 * herkomst — de regel "afgeleid van …" van een branch (afgeleid project, 09-11, branch stap 1).
 *
 * De server geeft bij een afgeleid project `herkomst: {ouderProject, basisVolgnummer, mapId?,
 * afgesplitstOp, afgesplitstDoor, gearchiveerd}`, en `null` bij een gewoon project (BACKEND,
 * API_REFERENCE.md §"Afgeleide projecten").
 */

/** Is dit een branch? */
export const isBranch = (herkomst) => !!(herkomst && herkomst.ouderProject);

/**
 * Eén regel voor het Project-menu en de dialoog.
 * @param {any} herkomst
 * @param {{ouderNaam?: string|null, mapNaam?: string|null}} [namen]
 * @returns {string} "" voor een gewoon project
 */
export function herkomstRegel(herkomst, { ouderNaam = null, mapNaam = null } = {}) {
  if (!isBranch(herkomst)) return "";
  const delen = [`Branch van ${ouderNaam ? `"${ouderNaam}"` : herkomst.ouderProject}`];
  if (herkomst.mapId) delen.push(`map ${mapNaam ? `"${mapNaam}"` : herkomst.mapId}`);
  delen.push(`basis #${herkomst.basisVolgnummer ?? "?"}`);
  const d = herkomst.afgesplitstOp ? new Date(herkomst.afgesplitstOp) : null;
  const wanneer = d && !isNaN(d.getTime()) ? d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) : "";
  if (wanneer || herkomst.afgesplitstDoor) delen.push(`afgesplitst${wanneer ? ` ${wanneer}` : ""}${herkomst.afgesplitstDoor ? ` door ${herkomst.afgesplitstDoor}` : ""}`);
  if (herkomst.gearchiveerd) delen.push("gearchiveerd");
  return delen.join(" · ");
}

/** Labels en volgorde van de statussen (verschilMetMain). */
export const STATUS_LABEL = {
  conflict: "Conflict",
  nieuw: "Nieuw",
  gewijzigd: "Gewijzigd",
  weg: "Weg",
  main: "Alleen op MAIN",
};
export const STATUS_UITLEG = {
  conflict: "Aan beide kanten veranderd; bij het mergen kies je.",
  nieuw: "Alleen in deze branch.",
  gewijzigd: "In deze branch veranderd, op MAIN niet.",
  weg: "In deze branch verwijderd.",
  main: "Op MAIN veranderd sinds het afsplitsen; hier pas zichtbaar na bijwerken of mergen.",
};
export const SOORT_LABEL = { element: "element", diagram: "diagram", map: "map", kruisverband: "koppeling" };
