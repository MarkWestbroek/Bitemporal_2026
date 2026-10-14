// @ts-check
/**
 * hints — korte tips, één keer, nooit in de weg (ontwerp docs/plans/2026-09-10 Begeleiding
 * in de Studio §2.3 en §3). Een tip verschijnt na een toestandsovergang (eerste element op
 * een diagram, eerste relatie in een profiel), niet op een timer. "Gezien" per browser in
 * localStorage `studio05-hints-gezien` (besluit Mark 14-10); Help → "Tips opnieuw tonen"
 * wist dat, "Geen tips meer" zet ze uit.
 *
 * Tips die over een profiel gaan, worden **afgeleid** uit het profiel (de descriptor), zodat
 * ze altijd kloppen met de tool. Alleen interactie (slepen, toetsen) is handgeschreven.
 */
import { create } from "zustand";

export const HINTS_SLEUTEL = "studio05-hints-gezien";

/** @returns {{gezien: Record<string, true>, uit: boolean}} */
function lees() {
  try {
    const raw = globalThis.localStorage?.getItem(HINTS_SLEUTEL);
    const d = raw ? JSON.parse(raw) : null;
    return { gezien: (d && typeof d.gezien === "object" && d.gezien) || {}, uit: !!d?.uit };
  } catch {
    return { gezien: {}, uit: false };
  }
}

function bewaar(stand) {
  try {
    globalThis.localStorage?.setItem(HINTS_SLEUTEL, JSON.stringify(stand));
  } catch {
    /* opslag uit of vol: dan alleen deze sessie */
  }
}

/** Zustand-store met de tip die nu zichtbaar is (hooguit één). */
export const useHintStore = create((set) => ({
  /** @type {null | {id: string, tekst: string, titel?: string}} */
  hint: null,
  sluit: () => set({ hint: null }),
}));

export const hintGezien = (id) => !!lees().gezien[id];
export const tipsUit = () => lees().uit;

/**
 * Toon een tip als hij nog niet gezien is en tips aan staan. Markeert hem meteen als
 * gezien (één keer, ook als je hem wegklikt). Staat er al een tip, dan wacht deze tot een
 * volgende keer dat de trigger afgaat. Geeft true als de tip nu verschijnt.
 */
export function toonHint({ id, tekst, titel }) {
  if (!id || !tekst) return false;
  const stand = lees();
  if (stand.uit || stand.gezien[id]) return false;
  if (useHintStore.getState().hint) return false;
  stand.gezien[id] = true;
  bewaar(stand);
  useHintStore.setState({ hint: { id, tekst, titel } });
  return true;
}

/** Help → Tips opnieuw tonen: alles weer ongezien en aan. */
export function resetHints() {
  bewaar({ gezien: {}, uit: false });
}

/** "Geen tips meer". */
export function zetTipsUit() {
  bewaar({ ...lees(), uit: true });
  useHintStore.getState().sluit();
}

// ── Teksten ───────────────────────────────────────────────────────────

const opsomming = (namen, max = 6) => {
  const n = namen.filter(Boolean);
  if (n.length <= max) return n.join(", ");
  return `${n.slice(0, max).join(", ")} en nog ${n.length - max}`;
};

/** Handgeschreven: wat je met een element op het canvas kunt (interactie). */
export function hintEersteElement() {
  return {
    id: "eerste-element",
    titel: "Je eerste element",
    tekst:
      "F2 hernoemt. Sleep vanaf een bolletje aan de rand naar een ander element om ze te verbinden; " +
      "laat je los op een leeg stuk, dan maak je meteen een nieuw element. Delete haalt het van het diagram, " +
      "Ctrl+Delete uit het model.",
  };
}

/**
 * Afgeleid uit het profiel: welke relaties er zijn. Eén keer per profiel.
 * @param {{id?: string, naam?: string, label?: string, elementTypes?: Array<{label?: string, id: string, isConnector?: boolean}>}} descriptor
 */
export function hintEersteRelatie(descriptor, profielId) {
  const soorten = (descriptor?.elementTypes || []).filter((et) => et.isConnector).map((et) => et.label || et.id);
  const naam = descriptor?.naam || descriptor?.label || profielId || "dit profiel";
  return {
    id: `eerste-relatie:${profielId || descriptor?.id || "?"}`,
    titel: "Relatie gelegd",
    tekst:
      (soorten.length > 1
        ? `${naam} kent ${soorten.length} soorten relaties: ${opsomming(soorten)}. Kies de soort in de taakbalk Verbinding, of in het keuzemenu bij het loslaten. `
        : "") +
      "Alle relaties van een element zie je in de eigenschappen onder Relaties; daar haal je ze ook van het diagram of terug.",
  };
}

/**
 * Afgeleid uit het profiel: wat je in een leeg diagram kunt maken (voor de lege staat).
 * @returns {{elementen: string[], relaties: string[]}}
 */
export function profielInhoud(descriptor) {
  const ets = descriptor?.elementTypes || [];
  return {
    elementen: ets.filter((et) => !et.isConnector && !et.verborgen).map((et) => et.label || et.id),
    relaties: ets.filter((et) => et.isConnector).map((et) => et.label || et.id),
  };
}

export { opsomming };
