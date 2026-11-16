// @ts-check
/**
 * Koppelt de omzetting «traceert naar» → gegeven (traceNaarGegeven.js) aan de stores: na elke
 * wijziging van de koppelingen of van een DMN-model, en bij het (her)registreren van profielen
 * (project laden). Idempotent; één keer installeren (dmnDrdActivity).
 */
import { getProfieltypen, getProfieltype, abonneerOpProfieltypen } from "./profieltypeRegistry.js";
import { voerTraceOmzettingUit } from "./traceNaarGegeven.js";

let _geinstalleerd = false;

export async function installeerTraceOmzetting() {
  if (_geinstalleerd) return;
  _geinstalleerd = true;
  // Dynamisch: koppelingenActivity trekt veel van de Studio mee; zo geen importcirkel.
  const { useKruisStore } = await import("./activities/koppelingenActivity.jsx");
  let gepland = false;
  const plan = () => {
    if (gepland) return;
    gepland = true;
    queueMicrotask(() => {
      gepland = false;
      voerTraceOmzettingUit({ useKruisStore, getProfieltypen, getProfieltype });
    });
  };
  useKruisStore.subscribe((s, vorig) => {
    if (s.links !== vorig?.links) plan();
  });
  const afgemeld = new Map();
  const koppelDmn = () => {
    for (const p of getProfieltypen()) {
      if (p?.descriptor?.id !== "dmn-drd" || !p.useStore || afgemeld.has(p.id)) continue;
      afgemeld.set(p.id, p.useStore.subscribe((s, vorig) => {
        if (s.elements !== vorig?.elements) plan();
      }));
    }
    plan();
  };
  abonneerOpProfieltypen(koppelDmn);
  koppelDmn();
}
