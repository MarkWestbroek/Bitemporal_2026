// @ts-check
/**
 * uitnodiging — zuivere helpers voor de acceptatiepagina (components/UitnodigingPagina.jsx).
 * De link is `…/viz/react/studio.html#uitnodiging=<token>` (gebruikers/uitnodiging.go).
 */

/** Token uit `#uitnodiging=…` (ook als er andere fragmentdelen zijn); anders null. */
export function uitnodigingToken(hash = typeof window !== "undefined" ? window.location.hash : "") {
  const m = String(hash || "").match(/(?:^#|&)uitnodiging=([A-Za-z0-9_-]{20,128})/);
  return m ? m[1] : null;
}

/** Gebruikersnaam zoals de server hem toestaat (gebruikersnaamPatroon in uitnodiging.go). */
export const GEBRUIKERSNAAM_PATROON = /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/;

/** Voorstel voor de gebruikersnaam: het deel vóór de @, of "" als dat niet mag. */
export function voorgesteldeGebruikersnaam(email) {
  const v = String(email || "").split("@")[0].replace(/[^A-Za-z0-9._-]/g, "").slice(0, 64);
  return GEBRUIKERSNAAM_PATROON.test(v) ? v : "";
}
