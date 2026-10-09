// @ts-check
/**
 * hernoemBotsendeIds — maak een importmodel "ernaast" plaatsbaar: element- en
 * diagram-ids die al in de store bestaan krijgen een nieuw id, en alle
 * verwijzingen (connector source/target, diagram-nodes, verborgen connectoren,
 * connectorvoorkomens) gaan mee. Daarna kan `importeerModel` het model in
 * één undo-stap toevoegen zonder "id bestaat al"-fouten.
 *
 * Pure functie (geen store): testbaar in node.
 *
 * @param {{elements: Record<string, any>, diagrams: Record<string, any>}} model
 * @param {{elements?: Record<string, any>, diagrams?: Record<string, any>}} state
 * @param {string} [stempel] - uniek voorvoegsel voor hernoemde ids (default: tijd)
 * @returns {{elements: Record<string, any>, diagrams: Record<string, any>, hernoemd: number, eersteDiagramId: string|null}}
 */
export function hernoemBotsendeIds(model, state, stempel = String(Date.now())) {
  const bestaandeEl = state?.elements || {};
  const bestaandeDi = state?.diagrams || {};
  const nieuwId = (oud) => `imp${stempel}_${oud}`;

  const elMap = new Map();
  for (const oud of Object.keys(model.elements || {})) {
    elMap.set(oud, bestaandeEl[oud] ? nieuwId(oud) : oud);
  }
  const her = (x) => (x == null ? x : elMap.get(x) ?? x);

  /** @type {Record<string, any>} */
  const elements = {};
  for (const [oud, el] of Object.entries(model.elements || {})) {
    const id = her(oud);
    elements[id] = {
      ...el,
      id,
      ...(el.source ? { source: her(el.source) } : {}),
      ...(el.target ? { target: her(el.target) } : {}),
    };
  }

  /** @type {Record<string, any>} */
  const diagrams = {};
  let eersteDiagramId = null;
  for (const [oud, d] of Object.entries(model.diagrams || {})) {
    const id = bestaandeDi[oud] ? nieuwId(oud) : oud;
    if (!eersteDiagramId) eersteDiagramId = id;
    const voorkomens = d.connectorVoorkomens
      ? Object.fromEntries(Object.entries(d.connectorVoorkomens).map(([cid, v]) => [her(cid), v]))
      : undefined;
    diagrams[id] = {
      ...d,
      id,
      nodes: (d.nodes || []).map((n) => ({ ...n, elementId: her(n.elementId) })),
      edges: (d.edges || []).map((e) => ({ ...e, source: her(e.source), target: her(e.target) })),
      ...(d.verborgenConnectoren ? { verborgenConnectoren: d.verborgenConnectoren.map(her) } : {}),
      ...(voorkomens ? { connectorVoorkomens: voorkomens } : {}),
      ...(d.lijnen ? { lijnen: Object.fromEntries(Object.entries(d.lijnen).map(([cid, l]) => [her(cid), l])) } : {}),
      ...(d.gedaanteOverrides ? { gedaanteOverrides: Object.fromEntries(Object.entries(d.gedaanteOverrides).map(([cid, v]) => [her(cid), v])) } : {}),
      ...(d.lijnen ? { lijnen: Object.fromEntries(Object.entries(d.lijnen).map(([cid, l]) => [her(cid), l])) } : {}),
      ...(d.gedaanteOverrides ? { gedaanteOverrides: Object.fromEntries(Object.entries(d.gedaanteOverrides).map(([cid, v]) => [her(cid), v])) } : {}),
    };
  }

  const hernoemd =
    [...elMap.entries()].filter(([a, b]) => a !== b).length +
    Object.keys(model.diagrams || {}).filter((oud) => bestaandeDi[oud]).length;
  return { elements, diagrams, hernoemd, eersteDiagramId };
}
