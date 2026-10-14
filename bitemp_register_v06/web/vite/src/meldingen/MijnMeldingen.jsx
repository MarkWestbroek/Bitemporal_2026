/**
 * MijnMeldingen — de eigen meldingen met status en gesprek; een beheerder ziet ze allemaal en
 * behandelt ze (status, toelichting, prioriteit, behandelaar). Gedeeld door de Studio en
 * melden.html. Bijlagen zijn alleen zichtbaar voor wie de melding mag zien (de API controleert).
 */
import React, { useCallback, useEffect, useState } from "react";
import { lijstMeldingen, reageer, behandel, bestandUrl, STATUSSEN, STATUS_LABEL, PRIORITEITEN, SOORTEN } from "./meldingApi.js";
import "./meldingen.css";

const wanneer = (iso) => (iso ? new Date(iso).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" }) : "");
const soortLabel = (s) => SOORTEN.find((x) => x.waarde === s)?.label || s;

function Behandeling({ melding, onKlaar }) {
  const [status, setStatus] = useState(melding.status);
  const [toelichting, setToelichting] = useState(melding.toelichting || "");
  const [prioriteit, setPrioriteit] = useState(melding.prioriteit || "");
  const [behandelaar, setBehandelaar] = useState(melding.behandelaar || "");
  const [fout, setFout] = useState("");
  async function opslaan() {
    const w = {};
    if (status !== melding.status || toelichting !== (melding.toelichting || "")) { w.status = status; w.toelichting = toelichting; }
    if (prioriteit && prioriteit !== melding.prioriteit) w.prioriteit = prioriteit;
    if (behandelaar && behandelaar !== melding.behandelaar) w.behandelaar = behandelaar;
    if (!Object.keys(w).length) return;
    try { await behandel(melding.id, w); setFout(""); onKlaar(); } catch (e) { setFout(e.message); }
  }
  return (
    <div className="mld-behandeling" data-testid="behandeling">
      <strong>Behandelen</strong>
      <label>status
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSSEN.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </label>
      <label>prioriteit
        <select value={prioriteit} onChange={(e) => setPrioriteit(e.target.value)}>
          <option value="">—</option>
          {PRIORITEITEN.map((p) => <option key={p}>{p}</option>)}
        </select>
      </label>
      <label>behandelaar
        <input value={behandelaar} onChange={(e) => setBehandelaar(e.target.value)} placeholder="gebruikersnaam" />
      </label>
      <label className="mld-breed">toelichting voor de melder
        <input value={toelichting} onChange={(e) => setToelichting(e.target.value)} placeholder="bv. opgelost in 0.19.1, of dubbel van #12" />
      </label>
      <button type="button" className="mld-knop mld-knop--hoofd" onClick={opslaan}>Opslaan</button>
      {fout && <span className="mld-fout">{fout}</span>}
    </div>
  );
}

function Detail({ melding, beheerder, onVerversen }) {
  const [tekst, setTekst] = useState("");
  const [fout, setFout] = useState("");
  async function stuur(e) {
    e.preventDefault();
    if (!tekst.trim()) return;
    try { await reageer(melding.id, tekst.trim()); setTekst(""); setFout(""); onVerversen(); } catch (err) { setFout(err.message); }
  }
  return (
    <div className="mld-detail" data-testid="melding-detail">
      {melding.beschrijving && <p className="mld-beschrijving">{melding.beschrijving}</p>}
      {melding.toelichting && <p className="mld-toelichting"><strong>Toelichting:</strong> {melding.toelichting}</p>}
      {melding.bijlagen.length > 0 && (
        <div className="mld-bijlagen">
          {melding.bijlagen.map((b) => (
            <a key={b.bestand} href={bestandUrl(b.bestand)} target="_blank" rel="noopener noreferrer" className="mld-bijlage">
              <img src={bestandUrl(b.bestand)} alt={b.omschrijving || "bijlage"} onError={(e) => { e.currentTarget.replaceWith(document.createTextNode("📄 bijlage")); }} />
            </a>
          ))}
        </div>
      )}
      {melding.context && Object.keys(melding.context).length > 0 && (
        <p className="mld-hulp">{Object.entries(melding.context).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
      )}
      <div className="mld-gesprek">
        {melding.reacties.map((r, i) => (
          <div key={i} className={"mld-reactie" + (r.auteur === melding.melder ? " is-melder" : "")}>
            <span className="mld-hulp">{r.auteur} · {wanneer(r.wanneer)}</span>
            <div>{r.tekst}</div>
          </div>
        ))}
      </div>
      <form onSubmit={stuur} className="mld-reageer">
        <input value={tekst} onChange={(e) => setTekst(e.target.value)} placeholder="Reageer…" aria-label="Reactie" />
        <button type="submit" className="mld-knop">Stuur</button>
      </form>
      {fout && <p className="mld-fout">{fout}</p>}
      {beheerder && <Behandeling melding={melding} onKlaar={onVerversen} />}
    </div>
  );
}

export default function MijnMeldingen({ openId = null, onNieuw }) {
  const [stand, setStand] = useState(null);
  const [fout, setFout] = useState("");
  const [open, setOpen] = useState(openId);
  const [filter, setFilter] = useState("open");
  const laad = useCallback(() => {
    lijstMeldingen().then((d) => { setStand(d); setFout(""); }).catch((e) => setFout(e.message));
  }, []);
  useEffect(laad, [laad]);

  if (fout) return <p className="mld-fout" role="alert">{fout}</p>;
  if (!stand) return <p className="mld-hulp">Laden…</p>;
  const afgerond = (m) => ["opgelost", "afgewezen", "dubbel"].includes(m.status);
  const lijst = stand.meldingen.filter((m) => filter === "alle" || !afgerond(m));
  return (
    <div className="mld-lijst" data-testid="mijn-meldingen">
      <div className="mld-lijst__kop">
        <h2 className="mld-titel">{stand.beheerder ? "Alle meldingen" : "Mijn meldingen"}</h2>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Welke meldingen">
          <option value="open">openstaand</option>
          <option value="alle">alle</option>
        </select>
        <button type="button" className="mld-knop mld-knop--zacht" onClick={laad}>Ververs</button>
        {onNieuw && <button type="button" className="mld-knop mld-knop--hoofd" onClick={onNieuw}>+ Melden</button>}
      </div>
      {lijst.length === 0 && <p className="mld-hulp">{stand.meldingen.length ? "Geen openstaande meldingen." : "Nog geen meldingen."}</p>}
      {lijst.map((m) => (
        <div key={m.id} className={"mld-rij" + (open === m.id ? " is-open" : "")}>
          <button type="button" className="mld-rij__kop" onClick={() => setOpen(open === m.id ? null : m.id)} aria-expanded={open === m.id}>
            <span className={`mld-status mld-status--${m.status}`}>{STATUS_LABEL[m.status] || m.status}</span>
            <span className="mld-rij__titel">#{m.id} {m.titel}</span>
            <span className="mld-hulp">{soortLabel(m.soort)}{m.prioriteit ? ` · ${m.prioriteit}` : ""}{stand.beheerder && m.melder ? ` · ${m.melder}` : ""} · {wanneer(m.gemeld_op)}</span>
            {m.reacties.length > 0 && <span className="mld-hulp">💬 {m.reacties.length}</span>}
          </button>
          {open === m.id && <Detail melding={m} beheerder={stand.beheerder} onVerversen={laad} />}
        </div>
      ))}
    </div>
  );
}
