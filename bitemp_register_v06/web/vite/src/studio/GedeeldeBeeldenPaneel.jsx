/**
 * GedeeldeBeeldenPaneel — de plaatjes van dit project die als link gedeeld zijn (Confluence,
 * wiki's), met adres kopiëren, openen en intrekken. Intrekken maakt het adres meteen ongeldig:
 * op elke pagina waar het geplakt is, verdwijnt het plaatje. Zie gedeeldeBeelden.js.
 */
import React from "react";
import { useBeeldenStore, laadBeelden, trekIn, beeldAdres } from "./gedeeldeBeelden.js";
import { vraagBevestiging, vraagNaam } from "./naamDialog.jsx";

const klein = { font: "inherit", fontSize: 12, padding: "2px 8px", borderRadius: 5, border: "1px solid var(--s-border)", background: "var(--s-panel)", color: "var(--s-fg)", cursor: "pointer" };

function wanneer(t) {
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" });
}

export function GedeeldeBeeldenPaneel({ projectId, onSluit }) {
  const beelden = useBeeldenStore((s) => s.beelden);
  const fout = useBeeldenStore((s) => s.fout);
  const [melding, setMelding] = React.useState("");
  React.useEffect(() => {
    laadBeelden(projectId);
  }, [projectId]);
  const zeg = (t) => {
    setMelding(t);
    setTimeout(() => setMelding(""), 3000);
  };
  return (
    <div data-testid="gedeelde-plaatjes-paneel" style={{ borderBottom: "1px solid var(--s-border)", padding: "8px 12px", maxHeight: "35vh", overflow: "auto", fontSize: 13 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <strong style={{ flex: 1 }}>Gedeelde plaatjes van dit project</strong>
        {melding && <span style={{ color: "var(--s-fg-muted)", fontSize: 12 }}>{melding}</span>}
        <button style={klein} onClick={onSluit} aria-label="Sluiten">×</button>
      </div>
      <p style={{ margin: "0 0 6px", color: "var(--s-fg-muted)", fontSize: 12 }}>
        Wie het adres kent, ziet dat ene plaatje (niets anders van het project). Intrekken haalt het overal weg waar het geplakt is.
      </p>
      {fout && <p style={{ color: "var(--s-danger, #b91c1c)" }}>{fout}</p>}
      {!fout && beelden.length === 0 && <p style={{ fontStyle: "italic", color: "var(--s-fg-muted)" }}>Nog geen plaatjes gedeeld.</p>}
      {beelden.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--s-fg-muted)", fontSize: 12 }}>
              <th>Diagram</th>
              <th>Soort</th>
              <th>Bijgewerkt</th>
              <th>Door</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {beelden.map((b) => (
              <tr key={b.token} data-testid="gedeeld-plaatje" style={{ borderTop: "1px solid var(--s-border)" }}>
                <td style={{ padding: "3px 4px" }}>{b.diagram_naam || b.diagram_id}</td>
                <td>{b.soort === "actueel" ? "houdt up to date" : "momentopname"}</td>
                <td>{wanneer(b.bijgewerkt)}</td>
                <td>{b.door || "—"}</td>
                <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                  <button
                    style={klein}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(beeldAdres(b.pad));
                        zeg("Adres gekopieerd.");
                      } catch {
                        // Geen klembord (http buiten localhost, of geweigerd): toon het adres om zelf
                        // te selecteren en te kopiëren.
                        await vraagNaam({ titel: "Adres van het plaatje", label: "Selecteer en kopieer (Ctrl+C)", waarde: beeldAdres(b.pad), bevestig: "Sluiten" });
                      }
                    }}
                  >
                    Kopieer adres
                  </button>{" "}
                  <a style={{ ...klein, textDecoration: "none", display: "inline-block" }} href={beeldAdres(b.pad)} target="_blank" rel="noreferrer">
                    Open
                  </a>{" "}
                  <button
                    style={klein}
                    data-testid="plaatje-intrekken"
                    onClick={async () => {
                      const ok = await vraagBevestiging({
                        titel: "Plaatje intrekken",
                        tekst: `Plaatje “${b.diagram_naam || b.diagram_id}” intrekken? Het verdwijnt overal waar het geplakt is.`,
                        bevestig: "Intrekken",
                        gevaar: true,
                      });
                      if (!ok) return;
                      try {
                        await trekIn(projectId, b.token);
                        zeg("Ingetrokken.");
                      } catch (e) {
                        zeg(`Intrekken mislukt: ${e?.message || e}`);
                      }
                    }}
                  >
                    Intrekken
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
