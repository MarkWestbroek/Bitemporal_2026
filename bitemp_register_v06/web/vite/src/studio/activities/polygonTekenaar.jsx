/**
 * polygonTekenaar — een klein tekencanvas voor data-shapes: klik punten, sleep
 * ze, dubbelklik om te wissen. Levert een CSS `clip-path: polygon(…)` op de
 * 0–100%-box, precies de vorm die je anders met de hand in het clip-path-veld
 * typt. Zo teken je de silhouet i.p.v. de coördinaten te typen.
 */
import { useRef } from "react";

const MAAT = 180; // px; het canvas beeldt de 0–100%-box af
const px = (pct) => (pct / 100) * MAAT;

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

export default function PolygonTekenaar({ punten, onChange }) {
  const svgRef = useRef(null);
  const sleepIdx = useRef(-1);

  const uitEvent = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
    return { x, y };
  };

  const canvasKlik = (e) => {
    if (sleepIdx.current >= 0) return; // net gesleept
    onChange([...(punten || []), uitEvent(e)]);
  };
  const startSleep = (e, i) => {
    e.stopPropagation();
    sleepIdx.current = i;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const beweeg = (e) => {
    if (sleepIdx.current < 0) return;
    const p = uitEvent(e);
    onChange(punten.map((q, i) => (i === sleepIdx.current ? p : q)));
  };
  const stop = () => {
    sleepIdx.current = -1;
  };
  const wisPunt = (e, i) => {
    e.stopPropagation();
    onChange(punten.filter((_, j) => j !== i));
  };

  const polyPunten = (punten || []).map((p) => `${px(p.x)},${px(p.y)}`).join(" ");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
      <svg
        ref={svgRef}
        width={MAAT}
        height={MAAT}
        onClick={canvasKlik}
        onPointerMove={beweeg}
        onPointerUp={stop}
        style={{ border: "1px solid var(--s-border, #cbd5e1)", borderRadius: 6, background: "var(--s-panel, #fff)", cursor: "crosshair", touchAction: "none" }}
      >
        {/* raster op 25% */}
        {[25, 50, 75].map((g) => (
          <g key={g} stroke="var(--s-border, #e2e8f0)" strokeWidth="0.5">
            <line x1={px(g)} y1="0" x2={px(g)} y2={MAAT} />
            <line x1="0" y1={px(g)} x2={MAAT} y2={px(g)} />
          </g>
        ))}
        {(punten || []).length >= 2 && (
          <polygon
            points={polyPunten}
            fill="var(--s-accent, #6366f1)"
            fillOpacity="0.18"
            stroke="var(--s-accent, #6366f1)"
            strokeWidth="1.5"
          />
        )}
        {(punten || []).map((p, i) => (
          <circle
            key={i}
            cx={px(p.x)}
            cy={px(p.y)}
            r={5}
            fill="var(--s-accent, #6366f1)"
            stroke="#fff"
            strokeWidth="1.5"
            style={{ cursor: "grab" }}
            onPointerDown={(e) => startSleep(e, i)}
            onDoubleClick={(e) => wisPunt(e, i)}
          />
        ))}
      </svg>
      <span style={{ fontSize: 11, color: "var(--s-fg-muted, #64748b)" }}>
        Klik = punt toevoegen · sleep = verplaatsen · dubbelklik = wissen ({(punten || []).length})
      </span>
    </div>
  );
}
