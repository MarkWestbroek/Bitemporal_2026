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
import { markdownNaarHtml } from "../../transformatie/sjabloon/markdownNaarHtml.js";
import { svgNaarAfbeeldingen, svgNaarPng, markdownZonderSvg } from "../../transformatie/sjabloon/rijkKopieren.js";
import { maakZip } from "../../transformatie/sjabloon/zip.js";
import { useModellerenStore } from "./modellerenActivity.jsx";
import { deelSvg, klembordFout } from "../gedeeldeBeelden.js";
import { GedeeldeBeeldenPaneel } from "../GedeeldeBeeldenPaneel.jsx";

// Hoe de plaatjes meegaan bij "Kopieer voor Teams/Confluence" (gedeelde plaatjes, 16-10):
// ingebed werkt in Teams, Word en Outlook; Confluence laat ingebedde plaatjes weg en wil een link.
const PLAATJES = [
  { id: "ingebed", label: "Plaatjes ingebed (Teams, Word, Outlook)" },
  { id: "momentopname", label: "Plaatjes als link — momentopname (Confluence)" },
  { id: "actueel", label: "Plaatjes als link — houd up to date (Confluence)" },
];
const PLAATJES_SLEUTEL = "studio-kopieer-plaatjes";
function leesPlaatjesKeuze() {
  try {
    const v = globalThis.localStorage?.getItem(PLAATJES_SLEUTEL);
    return PLAATJES.some((p) => p.id === v) ? v : "ingebed";
  } catch {
    return "ingebed";
  }
}

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
  const [plaatjes, setPlaatjes] = React.useState(leesPlaatjesKeuze);
  const [beheer, setBeheer] = React.useState(false);
  const projectId = useModellerenStore((s) => s.project.id);
  const opServer = useModellerenStore((s) => s.project.serverVersie != null);
  // Links kunnen alleen voor een project op de server; anders valt de keuze terug op ingebed.
  const plaatjesNu = opServer ? plaatjes : "ingebed";
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
          {/* Teams, Confluence, Word, Outlook plakken geen markdown/SVG maar wél HTML met
              plaatjes (Mark, 16-10): de diagrammen gaan als PNG mee. */}
          <button
            style={knop}
            data-testid="kopieer-rijk"
            title="Opgemaakte tekst met de diagrammen als afbeelding — om te plakken in Teams, Confluence, Word of Outlook"
            onClick={() => {
              // Eerst: kan dit hier wel? Anders blijft de melding "klaarzetten" staan (16-10).
              const fout = klembordFout();
              if (fout) {
                setMelding(fout);
                setTimeout(() => setMelding(""), 8000);
                return;
              }
              try {
                // Als link: elk diagram krijgt een eigen adres op de server; een plaatje zonder
                // herkomst (geen diagram uit dit project) gaat ingebed mee.
                const adressen = [];
                const rasteriseer =
                  plaatjesNu === "ingebed"
                    ? svgNaarPng
                    : async (svg, maat) => {
                        const adres = await deelSvg(projectId, svg, plaatjesNu);
                        adressen.push(adres);
                        return adres || svgNaarPng(svg, maat);
                      };
                if (plaatjesNu !== "ingebed") setMelding("Plaatjes klaarzetten op de server…");
                const fragment = svgNaarAfbeeldingen(markdownNaarHtml(markdown), rasteriseer);
                // Het klembord vraagt een verse klik ("user activation"). Uploaden kan langer duren dan
                // die geldig blijft, dus gaat de ClipboardItem meteen mee, met beloftes als inhoud.
                let n = 0;
                const platteTekst = fragment.then(() =>
                  plaatjesNu === "ingebed"
                    ? markdownZonderSvg(markdown)
                    : markdown.replace(/<svg\b[\s\S]*?<\/svg>/g, () => {
                        n += 1;
                        const adres = adressen[n - 1];
                        return adres ? `![Diagram ${n}](${adres})` : `[Diagram ${n}]`;
                      })
                );
                const item = new ClipboardItem({
                  "text/html": fragment.then((f) => new Blob([f], { type: "text/html" })),
                  "text/plain": platteTekst.then((t) => new Blob([t], { type: "text/plain" })),
                });
                navigator.clipboard
                  .write([item])
                  .then(() => {
                    const links = adressen.filter(Boolean).length;
                    setMelding(
                      plaatjesNu === "ingebed"
                        ? "Gekopieerd voor Teams/Confluence: plak het daar met Ctrl+V."
                        : `Gekopieerd met ${links} plaatje${links === 1 ? "" : "s"} als link${plaatjesNu === "actueel" ? " (houdt zich up to date)" : ""}. Wie de link heeft, ziet het plaatje; intrekken kan onder "Gedeelde plaatjes".`
                    );
                  })
                  .catch((e) => setMelding(`Kopiëren mislukt: ${e?.message || e}`))
                  .finally(() => setTimeout(() => setMelding(""), plaatjesNu === "ingebed" ? 3500 : 8000));
              } catch (e) {
                setMelding(`Kopiëren mislukt: ${e?.message || e}`);
              }
            }}
          >
            Kopieer voor Teams/Confluence
          </button>
          <select
            data-testid="kopieer-plaatjes"
            value={plaatjesNu}
            title={opServer ? "Hoe gaan de diagrammen mee bij het kopiëren?" : "Plaatjes als link kan alleen voor een project op de server"}
            onChange={(e) => {
              setPlaatjes(e.target.value);
              try {
                globalThis.localStorage?.setItem(PLAATJES_SLEUTEL, e.target.value);
              } catch {
                /* geen opslag: de keuze geldt deze sessie */
              }
            }}
            style={{ ...knop, padding: "4px 6px", maxWidth: 230 }}
          >
            {PLAATJES.map((p) => (
              <option key={p.id} value={p.id} disabled={p.id !== "ingebed" && !opServer}>
                {p.label}
              </option>
            ))}
          </select>
          {opServer && (
            <button style={knop} data-testid="gedeelde-plaatjes" onClick={() => setBeheer((b) => !b)} title="Plaatjes van dit project die als link gedeeld zijn: adres kopiëren of intrekken">
              Gedeelde plaatjes
            </button>
          )}
          <button style={knop} onClick={() => iframeRef.current?.contentWindow?.print()} title="Afdrukken of als PDF bewaren">
            Afdrukken…
          </button>
          <button style={knop} onClick={sluit} aria-label="Sluiten">×</button>
        </div>
        {melding && <div data-testid="document-melding" style={{ padding: "4px 12px", fontSize: 12, color: "var(--s-fg-muted)" }}>{melding}</div>}
        {beheer && opServer && <GedeeldeBeeldenPaneel projectId={projectId} onSluit={() => setBeheer(false)} />}
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
