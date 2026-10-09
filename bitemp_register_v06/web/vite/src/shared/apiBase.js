// @ts-check
/**
 * apiBase — projectbrede basis-URL voor de Go-API.
 *
 * In dev draait Vite op :5174 en de Go-API op :8082; in de build serveert
 * dezelfde origin de API, dus dan leeg.
 *
 * Gecentraliseerd n.a.v. de Studio-code-review van 2026-06-30 (§3/§7):
 * deze functie stond ~12× gekopieerd door het project. De poort-detectie
 * blijft vooralsnog hier op één plek; een env-var-oplossing kan later
 * zonder de aanroepers te raken.
 */
export function apiBase() {
  if (typeof window === "undefined") return ""; // node (tests)
  // Elke Vite-devserver (5173–5179: hoofdcheckout, worktrees, e2e) praat met de
  // lokale Go-API; voorheen alleen 5174, waardoor een worktree op 5176 zijn
  // eigen origin aanriep en elke /api-aanroep 404 gaf (10-10).
  return /^517[3-9]$/.test(window.location.port) ? "http://localhost:8082" : "";
}
