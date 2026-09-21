/**
 * silhouetTekenaar — een lichte vorm-editor voor data-shapes: klik punten, sleep
 * ze, en maak een punt **rond of hoekig** (klik erop) voor krommen. Levert een
 * gesloten SVG-`path` op de 0–100-box op, die als `silhouet` (zie `dataShape.jsx`)
 * met de node-box meerekt — béziers blijven behouden. Voor snel/simpel werk; voor
 * complexe vormen is er de Method Draw-modal.
 *
 * Undo/redo via een lokaal history-stack (refs). Ctrl+Z / Ctrl+Y werken zolang de
 * tekenaar in beeld is.
 */
import { useEffect, useRef, useState } from "react";
import { invoegIndex, polygonNaarPunten, puntenNaarPad } from "./silhouetPad.js";

export { polygonNaarPunten, puntenNaarPad };

// Canvas op node-verhouding (≈2:1), niet vierkant: het silhouet vult standaard de
// (brede) node-box, dus tekenen op node-proporties is WYSIWYG.
const BREEDTE = 280;
const HOOGTE = 138;
const px = (pct) => (pct / 100) * BREEDTE;
const py = (pct) => (pct / 100) * HOOGTE;

export default function SilhouetTekenaar({ initieel = [], onChange }) {
  const [punten, setPunten] = useState(() => initieel.map((p) => ({ x: p.x, y: p.y, r: !!p.r })));
  const puntenRef = useRef(punten);
  puntenRef.current = punten;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const historie = useRef([]);
  const redo = useRef([]);
  const svgRef = useRef(null);
  const sleepIdx = useRef(-1);
  const neer = useRef(null); // {cx, cy, moved} — klik-vs-sleep

  const zetBeide = (next) => {
    setPunten(next);
    onChangeRef.current?.(next);
  };
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
    const p = { ...uitEvent(e), r: false };
    // Voeg in op de dichtstbijzijnde rand, zodat het punt bij de klik verschijnt
    // (niet achteraan, wat de vorm liet kruisen).
    const cur = puntenRef.current;
    const idx = invoegIndex(cur, p);
    zetBeide([...cur.slice(0, idx), p, ...cur.slice(idx)]);
  };
  const startPunt = (e, i) => {
    e.stopPropagation(); // geen nieuw punt bij het pakken
    duw();
    sleepIdx.current = i;
    neer.current = { cx: e.clientX, cy: e.clientY, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const beweeg = (e) => {
    if (sleepIdx.current < 0) return;
    const nd = neer.current;
    if (!nd.moved && Math.hypot(e.clientX - nd.cx, e.clientY - nd.cy) < 4) return;
    nd.moved = true;
    const p = uitEvent(e);
    zetBeide(puntenRef.current.map((q, i) => (i === sleepIdx.current ? { ...q, x: p.x, y: p.y } : q)));
  };
  const stop = () => {
    // Klik zonder sleep op een punt → rond/hoek togglen (snapshot al bij down).
    if (sleepIdx.current >= 0 && neer.current && !neer.current.moved) {
      const i = sleepIdx.current;
      zetBeide(puntenRef.current.map((q, j) => (j === i ? { ...q, r: !q.r } : q)));
    }
    sleepIdx.current = -1;
    neer.current = null;
  };
  const wisPunt = (e, i) => {
    e.preventDefault();
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

  // Preview-pad in canvas-px (echte cirkels als handvatten; pad volgt de krommen).
  const pxPunten = punten.map((p) => ({ x: px(p.x), y: py(p.y), r: p.r }));
  const previewPad = puntenNaarPad(pxPunten);

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
        {previewPad && <path d={previewPad} fill="var(--s-accent, #6366f1)" fillOpacity="0.18" stroke="var(--s-accent, #6366f1)" strokeWidth="1.5" />}
        {punten.map((p, i) => (
          <circle
            key={i}
            cx={px(p.x)}
            cy={py(p.y)}
            r={5}
            fill={p.r ? "#fff" : "var(--s-accent, #6366f1)"}
            stroke="var(--s-accent, #6366f1)"
            strokeWidth={p.r ? 2 : 1.5}
            style={{ cursor: "grab" }}
            onPointerDown={(e) => startPunt(e, i)}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => wisPunt(e, i)}
          >
            <title>{p.r ? "rond punt — klik voor hoek · rechtsklik = wissen" : "hoekpunt — klik voor rond · rechtsklik = wissen"}</title>
          </circle>
        ))}
      </svg>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button className="dc-mini-knop" title="Ctrl+Z" onClick={undo} disabled={!historie.current.length}>↶ ongedaan</button>
        <button className="dc-mini-knop" title="Ctrl+Y" onClick={herstel} disabled={!redo.current.length}>↷ opnieuw</button>
        <button className="dc-mini-knop is-gevaar" onClick={wisAlles} disabled={!punten.length}>wis alles</button>
      </div>
      <span style={{ fontSize: 11, color: "var(--s-fg-muted, #64748b)" }}>
        Klik = punt toevoegen · sleep = verplaatsen · klik een punt = rond/hoek · rechtsklik = wissen ({punten.length})
      </span>
    </div>
  );
}
