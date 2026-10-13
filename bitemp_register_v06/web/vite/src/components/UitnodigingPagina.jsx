import { useEffect, useState } from "react";
import { apiBase } from "../shared/apiBase.js";
import { GEBRUIKERSNAAM_PATROON as NAAM_PATROON, voorgesteldeGebruikersnaam } from "../shared/uitnodiging.js";

/**
 * UitnodigingPagina — een uitnodiging accepteren (plan 2026-10-12 Gebruikers uitnodigen).
 *
 * De link uit de mail is `…/viz/react/studio.html#uitnodiging=<token>`: de token staat in het
 * fragment, dus niet in serverlogs. De genodigde kiest een gebruikersnaam (zichtbaar in "wie
 * is actief") en een wachtwoord. De server registreert de gebruiker, kent de projecttoegang
 * uit de uitnodiging toe en zet de sessiecookie; daarna gaat de Studio open.
 */

async function api(pad, opties = {}) {
  const res = await fetch(`${apiBase()}${pad}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opties });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
  return d;
}

const label = { display: "block", marginBottom: "0.375rem", fontWeight: 600 };
const veld = { width: "100%", boxSizing: "border-box" };
const hulp = { fontSize: "0.8rem", color: "#64748b", marginTop: 4 };

export default function UitnodigingPagina({ token }) {
  const [info, setInfo] = useState(null);
  const [laadFout, setLaadFout] = useState(null);
  const [naam, setNaam] = useState("");
  const [ww, setWw] = useState("");
  const [herhaal, setHerhaal] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);

  useEffect(() => {
    api(`/api/uitnodiging/${encodeURIComponent(token)}`)
      .then((d) => {
        setInfo(d);
        // Voorstel: het deel vóór de @ (de genodigde mag het aanpassen).
        const voorstel = voorgesteldeGebruikersnaam(d.email);
        if (voorstel) setNaam(voorstel);
      })
      .catch((e) => setLaadFout(e.message));
  }, [token]);

  const min = info?.min_wachtwoord || 10;
  const naamOngeldig = naam !== "" && !NAAM_PATROON.test(naam);
  const teKort = ww !== "" && ww.length < min;
  const ongelijk = herhaal !== "" && ww !== herhaal;

  async function accepteer(e) {
    e.preventDefault();
    if (naamOngeldig || teKort || ongelijk || !naam || !ww) return;
    setBezig(true);
    setFout(null);
    try {
      await api(`/api/uitnodiging/${encodeURIComponent(token)}/accepteer`, {
        method: "POST",
        body: JSON.stringify({ gebruikersnaam: naam, wachtwoord: ww }),
      });
      // Ingelogd (cookie gezet): fragment weg en de Studio laden.
      window.location.replace(window.location.pathname + window.location.search);
    } catch (err) {
      setFout(err.message);
      setBezig(false);
    }
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "70vh", padding: "2rem" }}>
      <div className="cg-form-card" style={{ maxWidth: 440, width: "100%", padding: "2rem" }} data-testid="uitnodiging">
        <h2 className="utrecht-heading-2" style={{ marginTop: 0, marginBottom: "0.5rem", textAlign: "center" }}>
          Welkom bij Omnium Studio
        </h2>
        {laadFout && (
          <div className="cg-feedback--fout" role="alert" style={{ padding: "0.75rem", borderRadius: 6 }}>
            {laadFout}
            <div style={{ marginTop: 8 }}>Vraag degene die je uitnodigde om een nieuwe link.</div>
          </div>
        )}
        {!info && !laadFout && <p style={{ textAlign: "center", color: "#64748b" }}>Uitnodiging controleren…</p>}
        {info && (
          <>
            <p style={{ color: "#475569", marginTop: 0 }}>
              {info.uitgenodigd_door ? <><strong>{info.uitgenodigd_door}</strong> nodigt je uit</> : "Je bent uitgenodigd"} als <strong>{info.rol}</strong>
              {info.projecten?.length ? <> voor {info.projecten.map((p) => p.naam || p.id).join(", ")}</> : null}.
              Kies een gebruikersnaam en een wachtwoord.
            </p>
            {fout && (
              <div className="cg-feedback--fout" role="alert" style={{ marginBottom: "1rem", padding: "0.75rem", borderRadius: 6 }}>{fout}</div>
            )}
            <form onSubmit={accepteer}>
              <div style={{ marginBottom: "1rem" }}>
                <label htmlFor="uitn-naam" style={label}>Gebruikersnaam</label>
                <input id="uitn-naam" className="utrecht-textbox" style={veld} autoComplete="username" autoFocus
                  value={naam} onChange={(e) => setNaam(e.target.value.trim())} disabled={bezig} aria-invalid={naamOngeldig || undefined} />
                <div style={{ ...hulp, color: naamOngeldig ? "#b91c1c" : hulp.color }}>
                  Zo zien anderen je in “wie is actief”. 3–64 tekens: letters, cijfers, punt, - of _.
                </div>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label htmlFor="uitn-ww" style={label}>Wachtwoord</label>
                <input id="uitn-ww" type="password" className="utrecht-textbox" style={veld} autoComplete="new-password"
                  value={ww} onChange={(e) => setWw(e.target.value)} disabled={bezig} aria-invalid={teKort || undefined} />
                <div style={{ ...hulp, color: teKort ? "#b91c1c" : hulp.color }}>Minstens {min} tekens.</div>
              </div>
              <div style={{ marginBottom: "1.5rem" }}>
                <label htmlFor="uitn-herhaal" style={label}>Herhaal wachtwoord</label>
                <input id="uitn-herhaal" type="password" className="utrecht-textbox" style={veld} autoComplete="new-password"
                  value={herhaal} onChange={(e) => setHerhaal(e.target.value)} disabled={bezig} aria-invalid={ongelijk || undefined} />
                <div role={ongelijk ? "alert" : undefined} style={{ ...hulp, color: "#b91c1c", minHeight: 16 }}>
                  {ongelijk ? "De wachtwoorden zijn niet gelijk." : ""}
                </div>
              </div>
              <button type="submit" className="utrecht-button utrecht-button--primary-action" style={{ width: "100%", padding: "0.625rem" }}
                disabled={bezig || !naam || !ww || !herhaal || naamOngeldig || teKort || ongelijk}>
                {bezig ? "Bezig…" : "Account maken en beginnen"}
              </button>
              <p style={{ ...hulp, textAlign: "center", marginTop: 12 }}>
                Deze link werkt tot {new Date(info.verloopt).toLocaleString("nl-NL", { dateStyle: "long", timeStyle: "short" })} en maar één keer.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
