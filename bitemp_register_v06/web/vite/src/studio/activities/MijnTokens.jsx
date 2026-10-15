/**
 * MijnTokens — persoonlijke API-tokens (AI-1, 14-10-2026), voor de Omnium-MCP-server
 * (tools/omnium-mcp) of een script. Een token werkt als jij: dezelfde rol en rechten. Je ziet het
 * één keer; daarna alleen het begin, om het te herkennen. Intrekken kan altijd.
 * API: GET/POST /api/auth/tokens, DELETE /api/auth/tokens/:id (gebruikers/token.go).
 */
import React, { useCallback, useEffect, useState } from "react";
import { apiBase } from "../studioUtils";
import { vraagBevestiging } from "../naamDialog.jsx";

async function api(pad, opties = {}) {
  const res = await fetch(`${apiBase()}${pad}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opties });
  if (res.status === 204) return null;
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
  return d;
}

const datum = (iso) => (iso ? new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }) : "—");
const invoer = { padding: "4px 6px", border: "1px solid var(--s-border, #cbd5e1)", borderRadius: 6, background: "var(--s-bg, #fff)", color: "inherit" };
const gedempt = { color: "var(--s-fg-muted, #64748b)" };

export default function MijnTokens() {
  const [lijst, setLijst] = useState(null);
  const [naam, setNaam] = useState("MCP in VS Code");
  const [dagen, setDagen] = useState(90);
  const [nieuw, setNieuw] = useState(null); // {token, naam}
  const [gekopieerd, setGekopieerd] = useState(false);
  const [fout, setFout] = useState("");

  const laad = useCallback(() => {
    api("/api/auth/tokens").then(setLijst).catch((e) => { setLijst(null); setFout(e.message); });
  }, []);
  useEffect(laad, [laad]);

  async function maak(e) {
    e.preventDefault();
    setFout("");
    try {
      const d = await api("/api/auth/tokens", { method: "POST", body: JSON.stringify({ naam: naam.trim(), dagen: Number(dagen) || 90 }) });
      setNieuw(d);
      setGekopieerd(false);
      laad();
    } catch (err) {
      setFout(err.message);
    }
  }

  async function trekIn(t) {
    if (!(await vraagBevestiging({ titel: "Token intrekken", tekst: `Token "${t.naam}" intrekken? Wat het gebruikt, werkt daarna niet meer.`, bevestig: "Intrekken", gevaar: true }))) return;
    try { await api(`/api/auth/tokens/${t.id}`, { method: "DELETE" }); } catch (err) { setFout(err.message); }
    laad();
  }

  if (lijst === null && !fout) return null;
  const actief = (lijst || []).filter((t) => !t.ingetrokken_op);
  return (
    <section data-testid="mijn-tokens" style={{ padding: 10, border: "1px solid var(--s-border, #e2e8f0)", borderRadius: 8, marginTop: 14, fontSize: 13 }}>
      <div style={{ marginBottom: 6 }}>
        <strong>Mijn API-tokens</strong> — voor de Omnium-MCP-server (AI in VS Code) of een script. Een token werkt als jij,
        met jouw rol en rechten. Voor de ✨ assistent in de Studio heb je géén token nodig, maar een
        toegangscode (om-…) van de beheerder (activiteit <em>AI-toegang</em>); een token (omt_…) werkt daar niet.
      </div>
      <form onSubmit={maak} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ display: "grid", gap: 2, fontSize: 12, flex: "1 1 200px" }}>Waarvoor
          <input style={invoer} value={naam} onChange={(e) => setNaam(e.target.value)} maxLength={100} />
        </label>
        <label style={{ display: "grid", gap: 2, fontSize: 12, width: 90 }}>Dagen geldig
          <input style={invoer} type="number" min={1} max={365} value={dagen} onChange={(e) => setDagen(e.target.value)} />
        </label>
        <button type="submit" className="studio-btn studio-btn--primary">Token maken</button>
      </form>
      {fout && <p role="alert" style={{ color: "#b91c1c", margin: "6px 0 0" }}>{fout}</p>}
      {nieuw && (
        <div role="status" style={{ marginTop: 10, padding: 10, borderRadius: 8, border: "1px solid #86efac", background: "#f0fdf4", color: "#14532d" }}>
          Token voor <strong>{nieuw.naam}</strong>. <strong>Alleen nu zichtbaar</strong> — bewaar het als omgevingsvariabele
          <code> OMNIUM_TOKEN</code> (zie <code>tools/omnium-mcp/README.md</code>):
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
            <code data-testid="nieuw-token" style={{ flex: 1, fontSize: 12, padding: "4px 8px", background: "#fff", border: "1px solid #bbf7d0", borderRadius: 6, overflowWrap: "anywhere" }}>{nieuw.token}</code>
            <button type="button" className="studio-btn" onClick={() => navigator.clipboard?.writeText(nieuw.token).then(() => setGekopieerd(true))}>{gekopieerd ? "Gekopieerd ✓" : "Kopiëren"}</button>
            <button type="button" className="studio-btn" onClick={() => setNieuw(null)}>Klaar</button>
          </div>
        </div>
      )}
      {actief.length > 0 && (
        <table style={{ width: "100%", marginTop: 10, borderCollapse: "collapse", fontSize: 12 }}>
          <tbody>
            {actief.map((t) => (
              <tr key={t.id} style={{ borderTop: "1px solid var(--s-border, #f1f5f9)" }}>
                <td style={{ padding: 4 }}><strong>{t.naam}</strong> <span style={gedempt}><code>{t.begin}…</code></span></td>
                <td style={{ padding: 4, ...gedempt }}>gemaakt {datum(t.aangemaakt)}</td>
                <td style={{ padding: 4, ...gedempt }}>geldig tot {datum(t.verloopt)}</td>
                <td style={{ padding: 4, ...gedempt }}>{t.laatst_gebruikt ? `gebruikt ${datum(t.laatst_gebruikt)}` : "nog niet gebruikt"}</td>
                <td style={{ padding: 4, textAlign: "right" }}><button type="button" className="studio-btn" onClick={() => trekIn(t)}>Intrekken</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
