// codestand.mjs — welke code deze MCP-server draait (AI-3, 08-11-2026).
//
// De server is een stdio-proces: hij laadt de Studio-code (web/vite/src) en profielen.json één
// keer, bij het starten. Draait hij al langer, dan mist hij wat er sindsdien in de repo kwam
// (07-11: sequence-diagrammen zonder punten, terwijl de code ze sinds 06-11 maakt). Daarom
// onthoudt hij bij het starten de commit, en vergelijkt die op verzoek met de huidige stand.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const hier = path.dirname(fileURLToPath(import.meta.url));

/** Korte commit van de repo (of null zonder git). */
export function huidigeCommit(cwd = hier) {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
  } catch {
    return null;
  }
}

const START = { commit: huidigeCommit(), tijd: new Date() };

/**
 * De stand: gestart op welke commit en wanneer, de commit van nu, en of er nieuwere code is.
 * @param {() => string|null} [nu] - voor tests
 */
export function codeStand(nu = huidigeCommit) {
  const huidig = nu();
  return { gestart: START.commit, sinds: START.tijd, huidig, verouderd: !!(START.commit && huidig && START.commit !== huidig) };
}

/** Eén regel tekst; met een waarschuwing als de repo verder is dan wat er geladen is. */
export function codeStandTekst(stand = codeStand()) {
  const sinds = stand.sinds.toLocaleString("sv-SE").slice(0, 16); // lokale tijd, jjjj-mm-dd uu:mm
  if (!stand.gestart) return `Code: onbekend (geen git), gestart ${sinds}.`;
  if (stand.verouderd) {
    return `Let op: deze MCP-server draait code van ${stand.gestart} (gestart ${sinds}), de repo staat nu op ${stand.huidig}. Herstart de server om de nieuwe code te laden.`;
  }
  return `Code: ${stand.gestart} (gestart ${sinds}), bij.`;
}
