/**
 * ProjectServerDialoog — "Van server ophalen…": de lijst van projecten op de
 * server (plan 2026-10-07 Projectsync, stap 1). Kiezen → `onKies(meta)`; de
 * aanroeper (modellerenActivity) haalt het project op en zet het in de stores.
 *
 * Eén instantie hangt in de Main van Modelleren; openen gaat via de store:
 *   useProjectServerStore.getState().openen({ huidigId, onKies })
 */
import React, { useEffect } from "react";
import { create } from "zustand";
import { lijstProjecten, verwijderProject } from "./projectSync.js";

export const useProjectServerStore = create((set, get) => ({
  open: false,
  laden: false,
  fout: null,
  /** @type {Array<{id:string,naam:string,eigenaar:string,versie:number,bijgewerkt:string,bijgewerkt_door:string,grootte:number}>} */
  lijst: [],
  huidigId: null,
  onKies: null,

  openen: ({ huidigId = null, onKies } = {}) => {
    set({ open: true, huidigId, onKies, fout: null });
    get().ververs();
  },
  sluiten: () => set({ open: false, onKies: null }),
  ververs: async () => {
    set({ laden: true, fout: null });
    try {
      const lijst = await lijstProjecten();
      set({ lijst: Array.isArray(lijst) ? lijst : [], laden: false });
    } catch (e) {
      set({ fout: e?.message || String(e), laden: false, lijst: [] });
    }
  },
}));

const kB = (n) => `${Math.max(1, Math.round((n || 0) / 1024))} kB`;
const wanneer = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" });
};

export default function ProjectServerDialoog() {
  const open = useProjectServerStore((s) => s.open);
  const laden = useProjectServerStore((s) => s.laden);
  const fout = useProjectServerStore((s) => s.fout);
  const lijst = useProjectServerStore((s) => s.lijst);
  const huidigId = useProjectServerStore((s) => s.huidigId);
  const sluiten = useProjectServerStore((s) => s.sluiten);
  const ververs = useProjectServerStore((s) => s.ververs);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") sluiten();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, sluiten]);

  if (!open) return null;

  const kies = (meta) => {
    const cb = useProjectServerStore.getState().onKies;
    sluiten();
    cb?.(meta);
  };

  const verwijder = async (meta) => {
    if (!window.confirm(`Project "${meta.naam}" van de server verwijderen?\n\nDit kan niet ongedaan gemaakt worden. Lokale kopieën blijven bestaan.`)) return;
    try {
      await verwijderProject(meta.id);
      ververs();
    } catch (e) {
      window.alert(`Verwijderen mislukt: ${e?.message || e}`);
    }
  };

  const knop = {
    font: "inherit",
    fontSize: 12,
    padding: "3px 10px",
    border: "1px solid var(--s-border, #cbd5e1)",
    borderRadius: 6,
    background: "transparent",
    color: "var(--s-fg)",
    cursor: "pointer",
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 260, background: "rgba(0,0,0,0.35)", display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: "8vh" }}
      onMouseDown={(e) => e.target === e.currentTarget && sluiten()}
    >
      <div
        role="dialog"
        aria-label="Projecten op de server"
        style={{ width: "min(640px, 92vw)", maxHeight: "82vh", overflow: "auto", background: "var(--s-panel)", color: "var(--s-fg)", border: "1px solid var(--s-border)", borderRadius: 10, boxShadow: "0 16px 48px rgba(0,0,0,0.4)", padding: 16 }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Projecten op de server</h2>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" onClick={ververs} style={knop} disabled={laden}>
              Ververs
            </button>
            <button type="button" onClick={sluiten} style={{ ...knop, padding: "2px 8px" }} aria-label="Sluiten">
              ×
            </button>
          </div>
        </div>
        <p style={{ margin: "0 0 10px", fontSize: 12, opacity: 0.8 }}>
          Ophalen vervangt je huidige project in deze browser. Parkeer het eerst via <em>Project → Nieuw project…</em> of
          <em> Exporteer project…</em> als je het wilt bewaren.
        </p>
        {fout && (
          <div style={{ color: "var(--s-danger, #dc2626)", fontSize: 13, marginBottom: 8 }}>{fout}</div>
        )}
        {laden && <div style={{ fontSize: 13, opacity: 0.7 }}>Laden…</div>}
        {!laden && !fout && lijst.length === 0 && (
          <div style={{ fontSize: 13, opacity: 0.7 }}>Nog geen projecten op de server. Gebruik <em>Project → Naar server sturen</em>.</div>
        )}
        {lijst.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", opacity: 0.7, fontSize: 11 }}>
                <th style={{ padding: "4px 6px" }}>Naam</th>
                <th style={{ padding: "4px 6px" }}>Eigenaar</th>
                <th style={{ padding: "4px 6px" }}>Bijgewerkt</th>
                <th style={{ padding: "4px 6px" }}>Versie</th>
                <th style={{ padding: "4px 6px" }}>Grootte</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lijst.map((m) => {
                const huidig = m.id === huidigId;
                return (
                  <tr key={m.id} style={{ borderTop: "1px solid var(--s-border, #e2e8f0)" }}>
                    <td style={{ padding: "6px" }}>
                      <strong>{m.naam}</strong>
                      {huidig && (
                        <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }} title="Dit project staat nu open in deze browser">
                          huidig
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "6px" }}>{m.eigenaar || "—"}</td>
                    <td style={{ padding: "6px" }} title={m.bijgewerkt_door ? `door ${m.bijgewerkt_door}` : undefined}>
                      {wanneer(m.bijgewerkt)}
                      {m.bijgewerkt_door ? <span style={{ opacity: 0.7 }}> · {m.bijgewerkt_door}</span> : null}
                    </td>
                    <td style={{ padding: "6px" }}>v{m.versie}</td>
                    <td style={{ padding: "6px" }}>{kB(m.grootte)}</td>
                    <td style={{ padding: "6px", whiteSpace: "nowrap", textAlign: "right" }}>
                      <button type="button" style={knop} onClick={() => kies(m)}>
                        Ophalen
                      </button>{" "}
                      <button type="button" style={{ ...knop, opacity: 0.7 }} onClick={() => verwijder(m)} title="Alleen de eigenaar of een admin">
                        Verwijder
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
