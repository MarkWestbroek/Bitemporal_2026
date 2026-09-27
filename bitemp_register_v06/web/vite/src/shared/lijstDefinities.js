/**
 * lijstDefinities.js — het pure deel van LijstDefinitie (zie hooks/useLijstDefinitie.js):
 * full-records omzetten naar actieve definities, en de geldende lijst kiezen. Getest in
 * lijstDefinities.test.js.
 */
import { actueleData } from "./actueleData.js";
import { vindDefinitie } from "./definitieSleutel.js";

const waar = (v) => v === true || v === "true";

/** Full-records → actieve definities voor het doeltype, standaard voorop. Puur (getest). */
export function naarLijstDefinities(items, doeltype) {
  const uit = [];
  for (const full of items) {
    if (!full || full.afvoer) continue;
    const meta = actueleData(full, "lijst_definitie_metas");
    if (!meta || meta.doeltype !== doeltype || meta.status !== "actief") continue;
    const cfg = actueleData(full, "lijst_definitie_lijstconfigs");
    let config = null;
    try {
      config = cfg?.lijst_config_json ? JSON.parse(cfg.lijst_config_json) : null;
    } catch {
      config = null;
    }
    uit.push({
      id: full.id,
      code: meta.code || "",
      meta,
      config,
      formulier: cfg?.formulier ? String(cfg.formulier).trim() : "",
      formulierKiesbaar: waar(cfg?.formulier_kiesbaar),
      isStandaard: waar(meta.is_standaard),
    });
  }
  uit.sort((a, b) => Number(b.isStandaard) - Number(a.isStandaard) || String(a.meta?.naam || "").localeCompare(String(b.meta?.naam || ""), "nl"));
  return uit;
}

/**
 * De lijst die geldt: `?lijst=<code of id>`, anders de standaard. "automatisch" = bewust geen
 * lijstdefinitie (het automatische overzicht uit het schema).
 */
export function gekozenLijst(definities, sleutel) {
  if (sleutel === "automatisch") return null;
  if (sleutel) return vindDefinitie(definities, sleutel) || null;
  return definities.find((d) => d.isStandaard) || null;
}
