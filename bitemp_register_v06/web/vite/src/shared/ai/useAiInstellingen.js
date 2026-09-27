import { useSyncExternalStore } from "react";
import { leesInstellingen, bewaarInstellingen, OPSLAGSLEUTEL } from "./aiProfielen.js";

/**
 * useAiInstellingen — de AI-instellingen als ÉÉN gedeelde bron voor alle AI-velden op de pagina
 * (en andere tabbladen). Voorheen hield elk veld een eigen kopie bij, waardoor je de sleutel per
 * veld opnieuw moest invoeren. Nu: opslaan in één veld → alle velden zien het meteen.
 *
 * @returns {[instellingen, bewaar(nieuw)]}
 */
const luisteraars = new Set();
const opslag = () => (typeof window !== "undefined" ? window.localStorage : null);
let huidig = null;

function lees() {
  if (huidig === null) huidig = leesInstellingen(opslag());
  return huidig;
}

function meld() {
  luisteraars.forEach((l) => l());
}

// Ander tabblad: localStorage veranderd → opnieuw lezen en alle velden bijwerken.
function bijOpslag(e) {
  if (e.key !== OPSLAGSLEUTEL) return;
  huidig = leesInstellingen(opslag());
  meld();
}

function abonneer(luisteraar) {
  if (luisteraars.size === 0 && typeof window !== "undefined") window.addEventListener("storage", bijOpslag);
  luisteraars.add(luisteraar);
  return () => {
    luisteraars.delete(luisteraar);
    if (luisteraars.size === 0 && typeof window !== "undefined") window.removeEventListener("storage", bijOpslag);
  };
}

export function bewaarAiInstellingen(nieuw) {
  huidig = nieuw;
  bewaarInstellingen(opslag(), nieuw);
  meld();
}

export function useAiInstellingen() {
  const inst = useSyncExternalStore(abonneer, lees, lees);
  return [inst, bewaarAiInstellingen];
}
