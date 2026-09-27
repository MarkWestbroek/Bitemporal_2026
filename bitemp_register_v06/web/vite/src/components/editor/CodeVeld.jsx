import { useState } from "react";
import CodeEditor, { jsonParseFout } from "./CodeEditor";
import { markdownNaarHtml } from "../../publicatie/markdown.js";

/**
 * CodeVeld — de vormen `code`, `markdown` en `json`: de code-editor met syntaxkleuring
 * (CodeEditor), en voor markdown een voorbeeld met dezelfde renderer als de publicatiepagina
 * (publicatie/markdown.js). Omnium-kant (gebruikt Prism), daarom niet in src/vormen.
 *
 * `code` kiest de taal met config.language (json, markdown, yaml, xml, sql, go_code, tekst);
 * `markdown` en `json` zijn de vaste varianten.
 *
 * Props: vorm, waarde, onChange, readOnly, labelId, config { language, minHeight, preview }
 *   preview: "tabs" (standaard: Bewerken | Voorbeeld) of "naast" (naast elkaar, breed scherm).
 */
export default function CodeVeld({ vorm, waarde, onChange, readOnly = false, labelId, config = {} }) {
  const taal = vorm === "code" ? config.language || "tekst" : vorm;
  const tekst = String(waarde ?? "");
  const [tab, setTab] = useState("bewerken");
  const isMd = taal === "markdown";
  const voorbeeld = isMd ? <div className="cg-publicatie-detail__inhoud" style={{ padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: 6, background: "#fff", minHeight: 80 }}
    dangerouslySetInnerHTML={{ __html: markdownNaarHtml(tekst) }} /> : null;

  if (readOnly) {
    if (isMd) return voorbeeld;
    return <pre style={{ margin: 0, padding: "0.5rem 0.75rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, overflowX: "auto", fontSize: "0.85rem" }}>{tekst || "—"}</pre>;
  }

  const editor = (
    <CodeEditor value={tekst} onChange={onChange} taal={taal} minHeight={config.minHeight || 160}
      foutmelding={taal === "json" && tekst.trim() ? jsonParseFout(tekst) : undefined} />
  );
  if (!isMd) return <div aria-labelledby={labelId}>{editor}</div>;

  if (config.preview === "naast") {
    return <div aria-labelledby={labelId} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>{editor}{voorbeeld}</div>;
  }
  const knop = (id, label) => (
    <button type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
      style={{ border: "none", borderBottom: tab === id ? "2px solid #1d4ed8" : "2px solid transparent", background: "none", padding: "4px 10px", cursor: "pointer",
        fontWeight: tab === id ? 700 : 400, color: tab === id ? "#1d4ed8" : "#475569" }}>{label}</button>
  );
  return (
    <div aria-labelledby={labelId}>
      <div role="tablist" style={{ display: "flex", gap: 4, marginBottom: 4 }}>{knop("bewerken", "Bewerken")}{knop("voorbeeld", "Voorbeeld")}</div>
      {tab === "bewerken" ? editor : voorbeeld}
    </div>
  );
}
