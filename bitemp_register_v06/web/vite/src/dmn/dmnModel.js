/**
 * dmnModel.js — pure helpers voor een DMN-achtige beslistabel waarvan de
 * input- en output-kolommen binden aan velden uit het canoniek model (FieldRef).
 *
 * Dit is bewust géén volledige DMN/FEEL-implementatie. Het doel is de
 * "driehoek proces – regels – data" te bewijzen: een DMN-kolom kan niet bestaan
 * zonder een veld uit het metamodel. Zie
 * process_engine_v01/docs/driehoek-proces-regels-data.md.
 *
 * Datamodel:
 *   DecisionTable {
 *     naam, hitPolicy,
 *     inputs:  [ InputClause ],
 *     outputs: [ OutputClause ],
 *     rules:   [ Rule ],
 *   }
 *   InputClause  { id, fieldRef|null, label, type, datatype, enum[] }
 *   OutputClause { id, fieldRef|null, adhoc, label, naam, type, datatype, enum[] }
 *   Rule         { id, inputEntries: {clauseId: tekst}, outputEntries: {clauseId: tekst} }
 */

let _counter = 0;
function genId(prefix) {
  _counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${_counter}`;
}

/** Lege beslistabel met één input, één output en één lege regel. */
export function nieuweBeslistabel(naam = "Nieuwe beslissing") {
  const input = nieuweInputClause();
  const output = nieuweOutputClause();
  return {
    naam,
    hitPolicy: "UNIQUE",
    inputs: [input],
    outputs: [output],
    rules: [nieuweRegel([input.id], [output.id])],
  };
}

export function nieuweInputClause() {
  return { id: genId("in"), fieldRef: null, label: "", type: "", datatype: "", enum: [] };
}

export function nieuweOutputClause() {
  return { id: genId("out"), fieldRef: null, adhoc: false, label: "", naam: "", type: "", datatype: "", enum: [] };
}

export function nieuweRegel(inputIds = [], outputIds = []) {
  const inputEntries = {};
  inputIds.forEach((id) => (inputEntries[id] = ""));
  const outputEntries = {};
  outputIds.forEach((id) => (outputEntries[id] = ""));
  return { id: genId("rule"), inputEntries, outputEntries };
}

/**
 * Bind een FieldRef aan een input-clause. Neemt label, type, datatype en enum
 * automatisch over uit het metamodel — geen handmatig getypte kolomdefinitie.
 */
export function bindInput(table, clauseId, fieldRef) {
  return {
    ...table,
    inputs: table.inputs.map((c) =>
      c.id === clauseId
        ? {
            ...c,
            fieldRef,
            label: fieldRef?.veldpad || c.label,
            type: fieldRef?.type || "",
            datatype: fieldRef?.datatype || "",
            enum: Array.isArray(fieldRef?.enum) ? fieldRef.enum : [],
          }
        : c
    ),
  };
}

/**
 * Bind een FieldRef aan een output-clause (optie a). adhoc wordt dan false.
 */
export function bindOutput(table, clauseId, fieldRef) {
  return {
    ...table,
    outputs: table.outputs.map((c) =>
      c.id === clauseId
        ? {
            ...c,
            fieldRef,
            adhoc: false,
            label: fieldRef?.veldpad || c.label,
            naam: fieldRef?.veldnaam || c.naam,
            type: fieldRef?.type || "",
            datatype: fieldRef?.datatype || "",
            enum: Array.isArray(fieldRef?.enum) ? fieldRef.enum : [],
          }
        : c
    ),
  };
}

/**
 * Markeer een output-clause als ad-hoc tussenresultaat (optie b): niet gebonden
 * aan een bestaand veld. De gebruiker geeft zelf naam + type op.
 */
export function maakOutputAdhoc(table, clauseId, naam = "resultaat", type = "string") {
  return {
    ...table,
    outputs: table.outputs.map((c) =>
      c.id === clauseId ? { ...c, fieldRef: null, adhoc: true, naam, label: naam, type, datatype: "", enum: [] } : c
    ),
  };
}

export function voegInputToe(table) {
  const clause = nieuweInputClause();
  return {
    ...table,
    inputs: [...table.inputs, clause],
    rules: table.rules.map((r) => ({ ...r, inputEntries: { ...r.inputEntries, [clause.id]: "" } })),
  };
}

export function voegOutputToe(table) {
  const clause = nieuweOutputClause();
  return {
    ...table,
    outputs: [...table.outputs, clause],
    rules: table.rules.map((r) => ({ ...r, outputEntries: { ...r.outputEntries, [clause.id]: "" } })),
  };
}

export function voegRegelToe(table) {
  return {
    ...table,
    rules: [...table.rules, nieuweRegel(table.inputs.map((c) => c.id), table.outputs.map((c) => c.id))],
  };
}

export function verwijderRegel(table, ruleId) {
  return { ...table, rules: table.rules.filter((r) => r.id !== ruleId) };
}

export function zetCel(table, ruleId, clauseId, kant, waarde) {
  const veld = kant === "input" ? "inputEntries" : "outputEntries";
  return {
    ...table,
    rules: table.rules.map((r) =>
      r.id === ruleId ? { ...r, [veld]: { ...r[veld], [clauseId]: waarde } } : r
    ),
  };
}

/**
 * Validatie: elke input/output moet gebonden zijn aan een FieldRef óf (output)
 * expliciet ad-hoc zijn. Dit dwingt de regel "data bestaat niet buiten het
 * canoniek model" af. Retourneert een lijst meldingen (leeg = geldig).
 */
export function valideerTabel(table) {
  const meldingen = [];
  table.inputs.forEach((c, i) => {
    if (!c.fieldRef) meldingen.push({ niveau: "fout", tekst: `Input-kolom ${i + 1} is niet gebonden aan een veld.` });
  });
  table.outputs.forEach((c, i) => {
    if (!c.fieldRef && !c.adhoc)
      meldingen.push({ niveau: "fout", tekst: `Output-kolom ${i + 1} is niet gebonden en niet ad-hoc.` });
    if (c.adhoc)
      meldingen.push({ niveau: "info", tekst: `Output "${c.naam}" is ad-hoc en kan gepromoveerd worden tot afgeleid veld.` });
  });
  return meldingen;
}

/**
 * Bouw een afgeleid-veld-voorstel uit een ad-hoc output. Dit is de "promoveer
 * tot afgeleid veld"-actie: het tussenresultaat wordt teruggeschreven naar het
 * canoniek model met de DMN als regelbron.
 */
export function adhocNaarAfgeleidVeldVoorstel(table, clauseId, doelTypenaam) {
  const clause = table.outputs.find((c) => c.id === clauseId);
  if (!clause) return null;
  return {
    typenaam: doelTypenaam || null,
    naam: clause.naam || "resultaat",
    goType: clause.type || "string",
    afleidingsregelTaal: "dmn",
    afleidingsregel: `decision:${table.naam}#${clause.naam}`,
    isWeergaveVeld: false,
    bron: { soort: "dmn", beslissing: table.naam, output: clause.naam },
  };
}
