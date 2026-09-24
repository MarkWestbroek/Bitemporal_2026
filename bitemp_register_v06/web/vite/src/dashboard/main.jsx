import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router";
import { AuthProvider } from "../context/AuthContext";
import AuthBeschermd from "../components/AuthBeschermd";
import GebruikerBadge from "../components/GebruikerBadge";
import { SchemaProvider, useSchema } from "../context/SchemaContext";
import { safeArray } from "../shared/schemaUtils";
import { voerDocumentUit, eersteLijst, resolveVeldpad } from "../publicatie/publicatieData";
import { isEmbedModus } from "../publicatie/embed";

import "@utrecht/component-library-css";
import "@utrecht/design-tokens/dist/index.css";
import "../styles/common-ground-theme.css";
import "../publicatie/embed.css";

/**
 * Dashboard — rendert een DashboardDefinitie (configuratiedomein): tegels die elk een
 * QueryDefinitie (opgeslagen document, `documentId`) uitvoeren en het resultaat tonen als
 * aantal, tabel of lijst. MVC (aanmeldformulier-plan §5.5): selectie = QueryDefinitie,
 * view = de tegelweergave, dashboard = compositie. Ontwerp: plan 2026-09-25 §3.
 *
 * URL: dashboard.html?dashboard=<naam>[&embed=1]. De pagina staat achter login (viewer):
 * dashboards zijn voor mensen die modereren; publieke QueryDefinities werken daarbinnen ook.
 * Ververst elke 60 s.
 */

const VERVERS_MS = 60_000;

function detectBaseUrl() {
  if (typeof window === "undefined") return "";
  const loc = window.location;
  if (["5173", "5174", "5175"].includes(loc.port)) return `${loc.protocol}//${loc.hostname}:8082`;
  return loc.origin;
}

/** Actueel record uit een GE-lijst van een /full-respons: laatst opgevoerde actieve hub. */
function actueleData(hubs) {
  let beste = null;
  let besteOpvoer = "";
  for (const hub of safeArray(hubs)) {
    if (!hub || hub.afvoer) continue;
    const d = safeArray(hub.data).find((x) => x?.opvoer && !x?.afvoer);
    if (!d) continue;
    const opvoer = String(hub.opvoer || d.opvoer || "");
    if (!beste || opvoer > besteOpvoer) { beste = d; besteOpvoer = opvoer; }
  }
  return beste;
}

/** Alle actieve records van een meervoudig GE. */
function actieveData(hubs) {
  return safeArray(hubs).filter((h) => h && !h.afvoer).map((h) => safeArray(h.data).find((x) => x?.opvoer && !x?.afvoer)).filter(Boolean);
}

function useDashboard(naam) {
  const { baseUrl } = useSchema();
  const [state, setState] = useState({ laden: true, fout: null, dashboard: null });
  useEffect(() => {
    if (!baseUrl || !naam) return;
    let cancelled = false;
    fetch(`${baseUrl}/full/dashboard_definities`, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((json) => {
        if (cancelled) return;
        const lijst = safeArray(json?.["dashboard definities"]);
        const gevonden = lijst.map((full) => {
          if (!full || full.afvoer) return null;
          const n = actueleData(full.dashboard_definitie_namen);
          const st = actueleData(full.dashboard_definitie_statussen);
          if (!n || n.naam !== naam || st?.status !== "actief") return null;
          const tegels = actieveData(full.dashboard_definitie_tegels)
            .map((t) => ({ ...t, variabelen: parseVariabelen(t.variabelen), kolommen: String(t.kolommen || "").split(",").map((k) => k.trim()).filter(Boolean) }))
            .sort((a, b) => (Number(a.volgorde) || 0) - (Number(b.volgorde) || 0));
          return { id: full.id, naam: n.naam, beschrijving: n.beschrijving, tegels };
        }).find(Boolean);
        setState({ laden: false, fout: gevonden ? null : `Dashboard "${naam}" bestaat niet of is niet actief.`, dashboard: gevonden || null });
      })
      .catch((e) => { if (!cancelled) setState({ laden: false, fout: String(e.message || e), dashboard: null }); });
    return () => { cancelled = true; };
  }, [baseUrl, naam]);
  return state;
}

function parseVariabelen(s) {
  if (!s) return {};
  try { const v = JSON.parse(s); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}

/** Padnaam van de doelentiteit uit de naam van het lijstveld (full_<padnaam>_list). */
function padnaamUit(data) {
  const key = Object.keys(data || {}).find((k) => Array.isArray(data[k]));
  const m = key && key.match(/^full_(.+)_list$/);
  return m ? m[1] : null;
}

function Tegel({ tegel, ronde }) {
  const { baseUrl, typeMetaByPadnaam, typeMetaByTypenaam } = useSchema();
  const [st, setSt] = useState({ laden: true, fout: null, rijen: [], padnaam: null });
  useEffect(() => {
    let cancelled = false;
    setSt((p) => ({ ...p, laden: true }));
    voerDocumentUit({ baseUrl, documentId: tegel.querydefinitie, variables: tegel.variabelen, fetchFn: (u, o) => fetch(u, { ...o, credentials: "include" }) })
      .then((data) => { if (!cancelled) setSt({ laden: false, fout: null, rijen: eersteLijst(data), padnaam: padnaamUit(data) }); })
      .catch((e) => { if (!cancelled) setSt({ laden: false, fout: String(e.message || e), rijen: [], padnaam: null }); });
    return () => { cancelled = true; };
  }, [baseUrl, tegel.querydefinitie, JSON.stringify(tegel.variabelen), ronde]); // eslint-disable-line react-hooks/exhaustive-deps

  const typeMeta = st.padnaam ? typeMetaByPadnaam?.[st.padnaam] : null;
  const detailLink = (rij) => (st.padnaam && rij?.id != null ? `${baseUrl}/viz/react/inhoud.html#/t/${st.padnaam}/${rij.id}` : null);
  const kolommen = useMemo(() => {
    if (tegel.kolommen.length > 0) return tegel.kolommen;
    const eerste = st.rijen[0] || {};
    return Object.keys(eerste).filter((k) => eerste[k] == null || typeof eerste[k] !== "object");
  }, [tegel.kolommen, st.rijen]);
  const waarde = (rij, pad) => {
    const v = typeMeta ? resolveVeldpad(rij, pad, typeMeta, typeMetaByTypenaam) : rij?.[pad];
    if (v == null) return "";
    return typeof v === "object" ? JSON.stringify(v) : String(v);
  };
  const kaart = { background: "var(--cg-wit, #fff)", border: "1px solid var(--cg-rand, #e2e8f0)", borderRadius: 8, padding: "1rem" };
  const kop = <h3 className="utrecht-heading-3" style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>{tegel.titel}</h3>;
  if (st.fout) return <section style={kaart}>{kop}<div className="cg-feedback--fout">{st.fout}</div></section>;

  if (tegel.weergave === "aantal") {
    return (
      <section style={{ ...kaart, minWidth: 200 }}>
        {kop}
        <div style={{ fontSize: "2.5rem", fontWeight: 700, lineHeight: 1 }}>{st.laden ? "…" : st.rijen.length}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--cg-donkergrijs, #666)", marginTop: "0.25rem" }}>{tegel.querydefinitie}</div>
      </section>
    );
  }
  if (tegel.weergave === "lijst") {
    return (
      <section style={{ ...kaart, gridColumn: "1 / -1" }}>
        {kop}
        {st.rijen.length === 0 && !st.laden && <div style={{ color: "var(--cg-donkergrijs, #666)" }}>Niets.</div>}
        <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
          {st.rijen.map((rij, i) => (
            <li key={rij.id ?? i}>{detailLink(rij) ? <a href={detailLink(rij)}>{rij.weergavenaam || rij.id}</a> : (rij.weergavenaam || rij.id)}</li>
          ))}
        </ul>
      </section>
    );
  }
  return (
    <section style={{ ...kaart, gridColumn: "1 / -1", overflowX: "auto" }}>
      {kop}
      {st.rijen.length === 0 && !st.laden && <div style={{ color: "var(--cg-donkergrijs, #666)" }}>Niets te tonen.</div>}
      {st.rijen.length > 0 && (
        <table className="utrecht-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead><tr>{kolommen.map((k) => <th key={k} style={{ textAlign: "left", padding: "0.375rem 0.5rem", borderBottom: "2px solid var(--cg-rand, #e2e8f0)" }}>{k.split(".").pop()}</th>)}</tr></thead>
          <tbody>
            {st.rijen.map((rij, i) => (
              <tr key={rij.id ?? i}>
                {kolommen.map((k, j) => (
                  <td key={k} style={{ padding: "0.375rem 0.5rem", borderBottom: "1px solid var(--cg-rand, #e2e8f0)" }}>
                    {j === 0 && detailLink(rij) ? <a href={detailLink(rij)}>{waarde(rij, k)}</a> : waarde(rij, k)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function DashboardPagina() {
  const naam = new URLSearchParams(window.location.search).get("dashboard") || "";
  const { loading, error } = useSchema();
  const { laden, fout, dashboard } = useDashboard(naam);
  const [ronde, setRonde] = useState(0);
  useEffect(() => { const t = setInterval(() => setRonde((r) => r + 1), VERVERS_MS); return () => clearInterval(t); }, []);
  if (!naam) return <div className="cg-feedback--fout" style={{ margin: "1.5rem" }}>Geen dashboard opgegeven (<code>?dashboard=&lt;naam&gt;</code>).</div>;
  if (loading || laden) return <div style={{ padding: "1.5rem" }}>Dashboard laden…</div>;
  if (error) return <div className="cg-feedback--fout" style={{ margin: "1.5rem" }}>Schema laden mislukt: {error}</div>;
  if (fout) return <div className="cg-feedback--fout" style={{ margin: "1.5rem" }}>{fout}</div>;
  return (
    <div style={{ padding: "1rem 1.5rem", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "1rem", flexWrap: "wrap" }}>
        <h1 className="utrecht-heading-1" style={{ margin: "0 0 0.25rem", textTransform: "capitalize" }}>{dashboard.naam}</h1>
        <button type="button" className="utrecht-button utrecht-button--subtle" style={{ fontSize: "0.8125rem" }} onClick={() => setRonde((r) => r + 1)}>Verversen</button>
      </div>
      {dashboard.beschrijving && <p style={{ color: "var(--cg-donkergrijs, #666)", marginTop: 0 }}>{dashboard.beschrijving}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" }}>
        {dashboard.tegels.map((t) => <Tegel key={t.rel_id ?? t.titel} tegel={t} ronde={ronde} />)}
      </div>
    </div>
  );
}

function App() {
  const isEmbed = isEmbedModus();
  return (
    <div className={isEmbed ? "common-ground-theme cg-embed" : "common-ground-theme"} style={{ minHeight: isEmbed ? undefined : "100vh", display: "flex", flexDirection: "column" }}>
      {!isEmbed && (
        <header className="cg-editor-nav" style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.5rem 1.5rem" }}>
          <strong>Dashboard</strong>
          <GebruikerBadge />
        </header>
      )}
      <main style={{ flex: 1 }}>
        <AuthBeschermd vereistRol="viewer">
          <DashboardPagina />
        </AuthBeschermd>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SchemaProvider baseUrl={detectBaseUrl()}>
      <AuthProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </AuthProvider>
    </SchemaProvider>
  </React.StrictMode>
);
