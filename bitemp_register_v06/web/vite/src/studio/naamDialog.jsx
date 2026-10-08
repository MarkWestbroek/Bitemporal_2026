/**
 * naamDialog — in-app dialogen als vervanging voor `window.prompt`,
 * `window.confirm` en `window.alert`. Browser-popups worden door sommige
 * browsers onderdrukt (na "voorkom dat deze pagina extra dialoogvensters
 * maakt") of in embedded webviews stil genegeerd; dan lijkt een actie "niets
 * te doen". Bovendien passen ze niet bij de Studio (gemeld 2026-10-07: "kunnen
 * alle popupjes vervangen worden door een modal?").
 *
 * Drie soorten (allemaal Promise-gebaseerd, bruikbaar vanuit losse functies):
 *
 *   const naam = await vraagNaam({ titel: "Nieuw diagram", waarde: "Nieuw diagram" });
 *   if (naam) { … }                                  // null bij annuleren
 *   if (!(await vraagBevestiging({ tekst: "Map verwijderen?" }))) return;   // boolean
 *   await toonMelding({ tekst: "Import mislukt: …" });                        // alleen OK
 *
 * Voor "maak iets nieuws met een naam" is een dialoog vaak niet eens nodig:
 * maak het ding met een standaardnaam en zet de regel meteen in inline
 * hernoemen (zoals een nieuwe map in de projectboom).
 *
 * Er hangt één `<NaamDialogHost />` in de StudioShell; de service praat er via
 * een kleine listener-set mee. Eén dialoog tegelijk — een nieuw verzoek
 * annuleert een eventueel openstaande (naam → null, bevestiging → false).
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

/** @type {Set<() => void>} */
const luisteraars = new Set();
/**
 * @type {{soort:"naam"|"bevestiging"|"melding", titel:string, label?:string, tekst?:string,
 *   waarde?:string, meerregelig?:boolean, bevestig:string, annuleer?:string, gevaar?:boolean,
 *   resolve:(v:any)=>void}|null}
 */
let _actief = null;

// Laatste muisklik: de dialoog verschijnt dáár in de buurt i.p.v. midden op
// het scherm (gemeld 2026-10-07: "ze staan meestal ver van waar je klikte").
let _laatsteKlik = null;
if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    (e) => {
      _laatsteKlik = { x: e.clientX, y: e.clientY };
    },
    true
  );
}

function signaleer() {
  luisteraars.forEach((fn) => fn());
}

function open(cfg) {
  return new Promise((resolve) => {
    if (_actief) {
      const vorige = _actief;
      _actief = null;
      vorige.resolve(vorige.soort === "bevestiging" ? false : null); // hangende dialoog netjes afsluiten
    }
    _actief = { ...cfg, resolve };
    signaleer();
  });
}

/** Tekst vragen; `null` bij annuleren. `meerregelig` geeft een textarea (plakken van JSON e.d.). */
export function vraagNaam({ titel = "Naam", label = "Naam", waarde = "", bevestig = "OK", meerregelig = false, leegToegestaan = false } = {}) {
  return open({ soort: "naam", titel, label, waarde, bevestig, meerregelig, leegToegestaan });
}

/** Ja/nee-vraag; `true` bij bevestigen. `gevaar` kleurt de knop rood (verwijderen e.d.). */
export function vraagBevestiging({ titel = "Weet je het zeker?", tekst = "", bevestig = "OK", annuleer = "Annuleren", gevaar = false, vinkje = null, vinkjeVerplicht = false } = {}) {
  // `vinkje`: tekst van een extra bevestigingsvinkje (dubbele bevestiging bij
  // iets destructiefs, bv. een map mét inhoud weg). Met `vinkjeVerplicht` kan
  // de knop pas als het vinkje aan staat. Uitkomst blijft een boolean.
  return open({ soort: "bevestiging", titel, tekst, bevestig, annuleer, gevaar, vinkje, vinkjeVerplicht });
}

/**
 * Keuze uit een lijst (`<select>`); de gekozen `waarde` of `null` bij annuleren.
 * @param {{titel?:string, label?:string, opties:{waarde:string,label:string}[], waarde?:string, bevestig?:string}} cfg
 */
export function vraagKeuze({ titel = "Kies", label = "Keuze", opties = [], waarde = "", bevestig = "OK", zoekbaar = false } = {}) {
  // zoekbaar: een zoekveld boven een scrollbare lijst (lange lijsten, bv. de
  // 2000 pakketten van een EA-repository); het filter kijkt naar elk stukje
  // van het label, los van hoofdletters.
  return open({ soort: "keuze", titel, label, opties, waarde: waarde || opties[0]?.waarde || "", bevestig, zoekbaar });
}

/**
 * Review met aan-/uitvinken: groepen regels met een status en detail; de
 * uitkomst is de Set van aangevinkte sleutels, of `null` bij annuleren.
 * @param {{titel?:string, tekst?:string, groepen:{kop:string, regels:{sleutel:string, label:string, status?:string, detail?:string, aan?:boolean}[]}[], bevestig?:string}} cfg
 * @returns {Promise<Set<string>|null>}
 */
export function vraagReview({ titel = "Review", tekst = "", groepen = [], bevestig = "Toepassen" } = {}) {
  const aan = new Set();
  for (const g of groepen) for (const r of g.regels || []) if (r.aan !== false) aan.add(r.sleutel);
  return open({ soort: "review", titel, tekst, groepen, aan, bevestig });
}

/** Mededeling met alleen een OK-knop (vervangt window.alert). */
export function toonMelding({ titel = "Melding", tekst = "", bevestig = "OK" } = {}) {
  return open({ soort: "melding", titel, tekst, bevestig });
}

/** Opties waarvan het label alle (spatie-gescheiden) zoekwoorden bevat, hoofdletterongevoelig. */
function filterOpties(opties, filter) {
  const woorden = String(filter || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!woorden.length) return opties || [];
  return (opties || []).filter((o) => {
    const l = String(o.label || "").toLowerCase();
    return woorden.every((w) => l.includes(w));
  });
}

function beeindig(waarde) {
  const huidig = _actief;
  _actief = null;
  signaleer();
  huidig?.resolve(waarde);
}

export function NaamDialogHost() {
  const [, hertik] = useState(0);
  const [waarde, setWaarde] = useState("");
  const [filter, setFilter] = useState("");
  const [vinken, setVinken] = useState(() => new Set());
  const [vink, setVink] = useState(false);
  const inputRef = useRef(null);
  const vakRef = useRef(null);
  const [plek, setPlek] = useState(null);
  // Bij de klik neerzetten, binnen het venster geklemd; zonder klik gecentreerd.
  useLayoutEffect(() => {
    const vak = vakRef.current;
    if (!vak || !_actief) {
      setPlek(null);
      return;
    }
    const k = _laatsteKlik;
    if (!k) {
      setPlek(null);
      return;
    }
    const r = vak.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const left = Math.max(8, Math.min(k.x + 12, vw - r.width - 8));
    const top = Math.max(8, Math.min(k.y + 12, vh - r.height - 8));
    setPlek({ left, top });
  }, [_actief]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fn = () => {
      hertik((v) => v + 1);
      if (_actief) {
        setWaarde(_actief.waarde || "");
        setFilter("");
        setVinken(new Set(_actief.aan || []));
        setVink(false);
      }
    };
    luisteraars.add(fn);
    return () => luisteraars.delete(fn);
  }, []);

  if (!_actief) return null;
  const cfg = _actief;
  const isNaam = cfg.soort === "naam";
  const isKeuze = cfg.soort === "keuze";
  const isReview = cfg.soort === "review";
  const isBevestiging = cfg.soort === "bevestiging";
  const annuleerWaarde = isBevestiging ? false : null;
  const bevestigen = () => {
    if (isNaam) {
      const schoon = waarde.trim();
      if (schoon || cfg.leegToegestaan) beeindig(schoon);
    } else if (isKeuze) {
      if (waarde) beeindig(waarde);
    } else if (isReview) {
      beeindig(new Set(vinken));
    } else beeindig(isBevestiging ? true : undefined);
  };
  const zetVink = (sleutels, aan) =>
    setVinken((v) => {
      const n = new Set(v);
      for (const k of sleutels) (aan ? n.add(k) : n.delete(k));
      return n;
    });
  const veldStijl = {
    font: "inherit",
    fontSize: 13,
    padding: "4px 8px",
    border: "1px solid var(--s-border, #cbd5e1)",
    borderRadius: 6,
    background: "transparent",
    color: "var(--s-fg)",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="studio-dialoog-achtergrond"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10001,
      }}
      onClick={(e) => e.target === e.currentTarget && beeindig(annuleerWaarde)}
      // Escape sluit ook zonder focus in het veld (bevestiging/melding).
      onKeyDown={(e) => {
        if (e.key === "Escape") beeindig(annuleerWaarde);
        else if (e.key === "Enter" && !isNaam && !isKeuze && !isReview) bevestigen();
      }}
    >
      <div
        ref={vakRef}
        className="studio-dialoog"
        style={{
          ...(plek ? { position: "absolute", left: plek.left, top: plek.top } : {}),
          background: "var(--s-panel, #fff)",
          color: "var(--s-fg, #1e293b)",
          border: "1px solid var(--s-border, #cbd5e1)",
          borderRadius: 10,
          boxShadow: "0 12px 40px rgba(15, 23, 42, 0.25)",
          width: isReview ? 640 : cfg.meerregelig || isKeuze ? 520 : 400,
          ...(isReview ? { maxHeight: "86vh" } : {}),
          maxWidth: "92vw",
          padding: "14px 16px",
          fontSize: 13,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <strong>{cfg.titel}</strong>
        {isNaam ? (
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
            {cfg.label}
            {cfg.meerregelig ? (
              <textarea
                ref={inputRef}
                autoFocus
                rows={10}
                value={waarde}
                onChange={(e) => setWaarde(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) bevestigen();
                }}
                style={{ ...veldStijl, fontFamily: "ui-monospace, monospace", resize: "vertical" }}
              />
            ) : (
              <input
                ref={inputRef}
                type="text"
                autoFocus
                value={waarde}
                onChange={(e) => setWaarde(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") bevestigen();
                }}
                style={veldStijl}
              />
            )}
          </label>
        ) : isKeuze ? (
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
            {cfg.label}
            {cfg.zoekbaar && (
              <input
                type="search"
                autoFocus
                placeholder="Zoek (meerdere woorden mag)"
                value={filter}
                onChange={(e) => {
                  const f = e.target.value;
                  setFilter(f);
                  // Houd een geldige keuze: valt de huidige buiten het filter,
                  // spring naar de eerste die er wél in zit.
                  const gefilterd = filterOpties(cfg.opties, f);
                  if (gefilterd.length && !gefilterd.some((o) => o.waarde === waarde)) setWaarde(gefilterd[0].waarde);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") bevestigen();
                }}
                style={veldStijl}
              />
            )}
            <select
              autoFocus={!cfg.zoekbaar}
              size={cfg.zoekbaar ? 12 : undefined}
              value={waarde}
              onChange={(e) => setWaarde(e.target.value)}
              onDoubleClick={() => bevestigen()}
              onKeyDown={(e) => {
                if (e.key === "Enter") bevestigen();
              }}
              style={{ ...veldStijl, maxWidth: "100%", ...(cfg.zoekbaar ? { fontFamily: "ui-monospace, monospace", fontSize: 12 } : {}) }}
            >
              {filterOpties(cfg.opties, cfg.zoekbaar ? filter : "").map((o) => (
                <option key={o.waarde} value={o.waarde}>
                  {o.label}
                </option>
              ))}
            </select>
            {cfg.zoekbaar && (
              <span style={{ opacity: 0.7 }}>
                {filterOpties(cfg.opties, filter).length} van {(cfg.opties || []).length}
              </span>
            )}
          </label>
        ) : isReview ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
            {cfg.tekst && <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45, fontSize: 12, opacity: 0.85 }}>{cfg.tekst}</div>}
            <div style={{ overflow: "auto", maxHeight: "58vh", border: "1px solid var(--s-border, #cbd5e1)", borderRadius: 6, padding: "4px 8px" }}>
              {(cfg.groepen || []).map((g) => {
                const sleutels = (g.regels || []).map((r) => r.sleutel);
                const alles = sleutels.length > 0 && sleutels.every((k) => vinken.has(k));
                return (
                  <div key={g.kop} style={{ marginBottom: 8 }}>
                    <label style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6, fontWeight: 600, padding: "4px 0" }}>
                      <input type="checkbox" checked={alles} onChange={(e) => zetVink(sleutels, e.target.checked)} />
                      {g.kop} <span style={{ opacity: 0.6, fontWeight: 400 }}>({sleutels.length})</span>
                    </label>
                    {(g.regels || []).map((r) => (
                      <label key={r.sleutel} style={{ display: "flex", flexDirection: "row", alignItems: "baseline", gap: 6, padding: "2px 0 2px 18px", fontSize: 12 }}>
                        <input type="checkbox" checked={vinken.has(r.sleutel)} onChange={(e) => zetVink([r.sleutel], e.target.checked)} />
                        {r.status && (
                          <span
                            style={{
                              fontSize: 10,
                              padding: "0 6px",
                              borderRadius: 8,
                              background: r.status === "nieuw" ? "#dcfce7" : r.status === "gewijzigd" ? "#fef3c7" : r.status === "verdwenen" ? "#fee2e2" : "#f1f5f9",
                              color: "#1e293b",
                              flex: "0 0 auto",
                            }}
                          >
                            {r.status}
                          </span>
                        )}
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
                        {r.detail && <span style={{ opacity: 0.65, whiteSpace: "nowrap" }}>— {r.detail}</span>}
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
              <button className="dc-mini-knop" onClick={() => zetVink((cfg.groepen || []).flatMap((g) => (g.regels || []).map((r) => r.sleutel)), true)}>Alles</button>
              <button className="dc-mini-knop" onClick={() => setVinken(new Set())}>Niets</button>
              <span style={{ opacity: 0.7, alignSelf: "center" }}>{vinken.size} aangevinkt</span>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{cfg.tekst}</div>
            {isBevestiging && cfg.vinkje && (
              <label style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600 }}>
                <input type="checkbox" checked={vink} onChange={(e) => setVink(e.target.checked)} />
                {cfg.vinkje}
              </label>
            )}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {cfg.soort !== "melding" && (
            <button className="dc-mini-knop" onClick={() => beeindig(annuleerWaarde)}>
              {cfg.annuleer || "Annuleren"}
            </button>
          )}
          <button
            className={"dc-mini-knop" + (cfg.gevaar ? " is-gevaar" : "")}
            autoFocus={!isNaam && !isKeuze && !isReview}
            disabled={(isNaam && !waarde.trim() && !cfg.leegToegestaan) || (isKeuze && !waarde) || (isBevestiging && cfg.vinkjeVerplicht && !vink)}
            onClick={bevestigen}
          >
            {cfg.bevestig}
          </button>
        </div>
      </div>
    </div>
  );
}
