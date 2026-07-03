/**
 * diagram05ApiDialogen — fase 4B: laden vanaf en publiceren naar de Go-API
 * voor de 0.5-sandbox (zelfde endpoints als de oude IDE):
 *
 *   GET  /api/schema/versies      → versielijst
 *   GET  /api/schema/model        → actieve model (V3)
 *   GET  /api/schema/model/{id}   → specifieke versie
 *   POST /api/schema/model?opmerking=… → nieuwe versie publiceren
 *
 * Luistert zelf op de menuBus ("d05:api-laden" / "d05:api-publiceer") zodat
 * de activiteit alleen dit component hoeft te renderen; de V3-vertaling loopt
 * via serialisatie.js (exporteerV3/importeerV3 — incl. default-diagram-fix).
 */
import { useCallback, useEffect, useState } from "react";
import { menuBus } from "../menuBus";
import { apiBase } from "../../shared/apiBase.js";
import { exporteerV3, importeerV3 } from "../../diagramprofielen/canoniek-uml/serialisatie.js";

const OVERLAY = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 10000,
};
const DIALOOG = {
  background: "var(--s-panel, #fff)",
  color: "var(--s-fg, #1e293b)",
  border: "1px solid var(--s-border, #cbd5e1)",
  borderRadius: 10,
  boxShadow: "0 12px 40px rgba(15, 23, 42, 0.25)",
  width: 460,
  maxWidth: "92vw",
  maxHeight: "82vh",
  display: "flex",
  flexDirection: "column",
  fontSize: 13,
};
const KOP = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 14px",
  borderBottom: "1px solid var(--s-border, #e2e8f0)",
  fontWeight: 600,
};
const BODY = { padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8, overflow: "auto" };
const VOET = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  padding: "10px 14px",
  borderTop: "1px solid var(--s-border, #e2e8f0)",
};
const KNOP = {
  font: "inherit",
  fontSize: 12,
  padding: "5px 12px",
  border: "1px solid var(--s-border, #cbd5e1)",
  borderRadius: 6,
  background: "var(--s-panel, #fff)",
  color: "var(--s-fg, #1e293b)",
  cursor: "pointer",
};
const KNOP_PRIMAIR = {
  ...KNOP,
  background: "var(--s-accent, #6366f1)",
  borderColor: "var(--s-accent, #6366f1)",
  color: "#fff",
};
const INPUT = {
  font: "inherit",
  fontSize: 12,
  padding: "5px 8px",
  border: "1px solid var(--s-border, #cbd5e1)",
  borderRadius: 6,
  background: "var(--s-panel, #fff)",
  color: "var(--s-fg, #1e293b)",
  width: "100%",
  boxSizing: "border-box",
};
const LABEL = { fontSize: 11, color: "var(--s-fg-muted, #64748b)" };

function Veld({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={LABEL}>{label}</span>
      {children}
    </label>
  );
}

/** Laden vanaf de API: actieve model of een specifieke versie. */
function LadenDialoog({ store, onSluit, onGeladen }) {
  const [versies, setVersies] = useState(null); // null = bezig
  const [keuze, setKeuze] = useState("actief");
  const [fout, setFout] = useState(null);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    let actueel = true;
    fetch(`${apiBase()}/api/schema/versies`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((lijst) => actueel && setVersies([...(lijst || [])].sort((a, b) => b.id - a.id)))
      .catch((e) => actueel && setFout(`Versielijst ophalen mislukt: ${e.message}`));
    return () => {
      actueel = false;
    };
  }, []);

  const laad = useCallback(async () => {
    setBezig(true);
    setFout(null);
    try {
      const url =
        keuze === "actief"
          ? `${apiBase()}/api/schema/model`
          : `${apiBase()}/api/schema/model/${keuze}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const v3 = await resp.json();

      const s = store.getState();
      if (Object.keys(s.elements).length > 0) {
        const ok = window.confirm(
          "Laden vervangt de hele 0.5-sandbox door het gekozen model.\nJe lokale wijzigingen gaan verloren. Doorgaan?"
        );
        if (!ok) {
          setBezig(false);
          return;
        }
      }
      s.laadModel(importeerV3(v3));
      store.temporal.getState().clear();
      onGeladen?.();
      onSluit();
    } catch (e) {
      setFout(`Laden mislukt: ${e.message}`);
    } finally {
      setBezig(false);
    }
  }, [keuze, store, onGeladen, onSluit]);

  return (
    <div style={DIALOOG}>
      <div style={KOP}>
        <span>Laden vanaf API</span>
        <button style={{ ...KNOP, border: "none", padding: "0 4px" }} onClick={onSluit}>✕</button>
      </div>
      <div style={BODY}>
        <span style={LABEL}>{apiBase()}/api/schema</span>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="radio" checked={keuze === "actief"} onChange={() => setKeuze("actief")} />
          <span><strong>Actieve model</strong> (zoals het register hem gebruikt)</span>
        </label>
        {versies === null && !fout && <span style={LABEL}>Versies laden…</span>}
        {(versies || []).map((v) => (
          <label key={v.id} style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
            <input type="radio" checked={keuze === v.id} onChange={() => setKeuze(v.id)} />
            <span>
              <strong>#{v.id}</strong> {v.model_naam || "(naamloos)"} · v{v.model_versie || "?"}
              <span style={{ ...LABEL, display: "block" }}>
                {[v.indiener, v.opmerking?.split("\n")[0]].filter(Boolean).join(" — ")}
              </span>
            </span>
          </label>
        ))}
        {fout && <span style={{ color: "var(--s-danger, #dc2626)", fontSize: 12 }}>{fout}</span>}
      </div>
      <div style={VOET}>
        <button style={KNOP} onClick={onSluit}>Annuleren</button>
        <button style={KNOP_PRIMAIR} disabled={bezig} onClick={laad}>
          {bezig ? "Laden…" : "Laden"}
        </button>
      </div>
    </div>
  );
}

/** Publiceren naar de API: nieuwe schema-versie (niet automatisch actief). */
function PubliceerDialoog({ store, onSluit }) {
  const meta = store.getState().meta?.modelMeta || {};
  const [naam, setNaam] = useState(meta.naam || "Studio 0.5 export");
  const [versie, setVersie] = useState(meta.versie && meta.versie !== "v3" ? meta.versie : "1.0");
  const [indiener, setIndiener] = useState(
    () => localStorage.getItem("studio05-indiener") || "Studio 0.5"
  );
  const [opmerking, setOpmerking] = useState("");
  const [bezig, setBezig] = useState(false);
  const [resultaat, setResultaat] = useState(null);
  const [fout, setFout] = useState(null);

  const publiceer = useCallback(async () => {
    setBezig(true);
    setFout(null);
    try {
      const { v3, overgeslagen } = exporteerV3(store.getState());
      const body = {
        bron: "studio-0.5",
        indiener,
        model: { ...(v3.model || v3), versie, naam },
      };
      const query = opmerking ? `?opmerking=${encodeURIComponent(opmerking)}` : "";
      const resp = await fetch(`${apiBase()}/api/schema/model${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const tekst = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${tekst.slice(0, 200)}`);
      }
      const result = await resp.json();
      try {
        localStorage.setItem("studio05-indiener", indiener);
      } catch {
        /* niet kritisch */
      }
      setResultaat({ id: result.id, status: result.status, overgeslagen });
    } catch (e) {
      setFout(`Publiceren mislukt: ${e.message}`);
    } finally {
      setBezig(false);
    }
  }, [store, naam, versie, indiener, opmerking]);

  return (
    <div style={DIALOOG}>
      <div style={KOP}>
        <span>Publiceer naar API</span>
        <button style={{ ...KNOP, border: "none", padding: "0 4px" }} onClick={onSluit}>✕</button>
      </div>
      <div style={BODY}>
        <span style={LABEL}>
          POST {apiBase()}/api/schema/model — maakt een nieuwe versie aan; activeren blijft een
          aparte stap (zoals in de UML-IDE).
        </span>
        <Veld label="modelnaam">
          <input style={INPUT} value={naam} onChange={(e) => setNaam(e.target.value)} />
        </Veld>
        <div style={{ display: "flex", gap: 8 }}>
          <Veld label="versie">
            <input style={INPUT} value={versie} onChange={(e) => setVersie(e.target.value)} />
          </Veld>
          <Veld label="indiener">
            <input style={INPUT} value={indiener} onChange={(e) => setIndiener(e.target.value)} />
          </Veld>
        </div>
        <Veld label="opmerking">
          <textarea
            style={{ ...INPUT, minHeight: 56, resize: "vertical" }}
            value={opmerking}
            onChange={(e) => setOpmerking(e.target.value)}
          />
        </Veld>
        {resultaat && (
          <span style={{ color: "var(--s-success, #16a34a)", fontSize: 12 }}>
            Gepubliceerd ✓ — versie #{resultaat.id}
            {resultaat.status ? ` (status: ${resultaat.status})` : ""}
            {resultaat.overgeslagen?.length
              ? ` · niet meegenomen: ${resultaat.overgeslagen.join(", ")}`
              : ""}
          </span>
        )}
        {fout && <span style={{ color: "var(--s-danger, #dc2626)", fontSize: 12 }}>{fout}</span>}
      </div>
      <div style={VOET}>
        <button style={KNOP} onClick={onSluit}>{resultaat ? "Sluiten" : "Annuleren"}</button>
        {!resultaat && (
          <button style={KNOP_PRIMAIR} disabled={bezig} onClick={publiceer}>
            {bezig ? "Publiceren…" : "Publiceer"}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Rendert de actieve API-dialoog; open te sturen via de menuBus:
 * "d05:api-laden" / "d05:api-publiceer".
 */
export default function ApiDialogen({ store, onGeladen }) {
  const [soort, setSoort] = useState(null);

  useEffect(() => {
    const af = [
      menuBus.on("d05:api-laden", () => setSoort("laden")),
      menuBus.on("d05:api-publiceer", () => setSoort("publiceer")),
    ];
    return () => af.forEach((off) => off());
  }, []);

  if (!soort) return null;
  const sluit = () => setSoort(null);
  return (
    <div style={OVERLAY} onClick={(e) => e.target === e.currentTarget && sluit()}>
      {soort === "laden" ? (
        <LadenDialoog store={store} onSluit={sluit} onGeladen={onGeladen} />
      ) : (
        <PubliceerDialoog store={store} onSluit={sluit} />
      )}
    </div>
  );
}
