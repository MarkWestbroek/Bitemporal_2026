/**
 * documentVoorbeeld — voorbeeldvenster voor een gegenereerd document
 * (documentsjablonen, ontwerpvoorstel 2026-10-09 §3.4/§3.5).
 *
 * Een generator (transformaties.js, "Document: …") rendert Markdown + HTML en
 * roept `useDocumentStore.getState().toon({...})` aan; de host (in de
 * StudioShell) toont de HTML in een sandbox-iframe met knoppen voor
 * Markdown/HTML downloaden, Markdown kopiëren en afdrukken (→ PDF).
 * "Markdown + afbeeldingen" levert een zip met het .md-bestand en de
 * diagrammen als losse .svg-bestanden: GitHub toont inline <svg> in markdown
 * niet (Mark, 10-10). Zie transformatie/sjabloon/markdownMetAfbeeldingen.js.
 */
import React from "react";
import { create } from "zustand";
import { markdownMetAfbeeldingen } from "../../transformatie/sjabloon/markdownMetAfbeeldingen.js";
import { maakZip } from "../../transformatie/sjabloon/zip.js";

export const useDocumentStore = create((set) => ({
  open: false,
  titel: "",
  bestandsnaam: "document",
  markdown: "",
  html: "",
  /** @param {{titel:string, bestandsnaam?:string, markdown:string, html:string}} d */
  toon: (d) => set({ open: true, titel: d.titel || "Document", bestandsnaam: d.bestandsnaam || "document", markdown: d.markdown || "", html: d.html || "" }),
  sluit: () => set({ open: false }),
}));

function download(naam, inhoud, type) {
  const blob = new Blob([inhoud], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = naam;
  a.click();
  URL.revokeObjectURL(url);
}

const knop = { font: "inherit", fontSize: 13, padding: "5px 12px", borderRadius: 6, border: "1px solid var(--s-border)", background: "var(--s-panel-head, var(--s-panel))", color: "var(--s-fg)", cursor: "pointer" };

export function DocumentVoorbeeldHost() {
  const open = useDocumentStore((s) => s.open);
  const titel = useDocumentStore((s) => s.titel);
  const bestandsnaam = useDocumentStore((s) => s.bestandsnaam);
  const markdown = useDocumentStore((s) => s.markdown);
  const html = useDocumentStore((s) => s.html);
  const sluit = useDocumentStore((s) => s.sluit);
  const iframeRef = React.useRef(null);
  const [melding, setMelding] = React.useState("");
  React.useEffect(() => {
    if (!open) return;
    const esc = (e) => e.key === "Escape" && sluit();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, sluit]);
  if (!open) return null;
  const veilig = (bestandsnaam || "document").replace(/[^\w.-]+/g, "_");
  return (
    <div
      className="studio-document-voorbeeld"
      style={{ position: "fixed", inset: 0, zIndex: 320, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "stretch", justifyContent: "center", padding: "4vh 6vw" }}
      onMouseDown={(e) => e.target === e.currentTarget && sluit()}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--s-panel, #fff)", color: "var(--s-fg)", border: "1px solid var(--s-border)", borderRadius: 10, boxShadow: "0 12px 40px rgba(15,23,42,.3)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--s-border)" }}>
          <strong style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titel}</strong>
          <button style={knop} onClick={() => download(`${veilig}.md`, markdown, "text/markdown")} title="Eén bestand; de diagrammen staan er als inline SVG in (VS Code, browsers)">
            Download Markdown
          </button>
          <button
            style={knop}
            title="Zip met het .md-bestand en de diagrammen als losse .svg-bestanden — werkt ook op GitHub"
            onClick={() => {
              const uit = markdownMetAfbeeldingen(markdown, veilig);
              const zip = maakZip([{ naam: `${veilig}.md`, inhoud: uit.markdown }, ...uit.bestanden]);
              download(`${veilig}.zip`, zip, "application/zip");
              setMelding(`Zip met ${uit.bestanden.length} afbeelding${uit.bestanden.length === 1 ? "" : "en"} gedownload.`);
              setTimeout(() => setMelding(""), 3000);
            }}
          >
            Markdown + afbeeldingen (.zip)
          </button>
          <button style={knop} onClick={() => download(`${veilig}.html`, html, "text/html")}>Download HTML</button>
          <button
            style={knop}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(markdown);
                setMelding("Markdown gekopieerd.");
              } catch {
                setMelding("Kopiëren geweigerd door de browser.");
              }
              setTimeout(() => setMelding(""), 2500);
            }}
          >
            Kopieer Markdown
          </button>
          <button style={knop} onClick={() => iframeRef.current?.contentWindow?.print()} title="Afdrukken of als PDF bewaren">
            Afdrukken…
          </button>
          <button style={knop} onClick={sluit} aria-label="Sluiten">×</button>
        </div>
        {melding && <div style={{ padding: "4px 12px", fontSize: 12, color: "var(--s-fg-muted)" }}>{melding}</div>}
        <iframe
          ref={iframeRef}
          title={titel}
          srcDoc={html}
          sandbox="allow-same-origin allow-modals"
          style={{ flex: 1, border: 0, background: "#fff" }}
        />
      </div>
    </div>
  );
}
