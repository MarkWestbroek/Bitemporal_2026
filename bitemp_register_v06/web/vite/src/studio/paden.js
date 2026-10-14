// @ts-check
/**
 * Een pagina naast de Studio: /viz/react/studio/ en /viz/react/studio.html → /viz/react/<pagina>
 * (melding #6: de link werd /viz/react/studio/melden.html).
 */
export function naastStudio(pagina, pad = typeof window !== "undefined" ? window.location.pathname : "/") {
  return pad.replace(/studio(\.html)?\/?$/, "").replace(/[^/]*$/, "") + pagina;
}

