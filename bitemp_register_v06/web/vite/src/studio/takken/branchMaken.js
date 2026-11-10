// @ts-check
/**
 * branchMaken — pure hulp voor "Branch maken…" op een map in de projectboom (10-11, Mark).
 *
 * Een branch hoort bij een map van MAIN (herkomst.mapId). De werkplaats op Imprint maakt ze ook,
 * één per dienst-map onder E-diensten, en vindt ze terug op diezelfde map. Daarom zoekt de Studio
 * eerst of er al een niet-gearchiveerde branch voor die map is en biedt die aan, in plaats van een
 * tweede te maken. (Waterdicht wordt het met een 409 van de server; zie BACKEND.)
 */

/**
 * De bestaande (niet-gearchiveerde) branch van `ouderId` voor `mapId`, of null. Bij meer dan één
 * (van vóór deze controle) de laatst bijgewerkte.
 * @param {Array<{id: string, bijgewerkt?: string, herkomst?: {ouderProject?: string, mapId?: string, gearchiveerd?: boolean} | null}>} lijst
 * @param {string} ouderId
 * @param {string} mapId
 */
export function bestaandeBranch(lijst, ouderId, mapId) {
  const kandidaten = (Array.isArray(lijst) ? lijst : []).filter(
    (m) => m?.herkomst?.ouderProject === ouderId && m.herkomst.mapId === mapId && !m.herkomst.gearchiveerd,
  );
  kandidaten.sort((a, b) => String(b.bijgewerkt || "").localeCompare(String(a.bijgewerkt || "")));
  return kandidaten[0] || null;
}

/** Voorstel voor de naam: "<project> — <map>". */
export function standaardBranchNaam(projectNaam, mapNaam) {
  const p = String(projectNaam || "").trim() || "Project";
  const m = String(mapNaam || "").trim();
  return m ? `${p} — ${m}` : `${p} — branch`;
}

/**
 * Mag hier een branch van gemaakt worden? → null (ja) of de reden (voor de melding).
 * @param {{serverVersie?: number|null, herkomst?: any}} project
 */
export function waaromGeenBranch(project) {
  if (project?.serverVersie == null) return "Dit project staat nog niet op de server. Stuur het eerst naar de server (Project → Naar server sturen).";
  if (project?.herkomst?.ouderProject) return "Dit project is zelf al een branch. Maak de branch van MAIN.";
  return null;
}
