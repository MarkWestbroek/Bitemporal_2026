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

/**
 * De naam van het open project voor naast de menutitel "Project" (10-11, Mark: "de naam en
 * branch van het project is niet in de Studio te zien"). Een branch krijgt "⑂" en de naam van
 * MAIN erachter; de volledige herkomstregel gaat in de tooltip.
 * @param {{naam?: string, herkomst?: any, ouderNaam?: string|null}} project
 * @param {{mapNaam?: string|null}} [opties]
 * @returns {{naast: string, naastTitel: string, naastSoort?: "branch"}}
 */
export function projectKop(project, { mapNaam = null } = {}) {
  const naam = String(project?.naam || "").trim() || "Naamloos project";
  if (!isBranch(project?.herkomst)) return { naast: naam, naastTitel: `Project: ${naam}` };
  const ouder = project.ouderNaam ? ` (van ${project.ouderNaam})` : "";
  return {
    naast: `⑂ ${naam}${ouder}`,
    naastTitel: [`Branch: ${naam}`, herkomstRegel(project.herkomst, { ouderNaam: project.ouderNaam, mapNaam })].join("\n"),
    naastSoort: "branch",
  };
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
