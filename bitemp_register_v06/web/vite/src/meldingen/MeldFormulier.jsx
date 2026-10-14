/**
 * MeldFormulier — een bug, wens of vraag melden (plan docs/plans/meldingen/). Gedeeld door de
 * Studio (dialoog, met de context en eventueel een schermafbeelding) en melden.html.
 *
 * Bijlagen: plakken (Ctrl+V, ook een schermafbeelding van Win+Shift+S), slepen of kiezen. De
 * context ("dit gaat mee") vult de aanroeper; de melder ziet hem en kan hem inklappen.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { SOORTEN, controleerMelding, bijlageProbleem, maakMelding, uploadBijlage } from "./meldingApi.js";
import "./meldingen.css";

const CONTEXT_LABELS = {
  studioversie: "versie", activiteit: "activiteit", plek: "plek", projectid: "project",
  pad: "pad", onderwerpid: "onderwerp-id", browser: "browser",
};

function Voorbeeld({ bestand, onWeg }) {
  const url = useMemo(() => (bestand.type?.startsWith("image/") ? URL.createObjectURL(bestand) : null), [bestand]);
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);
  return (
    <div className="mld-bijlage">
      {url ? <img src={url} alt={bestand.name || "schermafbeelding"} /> : <span className="mld-bijlage__icoon">📄</span>}
      <span className="mld-bijlage__naam">{bestand.name || "schermafbeelding.png"}</span>
      <button type="button" className="mld-knop mld-knop--zacht" onClick={onWeg} aria-label={`${bestand.name || "bijlage"} weghalen`}>×</button>
    </div>
  );
}

export default function MeldFormulier({ context = {}, beginBijlagen = [], onKlaar, onAnnuleer, onMijnMeldingen, onSchermafbeelding }) {
  const [soort, setSoort] = useState("bug");
  const [titel, setTitel] = useState("");
  const [beschrijving, setBeschrijving] = useState("");
  const [bijlagen, setBijlagen] = useState(beginBijlagen);
  const [contextOpen, setContextOpen] = useState(false);
  const [fout, setFout] = useState("");
  const [bezig, setBezig] = useState(false);
  const [klaar, setKlaar] = useState(null); // id
  const [sleept, setSleept] = useState(false);
  const kiesRef = useRef(null);
  const titelRef = useRef(null);

  useEffect(() => { titelRef.current?.focus(); }, []);

  const voegToe = (lijst) => {
    const nieuw = [];
    for (const f of lijst) {
      const p = bijlageProbleem(f);
      if (p) { setFout(p); continue; }
      nieuw.push(f);
    }
    if (nieuw.length) { setBijlagen((b) => [...b, ...nieuw]); setFout(""); }
  };

  // Plakken: een afbeelding op het klembord wordt een bijlage (tekst plakken blijft gewoon werken).
  const onPlak = (e) => {
    const bestanden = [...(e.clipboardData?.files || [])];
    if (bestanden.length) {
      e.preventDefault();
      voegToe(bestanden.map((f, i) => (f.name && f.name !== "image.png" ? f : new File([f], `geplakt-${Date.now()}-${i}.png`, { type: f.type || "image/png" }))));
    }
  };

  async function verstuur(e) {
    e.preventDefault();
    const probleem = controleerMelding({ soort, titel });
    if (probleem) { setFout(probleem); return; }
    setBezig(true);
    setFout("");
    try {
      const { id } = await maakMelding({ soort, titel: titel.trim(), beschrijving: beschrijving.trim(), context });
      const mislukt = [];
      for (const b of bijlagen) {
        try { await uploadBijlage(id, b); } catch (err) { mislukt.push(`${b.name || "bijlage"}: ${err.message}`); }
      }
      setKlaar(id);
      if (mislukt.length) setFout(`Melding ${id} is binnen, maar niet alle bijlagen: ${mislukt.join("; ")}`);
      onKlaar?.(id);
    } catch (err) {
      setFout(err.message);
    } finally {
      setBezig(false);
    }
  }

  if (klaar) {
    return (
      <div className="mld-formulier" data-testid="melding-verstuurd">
        <h2 className="mld-titel">Bedankt!</h2>
        <p>Je melding <strong>#{klaar}</strong> is binnen. Onder <em>Mijn meldingen</em> zie je de status en kun je reageren.</p>
        {fout && <p className="mld-fout" role="alert">{fout}</p>}
        <div className="mld-acties">
          {onMijnMeldingen && <button type="button" className="mld-knop" onClick={() => onMijnMeldingen(klaar)}>Mijn meldingen</button>}
          {onAnnuleer && <button type="button" className="mld-knop mld-knop--hoofd" onClick={onAnnuleer}>Sluiten</button>}
        </div>
      </div>
    );
  }

  const contextRegels = Object.entries(context).filter(([, v]) => v);
  return (
    <form
      className={"mld-formulier" + (sleept ? " is-sleept" : "")}
      onSubmit={verstuur}
      onPaste={onPlak}
      onDragOver={(e) => { if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); setSleept(true); } }}
      onDragLeave={() => setSleept(false)}
      onDrop={(e) => { if (e.dataTransfer?.files?.length) { e.preventDefault(); setSleept(false); voegToe([...e.dataTransfer.files]); } }}
      data-testid="meld-formulier"
    >
      <h2 className="mld-titel">Melden</h2>
      <fieldset className="mld-soorten">
        <legend>Wat wil je melden?</legend>
        {SOORTEN.map((s) => (
          <label key={s.waarde} className={"mld-soort" + (soort === s.waarde ? " is-gekozen" : "")} title={s.uitleg}>
            <input type="radio" name="soort" value={s.waarde} checked={soort === s.waarde} onChange={() => setSoort(s.waarde)} />
            {s.label}
          </label>
        ))}
      </fieldset>
      <label className="mld-veld">
        <span>Titel</span>
        <input ref={titelRef} value={titel} maxLength={255} onChange={(e) => setTitel(e.target.value)} placeholder="In één regel: wat ging er mis, of wat wil je?" />
      </label>
      <label className="mld-veld">
        <span>Beschrijving</span>
        <textarea rows={5} value={beschrijving} onChange={(e) => setBeschrijving(e.target.value)}
          placeholder={soort === "bug" ? "Wat deed je, wat verwachtte je, en wat gebeurde er?" : "Vertel er wat meer over."} />
      </label>
      <div className="mld-veld">
        <span>Bijlagen</span>
        <div className="mld-bijlagen">
          {bijlagen.map((b, i) => <Voorbeeld key={i} bestand={b} onWeg={() => setBijlagen(bijlagen.filter((_, j) => j !== i))} />)}
          {/* In de Studio: nog een schermafbeelding maken, de ingevulde tekst blijft staan (melding #2). */}
          {onSchermafbeelding && (
            <button type="button" className="mld-knop" onClick={() => onSchermafbeelding(voegToe)}>+ schermafbeelding</button>
          )}
          <button type="button" className="mld-knop" onClick={() => kiesRef.current?.click()}>+ bestand</button>
          <input ref={kiesRef} type="file" multiple hidden accept="image/*,application/pdf,text/plain"
            onChange={(e) => { voegToe([...(e.target.files || [])]); e.target.value = ""; }} />
        </div>
        <small className="mld-hulp">Plak een schermafbeelding (Ctrl+V) of sleep een bestand hierheen; max 10 MB per bestand.</small>
      </div>
      {contextRegels.length > 0 && (
        <div className="mld-context">
          <button type="button" className="mld-knop mld-knop--link" aria-expanded={contextOpen} onClick={() => setContextOpen(!contextOpen)}>
            {contextOpen ? "▾" : "▸"} Dit gaat mee ({contextRegels.length})
          </button>
          {contextOpen && (
            <dl>
              {contextRegels.map(([k, v]) => (
                <React.Fragment key={k}><dt>{CONTEXT_LABELS[k] || k}</dt><dd>{v}</dd></React.Fragment>
              ))}
            </dl>
          )}
        </div>
      )}
      {fout && <p className="mld-fout" role="alert">{fout}</p>}
      <div className="mld-acties">
        {onAnnuleer && <button type="button" className="mld-knop mld-knop--zacht" onClick={onAnnuleer}>Annuleren</button>}
        <button type="submit" className="mld-knop mld-knop--hoofd" disabled={bezig}>{bezig ? "Versturen…" : "Versturen"}</button>
      </div>
    </form>
  );
}
