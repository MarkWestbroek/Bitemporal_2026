/**
 * VerschilMetMainDialoog — "Verschil met MAIN…" van een branch (afgeleid project; 09-11, branch
 * stap 1, werkplaats-plan §4B). Toont per status (conflict, nieuw, gewijzigd, weg, alleen op MAIN)
 * de elementen, diagrammen, mappen en koppelingen die verschillen, met de velden en of ze buiten de
 * afgesplitste map liggen. Mergen gaat in stap 1 nog met de hand.
 *
 * De API doet het werk (GET …/vergelijk → render-sidecar POST /vergelijk, verschilMetMain.js).
 * Een diagram opent met een klik; een element opent het eerste diagram waarop het staat.
 *
 * Eén instantie hangt in de Main van Modelleren; openen via
 *   useVerschilMetMainStore.getState().openen({ projectId, regel, teVerzenden })
 */
import React, { useEffect, useMemo, useState } from "react";
import { create } from "zustand";
import { vergelijkMetMain } from "../activities/projectSync.js";
import { getProfieltype } from "../profieltypeRegistry";
import { openVerwijzing } from "../doorklik.js";
import { STATUS_LABEL, STATUS_UITLEG, SOORT_LABEL } from "./herkomst.js";

export const useVerschilMetMainStore = create((set, get) => ({
  open: false,
  laden: false,
  fout: null,
  uitkomst: null,
  projectId: null,
  regel: "",
  teVerzenden: 0,
  openen: ({ projectId, regel = "", teVerzenden = 0 }) => {
    set({ open: true, projectId, regel, teVerzenden, uitkomst: null, fout: null });
    get().ververs();
  },
  sluiten: () => set({ open: false }),
  ververs: async () => {
    const { projectId } = get();
    set({ laden: true, fout: null });
    try {
      const uitkomst = await vergelijkMetMain(projectId);
      set({ uitkomst, laden: false });
    } catch (e) {
      const fout =
        e?.status === 404
          ? "Dit project is geen branch, of de server kent \"verschil met MAIN\" nog niet."
          : e?.status === 502
            ? "De render-sidecar is niet bereikbaar, of te oud (zonder /vergelijk)."
            : e?.message || String(e);
      set({ fout, laden: false, uitkomst: null });
    }
  },
}));

const STATUSSEN = ["conflict", "nieuw", "gewijzigd", "weg", "main"];
const KLEUR = { conflict: "#dc2626", nieuw: "#16a34a", gewijzigd: "#2563eb", weg: "#9333ea", main: "#64748b" };

/** Profielnaam voor de lijst (val terug op het id). */
const profielNaam = (pid) => (pid ? getProfieltype(pid)?.label || getProfieltype(pid)?.naam || pid : "");

/** Open het diagram, of bij een element het eerste diagram waarop het in deze branch staat. */
function openRegel(v) {
  if (!v.profielId) return false;
  if (v.soort === "diagram") return openVerwijzing({ profielId: v.profielId, diagramId: v.id });
  if (v.soort !== "element") return false;
  const st = getProfieltype(v.profielId)?.useStore?.getState?.();
  const d = Object.values(st?.diagrams || {}).find((dg) => (dg.nodes || []).some((n) => n.elementId === v.id) || (dg.edges || []).some((e) => e.id === v.id || e.elementId === v.id));
  return d ? openVerwijzing({ profielId: v.profielId, diagramId: d.id }) : false;
}

export default function VerschilMetMainDialoog() {
  const { open, laden, fout, uitkomst, regel, teVerzenden, sluiten, ververs } = useVerschilMetMainStore();
  const [metMain, setMetMain] = useState(true);
  const [alleenScope, setAlleenScope] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && sluiten();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, sluiten]);

  const groepen = useMemo(() => {
    const lijst = (uitkomst?.verschillen || []).filter((v) => (metMain || v.status !== "main") && (!alleenScope || v.inScope));
    return STATUSSEN.map((s) => [s, lijst.filter((v) => v.status === s)]).filter(([, l]) => l.length);
  }, [uitkomst, metMain, alleenScope]);

  if (!open) return null;
  const t = uitkomst?.telling || {};
  const buiten = (uitkomst?.verschillen || []).filter((v) => v.status !== "main" && !v.inScope).length;
  const knop = { font: "inherit", fontSize: 12, padding: "3px 10px", border: "1px solid var(--s-border, #cbd5e1)", borderRadius: 6, background: "transparent", color: "var(--s-fg)", cursor: "pointer" };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 260, background: "rgba(0,0,0,0.35)", display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: "8vh" }}
      onMouseDown={(e) => e.target === e.currentTarget && sluiten()}
    >
      <div
        role="dialog"
        aria-label="Verschil met MAIN"
        data-testid="verschil-met-main"
        style={{ width: "min(780px, 92vw)", maxHeight: "82vh", overflow: "auto", background: "var(--s-panel)", color: "var(--s-fg)", border: "1px solid var(--s-border)", borderRadius: 10, boxShadow: "0 16px 48px rgba(0,0,0,0.4)", padding: 16 }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Verschil met MAIN</h2>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" onClick={ververs} style={knop} disabled={laden}>Ververs</button>
            <button type="button" onClick={sluiten} style={{ ...knop, padding: "2px 8px" }} aria-label="Sluiten">×</button>
          </div>
        </div>
        {regel && <p style={{ margin: "0 0 6px", fontSize: 12, opacity: 0.8 }}>{regel}</p>}
        <p style={{ margin: "0 0 10px", fontSize: 12, opacity: 0.8 }}>
          Vergeleken met de stand bij het afsplitsen. Mergen gaat nog met de hand.
          {uitkomst?.main?.laatsteVolgnummer != null && <> MAIN staat op #{uitkomst.main.laatsteVolgnummer}.</>}
        </p>
        {teVerzenden > 0 && (
          <div style={{ fontSize: 12, marginBottom: 8, color: "var(--s-warn, #b45309)" }}>
            Nog {teVerzenden} wijziging(en) van jou niet op de server; die tellen pas mee na verzenden.
          </div>
        )}
        {fout && <div style={{ color: "var(--s-danger, #dc2626)", fontSize: 13, marginBottom: 8 }}>{fout}</div>}
        {laden && <div style={{ fontSize: 13, opacity: 0.7 }}>Vergelijken…</div>}
        {uitkomst && !laden && (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", fontSize: 12, marginBottom: 8 }}>
              {STATUSSEN.map((s) => (
                <span key={s} title={STATUS_UITLEG[s]} data-status={s}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: KLEUR[s], marginRight: 4 }} />
                  {STATUS_LABEL[s]}: <strong>{t[s] || 0}</strong>
                </span>
              ))}
              <span style={{ flex: 1 }} />
              <label><input type="checkbox" checked={metMain} onChange={(e) => setMetMain(e.target.checked)} /> toon wat alleen op MAIN veranderde</label>
              <label><input type="checkbox" checked={alleenScope} onChange={(e) => setAlleenScope(e.target.checked)} /> alleen in de map</label>
            </div>
            {buiten > 0 && (
              <div style={{ fontSize: 12, marginBottom: 8, color: "var(--s-warn, #b45309)" }}>
                {buiten} wijziging(en) in deze branch liggen buiten de afgesplitste map. Dat mag nu nog; bij het mergen
                krijgen die extra aandacht.
              </div>
            )}
            {(uitkomst.meldingen || []).length > 0 && (
              <details style={{ fontSize: 12, marginBottom: 8 }}>
                <summary>{uitkomst.meldingen.length} melding(en) bij het naspelen</summary>
                <ul style={{ margin: "4px 0 0 16px" }}>{uitkomst.meldingen.map((m, i) => <li key={i}>{m.kant}: {m.bericht}</li>)}</ul>
              </details>
            )}
            {groepen.length === 0 && <div style={{ fontSize: 13, opacity: 0.7 }}>Geen verschil.</div>}
            {groepen.map(([status, lijst]) => (
              <section key={status} style={{ marginBottom: 10 }}>
                <h3 style={{ margin: "8px 0 4px", fontSize: 13, color: KLEUR[status] }} title={STATUS_UITLEG[status]}>
                  {STATUS_LABEL[status]} ({lijst.length})
                </h3>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <tbody>
                    {lijst.map((v) => (
                      <tr key={`${v.soort}:${v.profielId}:${v.id}`} style={{ borderTop: "1px solid var(--s-border, #e2e8f0)" }} data-verschil-id={v.id}>
                        <td style={{ padding: "4px 6px", width: 80, opacity: 0.7 }}>{SOORT_LABEL[v.soort] || v.soort}</td>
                        <td style={{ padding: "4px 6px" }}>
                          {v.soort === "element" || v.soort === "diagram" ? (
                            <button type="button" onClick={() => openRegel(v) && sluiten()} title="Openen" style={{ ...knop, border: 0, padding: 0, textDecoration: "underline" }}>
                              {v.naam || v.id}
                            </button>
                          ) : (
                            <strong>{v.naam || v.id}</strong>
                          )}
                          {!v.inScope && v.status !== "main" && (
                            <span style={{ marginLeft: 6, fontSize: 10, color: "var(--s-warn, #b45309)" }} title="Ligt niet in de afgesplitste map">buiten de map</span>
                          )}
                        </td>
                        <td style={{ padding: "4px 6px", opacity: 0.7 }}>{profielNaam(v.profielId)}</td>
                        <td style={{ padding: "4px 6px", opacity: 0.8 }}>{(v.velden || []).join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
