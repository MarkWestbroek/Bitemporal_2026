/**
 * sneltoetsen — instelbare toetsencombinaties voor canvas-acties (2026-10-07,
 * naar Marks EA-sneltoetsenlijst).
 *
 * - `SNELTOETS_ACTIES`: de catalogus (id, label, groep, standaardbinding).
 * - Bindingen: standaard, overschreven per browser (localStorage
 *   `studio05-sneltoetsen`, {actieId: "Ctrl+Alt+ArrowLeft" | null}).
 * - `actieVoorEvent(e)`: welke actie hoort bij dit keydown-event (of null) —
 *   de activiteit voert hem uit (`maakDiagramActiviteit`: uitlijnen, maat,
 *   verwijderen, zoeken).
 * - `bindingVanEvent(e)` / `toonBinding(b)`: vastleggen in het instelscherm
 *   en netjes tonen (menu's, tooltips).
 *
 * Bindingstekst: modifiers in vaste volgorde (Ctrl, Alt, Shift) + `e.key`
 * (letters in hoofdletters, pijlen als ArrowLeft e.d.). Op macOS telt ⌘ als
 * Ctrl. Enkele toetsen zonder modifier zijn toegestaan (F-toetsen, Delete),
 * gewone letters zonder modifier niet — die botsen met typen.
 */

export const SNELTOETS_ACTIES = [
  { id: "uitlijnen:left", groep: "Uitlijnen", label: "Links uitlijnen", standaard: "Ctrl+Alt+ArrowLeft" },
  { id: "uitlijnen:right", groep: "Uitlijnen", label: "Rechts uitlijnen", standaard: "Ctrl+Alt+ArrowRight" },
  { id: "uitlijnen:top", groep: "Uitlijnen", label: "Boven uitlijnen", standaard: "Ctrl+Alt+ArrowUp" },
  { id: "uitlijnen:bottom", groep: "Uitlijnen", label: "Onder uitlijnen", standaard: "Ctrl+Alt+ArrowDown" },
  // EA-benaming: verticaal centreren = boven elkaar (Alt+V), horizontaal = naast elkaar (Alt+H).
  { id: "uitlijnen:center-h", groep: "Uitlijnen", label: "Verticaal centreren (boven elkaar)", standaard: "Alt+V" },
  { id: "uitlijnen:center-v", groep: "Uitlijnen", label: "Horizontaal centreren (naast elkaar)", standaard: "Alt+H" },
  { id: "uitlijnen:distribute-h", groep: "Uitlijnen", label: "Horizontaal verdelen", standaard: "Alt+-" },
  { id: "uitlijnen:distribute-v", groep: "Uitlijnen", label: "Verticaal verdelen", standaard: "Alt+=" },
  { id: "uitlijnen:same-width", groep: "Maat", label: "Zelfde breedte", standaard: "Alt+W" },
  { id: "uitlijnen:same-height", groep: "Maat", label: "Zelfde hoogte", standaard: "Alt+E" },
  { id: "uitlijnen:same-size", groep: "Maat", label: "Zelfde maat", standaard: "Alt+R" },
  { id: "canvas:maat-inhoud", groep: "Maat", label: "Maat aanpassen aan inhoud", standaard: "Alt+Z" },
  { id: "canvas:snap", groep: "Maat", label: "Alles op raster", standaard: null },
  { id: "canvas:verwijder-uit-model", groep: "Bewerken", label: "Verwijderen uit model", standaard: "Ctrl+Delete" },
  { id: "canvas:zoek-in-boom", groep: "Bewerken", label: "Zoek in projectboom", standaard: "Alt+G" },
  { id: "canvas:normaliseer", groep: "Bewerken", label: "Normaliseer relaties", standaard: null },
];

/** Vaste toetsen die niet instelbaar zijn (ter informatie in het instelscherm). */
export const VASTE_SNELTOETSEN = [
  { label: "Hernoemen (canvas, boom, lijsten)", binding: "F2" },
  { label: "Verwijderen van het diagram", binding: "Delete" },
  { label: "Ongedaan maken / opnieuw", binding: "Ctrl+Z / Ctrl+Y" },
  { label: "Verplaatsen met pijltjes (×10 met Shift)", binding: "ArrowLeft…" },
  { label: "Kader-selectie / verbind-modus", binding: "Shift+slepen" },
  { label: "Item omhoog/omlaag in boom en velden", binding: "Ctrl+ArrowUp / Ctrl+ArrowDown" },
];

const OPSLAG = "studio05-sneltoetsen";
const luisteraars = new Set();
let _versie = 0;

function leesOverschrijvingen() {
  try {
    const raw = window.localStorage.getItem(OPSLAG);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function bewaarOverschrijvingen(obj) {
  try {
    window.localStorage.setItem(OPSLAG, JSON.stringify(obj));
  } catch {
    /* opslag uit: alleen deze sessie */
  }
  _versie += 1;
  luisteraars.forEach((fn) => fn());
}

/** Actieve binding voor een actie ("Alt+H"), of null als uitgezet. */
export function bindingVoor(actieId) {
  const over = leesOverschrijvingen();
  if (Object.prototype.hasOwnProperty.call(over, actieId)) return over[actieId];
  return SNELTOETS_ACTIES.find((a) => a.id === actieId)?.standaard ?? null;
}

export function zetBinding(actieId, binding) {
  const over = leesOverschrijvingen();
  const standaard = SNELTOETS_ACTIES.find((a) => a.id === actieId)?.standaard ?? null;
  if (binding === standaard) delete over[actieId];
  else over[actieId] = binding;
  bewaarOverschrijvingen(over);
}

export function herstelStandaarden() {
  bewaarOverschrijvingen({});
}

/** Welke andere actie gebruikt deze binding al (voor een waarschuwing)? */
export function actieMetBinding(binding, behalveId = null) {
  if (!binding) return null;
  return SNELTOETS_ACTIES.find((a) => a.id !== behalveId && bindingVoor(a.id) === binding) || null;
}

const MODIFIER_TOETSEN = new Set(["Control", "Alt", "Shift", "Meta", "AltGraph", "OS"]);

/** Bindingstekst uit een keydown-event, of null als het alleen een modifier is. */
export function bindingVanEvent(e) {
  if (!e || MODIFIER_TOETSEN.has(e.key)) return null;
  let key = e.key;
  if (key.length === 1) key = key.toUpperCase();
  if (key === " ") key = "Space";
  const delen = [];
  if (e.ctrlKey || e.metaKey) delen.push("Ctrl");
  if (e.altKey) delen.push("Alt");
  if (e.shiftKey) delen.push("Shift");
  delen.push(key);
  return delen.join("+");
}

/** Is deze binding bruikbaar als sneltoets (geen kale letter/cijfer)? */
export function bindingToegestaan(binding) {
  if (!binding) return false;
  const key = binding.split("+").pop();
  const heeftModifier = /(^|\+)(Ctrl|Alt)\+/.test(binding + "+");
  if (heeftModifier) return true;
  return /^(F\d{1,2}|Delete|Insert|Home|End|PageUp|PageDown|Escape)$/.test(key);
}

/** Actie-id bij een keydown-event, of null. */
export function actieVoorEvent(e) {
  const b = bindingVanEvent(e);
  if (!b) return null;
  for (const a of SNELTOETS_ACTIES) {
    if (bindingVoor(a.id) === b) return a.id;
  }
  return null;
}

const PIJLEN = { ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓" };

/** Nette weergave: "Ctrl+Alt+←", "Alt+H". */
export function toonBinding(binding) {
  if (!binding) return "";
  return binding
    .split("+")
    .map((d) => PIJLEN[d] || d)
    .join("+");
}

/** Abonnement voor React: hertekent bij een gewijzigde binding. */
export function abonneerSneltoetsen(fn) {
  luisteraars.add(fn);
  return () => luisteraars.delete(fn);
}
export function sneltoetsenVersie() {
  return _versie;
}
