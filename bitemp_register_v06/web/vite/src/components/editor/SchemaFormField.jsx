import { useId } from "react";
import { validatieMeldingVoorVeld } from "../actions/ActionFormParts";
import RefCombobox from "./RefCombobox";
import { useSchema } from "../../context/SchemaContext";
import CodeEditor, { jsonParseFout } from "./CodeEditor";

/**
 * SchemaFormField — generiek formulierveld dat één `veld` uit de schema-API
 * rendert als NL Design System-compatible invoerelement.
 *
 * Gebruikt de DatatypeRegistry (via SchemaContext) om weergave-hints op te halen
 * zoals widget, prefix, suffix, multiline en decimalen. Hierdoor wordt bijv.
 * een Bedrag-veld getoond met "€"-prefix en een LangeTekst als <textarea>.
 *
 * Props:
 *  - veld:      { naam, type, format, enum, verplicht, description, autoIncrement, datatype }
 *  - value:     huidige waarde
 *  - onChange:  (nieuweWaarde) => void
 *  - error:     optioneel foutmelding override (vanuit react-hook-form)
 *  - readOnly:  forceer readonly (voor PK/FK/autoincrement)
 *  - widgetOverride: optionele expliciete widget-keuze uit formulier/weergaveconfiguratie
 */
export default function SchemaFormField({ veld, value, onChange, error, readOnly, widgetOverride, labelOverride }) {
  const fieldId = useId();
  const { datatypeByNaam } = useSchema();
  if (!veld) return null;

  const isReadonly = readOnly || veld.autoIncrement;
  const enumOpties = Array.isArray(veld.enum) ? veld.enum.filter(Boolean) : [];
  const foutmelding = error || (!isReadonly ? validatieMeldingVoorVeld(value, veld) : "");
  const type = String(veld.type || "string");
  const format = String(veld.format || "");

  // Weergave-hints uit DatatypeRegistry ophalen (widget, prefix, suffix, multiline, decimalen)
  const datatypeMeta = veld.datatype ? datatypeByNaam?.[veld.datatype] : null;
  const weergave = datatypeMeta?.weergave || {};
  const effectieveWidget = widgetOverride || weergave.widget || "";

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
    if (type === "number" && weergave.decimalen != null) {
      return String(Math.pow(10, -weergave.decimalen));
    }
    if (type === "number") return "any";
    return undefined;
  }

  function maxLength() {
    return datatypeMeta?.validatie?.maxLength || undefined;
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

    // JSON-widget: geïntegreerde code-editor met syntax-highlighting.
    if (effectieveWidget === "json") {
      return (
        <CodeEditor
          value={value}
          onChange={onChange}
          taal="json"
          readOnly={isReadonly}
          placeholder={weergave.placeholder || '{\n  "sleutel": "waarde"\n}'}
          foutmelding={jsonParseFout(value)}
        />
      );
    }

    // Markdown-widget: geïntegreerde code-editor met syntax-highlighting.
    if (effectieveWidget === "markdown") {
      return (
        <CodeEditor
          value={value}
          onChange={onChange}
          taal="markdown"
          readOnly={isReadonly}
          placeholder={weergave.placeholder || "# Titel\n\nTekst met **vet** en *cursief*"}
        />
      );
    }

    // Multiline / textarea widget (bijv. LangeTekst)
    if (weergave.multiline || effectieveWidget === "textarea") {
      return (
        <textarea
          id={fieldId}
          className="utrecht-textarea utrecht-textarea--html-textarea"
          rows={4}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          readOnly={isReadonly}
          disabled={isReadonly}
          aria-invalid={foutmelding ? "true" : undefined}
          placeholder={weergave.placeholder || undefined}
          maxLength={maxLength()}
        />
      );
    }

    // Input met prefix/suffix wrapper (bijv. "€" voor Bedrag, "%" voor Percentage)
    const inputEl = (
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
        placeholder={weergave.placeholder || (format === "date" ? "JJJJ-MM-DD" : format === "date-time" ? "JJJJ-MM-DDThh:mm" : undefined)}
        maxLength={maxLength()}
      />
    );

    if (weergave.prefix || weergave.suffix) {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          {weergave.prefix && <span className="utrecht-form-field__prefix">{weergave.prefix}</span>}
          {inputEl}
          {weergave.suffix && <span className="utrecht-form-field__suffix">{weergave.suffix}</span>}
        </div>
      );
    }

    return inputEl;
  }

  // JSON en markdown widgets moeten de volle breedte van het grid innemen
  const isFullWidth = effectieveWidget === "json" || effectieveWidget === "markdown";

  return (
    <div className="utrecht-form-field" style={{ marginBottom: "0.75rem", ...(isFullWidth ? { gridColumn: "1 / -1" } : {}) }}>
      <label htmlFor={fieldId} className="utrecht-form-label" style={{ display: "block", marginBottom: "0.25rem" }}>
        {labelOverride || veld.naam}
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
