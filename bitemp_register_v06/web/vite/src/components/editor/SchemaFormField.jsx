import { useId } from "react";
import { validatieMeldingVoorVeld } from "../actions/ActionFormParts";
import RefCombobox from "./RefCombobox";

/**
 * SchemaFormField — generiek formulierveld dat één `veld` uit de schema-API
 * rendert als NL Design System-compatible invoerelement.
 *
 * Props:
 *  - veld:      { naam, type, format, enum, verplicht, description, autoIncrement }
 *  - value:     huidige waarde
 *  - onChange:  (nieuweWaarde) => void
 *  - error:     optioneel foutmelding override (vanuit react-hook-form)
 *  - readOnly:  forceer readonly (voor PK/FK/autoincrement)
 */
export default function SchemaFormField({ veld, value, onChange, error, readOnly }) {
  const fieldId = useId();
  if (!veld) return null;

  const isReadonly = readOnly || veld.autoIncrement;
  const enumOpties = Array.isArray(veld.enum) ? veld.enum.filter(Boolean) : [];
  const foutmelding = error || (!isReadonly ? validatieMeldingVoorVeld(value, veld) : "");
  const type = String(veld.type || "string");
  const format = String(veld.format || "");

  function inputType() {
    if (type === "string" && format === "date") return "date";
    if (type === "string" && format === "date-time") return "datetime-local";
    return "text";
  }

  function inputMode() {
    if (type === "integer") return "numeric";
    if (type === "number") return "decimal";
    return undefined;
  }

  function step() {
    if (type === "integer") return "1";
    if (type === "number") return "any";
    return undefined;
  }

  function renderInput() {
    // Boolean → radio group
    if (type === "boolean") {
      return (
        <div className="utrecht-form-field__input" style={{ display: "flex", gap: "1rem" }}>
          {[
            { val: "", label: "(leeg)" },
            { val: "true", label: "Ja" },
            { val: "false", label: "Nee" },
          ].map((optie) => (
            <label key={optie.val} style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <input
                type="radio"
                name={fieldId}
                checked={String(value ?? "") === optie.val}
                onChange={() => onChange(optie.val)}
                disabled={isReadonly}
              />
              {optie.label}
            </label>
          ))}
        </div>
      );
    }

    // Enum → select/dropdown
    if (enumOpties.length > 0) {
      return (
        <select
          id={fieldId}
          className="utrecht-select utrecht-select--html-select"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          disabled={isReadonly}
          aria-invalid={foutmelding ? "true" : undefined}
        >
          <option value="">{veld.verplicht ? "(kies waarde)" : "(leeg)"}</option>
          {enumOpties.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    // Referentielijst-verwijzing → combobox/autocomplete
    if (veld.ref) {
      return (
        <RefCombobox
          refType={veld.ref}
          value={value}
          onChange={onChange}
          readOnly={isReadonly}
        />
      );
    }

    // Default → text/date/number input
    return (
      <input
        id={fieldId}
        className="utrecht-textbox utrecht-textbox--html-input"
        type={inputType()}
        inputMode={inputMode()}
        step={step()}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        readOnly={isReadonly}
        disabled={isReadonly}
        aria-invalid={foutmelding ? "true" : undefined}
        placeholder={format === "date" ? "JJJJ-MM-DD" : format === "date-time" ? "JJJJ-MM-DDThh:mm" : undefined}
      />
    );
  }

  return (
    <div className="utrecht-form-field" style={{ marginBottom: "0.75rem" }}>
      <label htmlFor={fieldId} className="utrecht-form-label" style={{ display: "block", marginBottom: "0.25rem" }}>
        {veld.naam}
        {veld.verplicht && <span style={{ color: "var(--cg-fout)", marginLeft: 4 }}>*</span>}
      </label>
      {veld.description && (
        <div className="utrecht-form-field-description" style={{ marginBottom: "0.25rem" }}>
          {veld.description}
        </div>
      )}
      {renderInput()}
      {foutmelding && (
        <div className="utrecht-form-field-error-message" role="alert" style={{ marginTop: "0.25rem" }}>
          {foutmelding}
        </div>
      )}
    </div>
  );
}
