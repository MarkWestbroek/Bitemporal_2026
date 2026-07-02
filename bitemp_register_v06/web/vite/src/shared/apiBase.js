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
  return window.location.port === "5174" ? "http://localhost:8082" : "";
}
