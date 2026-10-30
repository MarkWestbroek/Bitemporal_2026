// @ts-check
/**
 * dmnXmlSchrijver — **schrijver** voor DMN 1.3 XML: één beslissing met een
 * beslistabel (de vorm van `dmn/dmnModel.js`: inputs, outputs, rules) →
 * `dmn:definitions` met één `decision` en zijn `decisionTable`
 * (docs/TRANSFORMATIES.md §11.12).
 *
 * Wat de schrijver per kolom nodig heeft:
 * - input: `naam` (de variabele die de engine aanbiedt), `expressie` (FEEL,
 *   standaard = naam), `type` (typeRef) en `label`;
 * - output: `naam`, `type` en `label`;
 * - regel: per kolom-id de tekst van de cel (FEEL unary test of expressie;
 *   leeg = "-", elke waarde), en `toelichting` (description).
 *
 * Engine-neutraal: DMN 1.3 kent geen engine-dialect in de tabel zelf. Hoe de
 * engine de invoer vult (bij GZAC: input-parameters op de businessRuleTask)
 * staat in de BPMN-regelset.
 *
 * Puur: geen DOM nodig, de uitvoer is tekst.
 */

const NS = {
  dmn: "https://www.omg.org/spec/DMN/20191111/MODEL/",
};

/**
 * Go- of modeltype → DMN typeRef (FEEL-basistypen). Getallen worden "number":
 * Valtimo geeft dossierwaarden via Jackson door, en een getal komt dan als
 * Double (50.0) binnen; "integer" kan daarop botsen (FUNDAMENT, cg-test 30-10).
 */
const TYPE_REF = {
  string: "string",
  tekst: "string",
  bool: "boolean",
  boolean: "boolean",
  int: "number",
  int64: "number",
  integer: "number",
  float64: "number",
  double: "number",
  number: "number",
  date: "date",
  datum: "date",
};
export const typeRef = (type) => TYPE_REF[String(type || "").toLowerCase()] || "string";

const HIT_POLICIES = new Set(["UNIQUE", "FIRST", "PRIORITY", "ANY", "COLLECT", "RULE ORDER", "OUTPUT ORDER"]);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const attrs = (obj) =>
  Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => ` ${k}="${esc(v)}"`)
    .join("");

/**
 * @param {Object} invoer
 * @param {{id: string, naam?: string, tabel: any}} invoer.beslissing - decision-id (= artefact-identifier), naam en beslistabel
 * @param {string} [invoer.namespace]
 * @returns {{xml: string, diagnostics: any[]}}
 */
export function schrijfDmn({ beslissing, namespace = "http://bpmn.io/schema/dmn" }) {
  const diagnostics = [];
  const meld = (message, sourceId = null) => diagnostics.push({ severity: "warning", code: "DMN-SCHRIJVER", message, sourceId, path: null });
  const tabel = beslissing.tabel || {};
  const inputs = tabel.inputs || [];
  const outputs = tabel.outputs || [];
  const hitPolicy = String(tabel.hitPolicy || "UNIQUE").toUpperCase();
  if (!HIT_POLICIES.has(hitPolicy)) meld(`Onbekende hitPolicy "${tabel.hitPolicy}"`);

  const id = beslissing.id;
  const r = [];
  r.push(`  <dmn:decision${attrs({ id, name: beslissing.naam || tabel.naam || id })}>`);
  r.push(`    <dmn:decisionTable${attrs({ id: `${id}-tabel`, hitPolicy })}>`);
  inputs.forEach((c, i) => {
    const naam = c.naam || c.fieldRef?.veldnaam;
    if (!naam && !c.expressie) meld(`Input-kolom ${i + 1} heeft geen naam of expressie`, c.id);
    r.push(`      <dmn:input${attrs({ id: c.id, label: c.label || naam })}>`);
    r.push(`        <dmn:inputExpression${attrs({ id: `${c.id}-expressie`, typeRef: typeRef(c.type) })}>`);
    r.push(`          <dmn:text>${esc(c.expressie || naam || "")}</dmn:text>`);
    r.push(`        </dmn:inputExpression>`);
    r.push(`      </dmn:input>`);
  });
  outputs.forEach((c, i) => {
    if (!c.naam) meld(`Output-kolom ${i + 1} heeft geen naam`, c.id);
    r.push(`      <dmn:output${attrs({ id: c.id, label: c.label || c.naam, name: c.naam, typeRef: typeRef(c.type) })} />`);
  });
  for (const regel of tabel.rules || []) {
    r.push(`      <dmn:rule${attrs({ id: regel.id })}>`);
    if (regel.toelichting) r.push(`        <dmn:description>${esc(regel.toelichting)}</dmn:description>`);
    for (const c of inputs) {
      const t = String(regel.inputEntries?.[c.id] ?? "").trim();
      r.push(`        <dmn:inputEntry${attrs({ id: `${regel.id}-${c.id}` })}><dmn:text>${esc(t || "-")}</dmn:text></dmn:inputEntry>`);
    }
    for (const c of outputs) {
      const t = String(regel.outputEntries?.[c.id] ?? "").trim();
      if (!t) meld(`Regel "${regel.id}": geen uitkomst voor "${c.naam}"`, regel.id);
      r.push(`        <dmn:outputEntry${attrs({ id: `${regel.id}-${c.id}` })}><dmn:text>${esc(t)}</dmn:text></dmn:outputEntry>`);
    }
    r.push(`      </dmn:rule>`);
  }
  r.push(`    </dmn:decisionTable>`);
  r.push(`  </dmn:decision>`);

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<dmn:definitions${attrs({ "xmlns:dmn": NS.dmn, id: `Definitions_${id}`, name: beslissing.naam || id, namespace })}>`,
    ...r,
    `</dmn:definitions>`,
    "",
  ].join("\n");
  return { xml, diagnostics };
}
