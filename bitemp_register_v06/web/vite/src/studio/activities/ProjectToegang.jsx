/**
 * ProjectToegang — wie mag dit project lezen of wijzigen (plan 2026-10-12 Gebruikers
 * uitnodigen §5: "alles dicht tenzij", rechten op niveau model). Zichtbaar voor de eigenaar
 * en beheerders, in "Van server ophalen…" onder het project.
 *
 * De eigenaar en beheerders mogen altijd alles; hier staan de overige rijen: een
 * gebruikersnaam of "*" (iedereen die is ingelogd) met lezen of schrijven. Schrijven vraagt
 * daarnaast minstens de rol modelleur. Opslaan vervangt alle rijen.
 */
import React, { useEffect, useState } from "react";
import { haalToegangOp, zetToegang, toegangVoorOpslaan } from "./projectSync.js";

const invoer = { font: "inherit", fontSize: 12, padding: "2px 6px", border: "1px solid var(--s-border, #cbd5e1)", borderRadius: 6, background: "var(--s-bg, transparent)", color: "inherit" };

export default function ProjectToegang({ project, knop, onKlaar }) {
  const [rijen, setRijen] = useState(null);
  const [eigenaar, setEigenaar] = useState("");
  const [fout, setFout] = useState("");
  const [bewaard, setBewaard] = useState(false);

  useEffect(() => {
    haalToegangOp(project.id)
      .then((d) => {
        setEigenaar(d?.eigenaar || "");
        setRijen((d?.toegang || []).map((r) => ({ subject: r.subject, recht: r.recht })));
      })
      .catch((e) => setFout(e?.message || String(e)));
  }, [project.id]);

  const zet = (i, deel) => { setBewaard(false); setRijen(rijen.map((r, j) => (j === i ? { ...r, ...deel } : r))); };
  const iedereen = rijen?.find((r) => r.subject === "*");

  async function opslaan() {
    setFout("");
    try {
      await zetToegang(project.id, toegangVoorOpslaan(rijen));
      setBewaard(true);
    } catch (e) {
      setFout(e?.message || String(e));
    }
  }

  return (
    <div data-testid="project-toegang" style={{ padding: "8px 10px", margin: "2px 0 8px", border: "1px solid var(--s-border, #e2e8f0)", borderRadius: 8, fontSize: 12 }}>
      <div style={{ marginBottom: 6, opacity: 0.85 }}>
        Toegang tot <strong>{project.naam}</strong>. Zonder rij ziet iemand dit project niet.
        {eigenaar ? <> Eigenaar <strong>{eigenaar}</strong> en beheerders mogen altijd alles.</> : <> Beheerders mogen altijd alles.</>}
      </div>
      {fout && <div role="alert" style={{ color: "var(--s-danger, #dc2626)", marginBottom: 6 }}>{fout}</div>}
      {rijen === null && !fout && <div style={{ opacity: 0.7 }}>Laden…</div>}
      {rijen && (
        <>
          {rijen.length === 0 && <div style={{ opacity: 0.7, marginBottom: 6 }}>Nog niemand anders.</div>}
          {rijen.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
              {r.subject === "*"
                ? <span style={{ flex: 1 }}>Iedereen die is ingelogd</span>
                : <input style={{ ...invoer, flex: 1 }} value={r.subject} placeholder="gebruikersnaam" aria-label="Gebruikersnaam"
                    onChange={(e) => zet(i, { subject: e.target.value })} />}
              <select style={invoer} value={r.recht} aria-label="Recht" onChange={(e) => zet(i, { recht: e.target.value })}>
                <option value="lezen">lezen</option>
                <option value="schrijven">schrijven</option>
              </select>
              <button type="button" style={knop} aria-label="Rij verwijderen" onClick={() => { setBewaard(false); setRijen(rijen.filter((_, j) => j !== i)); }}>×</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" style={knop} onClick={() => { setBewaard(false); setRijen([...rijen, { subject: "", recht: "schrijven" }]); }}>+ gebruiker</button>
            {!iedereen && <button type="button" style={knop} onClick={() => { setBewaard(false); setRijen([...rijen, { subject: "*", recht: "lezen" }]); }}>+ iedereen</button>}
            <span style={{ flex: 1 }} />
            {bewaard && <span role="status" style={{ color: "#15803d" }}>Opgeslagen</span>}
            <button type="button" style={{ ...knop, fontWeight: 600 }} onClick={opslaan}>Opslaan</button>
            <button type="button" style={knop} onClick={onKlaar}>Sluiten</button>
          </div>
        </>
      )}
    </div>
  );
}
