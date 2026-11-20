// @ts-check
/**
 * m3Profiel — de taal van het Profiel-ontwerp (het M3 als profiel, `ontwerptaal.js`) als
 * geregistreerd DiagramType, los van de activiteiten die hem gebruiken.
 *
 * Twee activiteiten delen hem:
 *   - **Profiel-ontwerp** (`profielOntwerp05`, beheer): het kladblok dat zich vult met alle
 *     geregistreerde profielen en niets bewaart;
 *   - **Profiel (M3)** (`m3Profiel05`, modelleren): dezelfde taal als gewone modelleertaal in een
 *     project, zodat het sidecar-project (PROF-1) te openen, te bewaren en te delen is.
 *
 * Puur genoeg voor Node (render-svc laadt hem mee).
 */
import { profielOntwerpKern, PROFIEL_ONTWERP_ID } from "./profielOntwerp.js";
import { vertaalHooks } from "./profielGereedschap.js";
import { getDiagramType, vervangDiagramType } from "../../diagramcore/types/typeRegistry.js";

/** Het profiel-id van de M3-taal in een project. */
export const M3_PROFIEL_ID = "m3Profiel05";
export { PROFIEL_ONTWERP_ID };

/** De descriptor (hooks op id vertaald naar code). Eén object: de activiteiten houden hem vast. */
export const ontwerpDescriptor = vertaalHooks(profielOntwerpKern);

/** Idempotent. */
export function registreerProfielOntwerp() {
  if (getDiagramType(PROFIEL_ONTWERP_ID) !== ontwerpDescriptor) vervangDiagramType(ontwerpDescriptor);
}
