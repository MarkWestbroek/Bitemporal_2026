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
 */
import React, { useCallback, useEffect, useState } from "react";
import { IconGebruikers } from "../icons";
import { apiBase } from "../studioUtils";

const ROLLEN = ["viewer", "editor", "admin"];
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

/** Wachtwoordveld met een oogje. */
function WachtwoordInvoer({ value, onChange, placeholder, autoComplete, zichtbaar }) {
  return (
    <input style={invoer} type={zichtbaar ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} autoComplete={autoComplete} />
  );
}

/** Eigen wachtwoord wijzigen (elke ingelogde gebruiker). */
function MijnWachtwoord({ ik }) {
  const [w, setW] = useState({ huidig: "", nieuw: "", herhaal: "" });
  const [zichtbaar, setZichtbaar] = useState(false);
  const [melding, setMelding] = useState(null); // { ok, tekst }

  if (!ik) {
    return <p style={{ ...gedempt, fontSize: 13 }}>Log in om je wachtwoord te wijzigen.</p>;
  }
  async function opslaan(e) {
    e.preventDefault();
    if (w.nieuw.length < MIN_LENGTE) return setMelding({ ok: false, tekst: `Het nieuwe wachtwoord moet minstens ${MIN_LENGTE} tekens hebben.` });
    if (w.nieuw !== w.herhaal) return setMelding({ ok: false, tekst: "De twee nieuwe wachtwoorden zijn niet gelijk." });
    try {
      await api("/api/auth/wachtwoord", { method: "PUT", body: JSON.stringify({ huidig: w.huidig, nieuw: w.nieuw }) });
      setW({ huidig: "", nieuw: "", herhaal: "" });
      setMelding({ ok: true, tekst: "Wachtwoord gewijzigd." });
    } catch (err) {
      setMelding({ ok: false, tekst: err.message });
    }
  }
  return (
    <form onSubmit={opslaan} style={{ ...kader, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
      <div style={{ flex: "1 1 100%", fontSize: 13 }}>
        Mijn wachtwoord — ingelogd als <strong>{ik.gebruikersnaam}</strong> ({ik.rol})
      </div>
      <label style={veld}>Huidig
        <WachtwoordInvoer value={w.huidig} onChange={(v) => setW({ ...w, huidig: v })} autoComplete="current-password" zichtbaar={zichtbaar} />
      </label>
      <label style={veld}>Nieuw (min. {MIN_LENGTE})
        <WachtwoordInvoer value={w.nieuw} onChange={(v) => setW({ ...w, nieuw: v })} autoComplete="new-password" zichtbaar={zichtbaar} />
      </label>
      <label style={veld}>Herhaal nieuw
        <WachtwoordInvoer value={w.herhaal} onChange={(v) => setW({ ...w, herhaal: v })} autoComplete="new-password" zichtbaar={zichtbaar} />
      </label>
      <button type="button" className="studio-btn" onClick={() => setZichtbaar((z) => !z)} aria-pressed={zichtbaar}
        title={zichtbaar ? "Verberg wachtwoorden" : "Toon wachtwoorden"}>{zichtbaar ? "🙈" : "👁"}</button>
      <button type="submit" className="studio-btn studio-btn--primary" disabled={!w.huidig || !w.nieuw}>Wijzigen</button>
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
  const [rol, setRol] = useState("editor");
  const [tot, setTot] = useState("");
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <select style={invoer} value={rol} onChange={(e) => setRol(e.target.value)} aria-label="Rol">
        {ROLLEN.map((r) => <option key={r}>{r}</option>)}
      </select>
      <input style={invoer} type="date" value={tot} onChange={(e) => setTot(e.target.value)} aria-label="Geldig tot (optioneel)" title="Geldig tot (optioneel)" />
      <button type="button" className="studio-btn studio-btn--primary" onClick={() => onToevoegen(rol, tot)}>Toevoegen</button>
      <button type="button" className="studio-btn" onClick={onAnnuleer}>×</button>
    </span>
  );
}

function Main() {
  const [ik, setIk] = useState(null); // { gebruikersnaam, rol } of null
  const [lijst, setLijst] = useState(null); // null = (nog) niet beschikbaar
  const [geenBeheer, setGeenBeheer] = useState("");
  const [fout, setFout] = useState("");
  const [nieuw, setNieuw] = useState({ gebruikersnaam: "", weergavenaam: "", email: "", rol: "editor", tot: "" });
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
      setNieuw({ gebruikersnaam: "", weergavenaam: "", email: "", rol: "editor", tot: "" });
    });
  }

  function resetWachtwoord(g) {
    if (!window.confirm(`Nieuw wachtwoord maken voor ${g.gebruikersnaam}? Het oude werkt dan niet meer.`)) return;
    doe(async () => {
      const d = await api(`/api/gebruikers/${g.id}/wachtwoord`, { method: "PUT" });
      setEenmalig({ naam: g.gebruikersnaam, wachtwoord: d.wachtwoord });
    });
  }

  function zetStatus(g, status) {
    const toelichting = status === "geblokkeerd" ? window.prompt(`Waarom ${g.gebruikersnaam} blokkeren? (optioneel)`, "") : "";
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

  function rolEraf(g, r) {
    if (!window.confirm(`Rol ${r.rol} van ${g.gebruikersnaam} intrekken?`)) return;
    doe(() => registreer(`${g.gebruikersnaam}: rol ${r.rol} ingetrokken`, [{ afvoer: { gebruikerroltoewijzing: { gebruiker_id: g.id, rel_id: r.rel_id } } }]));
  }

  function beeindig(g) {
    if (!window.confirm(`Account ${g.gebruikersnaam} beëindigen? Inloggen kan dan niet meer. De geschiedenis blijft bewaard.`)) return;
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
                {ROLLEN.map((r) => <option key={r}>{r}</option>)}
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
                            {!(zelf && r.rol === "admin") && (
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
      <p style={{ marginTop: 0 }}>Rollen: <strong>viewer</strong> kijkt, <strong>editor</strong> modelleert en registreert, <strong>admin</strong> beheert ook gebruikers.</p>
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
