/**
 * polygonTekenaar — een klein tekencanvas voor data-shapes: klik punten, sleep
 * ze, wis ze. Levert een CSS `clip-path: polygon(…)` op de 0–100%-box, precies
 * de vorm die je anders met de hand in het clip-path-veld typt.
 *
 * Undo/redo: een lokaal history-stack (refs), niet de zustand/zundo-store — dit
 * is een transiënte editor, dus een aparte store zou overkill zijn. Ctrl+Z /
 * Ctrl+Y (of Ctrl+Shift+Z) werken zolang de tekenaar in beeld is.
 */
import { useEffect, useRef, useState } from "react";

// Het canvas heeft dezelfde verhouding als een node (≈2:1), niet vierkant:
// clip-path-percentages rekken mee met de node-box, dus tekenen op node-
// proporties is WYSIWYG — geen horizontale uitrekking in de preview.
const BREEDTE = 280;
const HOOGTE = 138;
const px = (pct) => (pct / 100) * BREEDTE; // x-as
const py = (pct) => (pct / 100) * HOOGTE; // y-as

/** "polygon(10% 0%, 90% 50%)" → [{x:10,y:0},{x:90,y:50}] (of []). */
export function polygonNaarPunten(clipPath) {
  const m = /polygon\(([^)]*)\)/i.exec(clipPath || "");
  if (!m) return [];
  return m[1]
    .split(",")
    .map((paar) => {
      const [x, y] = paar.trim().split(/\s+/);
      return { x: parseFloat(x), y: parseFloat(y) };
    })
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

/** [{x,y}] → "polygon(10% 0%, …)" (of "" bij < 3 punten). */
export function puntenNaarPolygon(punten) {
  if (!punten || punten.length < 3) return "";
  return `polygon(${punten.map((p) => `${Math.round(p.x)}% ${Math.round(p.y)}%`).join(", ")})`;
}

export default function PolygonTekenaar({ initieel = [], onChange }) {
  const [punten, setPunten] = useState(initieel);
  // Refs met de actuele waarden — voorkomt verouderde closures in de
  // pointer-/toets-handlers en houdt de history-side-effects buiten de setState.
  const puntenRef = useRef(punten);
  puntenRef.current = punten;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const historie = useRef([]); // stapels vorige toestanden
  const redo = useRef([]);
  const svgRef = useRef(null);
  const sleepIdx = useRef(-1);

  const zetBeide = (next) => {
    setPunten(next);
    onChangeRef.current?.(next);
  };
  /** Snapshot van de huidige punten vóór een wijziging (voor undo). */
  const duw = () => {
    historie.current.push(puntenRef.current);
    if (historie.current.length > 100) historie.current.shift();
    redo.current = [];
  };

  const uitEvent = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
    return { x, y };
  };

  const canvasKlik = (e) => {
    duw();
    zetBeide([...puntenRef.current, uitEvent(e)]);
  };
  const startSleep = (e, i) => {
    e.stopPropagation(); // geen nieuw punt bij het pakken
    duw();
    sleepIdx.current = i;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const beweeg = (e) => {
    if (sleepIdx.current < 0) return;
    const p = uitEvent(e);
    zetBeide(puntenRef.current.map((q, i) => (i === sleepIdx.current ? p : q))); // geen snapshot tijdens slepen
  };
  const stop = () => {
    sleepIdx.current = -1;
  };
  const wisPunt = (e, i) => {
    e.stopPropagation();
    duw();
    zetBeide(puntenRef.current.filter((_, j) => j !== i));
  };
  const wisAlles = () => {
    duw();
    zetBeide([]);
  };

  const undo = () => {
    if (!historie.current.length) return;
    redo.current.push(puntenRef.current);
    zetBeide(historie.current.pop());
  };
  const herstel = () => {
    if (!redo.current.length) return;
    historie.current.push(puntenRef.current);
    zetBeide(redo.current.pop());
  };

  // Ctrl+Z / Ctrl+Y (of Ctrl+Shift+Z) zolang de tekenaar in beeld is.
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (k === "y" || (k === "z" && e.shiftKey))) {
        e.preventDefault();
        herstel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const polyPunten = punten.map((p) => `${px(p.x)},${py(p.y)}`).join(" ");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
      <svg
        ref={svgRef}
        width={BREEDTE}
        height={HOOGTE}
        onClick={canvasKlik}
        onPointerMove={beweeg}
        onPointerUp={stop}
        style={{ border: "1px solid var(--s-border, #cbd5e1)", borderRadius: 6, background: "var(--s-panel, #fff)", cursor: "crosshair", touchAction: "none" }}
      >
        {[25, 50, 75].map((g) => (
          <g key={g} stroke="var(--s-border, #e2e8f0)" strokeWidth="0.5">
            <line x1={px(g)} y1="0" x2={px(g)} y2={HOOGTE} />
            <line x1="0" y1={py(g)} x2={BREEDTE} y2={py(g)} />
          </g>
        ))}
        {punten.length >= 2 && (
          <polygon points={polyPunten} fill="var(--s-accent, #6366f1)" fillOpacity="0.18" stroke="var(--s-accent, #6366f1)" strokeWidth="1.5" />
        )}
        {punten.map((p, i) => (
          <circle
            key={i}
            cx={px(p.x)}
            cy={py(p.y)}
            r={5}
            fill="var(--s-accent, #6366f1)"
            stroke="#fff"
            strokeWidth="1.5"
            style={{ cursor: "grab" }}
            onPointerDown={(e) => startSleep(e, i)}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => wisPunt(e, i)}
            onContextMenu={(e) => { e.preventDefault(); wisPunt(e, i); }}
          />
        ))}
      </svg>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button className="dc-mini-knop" title="Ctrl+Z" onClick={undo} disabled={!historie.current.length}>↶ ongedaan</button>
        <button className="dc-mini-knop" title="Ctrl+Y" onClick={herstel} disabled={!redo.current.length}>↷ opnieuw</button>
        <button className="dc-mini-knop is-gevaar" onClick={wisAlles} disabled={!punten.length}>wis alles</button>
      </div>
      <span style={{ fontSize: 11, color: "var(--s-fg-muted, #64748b)" }}>
        Klik = punt · sleep = verplaatsen · dubbelklik of rechtsklik = punt wissen ({punten.length})
      </span>
    </div>
  );
}
