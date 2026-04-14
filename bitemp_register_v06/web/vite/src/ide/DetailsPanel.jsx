/**
 * DetailsPanel — Bewerkbaar properties-panel voor het geselecteerde element of edge.
 *
 * Leest selectedElementId / selectedEdgeId uit de UI store en toont
 * een formulier waarmee de eigenschappen direct bewerkt kunnen worden.
 * Wijzigingen worden bij blur/change naar de model store geschreven.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import useModelStore, { DEFAULT_DIAGRAM_ID } from "../store/useModelStore";
import useUIStore from "../store/useUIStore";
import { VELDTYPEN, AFLEIDINGSTALEN, bouwVeldtypen } from "@editor/metamodel/types";

// ─── Constanten ──────────────────────────────────────

const TYPE_LABELS = {
  entiteit: "Entiteit",
  gegevenselement: "Gegevenselement",
  relatie: "Relatie",
  enumeratie: "Enumeratie",
  gegevenstype: "Gegevenstype",
  referentielijstInstantie: "Referentielijst-instantie",
};

const MOMENTVOORKOMEN_OPTIES = ["enkelvoudig", "meervoudig"];
const KARDINALITEIT_OPTIES = ["0..1", "0..*", "1..1", "1..*"];
const BASISTYPEN = ["string", "integer", "number", "boolean"];
const ENTITEIT_SUBTYPES = ["", "kernentiteit", "subentiteit", "referentielijst", "referentielijst_item"];
const RELATIE_SUBTYPES = ["", "samenstelling", "associatie", "generalisatie", "referentielijst_items"];
const VALIDATIE_REGEL_TYPES = ["checksum", "formula", "function"];

// ─── Styling ──────────────────────────────────────────

const S = {
  panel: { padding: 12, fontSize: 13, overflowY: "auto", height: "100%", color: "var(--ide-panel-color, #ccc)" },
  heading: { margin: "0 0 10px", fontSize: 14, display: "flex", alignItems: "center", gap: 6 },
  section: { marginTop: 14, marginBottom: 6 },
  sectionTitle: { fontWeight: 600, fontSize: 13, marginBottom: 4, color: "var(--ide-panel-color-heading, #ddd)" },
  fieldRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 5 },
  label: { color: "var(--ide-panel-color-muted, #999)", minWidth: 90, flexShrink: 0, fontSize: 12 },
  input: {
    background: "var(--ide-input-bg, #1e1e1e)", color: "var(--ide-input-color, #ccc)", border: "1px solid var(--ide-input-border, #3a3a3a)",
    borderRadius: 3, padding: "3px 6px", fontSize: 12, width: "100%", outline: "none",
    boxSizing: "border-box",
  },
  select: {
    background: "var(--ide-input-bg, #1e1e1e)", color: "var(--ide-input-color, #ccc)", border: "1px solid var(--ide-input-border, #3a3a3a)",
    borderRadius: 3, padding: "3px 4px", fontSize: 12, outline: "none",
  },
  checkbox: { accentColor: "#4fc3f7" },
  textarea: {
    background: "var(--ide-input-bg, #1e1e1e)", color: "var(--ide-input-color, #ccc)", border: "1px solid var(--ide-input-border, #3a3a3a)",
    borderRadius: 3, padding: "4px 6px", fontSize: 12, width: "100%", outline: "none",
    resize: "vertical", minHeight: 40, fontFamily: "inherit", boxSizing: "border-box",
  },
  readOnly: { color: "var(--ide-panel-color-muted, #777)", fontSize: 12, wordBreak: "break-all" },
  btn: {
    background: "var(--ide-btn-bg, #333)", color: "var(--ide-btn-color, #ccc)", border: "1px solid var(--ide-btn-border, #555)",
    borderRadius: 3, padding: "2px 8px", fontSize: 11, cursor: "pointer",
  },
  btnDanger: {
    background: "#4a2020", color: "#f88", border: "1px solid #733",
    borderRadius: 3, padding: "1px 6px", fontSize: 11, cursor: "pointer",
  },
  table: { width: "100%", borderCollapse: "collapse", marginTop: 4, fontSize: 12 },
  th: { padding: "3px 4px", borderBottom: "1px solid var(--ide-table-border, #555)", textAlign: "left", fontSize: 11, color: "var(--ide-panel-color-muted, #999)" },
  td: { padding: "2px 3px", borderBottom: "1px solid var(--ide-table-cell-border, #2a2a2a)" },
  placeholder: { padding: 16, color: "var(--ide-panel-color-muted, #888)", fontSize: 13 },
};

// ─── EditField — universeel bewerkbaar veld ───────────

function EditField({ label, value, onChange, type = "text", options, readOnly, placeholder }) {
  const [local, setLocal] = useState(value ?? "");
  useEffect(() => { setLocal(value ?? ""); }, [value]);

  if (readOnly) {
    return (
      <div style={S.fieldRow}>
        <span style={S.label}>{label}:</span>
        <span style={S.readOnly}>{String(value ?? "—")}</span>
      </div>
    );
  }

  if (type === "checkbox") {
    return (
      <div style={S.fieldRow}>
        <span style={S.label}>{label}:</span>
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} style={S.checkbox} />
      </div>
    );
  }

  if (type === "select") {
    return (
      <div style={S.fieldRow}>
        <span style={S.label}>{label}:</span>
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} style={S.select}>
          {(options || []).map((o) => (
            <option key={o} value={o}>{o || "(geen)"}</option>
          ))}
        </select>
      </div>
    );
  }

  if (type === "color") {
    return (
      <div style={S.fieldRow}>
        <span style={S.label}>{label}:</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
          <input
            type="color"
            value={value || "#bfdbfe"}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: 28, height: 22, padding: 0, border: "1px solid #555", borderRadius: 3, cursor: "pointer", background: "transparent" }}
          />
          <input
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => { if (local !== (value ?? "")) onChange(local); }}
            onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
            style={{ ...S.input, flex: 1 }}
            placeholder="#hexkleur"
          />
        </div>
      </div>
    );
  }

  if (type === "textarea") {
    return (
      <div style={{ ...S.fieldRow, alignItems: "flex-start" }}>
        <span style={{ ...S.label, marginTop: 4 }}>{label}:</span>
        <textarea
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => { if (local !== (value ?? "")) onChange(local); }}
          style={S.textarea}
          placeholder={placeholder}
          rows={2}
        />
      </div>
    );
  }

  return (
    <div style={S.fieldRow}>
      <span style={S.label}>{label}:</span>
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { if (local !== (value ?? "")) onChange(local); }}
        onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
        style={S.input}
        placeholder={placeholder}
      />
    </div>
  );
}

// ─── VeldenEditor — bewerkbare veldentabel met model-types ────

function VeldenEditor({ velden = [], onChange, beschikbareVeldtypen }) {
  const updateVeld = (index, key, val) => {
    const nieuw = velden.map((v, i) => (i === index ? { ...v, [key]: val } : v));
    onChange(nieuw);
  };
  /** Multi-key update voor type-wissels (bijv. enum → string + format + enumNaam tegelijk) */
  const updateVeldMulti = (index, patch) => {
    const nieuw = velden.map((v, i) => (i === index ? { ...v, ...patch } : v));
    onChange(nieuw);
  };
  const addVeld = () => {
    onChange([...velden, { naam: "nieuw_veld", type: "string", format: "", verplicht: false, description: "",
      enumNaam: null, datatypeNaam: null, refItemNaam: null, afgeleid: false, afleidingsregelTaal: "cel", afleidingsregel: "" }]);
  };
  const removeVeld = (index) => {
    onChange(velden.filter((_, i) => i !== index));
  };
  const moveVeld = (index, dir) => {
    const arr = [...velden];
    const target = index + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    onChange(arr);
  };

  return (
    <div style={S.section}>
      <div style={{ ...S.sectionTitle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Velden ({velden.length})</span>
        <button style={S.btn} onClick={addVeld}>+ Veld</button>
      </div>
      {velden.length === 0 ? (
        <div style={{ color: "#666", fontSize: 12, padding: "4px 0" }}>Geen velden. Klik "+ Veld" om er een toe te voegen.</div>
      ) : (
        velden.map((v, i) => (
          <VeldEditBlock
            key={i}
            veld={v}
            index={i}
            total={velden.length}
            beschikbareVeldtypen={beschikbareVeldtypen}
            onUpdate={updateVeld}
            onUpdateMulti={updateVeldMulti}
            onRemove={removeVeld}
            onMove={moveVeld}
          />
        ))
      )}
    </div>
  );
}

/** Bepaal de select-waarde op basis van veld-properties */
function veldTypeSelectValue(veld) {
  if (veld.enumNaam) return `enum:${veld.enumNaam}`;
  if (veld.refItemNaam) return `refitem:${veld.refItemNaam}`;
  if (veld.datatypeNaam) return `datatype:${veld.datatypeNaam}`;
  return `${veld.type || "string"}|${veld.format || ""}`;
}

function VeldEditBlock({ veld, index, total, beschikbareVeldtypen, onUpdate, onUpdateMulti, onRemove, onMove }) {
  const [naam, setNaam] = useState(veld.naam ?? "");
  const [desc, setDesc] = useState(veld.description ?? "");
  useEffect(() => { setNaam(veld.naam ?? ""); }, [veld.naam]);
  useEffect(() => { setDesc(veld.description ?? ""); }, [veld.description]);

  const handleTypeChange = (val) => {
    if (val.startsWith("enum:")) {
      const enumNaam = val.slice(5);
      const entry = beschikbareVeldtypen.find((vt) => vt.isEnum && vt.enumNaam === enumNaam);
      onUpdateMulti(index, { type: "string", format: "", enumNaam, datatypeNaam: null, refItemNaam: null, enum: entry?.enumWaarden || [] });
    } else if (val.startsWith("datatype:")) {
      const datatypeNaam = val.slice(9);
      const entry = beschikbareVeldtypen.find((vt) => vt.isCustom && vt.datatypeNaam === datatypeNaam);
      onUpdateMulti(index, { type: entry?.type || "string", format: entry?.format || "", datatypeNaam, enumNaam: null, refItemNaam: null, enum: null });
    } else if (val.startsWith("refitem:")) {
      const refItemNaam = val.slice(8);
      onUpdateMulti(index, { type: "integer", format: "", refItemNaam, enumNaam: null, datatypeNaam: null, enum: null });
    } else {
      const [type, format] = val.split("|");
      onUpdateMulti(index, { type: type || "string", format: format || "", enumNaam: null, datatypeNaam: null, refItemNaam: null, enum: null });
    }
  };

  const isDerived = veld.afgeleid;

  return (
    <div style={{
      padding: "6px 8px", marginBottom: 4, background: isDerived ? "var(--ide-veld-derived-bg, #2a2520)" : "var(--ide-veld-bg, #1e2024)",
      borderLeft: isDerived ? "3px solid #f59e0b" : "3px solid var(--ide-veld-border, #3a3a3a)",
      borderRadius: 3, fontSize: 12,
    }}>
      {/* Rij 1: naam + type + acties */}
      <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 3 }}>
        <input
          value={naam}
          onChange={(e) => setNaam(e.target.value)}
          onBlur={() => { if (naam !== veld.naam) onUpdate(index, "naam", naam); }}
          onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
          style={{ ...S.input, flex: 1 }}
          placeholder="veldnaam"
        />
        <select
          value={veldTypeSelectValue(veld)}
          onChange={(e) => handleTypeChange(e.target.value)}
          style={{ ...S.select, minWidth: 100 }}
        >
          {beschikbareVeldtypen.map((vt) => {
            const optVal = vt.isEnum ? `enum:${vt.enumNaam}`
              : vt.isRefItem ? `refitem:${vt.refItemNaam}`
              : vt.isCustom ? `datatype:${vt.datatypeNaam}`
              : `${vt.type}|${vt.format}`;
            return (
              <option key={optVal} value={optVal}>
                {vt.label}{vt.isCustom ? " ✦" : ""}{vt.isEnum ? " ◇" : ""}{vt.isRefItem ? " ▣" : ""}
              </option>
            );
          })}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 2, whiteSpace: "nowrap", color: "#999", fontSize: 11 }}>
          <input type="checkbox" checked={!!veld.verplicht} onChange={(e) => onUpdate(index, "verplicht", e.target.checked)} style={S.checkbox} />
          Verpl.
        </label>
        <span onClick={() => onMove(index, -1)} style={{ cursor: "pointer", opacity: index === 0 ? 0.3 : 1 }} title="Omhoog">▲</span>
        <span onClick={() => onMove(index, 1)} style={{ cursor: "pointer", opacity: index === total - 1 ? 0.3 : 1 }} title="Omlaag">▼</span>
        <button style={S.btnDanger} onClick={() => onRemove(index)} title="Verwijder veld">×</button>
      </div>
      {/* Rij 2: omschrijving (OAS 3.1 description) */}
      <input
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        onBlur={() => { if (desc !== (veld.description ?? "")) onUpdate(index, "description", desc); }}
        onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
        style={{ ...S.input, fontSize: 11, marginBottom: 3, color: "#aaa" }}
        placeholder="Omschrijving (OAS 3.1 description)…"
      />
      {/* Rij 3: afgeleid toggle + afleidingsregel */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 2, color: "#999", fontSize: 11, whiteSpace: "nowrap" }}>
          <input type="checkbox" checked={!!veld.afgeleid} onChange={(e) => onUpdate(index, "afgeleid", e.target.checked)} style={S.checkbox} />
          Afgeleid
        </label>
        {isDerived && (
          <>
            <select value={veld.afleidingsregelTaal || "cel"} onChange={(e) => onUpdate(index, "afleidingsregelTaal", e.target.value)} style={{ ...S.select, fontSize: 11 }}>
              {AFLEIDINGSTALEN.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </>
        )}
      </div>
      {isDerived && (
        <VeldAfleidingsregel veld={veld} index={index} onUpdate={onUpdate} />
      )}
    </div>
  );
}

function VeldAfleidingsregel({ veld, index, onUpdate }) {
  const [local, setLocal] = useState(veld.afleidingsregel ?? "");
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { setLocal(veld.afleidingsregel ?? ""); }, [veld.afleidingsregel]);
  return (
    <div style={{ position: "relative", marginTop: 3 }}>
      <textarea
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { if (local !== (veld.afleidingsregel ?? "")) onUpdate(index, "afleidingsregel", local); }}
        style={{ ...S.textarea, fontSize: 11, minHeight: expanded ? 120 : 28, fontFamily: "monospace" }}
        placeholder="Afleidingsregel…"
        rows={expanded ? 6 : 1}
      />
      <button
        onClick={() => setExpanded(!expanded)}
        style={{ position: "absolute", top: 2, right: 4, background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 10 }}
        title={expanded ? "Inklappen" : "Uitklappen"}
      >{expanded ? "▲" : "▼"}</button>
    </div>
  );
}

// ─── WaardenEditor — bewerkbare enum-waardenlijst ─────

function WaardenEditor({ waarden = [], onChange }) {
  const [draft, setDraft] = useState("");

  const addWaarde = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChange([...waarden, trimmed]);
    setDraft("");
  };
  const removeWaarde = (index) => {
    onChange(waarden.filter((_, i) => i !== index));
  };
  const updateWaarde = (index, val) => {
    onChange(waarden.map((w, i) => (i === index ? val : w)));
  };
  const moveWaarde = (index, dir) => {
    const arr = [...waarden];
    const target = index + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    onChange(arr);
  };

  return (
    <div style={S.section}>
      <div style={S.sectionTitle}>Waarden ({waarden.length})</div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {waarden.map((w, i) => (
          <WaardeItem
            key={i}
            waarde={w}
            index={i}
            isLast={i === waarden.length - 1}
            onUpdate={updateWaarde}
            onRemove={removeWaarde}
            onMove={moveWaarde}
          />
        ))}
      </ul>
      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addWaarde(); }}
          style={{ ...S.input, flex: 1 }}
          placeholder="Nieuwe waarde…"
        />
        <button style={S.btn} onClick={addWaarde}>+</button>
      </div>
    </div>
  );
}

function WaardeItem({ waarde, index, isLast, onUpdate, onRemove, onMove }) {
  const [local, setLocal] = useState(waarde);
  useEffect(() => { setLocal(waarde); }, [waarde]);

  return (
    <li style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { if (local !== waarde) onUpdate(index, local); }}
        onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
        style={{ ...S.input, flex: 1 }}
      />
      <span onClick={() => onMove(index, -1)} style={{ cursor: "pointer", opacity: index === 0 ? 0.3 : 1, fontSize: 11 }} title="Omhoog">▲</span>
      <span onClick={() => onMove(index, 1)} style={{ cursor: "pointer", opacity: isLast ? 0.3 : 1, fontSize: 11 }} title="Omlaag">▼</span>
      <button style={S.btnDanger} onClick={() => onRemove(index)} title="Verwijder waarde">×</button>
    </li>
  );
}

// ─── AfgeleideVeldenEditor — bewerkbaar ───────────────

function AfgeleideVeldenEditor({ afgeleideVelden = [], onChange }) {
  const updateAV = (index, key, val) => {
    const nieuw = afgeleideVelden.map((av, i) => (i === index ? { ...av, [key]: val } : av));
    onChange(nieuw);
  };
  const addAV = () => {
    onChange([...afgeleideVelden, {
      naam: "nieuw_afgeleid", description: "", goType: "string",
      afleidingsregelTaal: "cel", afleidingsregel: "", isWeergaveVeld: false,
    }]);
  };
  const removeAV = (index) => {
    onChange(afgeleideVelden.filter((_, i) => i !== index));
  };

  return (
    <div style={S.section}>
      <div style={{ ...S.sectionTitle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Afgeleide velden ({afgeleideVelden.length})</span>
        <button style={S.btn} onClick={addAV}>+ Afgeleid veld</button>
      </div>
      {afgeleideVelden.map((av, i) => (
        <AfgeleidVeldBlock key={i} av={av} index={i} onUpdate={updateAV} onRemove={removeAV} />
      ))}
    </div>
  );
}

function AfgeleidVeldBlock({ av, index, onUpdate, onRemove }) {
  const [naam, setNaam] = useState(av.naam ?? "");
  const [desc, setDesc] = useState(av.description ?? "");
  const [regel, setRegel] = useState(av.afleidingsregel ?? "");
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { setNaam(av.naam ?? ""); }, [av.naam]);
  useEffect(() => { setDesc(av.description ?? ""); }, [av.description]);
  useEffect(() => { setRegel(av.afleidingsregel ?? ""); }, [av.afleidingsregel]);

  return (
    <div style={{
      padding: "6px 8px", marginBottom: 4, background: "var(--ide-veld-derived-bg, #2a2520)",
      borderLeft: "3px solid #f59e0b", borderRadius: 3, fontSize: 12,
    }}>
      <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 3 }}>
        <input
          value={naam}
          onChange={(e) => setNaam(e.target.value)}
          onBlur={() => { if (naam !== av.naam) onUpdate(index, "naam", naam); }}
          onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
          style={{ ...S.input, flex: 1 }}
          placeholder="naam"
        />
        <input
          value={av.goType ?? "string"}
          onChange={(e) => onUpdate(index, "goType", e.target.value)}
          style={{ ...S.input, width: 70 }}
          placeholder="goType"
        />
        <button style={S.btnDanger} onClick={() => onRemove(index)} title="Verwijder afgeleid veld">×</button>
      </div>
      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        onBlur={() => { if (desc !== (av.description ?? "")) onUpdate(index, "description", desc); }}
        style={{ ...S.textarea, fontSize: 11, minHeight: 24, marginBottom: 3 }}
        placeholder="Beschrijving"
        rows={1}
      />
      <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 3 }}>
        <select value={av.afleidingsregelTaal || "cel"} onChange={(e) => onUpdate(index, "afleidingsregelTaal", e.target.value)} style={{ ...S.select, fontSize: 11 }}>
          {AFLEIDINGSTALEN.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div style={{ position: "relative" }}>
        <textarea
          value={regel}
          onChange={(e) => setRegel(e.target.value)}
          onBlur={() => { if (regel !== (av.afleidingsregel ?? "")) onUpdate(index, "afleidingsregel", regel); }}
          style={{ ...S.textarea, fontSize: 11, minHeight: expanded ? 120 : 36, fontFamily: "monospace" }}
          placeholder="Afleidingsregel"
          rows={expanded ? 6 : 2}
        />
        <button
          onClick={() => setExpanded(!expanded)}
          style={{ position: "absolute", top: 2, right: 4, background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 10 }}
          title={expanded ? "Inklappen" : "Uitklappen"}
        >{expanded ? "▲" : "▼"}</button>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2, color: "#999", fontSize: 11 }}>
        <input
          type="checkbox"
          checked={!!av.isWeergaveVeld}
          onChange={(e) => onUpdate(index, "isWeergaveVeld", e.target.checked)}
          style={S.checkbox}
        />
        Weergaveveld (toon op kaarten)
      </label>
    </div>
  );
}

// ─── ValidatieRegelsEditor ─────────────────────────────

function ValidatieRegelsEditor({ regels = [], onChange }) {
  const updateRegel = (index, key, val) => {
    onChange(regels.map((r, i) => (i === index ? { ...r, [key]: val } : r)));
  };
  const addRegel = () => {
    onChange([...regels, { naam: "", type: "checksum", expressie: "" }]);
  };
  const removeRegel = (index) => {
    onChange(regels.filter((_, i) => i !== index));
  };

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ ...S.sectionTitle, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
        <span>Validatieregels ({regels.length})</span>
        <button style={S.btn} onClick={addRegel}>+ Regel</button>
      </div>
      {regels.map((r, i) => (
        <ValidatieRegelRow key={i} regel={r} index={i} onUpdate={updateRegel} onRemove={removeRegel} />
      ))}
    </div>
  );
}

function ValidatieRegelRow({ regel, index, onUpdate, onRemove }) {
  const [naam, setNaam] = useState(regel.naam ?? "");
  const [expr, setExpr] = useState(regel.expressie ?? "");
  useEffect(() => { setNaam(regel.naam ?? ""); }, [regel.naam]);
  useEffect(() => { setExpr(regel.expressie ?? ""); }, [regel.expressie]);

  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 3 }}>
      <input value={naam} onChange={(e) => setNaam(e.target.value)}
        onBlur={() => { if (naam !== regel.naam) onUpdate(index, "naam", naam); }}
        style={{ ...S.input, width: 80 }} placeholder="Naam" />
      <select value={regel.type ?? "checksum"} onChange={(e) => onUpdate(index, "type", e.target.value)} style={S.select}>
        {VALIDATIE_REGEL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <input value={expr} onChange={(e) => setExpr(e.target.value)}
        onBlur={() => { if (expr !== regel.expressie) onUpdate(index, "expressie", expr); }}
        style={{ ...S.input, flex: 1 }} placeholder="Expressie" />
      <button style={S.btnDanger} onClick={() => onRemove(index)}>×</button>
    </div>
  );
}

// ─── GegevenstypeEditor — validatie, normalisatie, weergave ──

function GegevenstypeEditor({ data, setData }) {
  const validatie = data.validatie || {};
  const weergave = data.weergave || {};
  const isString = (data.basistype || "string") === "string";
  const isNumeric = data.basistype === "integer" || data.basistype === "number";

  const setVal = useCallback((key, val) => {
    setData("validatie", { ...validatie, [key]: val });
  }, [validatie, setData]);

  const setWeer = useCallback((key, val) => {
    setData("weergave", { ...weergave, [key]: val });
  }, [weergave, setData]);

  return (
    <>
      {/* ─ Validatie ─ */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Validatie</div>
        <EditField label="Pattern" value={validatie.pattern} onChange={(v) => setVal("pattern", v)} placeholder="^regex$" />
        {isString && (
          <div style={{ display: "flex", gap: 8 }}>
            <EditField label="Min. lengte" value={validatie.minLength} onChange={(v) => setVal("minLength", v === "" ? null : Number(v))} placeholder="" />
            <EditField label="Max. lengte" value={validatie.maxLength} onChange={(v) => setVal("maxLength", v === "" ? null : Number(v))} placeholder="" />
          </div>
        )}
        {isNumeric && (
          <>
            <div style={{ display: "flex", gap: 8 }}>
              <EditField label="Minimum" value={validatie.minimum} onChange={(v) => setVal("minimum", v === "" ? null : Number(v))} />
              <EditField label="Maximum" value={validatie.maximum} onChange={(v) => setVal("maximum", v === "" ? null : Number(v))} />
            </div>
            <EditField label="Veelvoud van" value={validatie.multipleOf} onChange={(v) => setVal("multipleOf", v === "" ? null : Number(v))} />
          </>
        )}
        <EditField label="Foutmelding" value={validatie.foutmelding} onChange={(v) => setVal("foutmelding", v)} placeholder="Voer een geldige waarde in" />
        <EditField label="Voorbeelden" value={(validatie.voorbeelden || []).join(", ")}
          onChange={(v) => setVal("voorbeelden", v ? v.split(",").map((s) => s.trim()) : [])}
          placeholder="waarde1, waarde2" />
        <ValidatieRegelsEditor regels={validatie.regels || []} onChange={(r) => setVal("regels", r)} />
      </div>

      {/* ─ Normalisatie ─ */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Normalisatie</div>
        <EditField label="Normalisatie" value={data.normalisatie} onChange={(v) => setData("normalisatie", v)} placeholder="trim,uppercase_letters" />
      </div>

      {/* ─ Weergave ─ */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Weergave</div>
        <EditField label="Placeholder" value={weergave.placeholder} onChange={(v) => setWeer("placeholder", v)} />
        <EditField label="Invoermasker" value={weergave.inputMask} onChange={(v) => setWeer("inputMask", v)} placeholder="0000 AA" />
        <div style={{ display: "flex", gap: 8 }}>
          <EditField label="Prefix" value={weergave.prefix} onChange={(v) => setWeer("prefix", v)} placeholder="€" />
          <EditField label="Suffix" value={weergave.suffix} onChange={(v) => setWeer("suffix", v)} placeholder="%" />
        </div>
      </div>
    </>
  );
}

// ─── DomainEditor ─────────────────────────────────────

const EMPTY_DOMAIN_META = {};

function DomainEditor({ domeinNaam }) {
  const meta = useModelStore((s) => s.domainMeta[domeinNaam] ?? EMPTY_DOMAIN_META);
  const updateDomainMeta = useModelStore((s) => s.updateDomainMeta);
  const elements = useModelStore((s) => s.elements);

  const setMeta = useCallback(
    (key, value) => updateDomainMeta(domeinNaam, { [key]: value }),
    [domeinNaam, updateDomainMeta]
  );

  // Tel elementen in dit domein
  const count = useMemo(() =>
    Object.values(elements).filter((el) => el.domein === domeinNaam).length,
    [elements, domeinNaam]
  );

  return (
    <div style={S.panel}>
      <h3 style={S.heading}>📁 Domein: {domeinNaam}</h3>
      <EditField label="Naam" value={domeinNaam} readOnly />
      <EditField label="Elementen" value={`${count}`} readOnly />
      <EditField label="Versie" value={meta.versie} onChange={(v) => setMeta("versie", v)} placeholder="bijv. 1.0" />
      <EditField label="Beschrijving" value={meta.beschrijving} onChange={(v) => setMeta("beschrijving", v)} type="textarea" />
      <EditField label="Kleur" value={meta.kleur} onChange={(v) => setMeta("kleur", v)} type="color" />
      <EditField label="Prefix" value={meta.prefix} onChange={(v) => setMeta("prefix", v)} placeholder="bijv. a, b" />
    </div>
  );
}

// ─── SupertypeField — Supertype dropdown afgeleid van generalisatie-edge ───

function SupertypeField({ elementId, elements, diagrams, updateDiagramEdges }) {
  const overzichtId = DEFAULT_DIAGRAM_ID;
  const overzichtEdges = diagrams?.[overzichtId]?.edges || [];

  // Zoek bestaande generalisatie-edge waar deze entiteit source is
  const genEdge = overzichtEdges.find(
    (e) => e.source === elementId && e.data?.isGeneralization
  );
  const currentSupertypeId = genEdge?.target || "";

  // Mogelijke supertypes: alle entiteiten behalve zichzelf
  const mogelijkeSupertypes = useMemo(() =>
    Object.values(elements)
      .filter((el) => el.type === "entiteit" && el.id !== elementId)
      .sort((a, b) => (a.naam || "").localeCompare(b.naam || "")),
    [elements, elementId]
  );

  const handleChange = useCallback((e) => {
    const newTarget = e.target.value || null;
    let nextEdges;
    if (!newTarget) {
      // Verwijder generalisatie-edge
      nextEdges = overzichtEdges.filter(
        (edge) => !(edge.source === elementId && edge.data?.isGeneralization)
      );
    } else if (genEdge) {
      // Update bestaande edge
      nextEdges = overzichtEdges.map((edge) =>
        edge.id === genEdge.id ? { ...edge, target: newTarget } : edge
      );
    } else {
      // Voeg nieuwe generalisatie-edge toe
      nextEdges = [...overzichtEdges, {
        id: `gen-${elementId}-${newTarget}`,
        source: elementId,
        target: newTarget,
        type: "metamodel",
        data: { isGeneralization: true },
      }];
    }
    updateDiagramEdges(overzichtId, nextEdges);
  }, [elementId, overzichtEdges, genEdge, overzichtId, updateDiagramEdges]);

  return (
    <div style={S.fieldRow}>
      <span style={S.label}>Supertype:</span>
      <select style={S.select} value={currentSupertypeId} onChange={handleChange}>
        <option value="">(geen)</option>
        {mogelijkeSupertypes.map((ent) => (
          <option key={ent.id} value={ent.id}>{ent.data?.typenaam || ent.naam}</option>
        ))}
      </select>
    </div>
  );
}

// ─── ElementEditor ────────────────────────────────────

function ElementEditor({ element, updateElement }) {
  const { id, naam, type, domein, data = {} } = element;
  const elements = useModelStore((s) => s.elements);
  const structuralEdges = useModelStore((s) => s.structuralEdges);
  const diagrams = useModelStore((s) => s.diagrams);
  const updateDiagramEdges = useModelStore((s) => s.updateDiagramEdges);

  const setField = useCallback(
    (key, value) => updateElement(id, { [key]: value }),
    [id, updateElement]
  );

  const setData = useCallback(
    (key, value) => updateElement(id, { data: { [key]: value } }),
    [id, updateElement]
  );

  /**
   * Naam wijzigen synchroniseert klassenaam + typenaam.
   * - Entiteiten: typenaam = naam (identiek).
   * - GE/relatie: typenaam = parent_naam (afgeleid uit huidig suffix).
   *   Als typenaam leeg was, afleiden uit parent-entiteit + nieuwe naam.
   */
  const handleNaamChange = useCallback(
    (v) => {
      const patch = { naam: v, data: { klassenaam: v } };
      if (type === "entiteit") {
        patch.data.typenaam = v;
      } else if (data.typenaam && naam && data.typenaam.endsWith(naam)) {
        patch.data.typenaam = data.typenaam.slice(0, -naam.length) + v;
      } else if (!data.typenaam && v) {
        // Typenaam was leeg: afleiden uit parent-entiteit + klassenaam
        const parentEdge = structuralEdges.find((e) => e.target === id);
        const parentEnt = parentEdge && elements[parentEdge.source];
        if (parentEnt?.data?.typenaam) {
          patch.data.typenaam = `${parentEnt.data.typenaam}_${v}`;
        }
      }
      updateElement(id, patch);
    },
    [id, naam, type, data.typenaam, elements, structuralEdges, updateElement]
  );

  /**
   * Typenaam wijzigen: bij entiteiten sync ook naam + klassenaam.
   * Bij GE/relatie alleen typenaam (handmatige override).
   */
  const handleTypenaamChange = useCallback(
    (v) => {
      if (type === "entiteit") {
        updateElement(id, { naam: v, data: { typenaam: v, klassenaam: v } });
      } else {
        updateElement(id, { data: { typenaam: v } });
      }
    },
    [id, type, updateElement]
  );

  /** Bouw dynamische veldtype-lijst uit alle elementen in het model */
  const beschikbareVeldtypen = useMemo(() => {
    const datatypeNodes = [];
    const enumNodes = [];
    const refItemNodes = [];
    for (const el of Object.values(elements)) {
      if (el.type === "gegevenstype") datatypeNodes.push({ data: el.data });
      else if (el.type === "enumeratie") enumNodes.push({ data: el.data });
      else if (el.type === "entiteit" && el.data?.entiteitSubtype === "referentielijst_item") refItemNodes.push({ data: el.data });
    }
    return bouwVeldtypen(datatypeNodes, enumNodes, refItemNodes);
  }, [elements]);

  return (
    <div style={S.panel}>
      <h3 style={S.heading}>
        {TYPE_LABELS[type] || type}: {naam}
      </h3>

      {/* Basis-velden (alle types) */}
      <EditField label="ID" value={id} readOnly />
      <EditField label="Type" value={TYPE_LABELS[type] || type} readOnly />
      <EditField label="Naam" value={naam} onChange={handleNaamChange} />
      <EditField label="Typenaam" value={data.typenaam} onChange={handleTypenaamChange} placeholder="bijv. A_Aanvang" />
      <EditField label="Domein" value={domein} onChange={(v) => setField("domein", v)} />
      <EditField label="Beschrijving" value={data.description} onChange={(v) => setData("description", v)} type="textarea" />

      {/* Type-specifieke velden */}
      {(type === "entiteit" || type === "gegevenselement" || type === "relatie") && (
        <>
          <EditField label="Meervoud" value={data.meervoud} onChange={(v) => setData("meervoud", v)} placeholder="bijv. Personen" />
          <EditField label="Materieel" value={data.isMaterieel} onChange={(v) => setData("isMaterieel", v)} type="checkbox" />
          <EditField label="Kleur" value={data.kleur} onChange={(v) => setData("kleur", v)} type="color" />
        </>
      )}

      {type === "entiteit" && (
        <EditField
          label="Subtype"
          value={data.entiteitSubtype}
          onChange={(v) => setData("entiteitSubtype", v)}
          type="select"
          options={ENTITEIT_SUBTYPES}
        />
      )}

      {type === "entiteit" && <SupertypeField
        elementId={id}
        elements={elements}
        diagrams={diagrams}
        updateDiagramEdges={updateDiagramEdges}
      />}

      {type === "relatie" && (
        <>
          <EditField
            label="Rel.-subtype"
            value={data.relatieSubtype}
            onChange={(v) => setData("relatieSubtype", v)}
            type="select"
            options={RELATIE_SUBTYPES}
          />
          <EditField label="Doel-entiteit" value={data.doelEntiteit} onChange={(v) => setData("doelEntiteit", v)} />
        </>
      )}

      {/* Velden editor (GE, Relatie) — met dynamische model-types */}
      {(type === "gegevenselement" || type === "relatie") && (
        <VeldenEditor velden={data.velden} onChange={(v) => setData("velden", v)} beschikbareVeldtypen={beschikbareVeldtypen} />
      )}

      {/* Enum waarden editor */}
      {type === "enumeratie" && (
        <>
          <EditField
            label="Basistype"
            value={data.baseType}
            onChange={(v) => setData("baseType", v)}
            type="select"
            options={BASISTYPEN}
          />
          <WaardenEditor waarden={data.waarden} onChange={(v) => setData("waarden", v)} />
        </>
      )}

      {/* Gegevenstype: basistype, format + volledige validatie/normalisatie/weergave */}
      {type === "gegevenstype" && (
        <>
          <EditField
            label="Basistype"
            value={data.basistype}
            onChange={(v) => setData("basistype", v)}
            type="select"
            options={BASISTYPEN}
          />
          <EditField label="Format" value={data.format} onChange={(v) => setData("format", v)} placeholder="bijv. nl-postcode" />
          <GegevenstypeEditor data={data} setData={setData} />
        </>
      )}

      {/* Referentielijst-instantie */}
      {type === "referentielijstInstantie" && (
        <>
          <EditField label="Systeemnaam" value={data.systeemnaam} onChange={(v) => setData("systeemnaam", v)} />
          <EditField label="Omschrijving" value={data.omschrijving} onChange={(v) => setData("omschrijving", v)} type="textarea" />
        </>
      )}

      {/* Afgeleide velden (entiteiten, GE's, relaties) */}
      {(type === "entiteit" || type === "gegevenselement" || type === "relatie") && (
        <AfgeleideVeldenEditor afgeleideVelden={data.afgeleideVelden} onChange={(v) => setData("afgeleideVelden", v)} />
      )}
    </div>
  );
}

// ─── EdgeEditor ───────────────────────────────────────

function EdgeEditor({ edgeId }) {
  const diagrams = useModelStore((s) => s.diagrams);
  const updateStructuralEdge = useModelStore((s) => s.updateStructuralEdge);
  const updateDiagramEdge = useModelStore((s) => s.updateDiagramEdge);

  // Zoek de edge in de diagrammen
  let edgeData = null;
  let foundDiagramId = null;
  for (const [dId, diag] of Object.entries(diagrams)) {
    const found = (diag.edges || []).find((e) => e.id === edgeId);
    if (found) {
      edgeData = found;
      foundDiagramId = dId;
      break;
    }
  }

  const setEdgeData = useCallback(
    (key, value) => {
      const patch = { [key]: value };
      updateStructuralEdge(edgeId, patch);
      if (foundDiagramId) updateDiagramEdge(foundDiagramId, edgeId, patch);
    },
    [edgeId, foundDiagramId, updateStructuralEdge, updateDiagramEdge]
  );

  if (!edgeData) {
    return <div style={S.placeholder}>Edge niet gevonden.</div>;
  }

  const d = edgeData.data || {};

  return (
    <div style={S.panel}>
      <h3 style={S.heading}>🔗 Edge</h3>
      <EditField label="ID" value={edgeData.id} readOnly />
      <EditField label="Bron" value={edgeData.source} readOnly />
      <EditField label="Doel" value={edgeData.target} readOnly />
      <EditField label="Rolnaam" value={d.rolnaam} onChange={(v) => setEdgeData("rolnaam", v)} />
      <EditField label="JSON rolnaam" value={d.jsonRolnaam} onChange={(v) => setEdgeData("jsonRolnaam", v)} />
      <EditField
        label="Momentvoork."
        value={d.momentvoorkomen}
        onChange={(v) => setEdgeData("momentvoorkomen", v)}
        type="select"
        options={MOMENTVOORKOMEN_OPTIES}
      />
      <EditField
        label="Kardinaliteit"
        value={d.kardinaliteit}
        onChange={(v) => setEdgeData("kardinaliteit", v)}
        type="select"
        options={KARDINALITEIT_OPTIES}
      />
    </div>
  );
}

// ─── Main DetailsPanel ────────────────────────────────

export default function DetailsPanel() {
  const selectedElementId = useUIStore((s) => s.selectedElementId);
  const selectedEdgeId = useUIStore((s) => s.selectedEdgeId);
  const elements = useModelStore((s) => s.elements);
  const updateElement = useModelStore((s) => s.updateElement);

  if (!selectedElementId && !selectedEdgeId) {
    return (
      <div style={S.placeholder}>
        Selecteer een element of edge om de eigenschappen te bewerken.
      </div>
    );
  }

  if (selectedEdgeId) {
    return <EdgeEditor edgeId={selectedEdgeId} />;
  }

  // Domein-selectie: id begint met "domain_"
  if (selectedElementId?.startsWith("domain_")) {
    const domeinNaam = selectedElementId.slice(7);
    if (domeinNaam) return <DomainEditor domeinNaam={domeinNaam} />;
  }

  const element = elements[selectedElementId];
  if (!element) {
    return <div style={S.placeholder}>Element "{selectedElementId}" niet gevonden.</div>;
  }

  return <ElementEditor element={element} updateElement={updateElement} />;
}
