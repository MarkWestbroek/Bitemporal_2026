// @ts-check
/**
 * sequenceFlow — de twee hooks van de BPMN sequence flow, als pure module.
 *
 * Ze staan hier los van `index.js` omdat dát bestand de shapes importeert
 * (`.jsx`) en de node-testrunner die niet kan laden. Zo blijft de logica —
 * conditie-label en default flow — gewoon unit-testbaar, net als bij de
 * profielen zonder eigen shapes.
 */

/**
 * Default flow: het pad dat geldt als geen enkele conditie waar is. De
 * notatie is een schuin streepje vlak ná de bron. Formeel alleen zinvol vanaf
 * een exclusieve/inclusieve gateway of een activiteit met conditionele
 * uitgangen; net als de rest van v0 laten we dat permissief.
 *
 * @param {{data?: Record<string, any>}} conn
 */
export function sequenceFlowPresentatie(conn) {
  return conn?.data?.standaard ? { markerStart: "schuine-streep" } : {};
}

/**
 * De conditie als `[conditie]` midden op de lijn — de BPMN-conventie.
 *
 * @param {{data?: Record<string, any>}} conn
 */
export function sequenceFlowLabels(conn) {
  const c = conn?.data?.conditie;
  if (!c) return {};
  return { kaal: [{ zijde: "midden", delen: [{ tekst: `[${c}]`, soort: "constraint" }] }] };
}
