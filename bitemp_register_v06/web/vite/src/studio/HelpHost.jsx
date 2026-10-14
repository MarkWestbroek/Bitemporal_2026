/**
 * HelpHost — de begeleiding die altijd in de Studio hangt (ontwerp docs/plans/2026-09-10
 * Begeleiding in de Studio): de tipstrook (hints.js) en het sneltoetsenoverzicht (Help →
 * Sneltoetsen…, menuBus "help:sneltoetsen"). Beide nooit modaal voor het werk: de strook
 * blokkeert niets, het overzicht sluit met Esc of een klik ernaast.
 */
import React, { useEffect, useState } from "react";
import { menuBus } from "./menuBus";
import { useHintStore, zetTipsUit } from "./hints.js";
import { SNELTOETS_ACTIES, VASTE_SNELTOETSEN, bindingVoor } from "./sneltoetsen.js";
import useStudioStore from "./useStudioStore.js";
import { openDocumentatie } from "./buildMenus.js";
import Tour from "./Tour.jsx";
import MeldenHost from "./MeldenHost.jsx";
import { tourGezien } from "./tourStappen.js";

/** Toetsen van de werkbank zelf (niet instelbaar, niet van het canvas). */
const WERKBANK_TOETSEN = [
  { label: "Opdrachtenpalet: zoek elke actie", binding: "Ctrl+K" },
  { label: "Pagina herladen", binding: "F5" },
];

function HintStrook() {
  const hint = useHintStore((s) => s.hint);
  const sluit = useHintStore((s) => s.sluit);
  if (!hint) return null;
  return (
    <div className="studio-hint" role="status" aria-live="polite" data-hint-id={hint.id}>
      <span className="studio-hint__icoon" aria-hidden="true">💡</span>
      <div className="studio-hint__tekst">
        {hint.titel && <strong>{hint.titel}. </strong>}
        {hint.tekst}
      </div>
      <button type="button" className="studio-hint__knop" onClick={sluit}>Begrepen</button>
      <button type="button" className="studio-hint__knop studio-hint__knop--zacht" onClick={zetTipsUit}
        title="Weer aanzetten via Help → Tips opnieuw tonen">
        Geen tips meer
      </button>
    </div>
  );
}

/** Toetsnaam zoals op het toetsenbord ("ArrowUp" → ↑, "ArrowLeft…" → alle pijltjes). */
const TOETS = { ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", "ArrowLeft…": "← ↑ → ↓" };

function Toetsen({ binding }) {
  if (!binding) return <span className="studio-sneltoetsen__geen">—</span>;
  return (
    <span className="studio-sneltoetsen__toetsen">
      {String(binding).split(" / ").map((deel, i) => (
        <React.Fragment key={i}>
          {i > 0 && " / "}
          {deel.split("+").map((t, j) => <kbd key={j}>{TOETS[t] || t}</kbd>)}
        </React.Fragment>
      ))}
    </span>
  );
}

function SneltoetsenOverzicht({ onSluit }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onSluit();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSluit]);

  const groepen = [];
  for (const a of SNELTOETS_ACTIES) {
    let g = groepen.find((x) => x.naam === a.groep);
    if (!g) groepen.push((g = { naam: a.groep, rijen: [] }));
    g.rijen.push({ label: a.label, binding: bindingVoor(a.id) });
  }
  const blokken = [
    { naam: "Werkbank", rijen: WERKBANK_TOETSEN },
    { naam: "Canvas en boom (vast)", rijen: VASTE_SNELTOETSEN.map((v) => ({ label: v.label, binding: v.binding })) },
    ...groepen,
  ];

  const aanpassen = () => {
    onSluit();
    useStudioStore.getState().setActief("studio-instellingen");
    setTimeout(() => document.getElementById("instellingen-sneltoetsen")?.scrollIntoView({ block: "start" }), 150);
  };

  return (
    <div className="studio-palette-overlay" onMouseDown={onSluit}>
      <div className="studio-sneltoetsen" role="dialog" aria-label="Sneltoetsen" onMouseDown={(e) => e.stopPropagation()}>
        <div className="studio-sneltoetsen__kop">
          <h2>Sneltoetsen</h2>
          <button type="button" className="studio-hint__knop" onClick={aanpassen}>Aanpassen…</button>
          <button type="button" className="studio-hint__knop studio-hint__knop--zacht" onClick={onSluit} aria-label="Sluiten">×</button>
        </div>
        <div className="studio-sneltoetsen__blokken">
          {blokken.map((b) => (
            <section key={b.naam}>
              <h3>{b.naam}</h3>
              <table>
                <tbody>
                  {b.rijen.map((r) => (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td><Toetsen binding={r.binding} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
        <p className="studio-sneltoetsen__voet">Op macOS telt ⌘ als Ctrl. Instelbare toetsen gelden per browser.</p>
      </div>
    </div>
  );
}

export default function HelpHost() {
  const [sneltoetsen, setSneltoetsen] = useState(false);
  const [tour, setTour] = useState(false);
  useEffect(() => {
    const af = [
      menuBus.on("help:sneltoetsen", () => setSneltoetsen(true)),
      menuBus.on("help:documentatie", openDocumentatie),
      menuBus.on("help:tour", () => setTour(true)),
    ];
    // Eerste bezoek in deze browser: de rondleiding start vanzelf, als de Studio staat.
    const t = tourGezien() ? null : setTimeout(() => setTour(true), 1200);
    return () => {
      af.forEach((f) => f());
      if (t) clearTimeout(t);
    };
  }, []);
  return (
    <>
      {!tour && <HintStrook />}
      {sneltoetsen && <SneltoetsenOverzicht onSluit={() => setSneltoetsen(false)} />}
      {tour && <Tour onSluit={() => setTour(false)} />}
      <MeldenHost />
    </>
  );
}
