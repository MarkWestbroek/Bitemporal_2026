import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markdown";

/**
 * CodeEditor — geïntegreerde code-editor op basis van react-simple-code-editor.
 *
 * Je typt direct "in" de gekleurde code (transparante textarea over een
 * syntax-highlighted <pre>). Geen apart invoerveld en preview nodig.
 *
 * Props:
 *  - value:       huidige waarde (string)
 *  - onChange:     (nieuweWaarde) => void
 *  - taal:         "json" | "markdown" — bepaalt de Prism-grammar
 *  - readOnly:     indien true, alleen weergave
 *  - placeholder:  optionele placeholder tekst
 *  - minHeight:    minimum hoogte in px (default: 200)
 *  - foutmelding:  optionele foutmelding (bijv. JSON-parse error) getoond onder de editor
 */
export default function CodeEditor({
  value,
  onChange,
  taal = "json",
  readOnly = false,
  placeholder = "",
  minHeight = 200,
  foutmelding = "",
}) {
  const grammar = taal === "markdown" ? Prism.languages.markdown : Prism.languages.json;
  const prismTaal = taal === "markdown" ? "markdown" : "json";

  function highlight(code) {
    if (!code) return "";
    try {
      return Prism.highlight(code, grammar, prismTaal);
    } catch {
      // Fallback — toon onbewerkte tekst als highlight faalt
      return code;
    }
  }

  // Bij JSON: probeer te formatteren voor weergave als read-only
  const displayValue = readOnly && taal === "json" ? formatteerJson(value) : String(value ?? "");

  return (
    <div className={`cg-code-editor ${readOnly ? "cg-code-editor--readonly" : ""} cg-code-editor--${taal}`}>
      <div className="cg-code-editor__header">
        <span className="cg-code-editor__title">{taal === "json" ? "JSON" : "Markdown"}</span>
        {foutmelding && <span className="cg-code-editor__error">{foutmelding}</span>}
      </div>
      <Editor
        value={displayValue}
        onValueChange={readOnly ? () => {} : onChange}
        highlight={highlight}
        padding={12}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={readOnly}
        className="cg-code-editor__area"
        textareaClassName="cg-code-editor__textarea"
        preClassName="cg-code-editor__pre"
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, SF Mono, Menlo, monospace",
          fontSize: "0.8125rem",
          lineHeight: 1.6,
          minHeight: `${minHeight}px`,
        }}
      />
    </div>
  );
}

/** Probeer JSON te parsen en mooi te formatteren; geef anders de originele string terug. */
function formatteerJson(value) {
  if (value == null || value === "") return "";
  if (typeof value !== "string") {
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
  }
  try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; }
}

/**
 * Bepaal een JSON-parse foutmelding (of lege string als geldig).
 * Handig om als `foutmelding` prop mee te geven aan CodeEditor.
 */
export function jsonParseFout(value) {
  if (value == null || value === "") return "";
  try {
    JSON.parse(value);
    return "";
  } catch (e) {
    return e?.message || "Ongeldige JSON";
  }
}
