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
// Klikken ín een dialoog tellen niet mee: anders opent de volgende dialoog
// van een reeks (pakket → map → review) steeds bij de OK-knop van de vorige,
// dus elke keer verder naar rechtsonder (Mark, 10-10). Zo blijft de reeks bij
// de menukeuze waarmee hij begon.
let _laatsteKlik = null;
if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (e.target instanceof Element && e.target.closest(".studio-dialoog-achtergrond")) return;
      _laatsteKlik = { x: e.clientX, y: e.clientY };
    },
    true
  );
}

// Maat die de gebruiker de dialoog gaf (rechtsonder slepen), per soort; geldt
// voor de volgende dialogen van die soort en blijft bewaard in deze browser
// (Mark, 10-10: "lange lijsten en lange paden").
const MAAT_SLEUTEL = "studio-dialoog-maat";
let _maten = {};
try {
  _maten = JSON.parse(globalThis.localStorage?.getItem(MAAT_SLEUTEL) || "{}") || {};
} catch {
  _maten = {};
}
function bewaarMaat(soort, maat) {
  _maten = { ..._maten, [soort]: maat };
  try {
    globalThis.localStorage?.setItem(MAAT_SLEUTEL, JSON.stringify(_maten));
  } catch {
    /* privémodus */
  }
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
export function vraagBevestiging({ titel = "Weet je het zeker?", tekst = "", bevestig = "OK", annuleer = "Annuleren", gevaar = false, vinkje = null, vinkjeVerplicht = false, opties = null } = {}) {
  // opties: losse keuzevinkjes `[{sleutel, label, aan?}]` onder de tekst; de
  // uitkomst is dan `{ok: true, opties: {sleutel: boolean}}` (of false bij
  // annuleren) i.p.v. een boolean (EA-import: "eerst git pull", "ook verwijderen").
  // `vinkje`: tekst van een extra bevestigingsvinkje (dubbele bevestiging bij
  // iets destructiefs, bv. een map mét inhoud weg). Met `vinkjeVerplicht` kan
  // de knop pas als het vinkje aan staat. Uitkomst blijft een boolean.
  return open({ soort: "bevestiging", titel, tekst, bevestig, annuleer, gevaar, vinkje, vinkjeVerplicht, opties });
}

/**
 * Keuze uit een lijst (`<select>`); de gekozen `waarde` of `null` bij annuleren.
 * @param {{titel?:string, label?:string, opties:{waarde:string,label:string}[], waarde?:string, bevestig?:string}} cfg
 */
export function vraagKeuze({ titel = "Kies", label = "Keuze", opties = [], waarde = "", bevestig = "OK", zoekbaar = false, nieuw = null } = {}) {
  // zoekbaar: een zoekveld boven een scrollbare lijst (lange lijsten, bv. de
  // 2000 pakketten van een EA-repository); het filter kijkt naar elk stukje
  // van het label, los van hoofdletters.
  // nieuw: `{ label, placeholder? }` zet een tekstveld onder de lijst ("nieuwe
  // map in de gekozen map"); de uitkomst is dan `{ waarde, nieuw }` met `nieuw`
  // de ingevulde tekst (leeg = niets nieuws) i.p.v. alleen de waarde.
  return open({ soort: "keuze", titel, label, opties, waarde: waarde || opties[0]?.waarde || "", bevestig, zoekbaar, nieuw });
}

/**
 * Review met aan-/uitvinken, als boom: takken (bv. profiel → EA-pakket) met
 * bladeren (regels met een sleutel, status en detail). Een tak aan-/uitvinken
 * zet alle bladeren eronder; takken klappen in/uit, dus een review van
 * 20.000 regels blijft te overzien (Mark, 09-10: "alles of niets en dan
 * uitvinken"). De uitkomst is de Set van aangevinkte sleutels, of `null` bij
 * annuleren. `groepen` (plat: kop + regels) blijft werken als één laag takken.
 * @param {{titel?:string, tekst?:string, boom?: ReviewKnoop[],
 *   groepen?: {kop:string, regels:{sleutel:string, label:string, status?:string, detail?:string, aan?:boolean}[]}[], bevestig?:string}} cfg
 * @typedef {{sleutel?:string, label:string, status?:string, detail?:string, aan?:boolean, kinderen?:ReviewKnoop[]}} ReviewKnoop
 * @returns {Promise<Set<string>|null>}
 */
export function vraagReview({ titel = "Review", tekst = "", groepen = [], boom = null, bevestig = "Toepassen" } = {}) {
  const knopen = boom || groepen.map((g) => ({ label: g.kop, kinderen: g.regels || [] }));
  const aan = new Set();
  const loop = (k) => {
    if (k.kinderen) k.kinderen.forEach(loop);
    else if (k.sleutel && k.aan !== false) aan.add(k.sleutel);
  };
  knopen.forEach(loop);
  return open({ soort: "review", titel, tekst, knopen, aan, bevestig });
}

/**
 * Alle bladsleutels onder een review-knoop — één keer berekend en op de knoop
 * bewaard (`_sleutels`): een boom van 20.000 regels rendert anders elke tak
 * opnieuw over zijn hele deelboom bij elk vinkje.
 */
function reviewBladeren(knoop) {
  if (!knoop.kinderen) return knoop.sleutel ? [knoop.sleutel] : [];
  if (!knoop._sleutels) {
    const uit = [];
    for (const k of knoop.kinderen) uit.push(...reviewBladeren(k));
    knoop._sleutels = uit;
  }
  return knoop._sleutels;
}

/** Aantallen per status onder een knoop (gecached als `_tel`). */
function reviewTelling(knoop) {
  if (knoop._tel) return knoop._tel;
  const tel = { nieuw: 0, gewijzigd: 0, verdwenen: 0 };
  const loop = (k) => {
    if (k.kinderen) k.kinderen.forEach(loop);
    else if (k.status in tel) tel[k.status] += 1;
  };
  loop(knoop);
  knoop._tel = tel;
  return tel;
}

/** Standaard open: de bovenste laag, en álles als de boom klein is. */
function reviewStandaardOpen(knopen) {
  const open = new Set();
  const totaal = knopen.reduce((n, k) => n + reviewBladeren(k).length, 0);
  const loop = (k, pad, diepte) => {
    if (!k.kinderen) return;
    if (diepte === 0 || totaal <= 300) open.add(pad);
    k.kinderen.forEach((c, i) => loop(c, `${pad}/${i}`, diepte + 1));
  };
  knopen.forEach((k, i) => loop(k, String(i), 0));
  return open;
}

const STATUS_KLEUR = { nieuw: "#dcfce7", gewijzigd: "#fef3c7", verdwenen: "#fee2e2" };

/** Eén tak of blad van de review-boom (recursief). */
function ReviewTak({ knoop, pad, diepte, vinken, zetVink, open, toggleOpen }) {
  const vakRef = useRef(null);
  const isTak = Array.isArray(knoop.kinderen);
  const sleutels = isTak ? reviewBladeren(knoop) : [knoop.sleutel];
  const aantalAan = sleutels.reduce((n, k) => n + (vinken.has(k) ? 1 : 0), 0);
  const alles = sleutels.length > 0 && aantalAan === sleutels.length;
  const deels = aantalAan > 0 && !alles;
  useEffect(() => {
    if (vakRef.current) vakRef.current.indeterminate = deels;
  }, [deels]);
  const inspring = 18 * diepte;
  if (!isTak) {
    return (
      <label style={{ display: "flex", flexDirection: "row", alignItems: "baseline", gap: 6, padding: `2px 0 2px ${inspring + 18}px`, fontSize: 12 }}>
        <input type="checkbox" checked={vinken.has(knoop.sleutel)} onChange={(e) => zetVink([knoop.sleutel], e.target.checked)} />
        {knoop.status && (
          <span style={{ fontSize: 10, padding: "0 6px", borderRadius: 8, background: STATUS_KLEUR[knoop.status] || "#f1f5f9", color: "#1e293b", flex: "0 0 auto" }}>
            {knoop.status}
          </span>
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{knoop.label}</span>
        {knoop.detail && <span style={{ opacity: 0.65, whiteSpace: "nowrap" }}>— {knoop.detail}</span>}
      </label>
    );
  }
  const isOpen = open.has(pad);
  // Samenvatting per status, zodat een dichte tak ook iets zegt.
  const tel = reviewTelling(knoop);
  const samenvatting = Object.entries(tel).filter(([, n]) => n).map(([st, n]) => `${n} ${st}`).join(" · ");
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6, padding: `3px 0 3px ${inspring}px`, fontWeight: diepte === 0 ? 600 : 500, fontSize: diepte === 0 ? 13 : 12 }}>
        <button
          type="button"
          onClick={() => toggleOpen(pad)}
          title={isOpen ? "Inklappen" : "Uitklappen"}
          style={{ width: 16, height: 16, padding: 0, border: 0, background: "transparent", color: "inherit", cursor: "pointer", font: "inherit", lineHeight: 1 }}
        >
          {isOpen ? "▾" : "▸"}
        </button>
        <input ref={vakRef} type="checkbox" checked={alles} onChange={(e) => zetVink(sleutels, e.target.checked)} />
        <span style={{ cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} onClick={() => toggleOpen(pad)}>{knoop.label}</span>
        <span style={{ opacity: 0.6, fontWeight: 400, fontSize: 11, whiteSpace: "nowrap" }}>
          ({aantalAan}/{sleutels.length}{samenvatting ? ` — ${samenvatting}` : ""})
        </span>
      </div>
      {isOpen &&
        knoop.kinderen.map((k, i) => (
          <ReviewTak key={k.sleutel || `${pad}/${i}`} knoop={k} pad={`${pad}/${i}`} diepte={diepte + 1} vinken={vinken} zetVink={zetVink} open={open} toggleOpen={toggleOpen} />
        ))}
    </div>
  );
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
  const [optieWaarden, setOptieWaarden] = useState({});
  const [nieuwTekst, setNieuwTekst] = useState("");
  const [open, setOpen] = useState(() => new Set()); // open takken van de review-boom (pad)
  const inputRef = useRef(null);
  const vakRef = useRef(null);
  const [plek, setPlek] = useState(null);
  // Bij de klik neerzetten, binnen het venster geklemd; zonder klik gecentreerd.
  // Een boom die later uitklapt mag niet onder de rand verdwijnen: de hoogte
  // wordt geklemd op wat er onder `top` nog aan venster is (Mark, 10-10:
  // "de tree klapt open buiten het scherm"); de review-lijst scrollt dan.
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

  // Verslepen aan de titelbalk (pointer capture; binnen het venster geklemd).
  const _sleep = useRef(null);
  const sleepStart = (e) => {
    if (e.button !== 0) return;
    const r = vakRef.current?.getBoundingClientRect();
    if (!r) return;
    _sleep.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const sleepBeweeg = (e) => {
    const g = _sleep.current;
    if (!g) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    setPlek({
      left: Math.max(8, Math.min(e.clientX - g.dx, vw - g.w - 8)),
      top: Math.max(8, Math.min(e.clientY - g.dy, vh - 40)),
    });
  };
  const sleepStop = () => {
    _sleep.current = null;
  };

  useEffect(() => {
    const fn = () => {
      hertik((v) => v + 1);
      if (_actief) {
        setWaarde(_actief.waarde || "");
        setFilter("");
        setVinken(new Set(_actief.aan || []));
        setVink(false);
        setOptieWaarden(Object.fromEntries((_actief.opties || []).map((o) => [o.sleutel, !!o.aan])));
        setNieuwTekst("");
        setOpen(_actief.knopen ? reviewStandaardOpen(_actief.knopen) : new Set());
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
  const maatSoort = cfg.soort === "keuze" && cfg.zoekbaar ? "lijst" : cfg.soort;
  const annuleerWaarde = isBevestiging ? false : null;
  const bevestigen = () => {
    if (isNaam) {
      const schoon = waarde.trim();
      if (schoon || cfg.leegToegestaan) beeindig(schoon);
    } else if (isKeuze) {
      if (waarde) beeindig(cfg.nieuw ? { waarde, nieuw: nieuwTekst.trim() } : waarde);
    } else if (isReview) {
      beeindig(new Set(vinken));
    } else beeindig(isBevestiging ? (cfg.opties ? { ok: true, opties: { ...optieWaarden } } : true) : undefined);
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
        onPointerUp={() => {
          // De browser zet width/height inline zodra je de hoek versleept.
          const el = vakRef.current;
          if (el?.style.height) bewaarMaat(maatSoort, { w: el.offsetWidth, h: el.offsetHeight });
        }}
        style={{
          ...(plek ? { position: "absolute", left: plek.left, top: plek.top } : {}),
          // Nooit onder de onderrand: de inhoud (review-boom, lange lijst) scrollt.
          maxHeight: plek ? `calc(100vh - ${plek.top}px - 8px)` : "92vh",
          boxSizing: "border-box",
          background: "var(--s-panel, #fff)",
          color: "var(--s-fg, #1e293b)",
          border: "1px solid var(--s-border, #cbd5e1)",
          borderRadius: 10,
          boxShadow: "0 12px 40px rgba(15, 23, 42, 0.25)",
          width: _maten[maatSoort]?.w || (isReview ? 640 : cfg.meerregelig || isKeuze ? 520 : 400),
          ...(_maten[maatSoort]?.h ? { height: _maten[maatSoort].h } : {}),
          maxWidth: "calc(100vw - 16px)",
          minWidth: 320,
          minHeight: 140,
          // Rechtsonder te vergroten; de inhoud (lijst, review-boom) groeit mee.
          resize: "both",
          overflow: "hidden",
          padding: "14px 16px",
          fontSize: 13,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <strong
          style={{ cursor: "move", userSelect: "none", touchAction: "none" }}
          title="Sleep om de dialoog te verplaatsen"
          onPointerDown={sleepStart}
          onPointerMove={sleepBeweeg}
          onPointerUp={sleepStop}
          onPointerCancel={sleepStop}
        >
          {cfg.titel}
        </strong>
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
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, minHeight: 0, flex: 1 }}>
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
              style={{ ...veldStijl, maxWidth: "100%", ...(cfg.zoekbaar ? { fontFamily: "ui-monospace, monospace", fontSize: 12, flex: "1 1 auto", minHeight: 96 } : {}) }}
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
            {cfg.nieuw && (
              <span style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                {cfg.nieuw.label}
                <input
                  type="text"
                  value={nieuwTekst}
                  placeholder={cfg.nieuw.placeholder || ""}
                  onChange={(e) => setNieuwTekst(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") bevestigen();
                  }}
                  style={veldStijl}
                />
              </span>
            )}
          </label>
        ) : isReview ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0, flex: 1 }}>
            {cfg.tekst && <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45, fontSize: 12, opacity: 0.85 }}>{cfg.tekst}</div>}
            <div style={{ overflow: "auto", flex: 1, minHeight: 80, border: "1px solid var(--s-border, #cbd5e1)", borderRadius: 6, padding: "4px 8px" }}>
              {(cfg.knopen || []).map((k, i) => (
                <ReviewTak
                  key={String(i)}
                  knoop={k}
                  pad={String(i)}
                  diepte={0}
                  vinken={vinken}
                  zetVink={zetVink}
                  open={open}
                  toggleOpen={(pad) =>
                    setOpen((o) => {
                      const n = new Set(o);
                      n.has(pad) ? n.delete(pad) : n.add(pad);
                      return n;
                    })
                  }
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
              <button className="dc-mini-knop" onClick={() => zetVink((cfg.knopen || []).flatMap((k) => reviewBladeren(k)), true)}>Alles</button>
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
            {isBevestiging &&
              (cfg.opties || []).map((o) => (
                <label key={o.sleutel} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <input type="checkbox" checked={!!optieWaarden[o.sleutel]} onChange={(e) => setOptieWaarden((w) => ({ ...w, [o.sleutel]: e.target.checked }))} />
                  {o.label}
                </label>
              ))}
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
