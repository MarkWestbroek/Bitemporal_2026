/**
 * gebruikersActivity — "Gebruikers": accounts, rollen en wachtwoorden (gebruikersbeheer,
 * docs/plans/gebruikersbeheer/, AUTH_DEVELOPER_GUIDE §11).
 *
 * Een gebruiker is een bitemporele entiteit (domein beheer). Dit scherm schrijft dus gewone
 * registraties via de gegenereerde routes; alleen het wachtwoord en het overzicht hebben eigen
 * endpoints (package gebruikers). Iedereen die is ingelogd kan hier zijn eigen wachtwoord
 * wijzigen; het beheer zelf is alleen voor admins (de API controleert dat).
 *
 * Schrijfpaden (getest 06-10-2026):
 *   - aanmaken:          POST /full/gebruikers (genest, $nieuw-id), daarna PUT /api/gebruikers/:id/wachtwoord
 *   - rol erbij (± tot):  POST /registratie/ met opvoer gebruikerroltoewijzing (+ "einde"); NIET via
 *                         PATCH /full — die laat aanvang/einde van een nieuw item vallen
 *   - rol eraf:          afvoer gebruikerroltoewijzing met rel_id
 *   - (de)blokkeren:     opvoer gebruikerstatus (enkelvoudig; de vorige sluit vanzelf)
 *   - beëindigen:        DELETE /gebruikers/:id (afvoer; niets wordt hard verwijderd)
 *   - uitnodigen:        POST /api/gebruikers/uitnodigingen (plan 2026-10-12): rol + projecttoegang;
 *                        de genodigde kiest zelf gebruikersnaam en wachtwoord (UitnodigingPagina)
 */
import React, { useCallback, useEffect, useState } from "react";
import { IconGebruikers } from "../icons";
import { apiBase } from "../studioUtils";
import { vraagNaam, vraagBevestiging } from "../naamDialog.jsx";
import { TOEKENBARE_ROLLEN as ROLLEN, ROL_UITLEG, isBeheerder } from "../../shared/rollen.js";
import { lijstProjecten } from "./projectSync.js";
import MijnTokens from "./MijnTokens.jsx";
const MIN_LENGTE = 10; // gelijk aan gebruikers.MinWachtwoordLengte

async function api(pad, opties = {}) {
  const res = await fetch(`${apiBase()}${pad}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opties });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d?.error || d?.detail || d?.title || `HTTP ${res.status}`);
  return d;
}

/** Eén registratie met de gegeven wijzigingen via de engine. */
function registreer(opmerking, wijzigingen) {
  return api("/registratie/", {
    method: "POST",
    body: JSON.stringify({ registratie: { registratietype: "registratie", opmerking }, wijzigingen }),
  });
}

const datum = (iso) => (iso ? new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }) : "—");
const tijd = (iso) => (iso ? new Date(iso).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "nooit");

const veld = { display: "grid", gap: 2, fontSize: 12 };
const invoer = { padding: "4px 6px", border: "1px solid var(--s-border, #cbd5e1)", borderRadius: 6, background: "var(--s-bg, #fff)", color: "inherit" };
const kader = { padding: 10, border: "1px solid var(--s-border, #e2e8f0)", borderRadius: 8 };
const gedempt = { color: "var(--s-fg-muted, #64748b)" };

const ONGELIJK = "De twee nieuwe wachtwoorden zijn niet gelijk.";

/** Lijn-oogje (zelfde als Imprint, password-fields.tsx); doorgestreept = wachtwoord zichtbaar. */
function Oog({ doorgestreept }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {doorgestreept && <path d="M3 3l18 18" />}
    </svg>
  );
}

/** Wachtwoordveld met een oogje in het veld, per veld te tonen of te verbergen. */
function WachtwoordInvoer({ value, onChange, autoComplete, ongeldig, beschrijving }) {
  const [zichtbaar, setZichtbaar] = useState(false);
  return (
    <span style={{ position: "relative", display: "block" }}>
      <input style={{ ...invoer, width: "100%", paddingRight: 30, boxSizing: "border-box", ...(ongeldig ? { borderColor: "#dc2626" } : {}) }}
        type={zichtbaar ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete} aria-invalid={ongeldig || undefined} aria-describedby={beschrijving} />
      <button type="button" onClick={() => setZichtbaar((z) => !z)} aria-pressed={zichtbaar}
        aria-label={zichtbaar ? "Wachtwoord verbergen" : "Wachtwoord tonen"} title={zichtbaar ? "Verbergen" : "Tonen"}
        style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", display: "grid", placeItems: "center",
          width: 24, height: 24, border: 0, background: "transparent", color: "inherit", opacity: 0.65, cursor: "pointer", padding: 0 }}>
        <Oog doorgestreept={zichtbaar} />
      </button>
    </span>
  );
}

/** Eigen wachtwoord wijzigen (elke ingelogde gebruiker). */
function MijnWachtwoord({ ik }) {
  const [w, setW] = useState({ huidig: "", nieuw: "", herhaal: "" });
  const [melding, setMelding] = useState(null); // { ok, tekst }
  const foutId = "mijn-wachtwoord-ongelijk";

  if (!ik) {
    return <p style={{ ...gedempt, fontSize: 13 }}>Log in om je wachtwoord te wijzigen.</p>;
  }
  // Zodra het herhaalveld iets bevat en afwijkt: meteen melden (net als Imprint).
  const ongelijk = w.herhaal !== "" && w.nieuw !== w.herhaal;
  const teKort = w.nieuw !== "" && w.nieuw.length < MIN_LENGTE;

  async function opslaan(e) {
    e.preventDefault();
    if (teKort || ongelijk) return;
    try {
      await api("/api/auth/wachtwoord", { method: "PUT", body: JSON.stringify({ huidig: w.huidig, nieuw: w.nieuw }) });
      setW({ huidig: "", nieuw: "", herhaal: "" });
      setMelding({ ok: true, tekst: "Wachtwoord gewijzigd." });
    } catch (err) {
      setMelding({ ok: false, tekst: err.message });
    }
  }
  const zet = (veldnaam) => (v) => { setW({ ...w, [veldnaam]: v }); setMelding(null); };
  const klein = { fontSize: 12, minHeight: 16 };
  return (
    <form onSubmit={opslaan} style={{ ...kader, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
      <div style={{ flex: "1 1 100%", fontSize: 13 }}>
        Mijn wachtwoord — ingelogd als <strong>{ik.gebruikersnaam}</strong> ({ik.rol})
      </div>
      <label style={{ ...veld, width: 170 }}>Huidig
        <WachtwoordInvoer value={w.huidig} onChange={zet("huidig")} autoComplete="current-password" />
        <span style={klein} />
      </label>
      <label style={{ ...veld, width: 170 }}>Nieuw
        <WachtwoordInvoer value={w.nieuw} onChange={zet("nieuw")} autoComplete="new-password" ongeldig={teKort} />
        <span style={{ ...klein, color: teKort ? "#dc2626" : "var(--s-fg-muted, #64748b)" }}>minstens {MIN_LENGTE} tekens</span>
      </label>
      <label style={{ ...veld, width: 170 }}>Herhaal nieuw
        <WachtwoordInvoer value={w.herhaal} onChange={zet("herhaal")} autoComplete="new-password" ongeldig={ongelijk} beschrijving={ongelijk ? foutId : undefined} />
        <span id={foutId} role={ongelijk ? "alert" : undefined} style={{ ...klein, color: "#dc2626" }}>{ongelijk ? ONGELIJK : ""}</span>
      </label>
      <button type="submit" className="studio-btn studio-btn--primary" style={{ marginTop: 17 }}
        disabled={!w.huidig || !w.nieuw || !w.herhaal || ongelijk || teKort}>Wijzigen</button>
      {melding && <div role={melding.ok ? "status" : "alert"} style={{ flex: "1 1 100%", fontSize: 13, color: melding.ok ? "#15803d" : "#b91c1c" }}>{melding.tekst}</div>}
    </form>
  );
}

/** Groen kader met een wachtwoord dat maar één keer zichtbaar is. */
function EenmaligWachtwoord({ naam, wachtwoord, onKlaar }) {
  const [gekopieerd, setGekopieerd] = useState(false);
  return (
    <div role="status" style={{ marginTop: 12, padding: 10, borderRadius: 8, border: "1px solid #86efac", background: "#f0fdf4", color: "#14532d" }}>
      <div style={{ fontSize: 13 }}>Wachtwoord voor <strong>{naam}</strong>. <strong>Alleen nu zichtbaar</strong> — geef het door; {naam} kan het daarna zelf wijzigen:</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
        <code style={{ fontSize: 15, padding: "4px 8px", background: "#fff", border: "1px solid #bbf7d0", borderRadius: 6 }}>{wachtwoord}</code>
        <button type="button" className="studio-btn" onClick={() => navigator.clipboard?.writeText(wachtwoord).then(() => setGekopieerd(true))}>
          {gekopieerd ? "Gekopieerd ✓" : "Kopiëren"}
        </button>
        <button type="button" className="studio-btn" onClick={onKlaar}>Klaar</button>
      </div>
    </div>
  );
}

/** Kleine inline-form: rol erbij, optioneel met einddatum. */
function RolErbij({ onToevoegen, onAnnuleer }) {
  const [rol, setRol] = useState("modelleur");
  const [tot, setTot] = useState("");
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <select style={invoer} value={rol} onChange={(e) => setRol(e.target.value)} aria-label="Rol">
        {ROLLEN.map((r) => <option key={r} title={ROL_UITLEG[r]}>{r}</option>)}
      </select>
      <input style={invoer} type="date" value={tot} onChange={(e) => setTot(e.target.value)} aria-label="Geldig tot (optioneel)" title="Geldig tot (optioneel)" />
      <button type="button" className="studio-btn studio-btn--primary" onClick={() => onToevoegen(rol, tot)}>Toevoegen</button>
      <button type="button" className="studio-btn" onClick={onAnnuleer}>×</button>
    </span>
  );
}

/** Uitnodiging: e-mail, rol en (optioneel) projecten met recht. Zonder project ziet de
 *  genodigde niets ("alles dicht tenzij"). Na het maken: de link één keer zichtbaar. */
function Uitnodigen() {
  const leeg = { email: "", weergavenaam: "", rol: "modelleur", dagen: 7, projecten: {} };
  const [stand, setStand] = useState(null); // { aan, mail, uitnodigingen }
  const [projecten, setProjecten] = useState([]);
  const [n, setN] = useState(leeg);
  const [fout, setFout] = useState("");
  const [resultaat, setResultaat] = useState(null); // { link, gemaild, mailfout, email }
  const [gekopieerd, setGekopieerd] = useState(false);

  const laad = useCallback(() => {
    api("/api/gebruikers/uitnodigingen").then(setStand).catch((e) => setFout(e.message));
    lijstProjecten().then((l) => setProjecten(Array.isArray(l) ? l : [])).catch(() => setProjecten([]));
  }, []);
  useEffect(laad, [laad]);

  if (!stand) return fout ? <p role="alert" style={{ color: "#b91c1c", fontSize: 13 }}>{fout}</p> : null;

  const zetProject = (id, recht) => {
    const p = { ...n.projecten };
    if (recht) p[id] = recht; else delete p[id];
    setN({ ...n, projecten: p });
  };

  async function nodigUit(e) {
    e.preventDefault();
    setFout("");
    setResultaat(null);
    setGekopieerd(false);
    try {
      const d = await api("/api/gebruikers/uitnodigingen", {
        method: "POST",
        body: JSON.stringify({
          email: n.email.trim(), weergavenaam: n.weergavenaam.trim(), rol: n.rol, dagen: Number(n.dagen) || 7,
          projecten: Object.entries(n.projecten).map(([id, recht]) => ({ id, recht })),
        }),
      });
      setResultaat({ ...d, email: n.email.trim() });
      setN(leeg);
      laad();
    } catch (err) {
      setFout(err.message);
    }
  }

  async function trekIn(u) {
    if (!(await vraagBevestiging({ titel: "Uitnodiging intrekken", tekst: `Uitnodiging voor ${u.email} intrekken? De link werkt dan niet meer.`, bevestig: "Intrekken", gevaar: true }))) return;
    try {
      await api(`/api/gebruikers/uitnodigingen/${u.id}`, { method: "DELETE" });
    } catch (err) {
      setFout(err.message);
    }
    laad();
  }

  const open = (stand.uitnodigingen || []).filter((u) => u.status === "open");
  const recent = (stand.uitnodigingen || []).filter((u) => u.status !== "open").slice(0, 8);

  return (
    <section data-testid="uitnodigen" style={{ ...kader, marginTop: 14 }}>
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        <strong>Uitnodigen</strong> — de genodigde kiest zelf een gebruikersnaam en wachtwoord.
        {stand.aan
          ? (stand.mail ? " De link gaat per mail en verschijnt hier ook." : " Er is geen mailserver ingericht: kopieer de link en stuur hem zelf door.")
          : null}
      </div>
      {!stand.aan ? (
        <p style={{ ...gedempt, fontSize: 13, margin: 0 }}>
          Uitnodigen staat uit op deze instantie. Zet <code>UITNODIGEN_ENABLED=true</code> (met <code>AUTH_ENABLED=true</code>) in de omgeving van de API.
        </p>
      ) : (
        <form onSubmit={nodigUit} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <label style={{ ...veld, flex: "1 1 200px" }}>E-mail
            <input style={invoer} type="email" required value={n.email} onChange={(e) => setN({ ...n, email: e.target.value })} />
          </label>
          <label style={{ ...veld, flex: "1 1 140px" }}>Naam (optioneel)
            <input style={invoer} value={n.weergavenaam} onChange={(e) => setN({ ...n, weergavenaam: e.target.value })} />
          </label>
          <label style={veld}>Rol
            <select style={invoer} value={n.rol} onChange={(e) => setN({ ...n, rol: e.target.value })} title={ROL_UITLEG[n.rol]}>
              {ROLLEN.map((r) => <option key={r} title={ROL_UITLEG[r]}>{r}</option>)}
            </select>
          </label>
          <label style={{ ...veld, width: 70 }}>Dagen geldig
            <input style={invoer} type="number" min={1} max={30} value={n.dagen} onChange={(e) => setN({ ...n, dagen: e.target.value })} />
          </label>
          <div style={{ flex: "1 1 100%", fontSize: 12 }}>
            <div style={{ marginBottom: 4 }}>Projecten {projecten.length === 0 && <span style={gedempt}>(geen projecten op de server)</span>}</div>
            <div style={{ display: "grid", gap: 2, maxHeight: 160, overflow: "auto" }}>
              {projecten.map((p) => (
                <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "center" }} data-project-id={p.id}>
                  <select style={{ ...invoer, width: 110 }} aria-label={`Toegang tot ${p.naam}`} value={n.projecten[p.id] || ""}
                    onChange={(e) => zetProject(p.id, e.target.value)}>
                    <option value="">geen toegang</option>
                    <option value="lezen">lezen</option>
                    <option value="schrijven">schrijven</option>
                  </select>
                  <span>{p.naam}</span>
                  {p.eigenaar && <span style={gedempt}>· {p.eigenaar}</span>}
                </div>
              ))}
            </div>
            <div style={{ ...gedempt, marginTop: 4 }}>Alles dicht tenzij: zonder project ziet de genodigde geen enkel project.</div>
          </div>
          <button type="submit" className="studio-btn studio-btn--primary">Uitnodigen</button>
        </form>
      )}

      {fout && <p role="alert" style={{ color: "#b91c1c", fontSize: 13 }}>{fout}</p>}
      {resultaat && (
        <div role="status" style={{ marginTop: 12, padding: 10, borderRadius: 8, border: "1px solid #86efac", background: "#f0fdf4", color: "#14532d", fontSize: 13 }}>
          Uitnodiging voor <strong>{resultaat.email}</strong> gemaakt.{" "}
          {resultaat.gemaild ? "De mail is verstuurd." : resultaat.mailfout ? `Mailen mislukte (${resultaat.mailfout}); stuur de link zelf door.` : "Stuur deze link zelf door:"}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
            <code data-testid="uitnodiging-link" style={{ flex: 1, fontSize: 12, padding: "4px 8px", background: "#fff", border: "1px solid #bbf7d0", borderRadius: 6, overflowWrap: "anywhere" }}>{resultaat.link}</code>
            <button type="button" className="studio-btn" onClick={() => navigator.clipboard?.writeText(resultaat.link).then(() => setGekopieerd(true))}>
              {gekopieerd ? "Gekopieerd ✓" : "Kopiëren"}
            </button>
            <button type="button" className="studio-btn" onClick={() => setResultaat(null)}>Klaar</button>
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>De link is alleen nu zichtbaar; de server bewaart hem niet.</div>
        </div>
      )}

      {(open.length > 0 || recent.length > 0) && (
        <table style={{ width: "100%", marginTop: 12, borderCollapse: "collapse", fontSize: 12 }}>
          <tbody>
            {[...open, ...recent].map((u) => (
              <tr key={u.id} style={{ borderTop: "1px solid var(--s-border, #f1f5f9)" }}>
                <td style={{ padding: 4 }}>{u.email}{u.weergavenaam ? <span style={gedempt}> · {u.weergavenaam}</span> : null}</td>
                <td style={{ padding: 4 }}>{u.rol}</td>
                <td style={{ padding: 4 }}>{(u.projecten || []).map((p) => `${p.naam || p.id} (${p.recht})`).join(", ") || <span style={gedempt}>geen projecten</span>}</td>
                <td style={{ padding: 4, whiteSpace: "nowrap" }}>
                  {u.status === "open" ? `open tot ${datum(u.verloopt)}` : u.status === "geaccepteerd" ? `geaccepteerd als ${u.gebruikersnaam}` : u.status}
                </td>
                <td style={{ padding: 4, textAlign: "right" }}>
                  {u.status === "open" && <button type="button" className="studio-btn" onClick={() => trekIn(u)}>Intrekken</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Main() {
  const [ik, setIk] = useState(null); // { gebruikersnaam, rol } of null
  const [lijst, setLijst] = useState(null); // null = (nog) niet beschikbaar
  const [geenBeheer, setGeenBeheer] = useState("");
  const [fout, setFout] = useState("");
  const [nieuw, setNieuw] = useState({ gebruikersnaam: "", weergavenaam: "", email: "", rol: "modelleur", tot: "" });
  const [eenmalig, setEenmalig] = useState(null); // { naam, wachtwoord }
  const [rolFormVoor, setRolFormVoor] = useState(null); // gebruiker-id

  const laad = useCallback(() => {
    api("/api/auth/me").then(setIk).catch(() => setIk(null));
    api("/api/gebruikers")
      .then((d) => { setLijst(d); setGeenBeheer(""); })
      .catch((e) => { setLijst(null); setGeenBeheer(e.message); });
  }, []);
  useEffect(laad, [laad]);

  /** Voert een actie uit, toont een fout en laadt daarna opnieuw. */
  async function doe(actie) {
    setFout("");
    try {
      await actie();
    } catch (err) {
      setFout(err.message);
    }
    laad();
  }

  async function maak(e) {
    e.preventDefault();
    const naam = nieuw.gebruikersnaam.trim();
    if (!naam) return;
    const rol = { rol: nieuw.rol, toelichting: nieuw.tot ? `tot ${nieuw.tot}` : undefined };
    if (nieuw.tot) rol.einde = nieuw.tot;
    const identiteit = { gebruikersnaam: naam };
    if (nieuw.weergavenaam.trim()) identiteit.weergavenaam = nieuw.weergavenaam.trim();
    if (nieuw.email.trim()) identiteit.email = nieuw.email.trim();
    await doe(async () => {
      await api("/full/gebruikers", {
        method: "POST",
        body: JSON.stringify({ id: "$nieuw.g", gebruiker_identiteiten: [identiteit], gebruiker_roltoewijzingen: [rol] }),
      });
      // De POST geeft alleen het registratie-id; zoek de nieuwe gebruiker op naam op.
      const alle = await api("/api/gebruikers");
      const g = alle.find((u) => u.gebruikersnaam === naam);
      if (!g) throw new Error(`${naam} is aangemaakt, maar niet teruggevonden; zet het wachtwoord via "Nieuw wachtwoord".`);
      const d = await api(`/api/gebruikers/${g.id}/wachtwoord`, { method: "PUT" });
      setEenmalig({ naam, wachtwoord: d.wachtwoord });
      setNieuw({ gebruikersnaam: "", weergavenaam: "", email: "", rol: "modelleur", tot: "" });
    });
  }

  async function resetWachtwoord(g) {
    if (!(await vraagBevestiging({ titel: "Nieuw wachtwoord", tekst: `Nieuw wachtwoord maken voor ${g.gebruikersnaam}? Het oude werkt dan niet meer.`, bevestig: "Maak nieuw wachtwoord" }))) return;
    doe(async () => {
      const d = await api(`/api/gebruikers/${g.id}/wachtwoord`, { method: "PUT" });
      setEenmalig({ naam: g.gebruikersnaam, wachtwoord: d.wachtwoord });
    });
  }

  async function zetStatus(g, status) {
    const toelichting =
      status === "geblokkeerd"
        ? await vraagNaam({ titel: `${g.gebruikersnaam} blokkeren`, label: "Toelichting (optioneel)", waarde: "", bevestig: "Blokkeer", leegToegestaan: true })
        : "";
    if (toelichting === null) return; // geannuleerd
    const opvoer = { gebruiker_id: g.id, status };
    if (toelichting) opvoer.toelichting = toelichting;
    doe(() => registreer(`${g.gebruikersnaam} ${status}`, [{ opvoer: { gebruikerstatus: opvoer } }]));
  }

  function rolErbij(g, rol, tot) {
    setRolFormVoor(null);
    const opvoer = { gebruiker_id: g.id, rol };
    if (tot) { opvoer.einde = tot; opvoer.toelichting = `tot ${tot}`; }
    doe(() => registreer(`${g.gebruikersnaam}: rol ${rol}${tot ? ` tot ${tot}` : ""}`, [{ opvoer: { gebruikerroltoewijzing: opvoer } }]));
  }

  async function rolEraf(g, r) {
    if (!(await vraagBevestiging({ titel: "Rol intrekken", tekst: `Rol ${r.rol} van ${g.gebruikersnaam} intrekken?`, bevestig: "Intrekken", gevaar: true }))) return;
    doe(() => registreer(`${g.gebruikersnaam}: rol ${r.rol} ingetrokken`, [{ afvoer: { gebruikerroltoewijzing: { gebruiker_id: g.id, rel_id: r.rel_id } } }]));
  }

  async function beeindig(g) {
    if (!(await vraagBevestiging({ titel: "Account beëindigen", tekst: `Account ${g.gebruikersnaam} beëindigen? Inloggen kan dan niet meer. De geschiedenis blijft bewaard.`, bevestig: "Beëindig", gevaar: true }))) return;
    doe(() => api(`/gebruikers/${g.id}`, { method: "DELETE" }));
  }

  const isIk = (g) => ik && g.gebruikersnaam === ik.gebruikersnaam;

  return (
    <div style={{ padding: 16, maxWidth: 1000, overflow: "auto" }}>
      <h2 style={{ margin: "0 0 4px" }}>Gebruikers</h2>
      <p style={{ margin: "0 0 12px", ...gedempt, fontSize: 13 }}>
        Accounts, rollen en wachtwoorden. Elke wijziging is een registratie, dus je ziet later wie wanneer welke rol had.
        Een rol met een einddatum verloopt vanzelf. Wijzigingen werken binnen 30 seconden.
      </p>

      <MijnWachtwoord ik={ik} />
      {ik && <MijnTokens />}

      {lijst !== null && <Uitnodigen />}

      {lijst === null ? (
        <p style={{ ...gedempt, fontSize: 13, marginTop: 14 }}>
          Gebruikersbeheer is alleen voor admins{geenBeheer ? ` (${geenBeheer})` : ""}.
        </p>
      ) : (
        <>
          <form onSubmit={maak} style={{ ...kader, marginTop: 14, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 100%", fontSize: 13 }}>Nieuwe gebruiker — de server maakt een wachtwoord, dat je één keer te zien krijgt.</div>
            <label style={{ ...veld, flex: "1 1 140px" }}>Gebruikersnaam
              <input style={invoer} value={nieuw.gebruikersnaam} onChange={(e) => setNieuw({ ...nieuw, gebruikersnaam: e.target.value })} required autoComplete="off" />
            </label>
            <label style={{ ...veld, flex: "1 1 140px" }}>Weergavenaam
              <input style={invoer} value={nieuw.weergavenaam} onChange={(e) => setNieuw({ ...nieuw, weergavenaam: e.target.value })} />
            </label>
            <label style={{ ...veld, flex: "1 1 180px" }}>E-mail
              <input style={invoer} type="email" value={nieuw.email} onChange={(e) => setNieuw({ ...nieuw, email: e.target.value })} />
            </label>
            <label style={veld}>Rol
              <select style={invoer} value={nieuw.rol} onChange={(e) => setNieuw({ ...nieuw, rol: e.target.value })}>
                {ROLLEN.map((r) => <option key={r} title={ROL_UITLEG[r]}>{r}</option>)}
              </select>
            </label>
            <label style={veld}>Rol geldig tot (optioneel)
              <input style={invoer} type="date" value={nieuw.tot} onChange={(e) => setNieuw({ ...nieuw, tot: e.target.value })} />
            </label>
            <button type="submit" className="studio-btn studio-btn--primary">Aanmaken</button>
          </form>

          {eenmalig && <EenmaligWachtwoord {...eenmalig} onKlaar={() => setEenmalig(null)} />}
          {fout && <p role="alert" style={{ color: "#b91c1c", fontSize: 13 }}>{fout}</p>}

          <table style={{ width: "100%", marginTop: 14, borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--s-border, #e2e8f0)" }}>
                <th style={{ padding: 6 }}>Gebruiker</th><th style={{ padding: 6 }}>Status</th><th style={{ padding: 6, width: "30%" }}>Rollen</th><th style={{ padding: 6, whiteSpace: "nowrap" }}>Laatste login</th><th style={{ width: 210 }} />
              </tr>
            </thead>
            <tbody>
              {lijst.length === 0 && <tr><td colSpan={5} style={{ padding: 8, ...gedempt }}>Nog geen gebruikers.</td></tr>}
              {lijst.map((g) => {
                const zelf = isIk(g);
                return (
                  <tr key={g.id} style={{ borderBottom: "1px solid var(--s-border, #f1f5f9)", verticalAlign: "top", opacity: g.mag_inloggen ? 1 : 0.65 }}>
                    <td style={{ padding: 6 }}>
                      <strong>{g.gebruikersnaam}</strong>{zelf && <span style={gedempt}> (jij)</span>}
                      {g.weergavenaam && <div>{g.weergavenaam}</div>}
                      {g.email && <div style={gedempt}>{g.email}</div>}
                    </td>
                    <td style={{ padding: 6 }}>
                      {g.status}
                      {g.status_toelichting && <div style={{ ...gedempt, fontSize: 12 }}>{g.status_toelichting}</div>}
                      {!g.heeft_wachtwoord && <div style={{ color: "#b45309", fontSize: 12 }}>geen wachtwoord</div>}
                      {g.status !== "geblokkeerd" && g.rollen.length === 0 && <div style={{ color: "#b45309", fontSize: 12 }}>geen geldige rol</div>}
                    </td>
                    <td style={{ padding: 6 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {g.rollen.map((r) => (
                          <span key={r.rel_id} style={{ display: "inline-flex", gap: 4, alignItems: "center", padding: "1px 8px", borderRadius: 10, whiteSpace: "nowrap", background: "var(--s-hover, #f1f5f9)", color: "var(--s-fg, #0f172a)", border: "1px solid var(--s-border, #e2e8f0)" }}
                            title={r.einde ? `geldig tot ${datum(r.einde)}` : "zonder einddatum"}>
                            {r.rol}{r.domein ? ` · ${r.domein}` : ""}{r.einde ? ` · tot ${datum(r.einde)}` : ""}
                            {!(zelf && isBeheerder(r.rol)) && (
                              <button type="button" onClick={() => rolEraf(g, r)} aria-label={`Rol ${r.rol} intrekken`}
                                style={{ border: 0, background: "none", cursor: "pointer", padding: 0, color: "inherit" }}>×</button>
                            )}
                          </span>
                        ))}
                        {rolFormVoor === g.id
                          ? <RolErbij onToevoegen={(rol, tot) => rolErbij(g, rol, tot)} onAnnuleer={() => setRolFormVoor(null)} />
                          : <button type="button" className="studio-btn" onClick={() => setRolFormVoor(g.id)}>+ rol</button>}
                      </div>
                    </td>
                    <td style={{ padding: 6, whiteSpace: "nowrap" }}>{tijd(g.laatste_login_op)}</td>
                    <td style={{ padding: 6 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end" }}>
                        <button type="button" className="studio-btn" onClick={() => resetWachtwoord(g)} title="Nieuw wachtwoord maken (het oude vervalt)">Nieuw wachtwoord</button>
                        {!zelf && (g.status === "geblokkeerd"
                          ? <button type="button" className="studio-btn" onClick={() => zetStatus(g, "actief")}>Deblokkeren</button>
                          : <button type="button" className="studio-btn" onClick={() => zetStatus(g, "geblokkeerd")}>Blokkeren</button>)}
                        {!zelf && <button type="button" className="studio-btn" onClick={() => beeindig(g)}>Beëindigen</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function Sidebar() {
  return (
    <div style={{ padding: 10, fontSize: 12, ...gedempt }}>
      <p style={{ marginTop: 0 }}>Rollen, oplopend:</p>
      <ul style={{ margin: "0 0 8px", paddingLeft: 16 }}>
        {ROLLEN.map((r) => <li key={r}><strong>{r}</strong> {ROL_UITLEG[r]}</li>)}
      </ul>
      <p>De oude namen blijven werken: viewer = lezer, editor = bouwer, admin = beheerder.</p>
      <p>Studio-projecten zijn dicht tenzij: een genodigde ziet alleen de projecten uit de uitnodiging (later uit te breiden via <em>Van server ophalen → Toegang…</em>).</p>
      <p>Een gebruiker is een bitemporele entiteit (domein <code>beheer</code>). Wachtwoorden staan daar bewust buiten en komen nooit in de geschiedenis.</p>
      <p>Zie <code>docs/AUTH_DEVELOPER_GUIDE.md</code> §11.</p>
    </div>
  );
}

function Inspector() {
  return (
    <div style={{ padding: 10, fontSize: 12, ...gedempt }}>
      Je eigen admin-rol, blokkeren en beëindigen staan voor je eigen account uit, zodat je jezelf niet buitensluit.
    </div>
  );
}

export default {
  id: "gebruikers",
  label: "Gebruikers",
  icon: <IconGebruikers />,
  groep: "beheer",
  Sidebar,
  Main,
  Inspector,
  sidebarLabel: "Over gebruikers",
  inspectorLabel: "Let op",
};
