/**
 * BestandViewer — toont een bestand met syntax highlighting of markdown-preview.
 *
 * Dispatcht op basis van bestandsformaat naar:
 *  - CodeEditor (readonly) voor json, yaml, xml, go_code, sql, tekst
 *  - MarkdownWeergave voor markdown
 *
 * Props:
 *  - inhoud:          de bestandsinhoud (string)
 *  - bestandsformaat: "json" | "yaml" | "xml" | "markdown" | "go_code" | "sql" | "tekst" | "overig"
 *  - naam:            bestandsnaam (voor header)
 *  - grootte:         grootte in bytes (optioneel, voor info)
 *  - afgekapt:        boolean — of de preview is afgekapt
 */
import CodeEditor from "./CodeEditor";
import MarkdownWeergave from "./MarkdownWeergave";

const FORMAAT_NAAR_TAAL = {
  json: "json",
  yaml: "yaml",
  xml: "xml",
  markdown: "markdown",
  go_code: "go_code",
  sql: "sql",
  tekst: "tekst",
  overig: "tekst",
  binair: "tekst",
};

export default function BestandViewer({
  inhoud,
  bestandsformaat = "tekst",
  naam = "",
  grootte,
  afgekapt = false,
}) {
  if (!inhoud && inhoud !== "") {
    return <div style={{ padding: 16, color: "#888" }}>Geen inhoud beschikbaar</div>;
  }

  const taal = FORMAAT_NAAR_TAAL[bestandsformaat] || "tekst";

  return (
    <div className="cg-bestand-viewer">
      <div className="cg-bestand-viewer__header" style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "4px 8px", fontSize: 12, color: "#999",
        borderBottom: "1px solid var(--ide-controls-border, #444)",
      }}>
        <span style={{ fontWeight: 600, color: "#ccc" }}>{naam || "Bestand"}</span>
        {grootte != null && <span>({formatGrootte(grootte)})</span>}
        {afgekapt && <span style={{ color: "#f5c542" }}>⚠ Preview afgekapt</span>}
      </div>

      {taal === "markdown" ? (
        <MarkdownWeergave value={inhoud} title={naam || "Markdown-preview"} />
      ) : (
        <CodeEditor
          value={inhoud}
          taal={taal}
          readOnly
          minHeight={100}
        />
      )}
    </div>
  );
}

function formatGrootte(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
