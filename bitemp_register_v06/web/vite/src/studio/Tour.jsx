/**
 * Tour — de kennismakingstour (HELP-2). Stappen en logica: tourStappen.js. Eigen spotlight
 * (een gat in een donkere laag via box-shadow, pointer-events uit, zodat het aangewezen
 * element klikbaar blijft) en een ballon met "stap i van n". Toetsen: → of Enter verder,
 * ← terug, Esc sluit (niet als je in een invoerveld of dialoog typt).
 *
 * Start: automatisch bij het eerste bezoek (HelpHost), of via Help → Rondleiding.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { menuBus } from "./menuBus";
import { getProfieltypen } from "./profieltypeRegistry";
import useStudioStore from "./useStudioStore.js";
import { TOUR_STAPPEN, zoekAnker, volgendeStap, markeerTourGezien, ballonPositie } from "./tourStappen.js";

/** Tellingen over alle profielen, voor de `klaar`-voorwaarden. */
function telStand() {
  let diagrammen = 0;
  let elementen = 0;
  for (const p of getProfieltypen()) {
    const s = p.useStore?.getState?.();
    if (!s) continue;
    diagrammen += Object.keys(s.diagrams || {}).length;
    elementen += Object.keys(s.elements || {}).length;
  }
  return { diagrammen, elementen };
}

const typtErgens = (e) => {
  const t = e.target;
  return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
};

export default function Tour({ onSluit, stappen = TOUR_STAPPEN }) {
  // De rondleiding gaat over Modelleren: daar beginnen (een nieuwe browser opent soms
  // een andere activiteit). De ankers worden elke 300 ms opnieuw gezocht, dus ze komen vanzelf.
  const [stap, setStap] = useState(() => volgendeStap(stappen, -1));
  useLayoutEffect(() => {
    const st = useStudioStore.getState();
    if (st.activeId !== "modelleren") st.setActief("modelleren");
  }, []);
  const [rect, setRect] = useState(null);
  const [maat, setMaat] = useState({ w: 360, h: 180 });
  const ballonRef = useRef(null);
  const startRef = useRef(telStand());
  const huidig = stap >= 0 ? stappen[stap] : null;

  const sluit = () => {
    markeerTourGezien();
    onSluit();
  };
  const verder = () => {
    const v = volgendeStap(stappen, stap, 1);
    if (v < 0) sluit();
    else setStap(v);
  };
  const terug = () => setStap((s) => volgendeStap(stappen, s, -1));

  // Bij een nieuwe stap: nulpunt voor `klaar`, en de focus in de ballon.
  useEffect(() => {
    startRef.current = telStand();
    requestAnimationFrame(() => ballonRef.current?.querySelector("[data-tour-verder]")?.focus());
  }, [stap]);

  // Anker volgen (panelen schuiven, vensters veranderen) en `klaar` controleren.
  useEffect(() => {
    if (!huidig) return undefined;
    const meet = () => {
      const el = zoekAnker(huidig.anker);
      const r = el?.getBoundingClientRect();
      setRect(r && r.width > 0 ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height } : null);
      if (huidig.klaar?.(startRef.current, telStand())) verder();
    };
    meet();
    const t = setInterval(meet, 300);
    window.addEventListener("resize", meet);
    return () => {
      clearInterval(t);
      window.removeEventListener("resize", meet);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stap]);

  useLayoutEffect(() => {
    const b = ballonRef.current?.getBoundingClientRect();
    if (b && (Math.abs(b.width - maat.w) > 1 || Math.abs(b.height - maat.h) > 1)) setMaat({ w: b.width, h: b.height });
  });

  useEffect(() => {
    const onKey = (e) => {
      if (typtErgens(e)) return;
      if (e.key === "Escape") sluit();
      else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        verder();
      } else if (e.key === "ArrowLeft") terug();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!huidig) return null;
  const zichtbaar = stappen.filter((s) => !s.overslaan?.());
  const nummer = zichtbaar.indexOf(huidig) + 1;
  const pos = ballonPositie(rect, maat, { w: window.innerWidth, h: window.innerHeight });
  const laatste = volgendeStap(stappen, stap, 1) < 0;

  return (
    <div className="studio-tour" data-testid="tour">
      {rect ? (
        <div
          className="studio-tour__spot"
          style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }}
        />
      ) : (
        <div className="studio-tour__dim" />
      )}
      <div
        ref={ballonRef}
        className="studio-tour__ballon"
        role="dialog"
        aria-label={`Rondleiding: ${huidig.titel}`}
        style={{ left: pos.left, top: pos.top }}
        key={stap}
      >
        <div className="studio-tour__teller">Stap {nummer} van {zichtbaar.length}</div>
        <div className="studio-tour__titel">{huidig.titel}</div>
        <p className="studio-tour__tekst">{huidig.tekst}</p>
        {huidig.klaar && <p className="studio-tour__opdracht">Doe het maar: de rondleiding gaat dan vanzelf verder.</p>}
        {/* Eigen regel: met Terug/Volgende erbij past hij niet in de breedte (gemeld 14-10). */}
        {huidig.actie && (
          <div className="studio-tour__actie">
            <button type="button" className="studio-hint__knop" onClick={() => menuBus.emit(huidig.actie.emit)}>
              {huidig.actie.label}
            </button>
          </div>
        )}
        <div className="studio-tour__knoppen">
          <button type="button" className="studio-hint__knop studio-hint__knop--zacht" onClick={sluit}>Sluiten</button>
          <span style={{ flex: 1 }} />
          {nummer > 1 && <button type="button" className="studio-hint__knop" onClick={terug}>‹ Terug</button>}
          <button type="button" className="studio-hint__knop studio-tour__verder" data-tour-verder onClick={verder}>
            {laatste ? "Klaar" : "Volgende ›"}
          </button>
        </div>
      </div>
    </div>
  );
}
