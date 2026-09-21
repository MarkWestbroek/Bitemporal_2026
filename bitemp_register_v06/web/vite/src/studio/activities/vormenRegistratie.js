/**
 * vormenRegistratie — opslag + registratie van **data-shapes** (Studio-
 * instellingen). Zelfde patroon als profielRegistratie: localStorage als
 * runtime-cache, een git-endpoint (`/__studio05/vormen` ↔ web/vite/vormen/*.json)
 * als gedeelde bron die via git meereist, en een build-glob zodat de vormen
 * ook in een productie-build zitten. Data-shapes leven globaal (Style-domein):
 * eenmaal geregistreerd zijn ze in élk profiel bruikbaar.
 */
import { registreerDataShape } from "../../diagramcore/shapes/dataShape.jsx";

export const VORMEN_SLEUTEL = "studio05-vormen";
const ENDPOINT = "/__studio05/vormen";

export function leesVormen() {
  try {
    return JSON.parse(localStorage.getItem(VORMEN_SLEUTEL) || "{}") || {};
  } catch {
    return {};
  }
}

export function bewaarVormenLokaal(vormen) {
  try {
    localStorage.setItem(VORMEN_SLEUTEL, JSON.stringify(vormen));
  } catch {
    /* opslag vol — niet kritisch */
  }
}

/** Bewaar één data-shape: registreer live, cache lokaal, schrijf naar git. */
export function bewaarVorm(def) {
  if (!def?.id) return;
  registreerDataShape(def);
  bewaarVormenLokaal({ ...leesVormen(), [def.id]: def });
  try {
    fetch(`${ENDPOINT}/${encodeURIComponent(def.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(def, null, 2),
    }).catch(() => {});
  } catch {
    /* geen endpoint (productie): localStorage volstaat */
  }
}

/** Verwijder een data-shape (lokaal + git; de registry-entry blijft tot herladen). */
export function verwijderVorm(id) {
  const vormen = leesVormen();
  delete vormen[id];
  bewaarVormenLokaal(vormen);
  try {
    fetch(`${ENDPOINT}/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
  } catch {
    /* geen endpoint */
  }
}

// ── Startup: registreer alle bekende data-shapes ───────────────────────────
// 1) build-gebundelde vormen (productie + dev), 2) localStorage-cache.
const _gebundeld = import.meta.glob("../../../vormen/*.json", { eager: true });
for (const [, module] of Object.entries(_gebundeld)) {
  try {
    registreerDataShape(module?.default || module);
  } catch {
    /* kapotte vorm: overslaan */
  }
}
for (const def of Object.values(leesVormen())) {
  try {
    registreerDataShape(def);
  } catch {
    /* kapotte vorm: overslaan */
  }
}

// 3) Asynchroon de git-map (dev-endpoint) — gedeelde bron, wint van cache.
export async function synchroniseerVormenVanGit() {
  try {
    const r = await fetch(ENDPOINT);
    if (!r.ok) return null;
    const bestanden = await r.json();
    const lokaal = leesVormen();
    for (const [id, def] of Object.entries(bestanden)) {
      registreerDataShape(def);
      lokaal[id] = def;
    }
    bewaarVormenLokaal(lokaal);
    return bestanden;
  } catch {
    return null;
  }
}
synchroniseerVormenVanGit();
