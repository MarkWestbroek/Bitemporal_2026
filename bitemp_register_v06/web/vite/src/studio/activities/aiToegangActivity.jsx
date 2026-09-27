/**
 * aiToegangActivity — "AI-toegang": toegangscodes uitgeven en intrekken voor de AI-proxy
 * (handlers/ai_proxy.go, docs/AI_ASSISTENT.md). Een code laat iemand de AI-assistent proberen
 * met de sleutel van de eigenaar, voor beperkte tijd en met daglimieten. Alleen voor admins
 * (de API controleert dat; zonder rechten toont de lijst een melding).
 *
 * De code zelf is alleen direct na het aanmaken zichtbaar; de server bewaart alleen een hash.
 */
import React, { useCallback, useEffect, useState } from "react";
import { IconAI } from "../icons";
import { apiBase } from "../studioUtils";

async function api(pad, opties = {}) {
  const res = await fetch(`${apiBase()}${pad}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opties });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
  return d;
}

const datum = (iso) => (iso ? new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }) : "—");

function Main() {
  const [lijst, setLijst] = useState(null); // { codes, proxyIngesteld }
  const [fout, setFout] = useState("");
  const [nieuw, setNieuw] = useState({ naam: "", dagen: 14, perDag: 100, maxTokensPerDag: 200000 });
  const [uitgegeven, setUitgegeven] = useState(null); // { naam, code, verloopt }
  const [gekopieerd, setGekopieerd] = useState(false);

  const laad = useCallback(() => {
    api("/api/ai/codes").then((d) => { setLijst(d); setFout(""); }).catch((e) => setFout(`Lijst laden mislukt: ${e.message}`));
  }, []);
  useEffect(laad, [laad]);

  async function maak(e) {
    e.preventDefault();
    setFout(""); setGekopieerd(false);
    try {
      const d = await api("/api/ai/codes", { method: "POST", body: JSON.stringify({ ...nieuw, dagen: Number(nieuw.dagen), perDag: Number(nieuw.perDag), maxTokensPerDag: Number(nieuw.maxTokensPerDag) }) });
      setUitgegeven(d);
      setNieuw((n) => ({ ...n, naam: "" }));
      laad();
    } catch (err) {
      setFout(err.message);
    }
  }
  async function trekIn(naam) {
    if (!window.confirm(`Code van “${naam}” intrekken? Die werkt dan meteen niet meer.`)) return;
    try {
      await api(`/api/ai/codes/${encodeURIComponent(naam)}`, { method: "DELETE" });
      laad();
    } catch (err) {
      setFout(err.message);
    }
  }

  const veld = { display: "grid", gap: 2, fontSize: 12 };
  const invoer = { padding: "4px 6px", border: "1px solid var(--s-border, #cbd5e1)", borderRadius: 6, background: "var(--s-bg, #fff)", color: "inherit" };
  const nu = Date.now();

  return (
    <div style={{ padding: 16, maxWidth: 900, overflow: "auto" }}>
      <h2 style={{ margin: "0 0 4px" }}>AI-toegang</h2>
      <p style={{ margin: "0 0 12px", color: "var(--s-fg-muted, #64748b)", fontSize: 13 }}>
        Toegangscodes voor de AI-assistent via deze server, met de sleutel van de eigenaar. Tijdelijk, met daglimieten, en
        direct in te trekken. Wie een eigen sleutel heeft, heeft geen code nodig.
      </p>
      {lijst && !lijst.proxyIngesteld && (
        <p role="status" style={{ padding: "6px 10px", borderRadius: 6, background: "#fef3c7", color: "#92400e", fontSize: 13 }}>
          De proxy staat op deze server uit: zet <code>AI_UPSTREAM_KEY</code> in de <code>.env</code>. Codes kun je al wel uitgeven.
        </p>
      )}

      <form onSubmit={maak} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", padding: 10, border: "1px solid var(--s-border, #e2e8f0)", borderRadius: 8 }}>
        <label style={{ ...veld, flex: "1 1 180px" }}>Voor wie (naam)
          <input style={invoer} value={nieuw.naam} onChange={(e) => setNieuw({ ...nieuw, naam: e.target.value })} placeholder="bv. Collega X" required />
        </label>
        <label style={veld}>Geldig (dagen)
          <input style={{ ...invoer, width: 80 }} type="number" min={1} value={nieuw.dagen} onChange={(e) => setNieuw({ ...nieuw, dagen: e.target.value })} />
        </label>
        <label style={veld}>Aanroepen per dag
          <input style={{ ...invoer, width: 100 }} type="number" min={1} value={nieuw.perDag} onChange={(e) => setNieuw({ ...nieuw, perDag: e.target.value })} />
        </label>
        <label style={veld}>Tokens per dag (0 = geen limiet)
          <input style={{ ...invoer, width: 130 }} type="number" min={0} step={1000} value={nieuw.maxTokensPerDag} onChange={(e) => setNieuw({ ...nieuw, maxTokensPerDag: e.target.value })} />
        </label>
        <button type="submit" className="studio-btn studio-btn--primary">Code maken</button>
      </form>

      {uitgegeven && (
        <div role="status" style={{ marginTop: 12, padding: 10, borderRadius: 8, border: "1px solid #86efac", background: "#f0fdf4", color: "#14532d" }}>
          <div style={{ fontSize: 13 }}>Code voor <strong>{uitgegeven.naam}</strong>, geldig tot {datum(uitgegeven.verloopt)}. <strong>Alleen nu zichtbaar</strong> — kopieer hem en geef hem door:</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
            <code style={{ fontSize: 15, padding: "4px 8px", background: "#fff", border: "1px solid #bbf7d0", borderRadius: 6 }}>{uitgegeven.code}</code>
            <button type="button" className="studio-btn" onClick={() => navigator.clipboard?.writeText(uitgegeven.code).then(() => setGekopieerd(true))}>
              {gekopieerd ? "Gekopieerd ✓" : "Kopiëren"}
            </button>
            <button type="button" className="studio-btn" onClick={() => setUitgegeven(null)}>Klaar</button>
          </div>
          <div style={{ fontSize: 12, marginTop: 6 }}>In de assistent: ✨ → ⚙ → <em>Omnium-server (toegangscode)</em>.</div>
        </div>
      )}

      {fout && <p role="alert" style={{ color: "#b91c1c", fontSize: 13 }}>{fout}</p>}

      <table style={{ width: "100%", marginTop: 14, borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--s-border, #e2e8f0)" }}>
            <th style={{ padding: 6 }}>Naam</th><th>Code</th><th>Status</th><th>Geldig tot</th><th>Vandaag</th><th />
          </tr>
        </thead>
        <tbody>
          {(lijst?.codes || []).length === 0 && <tr><td colSpan={6} style={{ padding: 8, color: "var(--s-fg-muted, #64748b)" }}>Nog geen codes.</td></tr>}
          {(lijst?.codes || []).map((c) => {
            const verlopen = c.verloopt && new Date(c.verloopt).getTime() < nu;
            const status = !c.actief ? "ingetrokken" : verlopen ? "verlopen" : "actief";
            return (
              <tr key={`${c.naam}-${c.prefix}`} style={{ borderBottom: "1px solid var(--s-border, #f1f5f9)", opacity: status === "actief" ? 1 : 0.6 }}>
                <td style={{ padding: 6 }}>{c.naam}</td>
                <td><code>{c.prefix}…</code></td>
                <td>{status}</td>
                <td>{datum(c.verloopt)}</td>
                <td>{c.vandaag?.aanroepen ?? 0}/{c.perDag} aanroepen{c.maxTokensPerDag ? `, ${c.vandaag?.tokens ?? 0}/${c.maxTokensPerDag} tokens` : ""}</td>
                <td style={{ textAlign: "right" }}>
                  {status === "actief" && <button type="button" className="studio-btn" onClick={() => trekIn(c.naam)}>Intrekken</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Sidebar() {
  return (
    <div style={{ padding: 10, fontSize: 12, color: "var(--s-fg-muted, #64748b)" }}>
      <p style={{ marginTop: 0 }}>De AI-assistent (vorm <code>ai-assist</code>) werkt met een eigen sleutel of met een toegangscode van deze server.</p>
      <p>Naar de dienst gaan alleen de tekst van het veld, de opdracht en de naam van het veld. Op het openbare aanmeldformulier staat AI uit.</p>
      <p>Zie <code>docs/AI_ASSISTENT.md</code>.</p>
    </div>
  );
}

function Inspector() {
  return (
    <div style={{ padding: 10, fontSize: 12, color: "var(--s-fg-muted, #64748b)" }}>
      Een code verloopt vanzelf; intrekken werkt meteen. Er wordt pas geteld na een geslaagde aanroep.
    </div>
  );
}

export default {
  id: "ai-toegang",
  label: "AI-toegang",
  icon: <IconAI />,
  groep: "beheer",
  Sidebar,
  Main,
  Inspector,
  sidebarLabel: "Over AI",
  inspectorLabel: "Codes",
};
