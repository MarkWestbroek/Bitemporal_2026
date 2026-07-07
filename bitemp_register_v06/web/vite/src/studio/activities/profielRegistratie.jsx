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

// ── Git-persistentie (P04): dev-endpoint ↔ web/vite/profielen/*.json ────────
// Elk bestand is { kern?, layout?, activiteitIcoon? }. De bestanden reizen
// via git mee naar andere dev-machines; localStorage blijft de runtime-cache
// en de fallback wanneer het endpoint er niet is (productie-build).
const PROFIEL_ENDPOINT = "/__studio05/profielen";

/** Alle profiel-bestanden uit de git-map, of null zonder endpoint. */
export async function leesProfielBestanden() {
  try {
    const r = await fetch(PROFIEL_ENDPOINT);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/** Schrijf één profiel-bestand (fire-and-forget; dev-only). */
export function bewaarProfielBestand(id, inhoud) {
  try {
    fetch(`${PROFIEL_ENDPOINT}/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inhoud, null, 2),
    }).catch(() => {});
  } catch {
    /* geen endpoint (productie): localStorage volstaat */
  }
}

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

/** Bewaar één profiel-kern (voegt toe/overschrijft op kern.id) — ook als
 *  bestand in de git-map, samen met een eventuele standaard-layout. */
export function bewaarProfiel(kern) {
  bewaarProfielen({ ...leesProfielen(), [kern.id]: kern });
  const layout = leesProfielLayouts()[kern.id];
  bewaarProfielBestand(kern.id, { kern, ...(layout ? { layout } : {}) });
}

// ── Standaard-layouts per profiel (PE): {profielId: {sleutel: {x, y}}} ─────
export const LAYOUT_OPSLAG_SLEUTEL = "studio05-profiel-layouts";

export function leesProfielLayouts() {
  try {
    return JSON.parse(localStorage.getItem(LAYOUT_OPSLAG_SLEUTEL) || "{}") || {};
  } catch {
    return {};
  }
}

export function bewaarProfielLayout(profielId, layout) {
  try {
    localStorage.setItem(
      LAYOUT_OPSLAG_SLEUTEL,
      JSON.stringify({ ...leesProfielLayouts(), [profielId]: layout })
    );
  } catch {
    /* opslag vol — niet kritisch */
  }
  // Ook naar de git-map: mét de kern als dit een eigen (PE-)profiel is;
  // voor ingebouwde profielen (mim12, oas31, …) alleen de layout.
  const kern = leesProfielen()[profielId];
  bewaarProfielBestand(profielId, { ...(kern ? { kern } : {}), layout });
}

/**
 * Registreer een descriptor-kern als DiagramType + activiteit. Retourneert
 * het activiteit-id. Gooit bij validatie-/hookfouten.
 */
export function registreerProfielAlsActiviteit(kern) {
  const descriptor = vertaalHooks(kern);
  vervangDiagramType(descriptor);
  const activiteitId = `dyn-${kern.id}`;
  // P05: eigen embleem (1-2 tekens) in de activity bar, anders het
  // standaard profiel-icoon.
  const icoon = kern.embleem ? (
    <span style={{ fontSize: kern.embleem.length > 1 ? 11 : 14, fontWeight: 700, letterSpacing: "0.02em" }}>
      {kern.embleem}
    </span>
  ) : (
    <IconProfiel05 />
  );
  registreerActiviteit(
    maakDiagramActiviteit({
      id: activiteitId,
      label: kern.label || kern.id,
      icon: icoon,
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

// Daarna asynchroon de git-map (dev-endpoint): die is de gedeelde bron van
// waarheid en wint van localStorage — zo verschijnen profielen die op een
// andere machine zijn gemaakt hier vanzelf na een git pull.
leesProfielBestanden().then((bestanden) => {
  if (!bestanden) return; // geen endpoint (productie) — klaar
  const lokaal = leesProfielen();
  const layouts = leesProfielLayouts();
  let layoutsGewijzigd = false;
  for (const [id, inhoud] of Object.entries(bestanden)) {
    if (inhoud?.layout) {
      layouts[id] = inhoud.layout;
      layoutsGewijzigd = true;
    }
    if (inhoud?.kern) {
      try {
        registreerProfielAlsActiviteit(inhoud.kern);
        lokaal[inhoud.kern.id] = inhoud.kern;
      } catch (e) {
        console.warn(`Profiel-bestand "${id}" niet geregistreerd:`, e?.message || e);
      }
    }
  }
  if (layoutsGewijzigd) {
    try {
      localStorage.setItem(LAYOUT_OPSLAG_SLEUTEL, JSON.stringify(layouts));
    } catch {
      /* opslag vol — niet kritisch */
    }
  }
  bewaarProfielen(lokaal);
});
