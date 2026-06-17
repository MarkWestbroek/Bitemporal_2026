/**
 * DmnPropertiesPanel — Bewerkbaar properties-panel voor DMN elementen.
 *
 * Toont en bewerkt de properties van het geselecteerde DMN element
 * (inputData, decision, knowledgeSource, etc.) in de inspector.
 */
import { useState, useEffect, useCallback } from "react";

// ─── Styling (studio thema variabelen) ─────────────────────────

const S = {
  panel: { padding: 12, fontSize: 13, overflowY: "auto", height: "100%", color: "var(--s-fg)" },
  heading: { margin: "0 0 10px", fontSize: 14, display: "flex", alignItems: "center", gap: 6 },
  section: { marginTop: 14, marginBottom: 6 },
  sectionTitle: { fontWeight: 600, fontSize: 13, marginBottom: 4, color: "var(--s-fg)" },
  fieldRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 5 },
  label: { color: "var(--s-fg-muted)", minWidth: 90, flexShrink: 0, fontSize: 12 },
  input: {
    background: "var(--s-bg)", color: "var(--s-fg)", border: "1px solid var(--s-border)",
    borderRadius: 3, padding: "3px 6px", fontSize: 12, width: "100%", outline: "none",
    boxSizing: "border-box",
  },
  readOnly: { color: "var(--s-fg-muted)", fontSize: 12, wordBreak: "break-all" },
  placeholder: { padding: 16, color: "var(--s-fg-muted)", fontSize: 13 },
};

// ─── EditField — universeel bewerkbaar veld ───────────

function EditField({ label, value, onChange, readOnly, placeholder }) {
  const [local, setLocal] = useState(value ?? "");
  
  useEffect(() => { 
    setLocal(value ?? ""); 
  }, [value]);

  const handleBlur = () => {
    if (local !== value && onChange) {
      onChange(local);
    }
  };

  if (readOnly) {
    return (
      <div style={S.fieldRow}>
        <span style={S.label}>{label}:</span>
        <span style={S.readOnly}>{String(value ?? "—")}</span>
      </div>
    );
  }

  return (
    <div style={S.fieldRow}>
      <span style={S.label}>{label}:</span>
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.target.blur();
        }}
        style={S.input}
        placeholder={placeholder}
      />
    </div>
  );
}

// ─── Main DmnPropertiesPanel ─────────────────────────

export default function DmnPropertiesPanel({ element, onUpdate }) {
  if (!element) {
    return (
      <div style={S.placeholder}>
        Klik op een element in het DRD om de properties te bekijken en bewerken.
      </div>
    );
  }

  // Haal de basis properties op
  const elementId = element.id || element.businessObject?.id;
  const elementType = element.$type || element.type;
  const elementName = element.name || element.businessObject?.name;

  // Variable properties (voor inputData en decisions)
  const variable = element.variable || element.businessObject?.variable;
  const variableId = variable?.id;
  const variableName = variable?.name;
  const variableTypeRef = variable?.typeRef;

  // Information requirements (voor decisions)
  const infoReqs = element.informationRequirement || element.businessObject?.informationRequirement;

  const handleNameChange = useCallback((newName) => {
    if (onUpdate) {
      onUpdate({ name: newName });
    }
  }, [onUpdate]);

  const handleVariableNameChange = useCallback((newName) => {
    if (onUpdate && variable) {
      onUpdate({ variable: { ...variable, name: newName } });
    }
  }, [onUpdate, variable]);

  const handleVariableTypeRefChange = useCallback((newTypeRef) => {
    if (onUpdate && variable) {
      onUpdate({ variable: { ...variable, typeRef: newTypeRef } });
    }
  }, [onUpdate, variable]);

  return (
    <div style={S.panel}>
      <h3 style={S.heading}>
        <span>📋</span>
        <span>{elementType?.replace("dmn:", "") || "Element"}</span>
      </h3>

      {/* Basis properties */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Basis</div>
        <EditField label="ID" value={elementId} readOnly />
        <EditField label="Type" value={elementType} readOnly />
        <EditField 
          label="Name" 
          value={elementName} 
          onChange={handleNameChange}
          placeholder="Element naam"
        />
      </div>

      {/* Variable properties (voor inputData en decisions) */}
      {variable && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Variable</div>
          <EditField label="Variable ID" value={variableId} readOnly />
          <EditField 
            label="Variable Name" 
            value={variableName} 
            onChange={handleVariableNameChange}
            placeholder="Variable naam"
          />
          <EditField 
            label="Type Ref" 
            value={variableTypeRef} 
            onChange={handleVariableTypeRefChange}
            placeholder="string, integer, boolean, etc."
          />
        </div>
      )}

      {/* Information requirements (voor decisions) */}
      {infoReqs && infoReqs.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Information Requirements</div>
          {infoReqs.map((req, idx) => (
            <div key={idx} style={{ fontSize: 11, color: "var(--ide-panel-color-muted, #999)", marginBottom: 2 }}>
              {req.requiredDecision?.href || req.requiredInput?.href || "—"}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
