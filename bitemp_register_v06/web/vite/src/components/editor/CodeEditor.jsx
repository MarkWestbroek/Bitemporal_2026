import EditorModule from "react-simple-code-editor";
const Editor = EditorModule.default ?? EditorModule;
import Prism from "prismjs";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-go";
import "prismjs/components/prism-sql";

// Lookup map: taal-prop → { grammar, prismTaal, label }
const TAAL_MAP = {
  json:     { grammar: () => Prism.languages.json,     prismTaal: "json",     label: "JSON" },
  markdown: { grammar: () => Prism.languages.markdown,  prismTaal: "markdown", label: "Markdown" },
  yaml:     { grammar: () => Prism.languages.yaml,      prismTaal: "yaml",     label: "YAML" },
  xml:      { grammar: () => Prism.languages.markup,     prismTaal: "markup",   label: "XML" },
  go_code:  { grammar: () => Prism.languages.go,         prismTaal: "go",       label: "Go" },
  sql:      { grammar: () => Prism.languages.sql,        prismTaal: "sql",      label: "SQL" },
  tekst:    { grammar: () => null,                        prismTaal: "text",     label: "Tekst" },
};

/**
 * CodeEditor — geïntegreerde code-editor op basis van react-simple-code-editor.
 *
 * Je typt direct "in" de gekleurde code (transparante textarea over een
 * syntax-highlighted <pre>). Geen apart invoerveld en preview nodig.
 *
 * Props:
 *  - value:       huidige waarde (string)
 *  - onChange:     (nieuweWaarde) => void
 *  - taal:         "json" | "markdown" | "yaml" | "xml" | "go_code" | "sql" | "tekst" — bepaalt de Prism-grammar
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
  const taalInfo = TAAL_MAP[taal] || TAAL_MAP.json;
  const grammar = taalInfo.grammar();
  const prismTaal = taalInfo.prismTaal;
  const label = taalInfo.label;

  function highlight(code) {
    if (!code) return "";
    if (!grammar) return code; // tekst: geen highlighting
    try {
      return Prism.highlight(code, grammar, prismTaal);
    } catch {
      // Fallback — toon onbewerkte tekst als highlight faalt
      return code;
    }
  }

  // Bij JSON: probeer te formatteren voor weergave als read-only
  const displayValue = readOnly && taal === "json" ? formatteerJson(value) : String(value ?? "");

  function handleFormatteer() {
    const geformateerd = formatteerJson(value);
    if (geformateerd !== value && onChange) onChange(geformateerd);
  }

  const kanFormatteren = !readOnly && taal === "json" && value && !foutmelding;

  return (
    <div className={`cg-code-editor ${readOnly ? "cg-code-editor--readonly" : ""} cg-code-editor--${taal}`}>
      <div className="cg-code-editor__header">
        <span className="cg-code-editor__title">{label}</span>
        {kanFormatteren && (
          <button type="button" className="cg-code-editor__format-btn" onClick={handleFormatteer}>
            Formatteer
          </button>
        )}
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
