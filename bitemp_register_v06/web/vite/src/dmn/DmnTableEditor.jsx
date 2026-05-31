/**
 * DmnTableEditor — beslistabel-editor waarvan de kolommen binden aan velden uit
 * het canoniek model. Stap 2 van de "driehoek proces – regels – data".
 *
 * Binding gebeurt op twee manieren:
 *  1) Sleep een veld vanuit de ModelPicker op een kolomkop (drag-and-drop,
 *     MIME application/x-canoniek-fieldref).
 *  2) Klik "bind…" op een kolomkop → roept onRequestBind(clauseId, kant) aan,
 *     waarmee de host (demo-pagina) de ModelPicker als kiezer kan openen.
 *
 * Zodra een input-kolom gebonden is, worden type/datatype/enum automatisch
 * overgenomen. Bij een enum-veld worden regelcellen een dropdown met exact de
 * toegestane waarden uit het metamodel — geen handmatige FEEL-typefouten.
 *
 * Controlled component: geef `table` + `onChange(nieuweTabel)` mee.
 */
import { useState } from "react";
import { FIELDREF_MIME } from "../modelpicker";
import {
  bindInput,
  bindOutput,
  maakOutputAdhoc,
  voegInputToe,
  voegOutputToe,
  voegRegelToe,
  verwijderRegel,
  zetCel,
  valideerTabel,
  adhocNaarAfgeleidVeldVoorstel,
} from "./dmnModel";
import "./dmntable.css";

function leesFieldRefUitDrop(e) {
  const raw = e.dataTransfer.getData(FIELDREF_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function KolomMeta({ clause }) {
  const ref = clause.fieldRef;
  return (
    <span className="dmn-th-meta">
      {clause.datatype && <span className="dmn-chip dmn-chip-dt">{clause.datatype}</span>}
      {!clause.datatype && clause.type && <span className="dmn-chip">{clause.type}</span>}
      {Array.isArray(clause.enum) && clause.enum.length > 0 && (
        <span className="dmn-chip dmn-chip-enum" title={clause.enum.join(", ")}>
          enum {clause.enum.length}
        </span>
      )}
      {ref?.tDimensie && <span className="dmn-chip dmn-chip-dim">{ref.tDimensie === "materieel" ? "t_m" : "t_f"}</span>}
    </span>
  );
}

export default function DmnTableEditor({ table, onChange, onRequestBind, onPromoveerAdhoc, doelTypenaam }) {
  const [dropClause, setDropClause] = useState(null);

  const onHeaderDrop = (kant, clauseId) => (e) => {
    e.preventDefault();
    setDropClause(null);
    const ref = leesFieldRefUitDrop(e);
    if (!ref) return;
    onChange(kant === "input" ? bindInput(table, clauseId, ref) : bindOutput(table, clauseId, ref));
  };

  const meldingen = valideerTabel(table);

  const renderHeader = (clause, kant, index) => {
    const gebonden = Boolean(clause.fieldRef);
    return (
      <th
        key={clause.id}
        className={kant === "input" ? "dmn-th-input" : "dmn-th-output"}
        onDragOver={(e) => {
          e.preventDefault();
          setDropClause(clause.id);
        }}
        onDragLeave={() => setDropClause((c) => (c === clause.id ? null : c))}
        onDrop={onHeaderDrop(kant, clause.id)}
      >
        <div className={`dmn-th-inner${dropClause === clause.id ? " dmn-cell-drop" : ""}`}>
          {gebonden ? (
            <span className={`dmn-th-label dmn-th-veld${kant === "output" ? " dmn-out" : ""}`}>
              {clause.fieldRef.afgeleid ? "/ " : ""}
              {clause.fieldRef.veldpad}
            </span>
          ) : clause.adhoc ? (
            <span className="dmn-th-label dmn-th-adhoc">{clause.naam} (ad-hoc)</span>
          ) : (
            <span className="dmn-th-label dmn-th-unbound">— niet gebonden —</span>
          )}

          {(gebonden || clause.adhoc) && <KolomMeta clause={clause} />}

          <span className="dmn-th-actions">
            <button type="button" className="dmn-link" onClick={() => onRequestBind?.(clause.id, kant)}>
              bind…
            </button>
            {kant === "output" && (
              <button
                type="button"
                className="dmn-link"
                onClick={() => onChange(maakOutputAdhoc(table, clause.id, clause.naam || `resultaat_${index + 1}`))}
              >
                ad-hoc
              </button>
            )}
            {kant === "output" && clause.adhoc && (
              <button
                type="button"
                className="dmn-link"
                title="Promoveer dit tussenresultaat tot afgeleid veld in het canoniek model"
                onClick={() => onPromoveerAdhoc?.(adhocNaarAfgeleidVeldVoorstel(table, clause.id, doelTypenaam))}
              >
                → afgeleid veld
              </button>
            )}
          </span>
        </div>
      </th>
    );
  };

  const renderCel = (rule, clause, kant) => {
    const entries = kant === "input" ? rule.inputEntries : rule.outputEntries;
    const waarde = entries[clause.id] ?? "";
    const heeftEnum = Array.isArray(clause.enum) && clause.enum.length > 0;
    return (
      <td key={clause.id}>
        {heeftEnum ? (
          <select
            className="dmn-cell-input"
            value={waarde}
            onChange={(e) => onChange(zetCel(table, rule.id, clause.id, kant, e.target.value))}
          >
            <option value="">{kant === "input" ? "— (elke) —" : "—"}</option>
            {clause.enum.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="dmn-cell-input"
            type="text"
            value={waarde}
            placeholder={kant === "input" ? (clause.type === "integer" ? "bv. > 18" : "—") : "waarde"}
            onChange={(e) => onChange(zetCel(table, rule.id, clause.id, kant, e.target.value))}
          />
        )}
      </td>
    );
  };

  return (
    <div className="dmn-root">
      <div className="dmn-toolbar">
        <input
          className="dmn-naam"
          value={table.naam}
          onChange={(e) => onChange({ ...table, naam: e.target.value })}
        />
        <select
          className="dmn-hit"
          value={table.hitPolicy}
          onChange={(e) => onChange({ ...table, hitPolicy: e.target.value })}
          title="Hit policy"
        >
          {["UNIQUE", "FIRST", "PRIORITY", "ANY", "COLLECT"].map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span style={{ flex: 1 }} />
        <button type="button" className="dmn-btn" onClick={() => onChange(voegInputToe(table))}>
          + input
        </button>
        <button type="button" className="dmn-btn" onClick={() => onChange(voegOutputToe(table))}>
          + output
        </button>
        <button type="button" className="dmn-btn dmn-btn-primary" onClick={() => onChange(voegRegelToe(table))}>
          + regel
        </button>
      </div>

      <div className="dmn-hint">
        Sleep een veld vanuit het canoniek model op een kolomkop, of klik <b>bind…</b>.
      </div>

      <div className="dmn-table-wrap">
        <table className="dmn-table">
          <thead>
            <tr>
              <th className="dmn-corner" rowSpan={2}>
                #
              </th>
              <th className="dmn-th-input" colSpan={table.inputs.length}>
                Inputs (when)
              </th>
              <th className="dmn-th-output" colSpan={table.outputs.length}>
                Outputs (then)
              </th>
              <th className="dmn-corner" rowSpan={2} />
            </tr>
            <tr>
              {table.inputs.map((c, i) => renderHeader(c, "input", i))}
              {table.outputs.map((c, i) => renderHeader(c, "output", i))}
            </tr>
          </thead>
          <tbody>
            {table.rules.map((rule, idx) => (
              <tr key={rule.id}>
                <td className="dmn-rownum">{idx + 1}</td>
                {table.inputs.map((c) => renderCel(rule, c, "input"))}
                {table.outputs.map((c) => renderCel(rule, c, "output"))}
                <td className="dmn-rownum">
                  <button
                    type="button"
                    className="dmn-link dmn-link-danger"
                    title="Regel verwijderen"
                    onClick={() => onChange(verwijderRegel(table, rule.id))}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meldingen.length > 0 && (
        <div className="dmn-meldingen">
          {meldingen.map((m, i) => (
            <div key={i} className={`dmn-melding ${m.niveau === "fout" ? "dmn-melding-fout" : "dmn-melding-info"}`}>
              {m.tekst}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
