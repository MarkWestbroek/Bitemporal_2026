/**
 * naamDialog — een herbruikbare in-app naam-invoer als vervanging voor
 * `window.prompt`. Prompts worden door sommige browsers onderdrukt (na
 * "voorkom dat deze pagina extra dialoogvensters maakt") of in embedded
 * webviews stil genegeerd; dan lijkt een actie "niets te doen".
 *
 * Gebruik (werkt ook vanuit losse functies, niet alleen React-componenten):
 *
 *   const naam = await vraagNaam({ titel: "Nieuw diagram", waarde: "Nieuw diagram" });
 *   if (naam) { ... }   // null bij annuleren
 *
 * Er hangt één `<NaamDialogHost />` in de StudioShell; de service praat er via
 * een kleine listener-set mee. Eén dialoog tegelijk — een nieuwe verzoek
 * annuleert een eventueel openstaande.
 */
import React, { useEffect, useRef, useState } from "react";

/** @type {Set<() => void>} */
const luisteraars = new Set();
/** @type {{titel:string,label:string,waarde:string,bevestig:string,resolve:(v:string|null)=>void}|null} */
let _actief = null;

function meld() {
  luisteraars.forEach((fn) => fn());
}

export function vraagNaam({ titel = "Naam", label = "Naam", waarde = "", bevestig = "OK" } = {}) {
  return new Promise((resolve) => {
    if (_actief) {
      const vorige = _actief;
      _actief = null;
      vorige.resolve(null); // hangende dialoog netjes afsluiten
    }
    _actief = { titel, label, waarde, bevestig, resolve };
    meld();
  });
}

function beeindig(waarde) {
  const huidig = _actief;
  _actief = null;
  meld();
  huidig?.resolve(waarde);
}

export function NaamDialogHost() {
  const [, hertik] = useState(0);
  const [waarde, setWaarde] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    const fn = () => {
      hertik((v) => v + 1);
      if (_actief) setWaarde(_actief.waarde);
    };
    luisteraars.add(fn);
    return () => luisteraars.delete(fn);
  }, []);

  if (!_actief) return null;
  const cfg = _actief;
  const bevestigen = () => {
    const schoon = waarde.trim();
    if (schoon) beeindig(schoon);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10001,
      }}
      onClick={(e) => e.target === e.currentTarget && beeindig(null)}
    >
      <div
        style={{
          background: "var(--s-panel, #fff)",
          color: "var(--s-fg, #1e293b)",
          border: "1px solid var(--s-border, #cbd5e1)",
          borderRadius: 10,
          boxShadow: "0 12px 40px rgba(15, 23, 42, 0.25)",
          width: 380,
          maxWidth: "92vw",
          padding: "14px 16px",
          fontSize: 13,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <strong>{cfg.titel}</strong>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          {cfg.label}
          <input
            ref={inputRef}
            type="text"
            autoFocus
            value={waarde}
            onChange={(e) => setWaarde(e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => {
              if (e.key === "Enter") bevestigen();
              else if (e.key === "Escape") beeindig(null);
            }}
            style={{
              font: "inherit",
              fontSize: 13,
              padding: "4px 8px",
              border: "1px solid var(--s-border, #cbd5e1)",
              borderRadius: 6,
              background: "transparent",
              color: "var(--s-fg)",
            }}
          />
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="dc-mini-knop" onClick={() => beeindig(null)}>
            Annuleren
          </button>
          <button className="dc-mini-knop" disabled={!waarde.trim()} onClick={bevestigen}>
            {cfg.bevestig}
          </button>
        </div>
      </div>
    </div>
  );
}
