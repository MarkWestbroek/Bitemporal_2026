/**
 * profielRegistratie — gedeeld door de meta-editor (trede 1, JSON) en de
 * visuele profiel-ontwerper (trede 2, diagram): descriptor-kern → live
 * geregistreerde activiteit, plus de localStorage-opslag van eigen profielen.
 */
import { IconProfiel05 } from "../icons";
import { registreerActiviteit } from "../activityRegistry";
import { vervangDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";
import { vertaalHooks, maakGeneriekeMaakElement } from "./profielGereedschap.js";

export const OPSLAG_SLEUTEL = "studio05-profielen";

export function leesProfielen() {
  try {
    return JSON.parse(localStorage.getItem(OPSLAG_SLEUTEL) || "{}") || {};
  } catch {
    return {};
  }
}

export function bewaarProfielen(profielen) {
  try {
    localStorage.setItem(OPSLAG_SLEUTEL, JSON.stringify(profielen));
  } catch {
    /* opslag vol — niet kritisch */
  }
}

/** Bewaar één profiel-kern (voegt toe/overschrijft op kern.id). */
export function bewaarProfiel(kern) {
  bewaarProfielen({ ...leesProfielen(), [kern.id]: kern });
}

/**
 * Registreer een descriptor-kern als DiagramType + activiteit. Retourneert
 * het activiteit-id. Gooit bij validatie-/hookfouten.
 */
export function registreerProfielAlsActiviteit(kern) {
  const descriptor = vertaalHooks(kern);
  vervangDiagramType(descriptor);
  const activiteitId = `dyn-${kern.id}`;
  registreerActiviteit(
    maakDiagramActiviteit({
      id: activiteitId,
      label: kern.label || kern.id,
      icon: <IconProfiel05 />,
      descriptor,
      maakElement: maakGeneriekeMaakElement(descriptor),
      persistKey: `studio05-dyn-${kern.id}`,
      taakbalkSleutel: `studio05-taakbalken-dyn-${kern.id}`,
      menuPrefix: `dyn-${kern.id}`,
      menuLabel: kern.label || kern.id,
      previewTekst: `Eigen profiel "${kern.label || kern.id}" — gemaakt met de meta-editor.`,
      devHookNaam: `__dyn_${kern.id.replace(/[^a-zA-Z0-9]/g, "_")}Store`,
    })
  );
  return activiteitId;
}

// Bij het laden van de Studio: opgeslagen profielen opnieuw registreren,
// zodat dynamische activiteiten een herlaad overleven.
for (const [id, kern] of Object.entries(leesProfielen())) {
  try {
    registreerProfielAlsActiviteit(kern);
  } catch (e) {
    console.warn(`Opgeslagen profiel "${id}" niet geregistreerd:`, e?.message || e);
  }
}
