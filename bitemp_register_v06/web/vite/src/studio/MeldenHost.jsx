/**
 * MeldenHost — melden vanuit de Studio (plan docs/plans/meldingen/): Help → Melden…, Melden met
 * schermafbeelding…, Mijn meldingen…, rechtsklik op een item, en de sneltoetsen F8 (met
 * schermafbeelding) en Alt+M (melden), beide instelbaar (sneltoetsen.js, groep Help).
 *
 * Met schermafbeelding, zoals een knipprogramma: eerst wordt het venster **bevroren** (zodat ook
 * een open rechtsklikmenu meekomt, melding #3), dan trek je een kader op dat stilstaande beeld
 * (Esc breekt af; een klik zonder slepen neemt het hele venster). Het punt waar je begint is de
 * "plek". In het formulier maakt "+ schermafbeelding" er nog een (melding #2), zonder dat je
 * ingevulde tekst verloren gaat.
 *
 * menuBus: "help:melden" {context?}, "help:melden-kader" {context?}, "help:mijn-meldingen".
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { menuBus } from "./menuBus";
import { bindingVanEvent, bindingVoor } from "./sneltoetsen.js";
import { verzamelMeldContext } from "./meldContext.js";
import { normaliseerKader, plekVan } from "../meldingen/meldingApi.js";
import { bevries, knip } from "../meldingen/schermafbeelding.js";
import MeldFormulier from "../meldingen/MeldFormulier.jsx";
import MijnMeldingen from "../meldingen/MijnMeldingen.jsx";

const typt = (e) => {
  const t = e.target;
  return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
};
const bestandsnaam = () => `schermafbeelding-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
const isEigen = (el) => el.classList?.contains("mld-kaderlaag") || el.classList?.contains("mld-dialoog-achter");

function KaderTrekker({ beeld, onKlaar, onAnnuleer }) {
  const [start, setStart] = useState(null);
  const [eind, setEind] = useState(null);
  const laagRef = useRef(null);
  const plekRef = useRef("");
  const url = useMemo(() => beeld.canvas.toDataURL("image/png"), [beeld]);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onAnnuleer();
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onAnnuleer]);

  const venster = () => ({ w: window.innerWidth, h: window.innerHeight });
  const kader = start && eind ? normaliseerKader(start, eind, venster()) : null;

  return (
    <div
      ref={laagRef}
      className="mld-kaderlaag"
      data-testid="kaderlaag"
      onMouseDown={(e) => {
        e.preventDefault();
        // De plek nu bepalen: een open menu sluit zo meteen door deze klik.
        const onder = document.elementsFromPoint(e.clientX, e.clientY).find((el) => !laagRef.current?.contains(el));
        plekRef.current = onder ? plekVan(onder) : "";
        setStart({ x: e.clientX, y: e.clientY });
        setEind({ x: e.clientX, y: e.clientY });
      }}
      onMouseMove={(e) => start && setEind({ x: e.clientX, y: e.clientY })}
      onMouseUp={(e) => {
        if (!start) return;
        const k = normaliseerKader(start, { x: e.clientX, y: e.clientY }, venster());
        onKlaar(k.w < 8 || k.h < 8 ? { x: 0, y: 0, ...venster() } : k, plekRef.current);
      }}
    >
      {/* Het bevroren beeld: wat je ziet is wat er in de afbeelding komt. */}
      <img src={url} alt="" className="mld-kaderlaag__beeld" draggable={false} />
      <div className="mld-kaderlaag__uitleg">Trek een kader om wat je wilt laten zien · klik voor het hele venster · Esc annuleert</div>
      {kader && <div className="mld-kaderlaag__kader" style={{ left: kader.x, top: kader.y, width: kader.w, height: kader.h }} />}
    </div>
  );
}

function Dialoog({ onSluit, children, label, verborgen = false }) {
  useEffect(() => {
    if (verborgen) return undefined;
    const onKey = (e) => e.key === "Escape" && onSluit();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSluit, verborgen]);
  return (
    <div className="mld-dialoog-achter" onMouseDown={onSluit} style={verborgen ? { display: "none" } : undefined}>
      <div className="mld-dialoog" role="dialog" aria-label={label} onMouseDown={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

export default function MeldenHost() {
  // formulier: is het formulier open (ook als het even verborgen is voor een schermafbeelding)
  // kader: null | "bevriezen" | {beeld} ; lijst: Mijn meldingen open
  const [formulier, setFormulier] = useState(null); // {sleutel, context, bijlagen}
  const [kader, setKader] = useState(null);
  const [lijst, setLijst] = useState(null); // {openId}
  const [fout, setFout] = useState("");
  const naKaderRef = useRef(null); // (file, plek) => void

  /** Venster bevriezen en daarna een kader laten trekken; `naKader(file, plek)` krijgt het resultaat. */
  async function schermafbeelding(naKader) {
    naKaderRef.current = naKader;
    setKader("bevriezen");
    // Eén frame: het (eventueel verborgen) formulier is weg uit beeld.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      const beeld = await bevries({ negeer: isEigen });
      setKader({ beeld });
    } catch (e) {
      setKader(null);
      naKaderRef.current = null;
      setFout(`De schermafbeelding lukte niet (${e.message}); plak er zelf een of meld zonder.`);
      setFormulier((f) => f || { sleutel: Date.now(), context: verzamelMeldContext(), bijlagen: [] });
    }
  }

  const melden = (extra = {}) => {
    setFout("");
    setLijst(null);
    setFormulier({ sleutel: Date.now(), context: verzamelMeldContext(extra), bijlagen: [] });
  };
  const meldenMetKader = (extra = {}) => {
    setFout("");
    setLijst(null);
    schermafbeelding((file, plek) => {
      setFormulier({ sleutel: Date.now(), context: verzamelMeldContext({ ...(plek ? { plek } : {}), ...extra }), bijlagen: file ? [file] : [] });
    });
  };

  // Laatste versies van de handlers voor de (eenmalig geregistreerde) listeners.
  const actueel = useRef({});
  actueel.current = { melden, meldenMetKader, bezig: () => kader !== null };

  useEffect(() => {
    const af = [
      menuBus.on("help:melden", (o) => actueel.current.melden(o?.context)),
      menuBus.on("help:melden-kader", (o) => actueel.current.meldenMetKader(o?.context)),
      menuBus.on("help:mijn-meldingen", (o) => { setFormulier(null); setLijst({ openId: o?.id ?? null }); }),
    ];
    const onKey = (e) => {
      if (actueel.current.bezig()) return;
      const b = bindingVanEvent(e);
      if (!b) return;
      if (b === bindingVoor("help:melden-kader")) { e.preventDefault(); actueel.current.meldenMetKader(); }
      else if (b === bindingVoor("help:melden") && !typt(e)) { e.preventDefault(); actueel.current.melden(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { af.forEach((f) => f()); window.removeEventListener("keydown", onKey); };
  }, []);

  async function kaderKlaar(k, plek) {
    const beeld = kader?.beeld;
    setKader(null);
    let file = null;
    try {
      file = new File([await knip(beeld, k)], bestandsnaam(), { type: "image/png" });
    } catch (e) {
      setFout(`De schermafbeelding lukte niet (${e.message}).`);
    }
    naKaderRef.current?.(file, plek);
    naKaderRef.current = null;
  }

  const formulierVerborgen = kader !== null;
  return (
    <>
      {kader === "bevriezen" && <div className="mld-kaderlaag" style={{ cursor: "progress", background: "transparent" }} />}
      {kader?.beeld && (
        <KaderTrekker beeld={kader.beeld} onKlaar={kaderKlaar} onAnnuleer={() => { setKader(null); naKaderRef.current = null; }} />
      )}
      {formulier && (
        <Dialoog label="Melden" onSluit={() => setFormulier(null)} verborgen={formulierVerborgen}>
          {fout && <p className="mld-fout" role="alert">{fout}</p>}
          <MeldFormulier
            key={formulier.sleutel}
            context={formulier.context}
            beginBijlagen={formulier.bijlagen}
            onAnnuleer={() => setFormulier(null)}
            onSchermafbeelding={(voegToe) => schermafbeelding((file) => file && voegToe([file]))}
            onMijnMeldingen={(id) => { setFormulier(null); setLijst({ openId: id }); }}
          />
        </Dialoog>
      )}
      {lijst && (
        <Dialoog label="Mijn meldingen" onSluit={() => setLijst(null)}>
          <MijnMeldingen openId={lijst.openId} onNieuw={() => melden()} />
        </Dialoog>
      )}
    </>
  );
}
