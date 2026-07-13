/**
 * TransformatiePaneel — het generieke transformeer-scherm (modal).
 *
 * Opent vanuit rechtsklik op een map ("Transformeren…") of het Transformeren-
 * menu. Kies richting (import/export/transform), een aangesloten generator, en
 * de bron/doel — en voer uit. Zie transformatieRegistry.js voor het contract
 * en transformaties.js voor de ingebouwde generatoren.
 */
import React from "react";
import { create } from "zustand";
import { useModellerenStore } from "./modellerenActivity.jsx";
import { getTransformaties } from "./transformatieRegistry.js";
import { mapProfielen } from "./transformaties.js";
import { getProfieltype } from "../profieltypeRegistry";

export const useTransformStore = create((set) => ({
  open: false,
  mapId: null,
  openen: (mapId) => set({ open: true, mapId: mapId || null }),
  sluiten: () => set({ open: false }),
}));

const RICHTINGEN = [
  { id: "import", label: "Importeren", uitleg: "van buiten (bestand/API) naar deze map" },
  { id: "export", label: "Exporteren", uitleg: "van deze map naar buiten (bestand/API)" },
  { id: "transform", label: "Transformeren", uitleg: "van deze map naar een (andere) map" },
];

const veld = { font: "inherit", fontSize: 13, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--s-border)", background: "var(--s-panel)", color: "var(--s-fg)" };
const knop = { font: "inherit", fontSize: 13, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--s-border)", background: "var(--s-panel-head)", color: "var(--s-fg)", cursor: "pointer" };

export default function TransformatiePaneel() {
  const open = useTransformStore((s) => s.open);
  const mapId = useTransformStore((s) => s.mapId);
  const sluiten = useTransformStore((s) => s.sluiten);
  const mappen = useModellerenStore((s) => s.mappen);

  const [gekozenMap, setGekozenMap] = React.useState(mapId);
  const [richting, setRichting] = React.useState("export");
  const [generatorId, setGeneratorId] = React.useState(null);
  const [bestandTekst, setBestandTekst] = React.useState(null);
  const [bestandNaam, setBestandNaam] = React.useState(null);
  const [doelMode, setDoelMode] = React.useState("nieuw");
  const [doelMapId, setDoelMapId] = React.useState("");
  const [nieuweMapNaam, setNieuweMapNaam] = React.useState("");
  const [bezig, setBezig] = React.useState(false);
  const [klaar, setKlaar] = React.useState(null);

  React.useEffect(() => {
    if (open) {
      setGekozenMap(mapId);
      setGeneratorId(null);
      setBestandTekst(null);
      setBestandNaam(null);
      setKlaar(null);
    }
  }, [open, mapId]);

  if (!open) return null;

  const actieveMap = gekozenMap || null;
  const mapNaam = actieveMap ? mappen[actieveMap]?.naam : null;
  const profielen = actieveMap ? mapProfielen(actieveMap) : [];
  const generatoren = getTransformaties(richting, profielen.length ? profielen : null);
  const gekozen = generatoren.find((g) => g.id === generatorId) || null;
  const doelMappen = Object.values(mappen).filter((m) => m.id !== actieveMap);

  const kiesBestand = () => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".json,application/json,.yaml,.yml,.xml,text/*";
    inp.onchange = () => {
      const f = inp.files?.[0];
      if (!f) return;
      f.text().then((t) => {
        setBestandTekst(t);
        setBestandNaam(f.name);
      });
    };
    inp.click();
  };

  const kanUitvoeren =
    actieveMap &&
    gekozen &&
    (richting !== "import" || bestandTekst) &&
    (richting !== "transform" || (doelMode === "nieuw" ? nieuweMapNaam.trim() : doelMapId));

  const uitvoeren = async () => {
    if (!kanUitvoeren) return;
    setBezig(true);
    setKlaar(null);
    try {
      const context = { mapId: actieveMap, mapNaam, richting, profielen };
      if (richting === "import") context.bron = { type: "file", tekst: bestandTekst, naam: bestandNaam };
      if (richting === "transform") {
        context.doel = doelMode === "nieuw" ? { type: "nieuweMap", naam: nieuweMapNaam.trim() } : { type: "map", mapId: doelMapId };
      }
      await gekozen.run(context);
      setKlaar("Gelukt.");
    } catch (e) {
      setKlaar(`Mislukt: ${String(e).slice(0, 200)}`);
    } finally {
      setBezig(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 260, background: "rgba(0,0,0,0.35)", display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: "8vh" }}
      onMouseDown={sluiten}
    >
      <div
        style={{ width: "min(620px, 92vw)", maxHeight: "80vh", overflow: "auto", background: "var(--s-panel)", color: "var(--s-fg)", border: "1px solid var(--s-border)", borderRadius: 10, boxShadow: "0 16px 48px rgba(0,0,0,0.4)", padding: 16 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Transformeren</h2>
          <button type="button" onClick={sluiten} style={{ ...knop, padding: "2px 8px" }}>×</button>
        </div>

        {/* Map-keuze (indien niet vooraf gekozen) + inhoud */}
        <label style={{ display: "block", fontSize: 12, color: "var(--s-fg-muted)", marginBottom: 8 }}>
          Map
          <select value={actieveMap || ""} onChange={(e) => setGekozenMap(e.target.value || null)} style={{ ...veld, display: "block", width: "100%", marginTop: 3 }}>
            <option value="">— kies een map —</option>
            {Object.values(mappen).map((m) => (
              <option key={m.id} value={m.id}>{m.naam}</option>
            ))}
          </select>
        </label>
        {actieveMap && (
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--s-fg-muted)" }}>
            Profielen in deze map: {profielen.length ? profielen.map((pid) => getProfieltype(pid)?.label || pid).join(", ") : "— (nog leeg)"}
          </p>
        )}

        {/* Richting */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {RICHTINGEN.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => { setRichting(r.id); setGeneratorId(null); setKlaar(null); }}
              title={r.uitleg}
              style={{ ...knop, flex: 1, fontWeight: richting === r.id ? 700 : 400, borderColor: richting === r.id ? "var(--s-accent, #4f46e5)" : "var(--s-border)", background: richting === r.id ? "var(--s-hover)" : "var(--s-panel-head)" }}
            >
              {r.label}
            </button>
          ))}
        </div>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--s-fg-muted)" }}>
          {RICHTINGEN.find((r) => r.id === richting).uitleg}.
        </p>

        {/* Generator-keuze */}
        <div style={{ marginBottom: 10 }}>
          {generatoren.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--s-fg-muted)", fontStyle: "italic" }}>
              Nog geen {richting}-transformatie aangesloten voor deze profielen.
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
        </div>

        {/* Bron/doel per richting */}
        {gekozen && richting === "import" && (
          <div style={{ marginBottom: 10, fontSize: 13 }}>
            <button type="button" style={knop} onClick={kiesBestand}>Kies bestand…</button>
            {bestandNaam && <span style={{ marginLeft: 8, color: "var(--s-fg-muted)" }}>{bestandNaam}</span>}
            <span style={{ display: "block", fontSize: 12, color: "var(--s-fg-muted)", marginTop: 4 }}>Doel: deze map ({mapNaam}).</span>
          </div>
        )}
        {gekozen && richting === "export" && (
          <p style={{ marginBottom: 10, fontSize: 12, color: "var(--s-fg-muted)" }}>Bron: deze map ({mapNaam}). Doel: bestand (download).</p>
        )}
        {gekozen && richting === "transform" && (
          <div style={{ marginBottom: 10, fontSize: 13 }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
              <label style={{ cursor: "pointer" }}><input type="radio" checked={doelMode === "nieuw"} onChange={() => setDoelMode("nieuw")} /> nieuwe map</label>
              <label style={{ cursor: "pointer" }}><input type="radio" checked={doelMode === "bestaand"} onChange={() => setDoelMode("bestaand")} /> bestaande map</label>
            </div>
            {doelMode === "nieuw" ? (
              <input value={nieuweMapNaam} onChange={(e) => setNieuweMapNaam(e.target.value)} placeholder="naam van de nieuwe map" style={{ ...veld, width: "100%" }} />
            ) : (
              <select value={doelMapId} onChange={(e) => setDoelMapId(e.target.value)} style={{ ...veld, width: "100%" }}>
                <option value="">— kies doelmap —</option>
                {doelMappen.map((m) => (
                  <option key={m.id} value={m.id}>{m.naam}</option>
                ))}
              </select>
            )}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
          <button type="button" onClick={uitvoeren} disabled={!kanUitvoeren || bezig} style={{ ...knop, fontWeight: 600, opacity: !kanUitvoeren || bezig ? 0.5 : 1, cursor: !kanUitvoeren || bezig ? "default" : "pointer" }}>
            {bezig ? "Bezig…" : "Uitvoeren"}
          </button>
          {klaar && <span style={{ fontSize: 12, color: klaar.startsWith("Mislukt") ? "#ef4444" : "#22c55e" }}>{klaar}</span>}
        </div>
      </div>
    </div>
  );
}
