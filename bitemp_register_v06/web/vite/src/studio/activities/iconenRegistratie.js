/**
 * iconenRegistratie — opslag + registratie van **data-iconen** (geïmporteerde
 * SVG). Zelfde patroon als vormenRegistratie: localStorage-cache, git-endpoint
 * (`/__studio05/iconen` ↔ web/vite/iconen/*.json) als gedeelde bron die via git
 * meereist, en een build-glob voor productie. Data-iconen leven globaal: na
 * registratie zijn ze in élk profiel bruikbaar (galerij, PE icoon-kiezers,
 * shape-set-cellen).
 */
import { registreerDataIcoon } from "../../diagramcore/shapes/dataIcoon.jsx";

export const ICONEN_SLEUTEL = "studio05-iconen";
const ENDPOINT = "/__studio05/iconen";

export function leesIconen() {
  try {
    return JSON.parse(localStorage.getItem(ICONEN_SLEUTEL) || "{}") || {};
  } catch {
    return {};
  }
}

function bewaarLokaal(iconen) {
  try {
    localStorage.setItem(ICONEN_SLEUTEL, JSON.stringify(iconen));
  } catch {
    /* opslag vol — niet kritisch */
  }
}

/** Bewaar één data-icoon: registreer live, cache lokaal, schrijf naar git. */
export function bewaarIcoon(def) {
  if (!def?.id || !def?.svg) return;
  registreerDataIcoon(def);
  bewaarLokaal({ ...leesIconen(), [def.id]: def });
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

export function verwijderIcoon(id) {
  const iconen = leesIconen();
  delete iconen[id];
  bewaarLokaal(iconen);
  try {
    fetch(`${ENDPOINT}/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
  } catch {
    /* geen endpoint */
  }
}

// ── Startup: registreer alle bekende data-iconen ──────────────────────────
const _gebundeld = import.meta.glob("../../../iconen/*.json", { eager: true });
for (const [, module] of Object.entries(_gebundeld)) {
  try {
    registreerDataIcoon(module?.default || module);
  } catch {
    /* kapot icoon: overslaan */
  }
}
for (const def of Object.values(leesIconen())) {
  try {
    registreerDataIcoon(def);
  } catch {
    /* kapot icoon: overslaan */
  }
}

export async function synchroniseerIconenVanGit() {
  try {
    const r = await fetch(ENDPOINT);
    if (!r.ok) return null;
    const bestanden = await r.json();
    const lokaal = leesIconen();
    for (const [id, def] of Object.entries(bestanden)) {
      registreerDataIcoon(def);
      lokaal[id] = def;
    }
    bewaarLokaal(lokaal);
    return bestanden;
  } catch {
    return null;
  }
}
synchroniseerIconenVanGit();
