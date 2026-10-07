/**
 * SneltoetsenInstellingen — instelscherm voor de canvas-sneltoetsen
 * (Studio-instellingen → Sneltoetsen). Per actie: huidige binding, klik op
 * "Wijzig" en druk de gewenste toetsen; "Uit" zet de actie zonder toets,
 * "Standaard" zet de EA-achtige default terug. Opslag per browser, zie
 * `sneltoetsen.js`.
 */
import React, { useEffect, useState, useSyncExternalStore } from "react";
import {
  SNELTOETS_ACTIES,
  VASTE_SNELTOETSEN,
  bindingVoor,
  zetBinding,
  herstelStandaarden,
  bindingVanEvent,
  bindingToegestaan,
  actieMetBinding,
  toonBinding,
  abonneerSneltoetsen,
  sneltoetsenVersie,
} from "./sneltoetsen.js";

export default function SneltoetsenInstellingen() {
  useSyncExternalStore(abonneerSneltoetsen, sneltoetsenVersie);
  const [vangt, setVangt] = useState(null); // actie-id die op een toets wacht
  const [melding, setMelding] = useState("");

  useEffect(() => {
    if (!vangt) return;
    const onKey = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setVangt(null);
        return;
      }
      const b = bindingVanEvent(e);
      if (!b) return; // alleen een modifier ingedrukt: wachten
      if (!bindingToegestaan(b)) {
        setMelding(`"${toonBinding(b)}" kan niet: gebruik Ctrl of Alt, of een F-toets.`);
        return;
      }
      const ander = actieMetBinding(b, vangt);
      zetBinding(vangt, b);
      if (ander) zetBinding(ander.id, null);
      setMelding(ander ? `"${toonBinding(b)}" is weggehaald bij "${ander.label}".` : "");
      setVangt(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [vangt]);

  const groepen = [...new Set(SNELTOETS_ACTIES.map((a) => a.groep))];
  const cel = { padding: "3px 8px", fontSize: 13, borderBottom: "1px solid var(--s-border, #e2e8f0)" };
  const kbd = {
    display: "inline-block",
    padding: "1px 6px",
    border: "1px solid var(--s-border, #cbd5e1)",
    borderRadius: 4,
    fontFamily: "ui-monospace, monospace",
    fontSize: 12,
    background: "var(--s-hover, #f1f5f9)",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 640 }}>
        <tbody>
          {groepen.map((groep) => (
            <React.Fragment key={groep}>
              <tr>
                <th colSpan={3} style={{ ...cel, textAlign: "left", paddingTop: 10, color: "var(--s-fg-muted, #64748b)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em" }}>
                  {groep}
                </th>
              </tr>
              {SNELTOETS_ACTIES.filter((a) => a.groep === groep).map((a) => {
                const b = bindingVoor(a.id);
                const wacht = vangt === a.id;
                return (
                  <tr key={a.id}>
                    <td style={{ ...cel, width: "45%" }}>{a.label}</td>
                    <td style={cel}>
                      {wacht ? (
                        <span style={{ ...kbd, border: "1px solid var(--s-accent, #6366f1)" }}>druk toetsen… (Esc = annuleren)</span>
                      ) : b ? (
                        <span style={kbd}>{toonBinding(b)}</span>
                      ) : (
                        <span style={{ color: "var(--s-fg-muted, #64748b)" }}>—</span>
                      )}
                    </td>
                    <td style={{ ...cel, whiteSpace: "nowrap", textAlign: "right" }}>
                      <button className="dc-mini-knop" onClick={() => { setMelding(""); setVangt(wacht ? null : a.id); }}>
                        {wacht ? "Annuleer" : "Wijzig"}
                      </button>{" "}
                      <button className="dc-mini-knop" disabled={!b} onClick={() => zetBinding(a.id, null)} title="Geen toets voor deze actie">
                        Uit
                      </button>{" "}
                      <button className="dc-mini-knop" disabled={b === (a.standaard ?? null)} onClick={() => zetBinding(a.id, a.standaard ?? null)} title={a.standaard ? `Standaard: ${toonBinding(a.standaard)}` : "Standaard: geen"}>
                        Standaard
                      </button>
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
          <tr>
            <th colSpan={3} style={{ ...cel, textAlign: "left", paddingTop: 10, color: "var(--s-fg-muted, #64748b)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em" }}>
              Vast
            </th>
          </tr>
          {VASTE_SNELTOETSEN.map((v) => (
            <tr key={v.label}>
              <td style={{ ...cel, width: "45%" }}>{v.label}</td>
              <td style={cel} colSpan={2}>
                <span style={kbd}>{toonBinding(v.binding)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button className="dc-mini-knop" onClick={() => { herstelStandaarden(); setMelding("Alle sneltoetsen staan weer op de standaard."); }}>
          Alles naar standaard
        </button>
        {melding && <span style={{ fontSize: 12, color: "var(--s-fg-muted, #64748b)" }}>{melding}</span>}
      </div>
    </div>
  );
}
