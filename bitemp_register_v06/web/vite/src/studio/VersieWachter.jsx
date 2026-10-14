/**
 * VersieWachter — "er is een nieuwe versie" en "wat is er nieuw" (Mark, 14-10: Hugo kreeg de
 * release pas na een F5).
 *
 * - Elke 5 minuten, en als je terugkomt in het tabblad, vraagt de Studio `versie.json` op
 *   (vite.config.js, plugin versieBestand). Is de build anders dan die in deze pagina, dan
 *   verschijnt een strook met de kopjes van de nieuwe versie en **Herladen**. Staan er nog
 *   wijzigingen klaar voor de server, dan verstuurt Herladen die eerst.
 * - Na het eerste laden van een nieuwere versie toont de Studio één keer **Wat is er nieuw**
 *   (de releases sinds je vorige bezoek, uit de CHANGELOG van deze build). Ook via Help.
 *   "Gezien" per browser: localStorage `studio05-versie-gezien`.
 */
import React, { useEffect, useState } from "react";
import { menuBus } from "./menuBus";
import { leesChangelog, releasesSinds, releaselogUrl, vergelijkVersie } from "./releaseNotities.js";

const VERSIE = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
const BUILD = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";
const GEZIEN = "studio05-versie-gezien";
const INTERVAL = 5 * 60 * 1000;

const lees = () => { try { return localStorage.getItem(GEZIEN); } catch { return null; } };
const bewaar = (v) => { try { localStorage.setItem(GEZIEN, v); } catch { /* opslag uit */ } };
const datumTekst = (d) => {
  const t = new Date(d);
  return isNaN(t) ? d : t.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
};

/** De CHANGELOG van deze build (los blok, alleen geladen als iemand hem wil zien). */
async function laadReleases() {
  const { default: md } = await import("../../CHANGELOG.md?raw");
  return leesChangelog(md);
}

function WatIsErNieuw({ sinds, onSluit }) {
  const [releases, setReleases] = useState(null);
  useEffect(() => {
    laadReleases().then((alle) => {
      const lijst = sinds ? releasesSinds(alle, sinds, VERSIE) : alle.filter((r) => vergelijkVersie(r.versie, VERSIE) <= 0).slice(0, 3);
      setReleases(lijst.length ? lijst : alle.slice(0, 1));
    }).catch(() => setReleases([]));
  }, [sinds]);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onSluit();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSluit]);
  return (
    <div className="studio-palette-overlay" onMouseDown={onSluit}>
      <div className="studio-nieuw" role="dialog" aria-label="Wat is er nieuw" onMouseDown={(e) => e.stopPropagation()} data-testid="wat-is-nieuw">
        <div className="studio-sneltoetsen__kop">
          <h2>Wat is er nieuw{sinds ? " sinds je vorige bezoek" : ""}</h2>
          <button type="button" className="studio-hint__knop studio-hint__knop--zacht" onClick={onSluit} aria-label="Sluiten">×</button>
        </div>
        {!releases && <p className="studio-sneltoetsen__voet">Laden…</p>}
        {releases?.map((r) => (
          <section key={r.versie} className="studio-nieuw__release">
            <h3>Versie {r.versie} <span>· {datumTekst(r.datum)}</span></h3>
            {r.inleiding && <p>{r.inleiding}</p>}
            {r.groepen.filter((g) => !/^tests?$/i.test(g.kop)).map((g) => (
              <div key={g.kop}>
                <h4>{g.kop}</h4>
                <ul>
                  {g.items.map((i, n) => (
                    <li key={n}>{i.titel && <strong>{i.titel}. </strong>}{i.tekst.length > 260 ? i.tekst.slice(0, 257) + "…" : i.tekst}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ))}
        <p className="studio-sneltoetsen__voet">
          <a href={releaselogUrl(VERSIE)} target="_blank" rel="noopener noreferrer">Volledige releaselog</a> · Omnium Studio {VERSIE}
        </p>
      </div>
    </div>
  );
}

export default function VersieWachter({ uitgesteld = false }) {
  const [nieuw, setNieuw] = useState(null); // versie.json van de server als die anders is
  const [venster, setVenster] = useState(null); // null | {sinds}

  // Na een update: één keer "wat is er nieuw" (niet bij een eerste bezoek: dan is er de rondleiding).
  useEffect(() => {
    if (VERSIE === "dev" || uitgesteld) return;
    const gezien = lees();
    if (!gezien) bewaar(VERSIE);
    else if (vergelijkVersie(VERSIE, gezien) > 0) {
      setVenster({ sinds: gezien });
      bewaar(VERSIE);
    }
  }, [uitgesteld]);

  useEffect(() => {
    let weg = false;
    const kijk = async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL || "/viz/react/"}versie.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const v = await res.json();
        if (!weg && v?.build && v.build !== BUILD) setNieuw(v);
      } catch {
        /* offline of geen versie.json: niets melden */
      }
    };
    const eerste = setTimeout(kijk, 20_000);
    const t = setInterval(kijk, INTERVAL);
    const zicht = () => document.visibilityState === "visible" && kijk();
    document.addEventListener("visibilitychange", zicht);
    const af = [
      menuBus.on("help:wat-is-nieuw", () => setVenster({ sinds: null })),
      menuBus.on("help:versie-controleren", kijk),
    ];
    return () => { weg = true; clearTimeout(eerste); clearInterval(t); document.removeEventListener("visibilitychange", zicht); af.forEach((f) => f()); };
  }, []);

  async function herlaad() {
    try {
      const { useSyncStore, verzend } = await import("./sync/verzender.js");
      if (useSyncStore.getState().teVerzenden > 0) await verzend();
      const rest = useSyncStore.getState().teVerzenden;
      if (rest > 0 && !window.confirm(`Er staan nog ${rest} wijziging(en) klaar voor de server. Toch herladen? (Ze blijven in deze browser bewaard.)`)) return;
    } catch {
      /* geen sync: gewoon herladen */
    }
    window.location.reload();
  }

  return (
    <>
      {nieuw && (
        <div className="studio-hint studio-hint--versie" role="status" aria-live="polite" data-testid="nieuwe-versie">
          <span className="studio-hint__icoon" aria-hidden="true">⬆</span>
          <div className="studio-hint__tekst">
            <strong>Nieuwe versie van Omnium{nieuw.versie && nieuw.versie !== VERSIE ? ` (${nieuw.versie})` : ""}. </strong>
            {nieuw.nieuw?.length ? `Nieuw: ${nieuw.nieuw.slice(0, 3).join(" · ")}. ` : ""}
            Herlaad om hem te gebruiken; je werk blijft bewaard.
          </div>
          <button type="button" className="studio-hint__knop studio-tour__verder" onClick={herlaad}>Herladen</button>
          <button type="button" className="studio-hint__knop studio-hint__knop--zacht" onClick={() => setNieuw(null)}>Later</button>
        </div>
      )}
      {venster && <WatIsErNieuw sinds={venster.sinds} onSluit={() => setVenster(null)} />}
    </>
  );
}
