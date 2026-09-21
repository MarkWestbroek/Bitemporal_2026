/**
 * layoutModel — pure helpers voor de FormulierDefinitie-layout (het `layout_json`).
 *
 * De layout is een boom van elementen; de runtime-renderer is
 * components/editor/CustomFormulierRenderer.jsx. Dit model is de *editor*-kant:
 * bewerken, valideren, (de)serialiseren.
 *
 * Elementtypes:
 *   - formulier   → root container            { type, elementen[] }
 *   - groep       → sectie met heading        { type, label?, context?, elementen[] }
 *   - rij         → horizontale flexrij        { type, elementen[] }
 *   - veld        → één invoerveld             { type, veld: "ENT.GE.veld", label?, breedte?, widget? }
 *   - conditioneel→ conditioneel blok          { type, als?|conditie?, dan[] }
 *
 * Veld-adressering is **padgebaseerd** (`ENT.GE.veld`), consistent met CEL,
 * afgeleide velden en berichtdefinities. Zie docs/plans/2026-07-16 Formulier-editor.
 *
 * Elk element krijgt tijdens het bewerken een intern `_id` voor selectie; dat
 * wordt bij serialisatie gestript (het hoort niet in het opgeslagen JSON).
 */

let _idTeller = 0;
function nieuwId() {
  _idTeller += 1;
  return `el${_idTeller}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Containertypes die een `elementen`-array hebben. */
const CONTAINER_MET_ELEMENTEN = new Set(["formulier", "groep", "rij", "lijst"]);

/** Kan dit elementtype kinderen bevatten? */
export function isContainer(el) {
  if (!el) return false;
  return CONTAINER_MET_ELEMENTEN.has(el.type) || el.type === "conditioneel";
}

/** De kinder-array-sleutel voor een element (`elementen` of `dan`). */
export function kinderSleutel(el) {
  if (!el) return null;
  if (el.type === "conditioneel") return "dan";
  if (CONTAINER_MET_ELEMENTEN.has(el.type)) return "elementen";
  return null;
}

/** De kinderen van een element (lege array als geen container). */
export function kinderen(el) {
  const sleutel = kinderSleutel(el);
  return sleutel ? (Array.isArray(el[sleutel]) ? el[sleutel] : []) : [];
}

/** Een leeg root-formulier. */
export function nieuwFormulier() {
  return { _id: nieuwId(), type: "formulier", elementen: [] };
}

/** Een nieuw element van een gegeven type met interne id. */
export function nieuwElement(type, extra = {}) {
  const basis = { _id: nieuwId(), type, ...extra };
  if (CONTAINER_MET_ELEMENTEN.has(type) && !basis.elementen) basis.elementen = [];
  if (type === "conditioneel" && !basis.dan) basis.dan = [];
  return basis;
}

/**
 * parseLayout — JSON-string of object → boom met interne `_id`'s.
 * Geeft `{ root, fout }`. Bij parse-fout is root null en fout gezet.
 */
export function parseLayout(input) {
  let obj = input;
  if (typeof input === "string") {
    if (!input.trim()) return { root: nieuwFormulier(), fout: null };
    try {
      obj = JSON.parse(input);
    } catch (e) {
      return { root: null, fout: `Ongeldige JSON: ${e.message}` };
    }
  }
  if (!obj || typeof obj !== "object") {
    return { root: nieuwFormulier(), fout: null };
  }
  return { root: metIds(obj), fout: null };
}

/** Recursief interne id's toekennen (kopieert de boom). */
function metIds(el) {
  const kopie = { ...el, _id: el._id || nieuwId() };
  const sleutel = kinderSleutel(el);
  if (sleutel && Array.isArray(el[sleutel])) {
    kopie[sleutel] = el[sleutel].map(metIds);
  }
  return kopie;
}

/** serializeLayout — boom → schoon object zonder interne velden. */
export function serializeLayout(root) {
  return zonderIds(root);
}

function zonderIds(el) {
  const kopie = {};
  for (const [k, v] of Object.entries(el)) {
    if (k === "_id") continue;
    kopie[k] = v;
  }
  const sleutel = kinderSleutel(el);
  if (sleutel && Array.isArray(el[sleutel])) {
    kopie[sleutel] = el[sleutel].map(zonderIds);
  }
  return kopie;
}

/** serializeLayout → JSON-string (compact of ingesprongen). */
export function serializeLayoutJson(root, ingesprongen = false) {
  return JSON.stringify(serializeLayout(root), null, ingesprongen ? 2 : 0);
}

/** Bezoek elk element diepte-eerst (parent vóór kinderen). */
export function wandel(root, fn, parent = null, index = 0) {
  if (!root) return;
  fn(root, parent, index);
  const sleutel = kinderSleutel(root);
  if (sleutel && Array.isArray(root[sleutel])) {
    root[sleutel].forEach((kind, i) => wandel(kind, fn, root, i));
  }
}

/** Vind een element op interne id → { element, parent, index } of null. */
export function vindElement(root, id) {
  let gevonden = null;
  wandel(root, (el, parent, index) => {
    if (el._id === id) gevonden = { element: el, parent, index };
  });
  return gevonden;
}

/** Vind een bestaand `lijst`-element met de gegeven bron (entiteit.rol), of null. */
export function vindLijstMetBron(root, bron) {
  let gevonden = null;
  wandel(root, (el) => {
    if (el.type === "lijst" && el.bron === bron) gevonden = el;
  });
  return gevonden;
}

/** Diepe kloon van de boom mét behoud van interne id's (voor immutabele store-updates). */
export function kloonBehoudIds(root) {
  const kopie = { ...root };
  const sleutel = kinderSleutel(root);
  if (sleutel && Array.isArray(root[sleutel])) {
    kopie[sleutel] = root[sleutel].map(kloonBehoudIds);
  }
  return kopie;
}

/**
 * voegToe — voeg `element` toe als kind van `parentId` op positie `index`
 * (of achteraan). Retourneert een nieuwe boom. Als parentId null/root → aan root.
 */
export function voegToe(root, parentId, element, index = null) {
  const nieuw = kloonBehoudIds(root);
  const doel = parentId ? vindElement(nieuw, parentId)?.element : nieuw;
  if (!doel || !isContainer(doel)) return root;
  const sleutel = kinderSleutel(doel);
  if (!Array.isArray(doel[sleutel])) doel[sleutel] = [];
  const pos = index == null ? doel[sleutel].length : index;
  doel[sleutel].splice(pos, 0, element);
  return nieuw;
}

/** verwijder — verwijder element op id. Retourneert een nieuwe boom. */
export function verwijder(root, id) {
  const nieuw = kloonBehoudIds(root);
  const info = vindElement(nieuw, id);
  if (!info || !info.parent) return root; // root zelf niet verwijderbaar
  const sleutel = kinderSleutel(info.parent);
  info.parent[sleutel].splice(info.index, 1);
  return nieuw;
}

/** updateElement — merge `patch` in element op id. Retourneert nieuwe boom. */
export function updateElement(root, id, patch) {
  const nieuw = kloonBehoudIds(root);
  const info = vindElement(nieuw, id);
  if (!info) return root;
  Object.assign(info.element, patch);
  // Lege string-waarden opruimen zodat ze niet in de JSON blijven staan.
  for (const [k, v] of Object.entries(patch)) {
    if (v === "" || v == null) delete info.element[k];
  }
  return nieuw;
}

/**
 * verplaats — schuif element binnen zijn parent één plek op/neer.
 * `richting` = -1 (omhoog) of +1 (omlaag). Retourneert nieuwe boom.
 */
export function verplaats(root, id, richting) {
  const nieuw = kloonBehoudIds(root);
  const info = vindElement(nieuw, id);
  if (!info || !info.parent) return root;
  const sleutel = kinderSleutel(info.parent);
  const arr = info.parent[sleutel];
  const doel = info.index + richting;
  if (doel < 0 || doel >= arr.length) return root;
  [arr[info.index], arr[doel]] = [arr[doel], arr[info.index]];
  return nieuw;
}

/**
 * valideer — verzamel waarschuwingen over de layout.
 * @param {object} root
 * @param {Set<string>} bekendePaden  (optioneel) geldige veldpaden uit het model
 * @returns {Array<{ id, niveau, tekst }>}
 */
export function valideer(root, bekendePaden = null) {
  const meldingen = [];
  const padTelling = new Map();

  wandel(root, (el) => {
    if (el.type === "veld") {
      const pad = el.veld || "";
      if (!pad) {
        meldingen.push({ id: el._id, niveau: "fout", tekst: "Veld zonder pad." });
        return;
      }
      padTelling.set(pad, (padTelling.get(pad) || 0) + 1);
      if (bekendePaden && bekendePaden.size > 0 && !bekendePaden.has(pad)) {
        meldingen.push({ id: el._id, niveau: "waarschuwing", tekst: `Onbekend veldpad: ${pad}` });
      }
    }
  });

  for (const [pad, n] of padTelling) {
    if (n > 1) {
      meldingen.push({ id: null, niveau: "waarschuwing", tekst: `Veld ${pad} komt ${n}× voor.` });
    }
  }
  return meldingen;
}

/** Korte, leesbare naam voor een element (voor de boom-weergave). */
export function elementLabel(el) {
  if (!el) return "";
  switch (el.type) {
    case "formulier": return "Formulier";
    case "groep": return el.label ? `Groep · ${el.label}` : "Groep";
    case "rij": return "Rij";
    case "lijst": return `Lijst · ${el.label || el.bron || "?"} (meervoudig)`;
    case "veld": return el.label ? `${el.label} (${el.veld})` : (el.veld || "veld");
    case "conditioneel": return `Conditioneel · ${el.conditie ? beschrijfConditie(el.conditie) : (el.als || "?")}`;
    default: return el.type;
  }
}

function beschrijfConditie(c) {
  if (!c || typeof c !== "object") return String(c ?? "");
  const { veld, op, waarde } = c;
  if (op === "leeg") return `${veld} leeg`;
  if (op === "nietleeg") return `${veld} ingevuld`;
  return `${veld} ${op || "=="} ${waarde ?? ""}`;
}
