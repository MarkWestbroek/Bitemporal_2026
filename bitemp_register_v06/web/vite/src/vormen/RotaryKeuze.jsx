import { useId, useRef } from "react";
import { maakSchaal, stapKleur } from "./schaal";

/**
 * RotaryKeuze — de vorm `rotary`: een draaiknop met klikstanden (zoals op een synth-module).
 * Bedient een getal of één uit een geordende lijst. ARIA: role="slider" met aria-valuenow/-text;
 * toetsen: pijlen (±1 stap), PageUp/PageDown (±10%), Home/End. Muis/touch: omhoog slepen =
 * rechtsom draaien (zoals bij de meeste software-knoppen); scrollen werkt ook.
 *
 * Props: items, waarde, onChange, readOnly, labelId, config { min, max, step, sweep, size, accentColor, labels, colors }
 */
export default function RotaryKeuze({ items, waarde, onChange, readOnly = false, labelId, config = {} }) {
  const s = maakSchaal({ items, config });
  const idx = s.naarIndex(waarde);
  const leeg = idx < 0;
  const size = config.size || 96;
  const sweep = config.sweep || 270;
  const accent = (!leeg && stapKleur(config.colors, idx, s.n)) || config.accentColor || "#f59e0b";
  const hoek = (i) => -sweep / 2 + (s.n <= 1 ? 0 : (i / (s.n - 1)) * sweep); // 0° = boven
  const sleep = useRef(null);
  const gradId = `rotary-metaal-${useId().replace(/:/g, "")}`;

  const zet = (i) => { if (!readOnly) onChange(s.naarWaarde(Math.max(0, Math.min(s.n - 1, i)))); };
  const huidig = leeg ? 0 : idx;

  const onKeyDown = (e) => {
    const groot = Math.max(1, Math.round(s.n / 10));
    const map = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: groot, PageDown: -groot };
    if (e.key in map) { e.preventDefault(); zet((leeg ? -1 : huidig) + map[e.key] + (leeg && map[e.key] < 0 ? 1 : 0)); }
    else if (e.key === "Home") { e.preventDefault(); zet(0); }
    else if (e.key === "End") { e.preventDefault(); zet(s.n - 1); }
  };
  const onPointerDown = (e) => {
    if (readOnly) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    sleep.current = { y: e.clientY, start: huidig };
    if (leeg) zet(0);
  };
  const onPointerMove = (e) => {
    if (!sleep.current) return;
    const pixelsPerStap = Math.max(4, 160 / s.n);
    zet(sleep.current.start + Math.round((sleep.current.y - e.clientY) / pixelsPerStap));
  };
  const onPointerUp = () => { sleep.current = null; };

  const r = size / 2, knop = r * 0.62;
  const punt = (a, rad) => [r + rad * Math.sin((a * Math.PI) / 180), r - rad * Math.cos((a * Math.PI) / 180)];
  const boog = (a1, a2, rad) => {
    const [x1, y1] = punt(a1, rad), [x2, y2] = punt(a2, rad);
    return `M${x1},${y1} A${rad},${rad} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${x2},${y2}`;
  };
  const toonTicks = s.n <= 24;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
      <svg
        width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        role="slider" tabIndex={readOnly ? -1 : 0} aria-labelledby={labelId} aria-readonly={readOnly || undefined}
        aria-valuemin={0} aria-valuemax={s.n - 1} aria-valuenow={leeg ? undefined : idx} aria-valuetext={leeg ? "niet gekozen" : s.label(idx)}
        onKeyDown={onKeyDown} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onWheel={(e) => { if (!readOnly && document.activeElement === e.currentTarget) { e.preventDefault(); zet(huidig + (e.deltaY < 0 ? 1 : -1)); } }}
        style={{ cursor: readOnly ? "default" : "ns-resize", touchAction: "none", outlineOffset: 3 }}
      >
        <path d={boog(-sweep / 2, sweep / 2, r - 5)} fill="none" stroke="#334155" strokeWidth={4} strokeLinecap="round" />
        {!leeg && <path d={boog(-sweep / 2, hoek(idx) + 0.01, r - 5)} fill="none" stroke={accent} strokeWidth={4} strokeLinecap="round" />}
        {toonTicks && Array.from({ length: s.n }, (_, i) => {
          const [x1, y1] = punt(hoek(i), r - 11), [x2, y2] = punt(hoek(i), r - 15);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i === idx ? accent : "#94a3b8"} strokeWidth={i === idx ? 2.5 : 1.5} />;
        })}
        <circle cx={r} cy={r} r={knop} fill={`url(#${gradId})`} stroke="#0f172a" strokeWidth={1} />
        <defs>
          <radialGradient id={gradId} cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#475569" /><stop offset="100%" stopColor="#0f172a" />
          </radialGradient>
        </defs>
        {(() => { const [x, y] = punt(hoek(huidig), knop - 6); return <line x1={r} y1={r} x2={x} y2={y} stroke={leeg ? "#64748b" : "#f8fafc"} strokeWidth={3} strokeLinecap="round" />; })()}
      </svg>
      <span style={{ fontWeight: 700, fontSize: "1rem", minWidth: 60 }}>{leeg ? "—" : s.label(idx)}</span>
    </div>
  );
}
