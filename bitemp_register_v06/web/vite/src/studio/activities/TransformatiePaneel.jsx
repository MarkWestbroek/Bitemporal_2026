/**
 * TransformatiePaneel — het generieke transformeer-scherm (modal).
 *
 * Opbouw (sessiebesluit 2026-07-13):
 *   1. Actie: Importeren · Transformeren · Exporteren (in die volgorde).
 *      Wordt de actie al via het (rechtsklik-/hoofd)menu gekozen, dan opent
 *      het scherm direct in die vorm en vervalt deze keuze bovenaan.
 *   2. Bron — afhankelijk van de actie: een map, of een bestand/API.
 *   3. Doel — idem; bij een map is er extra een veld
 *      "nieuwe (sub)map in de gekozen map" (leeg = de gekozen map zelf).
 *
 * Zie transformatieRegistry.js (contract) en transformaties.js (ingebouwde
 * generatoren). Aangesloten generatoren krijgen bronMap/doelMap of bron/doel.
 */
import React from "react";
import { create } from "zustand";
import { useModellerenStore } from "./modellerenActivity.jsx";
import { bundelDiagnostics } from "./diagnosticsBundel.js";
import {
  acceptVoor,
  detecteerTransformatie,
  getTransformaties,
  normaliseerTransformatieResultaat,
  standaardOpties,
} from "./transformatieRegistry.js";
import { mapProfielen } from "./transformaties.js";
import { getProfieltype } from "../profieltypeRegistry";

export const useTransformStore = create((set) => ({
  open: false,
  mapId: null,
  actie: null,
  /** @param {string|null} mapId @param {"import"|"export"|"transform"|null} actie */
  openen: (mapId = null, actie = null) => set({ open: true, mapId: mapId || null, actie: actie || null }),
  sluiten: () => set({ open: false }),
}));

const ACTIES = [
  { id: "import", label: "Importeren", uitleg: "van buiten (bestand/API) naar een map" },
  { id: "transform", label: "Transformeren", uitleg: "van een map naar een (andere) map" },
  { id: "export", label: "Exporteren", uitleg: "van een map naar buiten (bestand/API)" },
];

const veld = { font: "inherit", fontSize: 13, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--s-border)", background: "var(--s-panel)", color: "var(--s-fg)" };
const knop = { font: "inherit", fontSize: 13, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--s-border)", background: "var(--s-panel-head)", color: "var(--s-fg)", cursor: "pointer" };
const kopje = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--s-fg-muted)", margin: "10px 0 4px" };

/** Doel-map met optioneel een nieuwe (sub)map erin. */
function DoelMapKiezer({ mappen, doelMapId, setDoelMapId, nieuweNaam, setNieuweNaam }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <select value={doelMapId} onChange={(e) => setDoelMapId(e.target.value)} style={{ ...veld, width: "100%" }}>
        <option value="">— kies een map —</option>
        {Object.values(mappen).map((m) => (
          <option key={m.id} value={m.id}>{m.naam}</option>
        ))}
      </select>
      <input
        value={nieuweNaam}
        onChange={(e) => setNieuweNaam(e.target.value)}
        placeholder="nieuwe (sub)map in de gekozen map — leeg = de gekozen map zelf"
        style={{ ...veld, width: "100%" }}
      />
    </div>
  );
}

export default function TransformatiePaneel() {
  const open = useTransformStore((s) => s.open);
  const mapId = useTransformStore((s) => s.mapId);
  const actie = useTransformStore((s) => s.actie);
  const sluiten = useTransformStore((s) => s.sluiten);
  const mappen = useModellerenStore((s) => s.mappen);

  // Afgeleid van de actie zodat er geen render-race is: is de actie via het
  // menu gekozen (vasteActie), dan wint die; anders de tab-keuze.
  const [richtingState, setRichtingState] = React.useState("import");
  const vasteActie = !!actie;
  const richting = actie || richtingState;
  const [generatorId, setGeneratorId] = React.useState(null);
  const [bronMapId, setBronMapId] = React.useState("");
  const [bestandTekst, setBestandTekst] = React.useState(null);
  const [bestandNaam, setBestandNaam] = React.useState(null);
  const [doelMapId, setDoelMapId] = React.useState("");
  const [doelNieuweNaam, setDoelNieuweNaam] = React.useState("");
  const [optieWaarden, setOptieWaarden] = React.useState({});
  const [bezig, setBezig] = React.useState(false);
  const [resultaat, setResultaat] = React.useState(null);

  React.useEffect(() => {
    if (!open) return;
    const a = actie || "import";
    setRichtingState(a);
    setGeneratorId(null);
    setBestandTekst(null);
    setBestandNaam(null);
    setDoelNieuweNaam("");
    setResultaat(null);
    setOptieWaarden({});
    // De aangewezen map vult de relevante kant: bij import het doel, anders de bron.
    if (a === "import") { setDoelMapId(mapId || ""); setBronMapId(""); }
    else { setBronMapId(mapId || ""); setDoelMapId(""); }
  }, [open, mapId, actie]);

  // Profielen van de bron-map bepalen welke export/transform-generatoren gelden.
  // N.B. deze afleidingen en het effect hieronder staan bewust VÓÓR de
  // early return bij een gesloten paneel: een hook na een conditionele
  // return geeft "Rendered more hooks than during the previous render"
  // zodra het paneel opent (gevonden 31-08, crash bij Project → Transformeren).
  const bronProfielen = bronMapId ? mapProfielen(bronMapId) : [];
  const filter = richting === "import" ? null : (bronProfielen.length ? bronProfielen : null);
  const generatoren = getTransformaties(richting, filter);
  const gekozen = generatoren.find((g) => g.id === generatorId) || null;

  React.useEffect(() => {
    setOptieWaarden(standaardOpties(gekozen));
    setResultaat(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatorId]);

  if (!open) return null;

  const kiesBestand = () => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = acceptVoor(gekozen);
    inp.onchange = () => {
      const f = inp.files?.[0];
      if (!f) return;
      f.text().then((tekst) => {
        setBestandTekst(tekst);
        setBestandNaam(f.name);
        if (!gekozen) {
          const herkend = detecteerTransformatie(generatoren, { naam: f.name, tekst });
          if (herkend) setGeneratorId(herkend.id);
        }
      });
    };
    inp.click();
  };

  const doelGekozen = !!(doelMapId || doelNieuweNaam.trim());
  const kanUitvoeren =
    gekozen &&
    (richting === "import" ? bestandTekst && doelGekozen : true) &&
    (richting === "export" ? bronMapId : true) &&
    (richting === "transform" ? bronMapId && doelGekozen : true);

  /** Resolveert de doelmap: nieuwe (sub)map aanmaken als er een naam staat. */
  const resolveerDoelMap = () => {
    if (doelNieuweNaam.trim()) return useModellerenStore.getState().nieuweMap(doelNieuweNaam.trim(), doelMapId || null);
    return doelMapId || null;
  };

  const uitvoeren = async () => {
    if (!kanUitvoeren) return;
    setBezig(true);
    setResultaat(null);
    try {
      const context = { richting };
      if (richting === "import") {
        context.bron = { type: "file", tekst: bestandTekst, naam: bestandNaam };
        context.doelMap = resolveerDoelMap();
      } else if (richting === "export") {
        context.bronMap = bronMapId;
        context.mapNaam = mappen[bronMapId]?.naam;
      } else {
        context.bronMap = bronMapId;
        context.doelMap = resolveerDoelMap();
      }
      context.opties = optieWaarden;
      const runResultaat = await gekozen.run(context);
      setResultaat(normaliseerTransformatieResultaat(runResultaat));
    } catch (e) {
      setResultaat({
        status: "error",
        summary: `Mislukt: ${e?.message || String(e)}`.slice(0, 500),
        diagnostics: Array.isArray(e?.diagnostics) ? e.diagnostics : [],
      });
    } finally {
      setBezig(false);
    }
  };

  const bronMapNaam = bronMapId ? mappen[bronMapId]?.naam : null;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 260, background: "rgba(0,0,0,0.35)", display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: "8vh" }}
      onMouseDown={sluiten}
    >
      <div
        style={{ width: "min(600px, 92vw)", maxHeight: "82vh", overflow: "auto", background: "var(--s-panel)", color: "var(--s-fg)", border: "1px solid var(--s-border)", borderRadius: 10, boxShadow: "0 16px 48px rgba(0,0,0,0.4)", padding: 16 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Transformeren</h2>
          <button type="button" onClick={sluiten} style={{ ...knop, padding: "2px 8px" }}>×</button>
        </div>

        {/* 1. Actie */}
        {vasteActie ? (
          <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600 }}>
            {ACTIES.find((a) => a.id === richting)?.label}
            <span style={{ fontWeight: 400, color: "var(--s-fg-muted)" }}> — {ACTIES.find((a) => a.id === richting)?.uitleg}</span>
          </p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 6, margin: "4px 0 4px" }}>
              {ACTIES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => { setRichtingState(a.id); setGeneratorId(null); setResultaat(null); }}
                  style={{ ...knop, flex: 1, fontWeight: richting === a.id ? 700 : 400, borderColor: richting === a.id ? "var(--s-accent, #4f46e5)" : "var(--s-border)", background: richting === a.id ? "var(--s-hover)" : "var(--s-panel-head)" }}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <p style={{ margin: "0 0 4px", fontSize: 12, color: "var(--s-fg-muted)" }}>
              {ACTIES.find((a) => a.id === richting)?.uitleg}.
            </p>
          </>
        )}

        {/* 2. Bron */}
        <div style={kopje}>Bron</div>
        {richting === "import" ? (
          <div style={{ fontSize: 13 }}>
            <button type="button" style={knop} onClick={kiesBestand}>Kies bestand…</button>
            {bestandNaam && <span style={{ marginLeft: 8, color: "var(--s-fg-muted)" }}>{bestandNaam}</span>}
            <label style={{ display: "block", marginTop: 4, color: "var(--s-fg-muted)", fontSize: 12 }}>
              <input type="radio" disabled /> API (binnenkort)
            </label>
          </div>
        ) : (
          <select value={bronMapId} onChange={(e) => setBronMapId(e.target.value)} style={{ ...veld, width: "100%" }}>
            <option value="">— kies bron-map —</option>
            {Object.values(mappen).map((m) => (
              <option key={m.id} value={m.id}>{m.naam}</option>
            ))}
          </select>
        )}
        {bronMapId && richting !== "import" && (
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--s-fg-muted)" }}>
            Profielen in {bronMapNaam}: {bronProfielen.length ? bronProfielen.map((pid) => getProfieltype(pid)?.label || pid).join(", ") : "— (nog leeg)"}
          </p>
        )}

        {/* 3. Doel */}
        <div style={kopje}>Doel</div>
        {richting === "export" ? (
          <div style={{ fontSize: 13, color: "var(--s-fg-muted)" }}>
            bestand (download)
            <label style={{ display: "block", marginTop: 4, fontSize: 12 }}>
              <input type="radio" disabled /> API (binnenkort)
            </label>
          </div>
        ) : (
          <DoelMapKiezer mappen={mappen} doelMapId={doelMapId} setDoelMapId={setDoelMapId} nieuweNaam={doelNieuweNaam} setNieuweNaam={setDoelNieuweNaam} />
        )}

        {/* Generator */}
        <div style={kopje}>Transformatie</div>
        {generatoren.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--s-fg-muted)", fontStyle: "italic" }}>
            Nog geen {ACTIES.find((a) => a.id === richting)?.label.toLowerCase()}-transformatie aangesloten
            {richting !== "import" && bronMapId ? " voor deze profielen" : ""}.
          </p>
        ) : (
          generatoren.map((g) => (
            <label key={g.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "4px 0", fontSize: 13, cursor: "pointer" }}>
              <input type="radio" name="gen" checked={generatorId === g.id} onChange={() => setGeneratorId(g.id)} style={{ marginTop: 3 }} />
              <span>
                {g.label}
                {g.toelichting && <span style={{ display: "block", fontSize: 11, color: "var(--s-fg-muted)" }}>{g.toelichting}</span>}
              </span>
            </label>
          ))
        )}

        {gekozen?.opties?.length > 0 && (
          <>
            <div style={kopje}>Opties</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {gekozen.opties.map((optie) => {
                const waarde = optieWaarden[optie.key];
                if (optie.datatype === "boolean") {
                  return (
                    <label key={optie.key} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={!!waarde}
                        onChange={(e) => setOptieWaarden((huidig) => ({ ...huidig, [optie.key]: e.target.checked }))}
                      />
                      {optie.label}
                    </label>
                  );
                }
                return (
                  <label key={optie.key} style={{ display: "grid", gridTemplateColumns: "minmax(130px, 1fr) 2fr", gap: 8, alignItems: "center", fontSize: 13 }}>
                    <span>{optie.label}</span>
                    <input
                      type={optie.datatype === "number" ? "number" : "text"}
                      value={waarde ?? ""}
                      onChange={(e) => setOptieWaarden((huidig) => ({
                        ...huidig,
                        [optie.key]: optie.datatype === "number" ? Number(e.target.value) : e.target.value,
                      }))}
                      style={{ ...veld, width: "100%" }}
                    />
                  </label>
                );
              })}
            </div>
          </>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
          <button type="button" onClick={uitvoeren} disabled={!kanUitvoeren || bezig} style={{ ...knop, fontWeight: 600, opacity: !kanUitvoeren || bezig ? 0.5 : 1, cursor: !kanUitvoeren || bezig ? "default" : "pointer" }}>
            {bezig ? "Bezig…" : "Uitvoeren"}
          </button>
          {resultaat?.summary && (
            <span style={{ fontSize: 12, color: resultaat.status === "error" ? "#ef4444" : resultaat.status === "warning" ? "#f59e0b" : "#22c55e" }}>
              {resultaat.summary}
            </span>
          )}
        </div>
        {resultaat?.diagnostics?.length > 0 && (
          <details open={resultaat.status === "error"} style={{ marginTop: 10, fontSize: 12 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>
              Meldingen ({resultaat.diagnostics.length})
            </summary>
            {/* Identieke meldingen gebundeld ("8× — …", bronnen uitklapbaar).
                Weergave-only: de diagnostics in het resultaat blijven los. */}
            <ul style={{ margin: "6px 0 0", paddingLeft: 20, maxHeight: 220, overflow: "auto" }}>
              {bundelDiagnostics(resultaat.diagnostics).map((bundel, index) =>
                bundel.items.length === 1 ? (
                  <li key={`${bundel.code || "melding"}-${index}`} style={{ marginBottom: 4 }}>
                    <strong>{bundel.severity}{bundel.code ? ` · ${bundel.code}` : ""}</strong>
                    {bundel.items[0].sourceId ? ` · ${bundel.items[0].sourceId}` : ""}
                    {bundel.items[0].path ? ` · ${bundel.items[0].path}` : ""}
                    {`: ${bundel.message}`}
                  </li>
                ) : (
                  <li key={`${bundel.code || "melding"}-${index}`} style={{ marginBottom: 4 }}>
                    <strong>{bundel.severity}{bundel.code ? ` · ${bundel.code}` : ""}</strong>
                    {` · ${bundel.items.length}× — ${bundel.message}`}
                    <details style={{ marginTop: 2 }}>
                      <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--s-fg-muted, #64748b)" }}>
                        {bundel.items.length} bronnen
                      </summary>
                      <ul style={{ margin: "2px 0 0", paddingLeft: 16 }}>
                        {bundel.items.map((item, i) => (
                          <li key={i} style={{ fontSize: 11 }}>
                            {item.sourceId || "(zonder bron-id)"}
                            {item.path ? ` · ${item.path}` : ""}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                )
              )}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
