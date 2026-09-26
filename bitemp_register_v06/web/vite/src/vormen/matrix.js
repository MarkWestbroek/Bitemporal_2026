/**
 * matrix.js — de vorm `rating-grid` (matrix / likert): per rij één keuze uit dezelfde schaal.
 * Puur (matrix.test.js).
 *
 * Inhoud: een lijst met één rij per waarde van het RIJVELD (bv. type_bijdrage =
 * Wendbaarheid / Dienstverlening / Regie) en per rij één uit een lijst voor het KOLOMVELD
 * (bv. schaal = Schaal 1..4). XForms: een `repeat` met per item een `select1` in
 * appearance "full". De data is precies die van drie losse vaste-rij-lijsten: één lijstrij
 * per rijwaarde, { ...vast, [rijveld]: rij, [kolomveld]: keuze, …extra }.
 *
 * vormConfig (gedeeld met Imprint, dus Engels):
 *   {
 *     "rowField": "type_bijdrage",            // standaard: het eerste sjabloonveld zonder vasteWaarde
 *     "columnField": "schaal",                // standaard: het volgende sjabloonveld
 *     "rows":    [ "Wendbaarheid", { "value": "Regie", "label": "Regie", "description": "…" } ],
 *                                             // standaard: de enum van het rijveld (alle waarden)
 *     "columns": [ { "value": "Schaal 1", "label": "1 · klein", "color": "#fde68a" }, … ],
 *                                             // standaard: de enum van het kolomveld
 *     "required": true                        // elke rij moet een keuze hebben
 *   }
 * Overige sjabloonvelden (bv. toelichting) zijn EXTRA velden per rij: de renderer tekent ze
 * onder de rij (uitklapbaar), met de gewone veldcomponenten.
 */

const heeftVasteWaarde = (el) => el?.vasteWaarde !== undefined && el?.vasteWaarde !== null && el?.vasteWaarde !== "";
const isLeeg = (v) => v === undefined || v === null || v === "";

function naarOpties(lijst) {
  return (lijst || []).filter((o) => o != null && o !== "").map((o) => (typeof o === "object"
    ? { value: String(o.value), label: o.label || String(o.value), ...(o.description ? { description: o.description } : {}), ...(o.color ? { color: o.color } : {}) }
    : { value: String(o), label: String(o) }));
}

/**
 * Assen van de matrix uit het lijst-element en de velddefinities.
 *
 * @param {Object}   lijst     het layout-element (type "lijst", vorm "rating-grid")
 * @param {Function} zoekVeld  (relatieve veldnaam) => velddefinitie { naam, enum, verplicht, … } | undefined
 * @returns {{ rowField, columnField, rows, columns, extra, rowElement, columnElement, required, fouten }}
 */
export function matrixAssen(lijst, zoekVeld = () => undefined) {
  const cfg = lijst?.vormConfig || {};
  const sjabloon = (lijst?.elementen || []).filter((e) => e?.type === "veld" && !heeftVasteWaarde(e));
  const fouten = [];

  const rowField = cfg.rowField || sjabloon[0]?.veld || null;
  const columnField = cfg.columnField || sjabloon.find((e) => e.veld !== rowField)?.veld || null;
  if (!rowField) fouten.push("matrix zonder rijveld");
  if (!columnField) fouten.push("matrix zonder kolomveld");

  const rowDef = rowField ? zoekVeld(rowField) : undefined;
  const colDef = columnField ? zoekVeld(columnField) : undefined;
  const rows = naarOpties(cfg.rows || rowDef?.enum);
  const columns = naarOpties(cfg.columns || colDef?.enum);
  if (rowField && rows.length === 0) fouten.push(`matrix: geen rijen (geef vormConfig.rows of een enum op ${rowField})`);
  if (columnField && columns.length === 0) fouten.push(`matrix: geen kolommen (geef vormConfig.columns of een enum op ${columnField})`);

  // Een kolomwaarde die niet in de enum van het kolomveld staat, zou de server weigeren.
  if (cfg.columns && Array.isArray(colDef?.enum) && colDef.enum.length) {
    for (const c of columns) if (!colDef.enum.includes(c.value)) fouten.push(`matrix: kolom "${c.value}" hoort niet bij ${columnField}`);
  }
  if (cfg.rows && Array.isArray(rowDef?.enum) && rowDef.enum.length) {
    for (const r of rows) if (!rowDef.enum.includes(r.value)) fouten.push(`matrix: rij "${r.value}" hoort niet bij ${rowField}`);
  }

  return {
    rowField,
    columnField,
    rows,
    columns,
    extra: sjabloon.filter((e) => e.veld !== rowField && e.veld !== columnField),
    rowElement: sjabloon.find((e) => e.veld === rowField) || null,
    columnElement: sjabloon.find((e) => e.veld === columnField) || null,
    required: cfg.required === true || (cfg.required === undefined && colDef?.verplicht === true),
    fouten,
  };
}

/**
 * Per rijwaarde de bestaande lijstrij (eerste voorkomen) binnen de eigen rijen van de lijst.
 * @returns {Record<string, { idx: number, rij: Object }>}
 */
export function matrixRijen(alle, eigenIdx, rowField) {
  const uit = {};
  for (const j of eigenIdx || []) {
    const rij = alle?.[j];
    const k = isLeeg(rij?.[rowField]) ? "" : String(rij[rowField]);
    if (k && !uit[k]) uit[k] = { idx: j, rij };
  }
  return uit;
}

/** Heeft een rij inhoud buiten de vaste waarden en het rijveld? */
function heeftInhoud(rij, vast, rowField) {
  return Object.entries(rij || {}).some(([k, v]) => k !== rowField && !(k in (vast || {})) && !isLeeg(v));
}

/**
 * Eén cel kiezen of wissen. Bestaat de rij, dan wordt het kolomveld bijgewerkt (zelfde
 * lijstrij, geen afvoer+opvoer); anders komt er een rij bij. Wissen (kolomwaarde leeg)
 * haalt de rij weg als er verder niets in staat (anders blijft bv. de toelichting staan).
 */
export function zetMatrixCel(alle, eigenIdx, vast, rowField, columnField, rowValue, colValue) {
  const lijst = alle || [];
  const bestaand = matrixRijen(lijst, eigenIdx, rowField)[String(rowValue)];
  if (bestaand) {
    const nieuw = { ...bestaand.rij, [columnField]: isLeeg(colValue) ? "" : colValue };
    if (isLeeg(colValue) && !heeftInhoud(nieuw, vast, rowField)) return lijst.filter((_, j) => j !== bestaand.idx);
    return lijst.map((r, j) => (j === bestaand.idx ? nieuw : r));
  }
  if (isLeeg(colValue)) return lijst;
  return [...lijst, { ...vast, [rowField]: rowValue, [columnField]: colValue }];
}

/**
 * Een extra veld (bv. toelichting) van één matrixrij zetten; maakt de rij aan als die er
 * nog niet is (dan zonder kolomwaarde).
 */
export function zetMatrixExtra(alle, eigenIdx, vast, rowField, rowValue, veld, waarde) {
  const lijst = alle || [];
  const bestaand = matrixRijen(lijst, eigenIdx, rowField)[String(rowValue)];
  if (bestaand) return lijst.map((r, j) => (j === bestaand.idx ? { ...r, [veld]: waarde } : r));
  if (isLeeg(waarde)) return lijst;
  return [...lijst, { ...vast, [rowField]: rowValue, [veld]: waarde }];
}

/** Rijen zonder keuze (voor `required`). */
export function ontbrekendeRijen(rows, rijen, columnField) {
  return rows.filter((r) => isLeeg(rijen[r.value]?.rij?.[columnField])).map((r) => r.value);
}
