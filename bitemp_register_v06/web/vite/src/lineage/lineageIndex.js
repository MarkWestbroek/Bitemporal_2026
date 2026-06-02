/**
 * lineageIndex.js — pure logica voor de lineage-view (stap 6 van de
 * "driehoek proces – regels – data").
 *
 * De lineage-view is volledig AFGELEID: zij voegt geen nieuwe data toe, maar
 * leest de FieldRefs die DMN-beslistabellen, berichttypen, BPMN-events en
 * procescontracten al delen. Omdat élk van die artefacten zijn velden uit het
 * canoniek model haalt, ontstaat de herkomst-/impactanalyse "gratis":
 *
 *   - kies een veld  → welke regels (DMN) en processtappen/berichten raken het?
 *   - kies een artefact → welke andere artefacten delen er een veld mee?
 *
 * Zie process_engine_v01/docs/driehoek-proces-regels-data.md §8.7.
 *
 * Invoer: een lijst "artefacten", elk in zijn eigen native vorm:
 *   { soort: "dmn",         naam, inputs:[{fieldRef}], outputs:[{fieldRef}] }
 *   { soort: "bericht",     naam, velden:[{ref}] }
 *   { soort: "bpmn-event",  naam, kind, velden:[{typenaam,veldnaam,veldpad}] }
 *   { soort: "contract",    naam, isCall, input:{velden:[{ref}]}, output:{velden:[{ref}]} }
 *
 * Een "veldKey" is `${typenaam}::${veldnaam}` (gelijk aan fieldRefKey).
 */

/** Stabiele sleutel voor een veld; identiek aan modelpicker/fieldRefKey. */
export function veldKey(ref) {
  if (!ref || !ref.typenaam || !ref.veldnaam) return "";
  return `${ref.typenaam}::${ref.veldnaam}`;
}

/** Normaliseer een willekeurige veld-vorm naar {typenaam, veldnaam, veldpad}. */
function normRef(ref) {
  if (!ref) return null;
  const typenaam = ref.typenaam || "";
  const veldnaam = ref.veldnaam || "";
  if (!typenaam || !veldnaam) return null;
  return { typenaam, veldnaam, veldpad: ref.veldpad || `${typenaam}.${veldnaam}` };
}

/**
 * Haal alle (ref, rol)-paren uit één artefact. `rol` beschrijft hoe het veld in
 * dat artefact voorkomt (bv. "dmn-input", "contract-output").
 */
export function extractRefs(artefact) {
  if (!artefact) return [];
  const uit = [];
  const voegToe = (ref, rol) => {
    const n = normRef(ref);
    if (n) uit.push({ ref: n, rol });
  };
  switch (artefact.soort) {
    case "dmn":
      (artefact.inputs || []).forEach((c) => voegToe(c.fieldRef, "dmn-input"));
      (artefact.outputs || []).forEach((c) => voegToe(c.fieldRef, "dmn-output"));
      break;
    case "bericht":
      (artefact.velden || []).forEach((v) => voegToe(v.ref, "bericht-veld"));
      break;
    case "bpmn-event":
      (artefact.velden || []).forEach((f) => voegToe(f, `event-${artefact.kind || "message"}`));
      break;
    case "contract":
      (artefact.input?.velden || []).forEach((v) => voegToe(v.ref, "contract-input"));
      (artefact.output?.velden || []).forEach((v) => voegToe(v.ref, "contract-output"));
      break;
    default:
      break;
  }
  return uit;
}

/**
 * Bouw de lineage-index over alle artefacten.
 * Retourneert {
 *   velden:     Map<veldKey, {ref, gebruik:[{soort,naam,rol}]}>,
 *   artefacten: [{soort, naam, refs:[ref], keys:Set<veldKey>}],
 * }
 */
export function bouwLineageIndex(artefacten = []) {
  const velden = new Map();
  const artefactInfo = [];

  for (const a of artefacten) {
    const paren = extractRefs(a);
    const keys = new Set();
    const refs = [];
    for (const { ref, rol } of paren) {
      const k = veldKey(ref);
      if (!k) continue;
      keys.add(k);
      refs.push(ref);
      if (!velden.has(k)) velden.set(k, { ref, gebruik: [] });
      velden.get(k).gebruik.push({ soort: a.soort, naam: a.naam, rol });
    }
    artefactInfo.push({ soort: a.soort, naam: a.naam, refs, keys });
  }

  return { velden, artefacten: artefactInfo };
}

/** Lineage voor één veld: de ref + alle plekken waar het gebruikt wordt. */
export function lineageVoorVeld(index, key) {
  if (!index || !index.velden.has(key)) return null;
  const { ref, gebruik } = index.velden.get(key);
  return { ref, gebruik: [...gebruik] };
}

/**
 * Alle velden met gebruiks-telling, gesorteerd op veldpad. Geschikt als
 * lijstbron voor de UI (links kiezen, rechts de lineage tonen).
 */
export function alleVelden(index) {
  if (!index) return [];
  return [...index.velden.entries()]
    .map(([key, { ref, gebruik }]) => ({ key, ref, aantal: gebruik.length }))
    .sort((a, b) => a.ref.veldpad.localeCompare(b.ref.veldpad));
}

/**
 * Gekoppelde artefacten: gegeven een artefactnaam, alle ANDERE artefacten die
 * minstens één veld delen, met de gedeelde veld-keys erbij. Dit is de
 * proces↔regels-brug: "deze processtap raakt veld X; DMN Y gebruikt X ook".
 */
export function gekoppeldeArtefacten(index, naam) {
  if (!index) return [];
  const bron = index.artefacten.find((a) => a.naam === naam);
  if (!bron) return [];
  const uit = [];
  for (const ander of index.artefacten) {
    if (ander.naam === naam && ander.soort === bron.soort) continue;
    const gedeeld = [...bron.keys].filter((k) => ander.keys.has(k));
    if (gedeeld.length > 0) {
      uit.push({ soort: ander.soort, naam: ander.naam, gedeeld });
    }
  }
  return uit;
}

/** Velden van één artefact (voor het detailpaneel), gesorteerd op veldpad. */
export function veldenVanArtefact(index, naam) {
  if (!index) return [];
  const a = index.artefacten.find((x) => x.naam === naam);
  if (!a) return [];
  return [...a.refs].sort((x, y) => x.veldpad.localeCompare(y.veldpad));
}
