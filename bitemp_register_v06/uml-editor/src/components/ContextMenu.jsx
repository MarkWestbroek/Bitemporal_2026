/**
 * ContextMenu — Rechtsklikmenu op het canvas.
 *
 * Twee varianten op basis van `menuType`:
 *   "align"      — Uitlijnacties (verschijnt bij ≥2 geselecteerde nodes)
 *   "dependency"  — Verberg/toon «use» dependency edges
 *
 * Props:
 *   x, y        — schermcoördinaten (pixels) van het menu
 *   menuType    — "align" | "dependency"
 *   onAlign     — callback(actie: string)        (align)
 *   onAction    — callback(actie: string)         (dependency)
 *   onClose     — callback om het menu te sluiten
 *   itemCount   — aantal geselecteerde nodes      (align)
 *   items       — [{actie, label, icon?}]         (dependency)
 *   header      — optionele tekst bovenin         (dependency)
 */
import { useEffect, useRef } from "react";

/* ── Compacte 16×16 SVG iconen ── */
const C = "currentColor";
const SVG = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none" };

const iconen = {
  /* ─ Horizontale uitlijning: 3 liggende balken ─ */
  links: (
    <svg {...SVG}>
      <path d="M2 .5v15" stroke={C} strokeWidth="1.5" />
      <rect x="4" y="1.5" width="10" height="2.5" rx=".5" fill={C} />
      <rect x="4" y="6.75" width="6" height="2.5" rx=".5" fill={C} />
      <rect x="4" y="11.5" width="8" height="2.5" rx=".5" fill={C} />
    </svg>
  ),
  centreer: (
    <svg {...SVG}>
      <path d="M8 .5v15" stroke={C} strokeWidth=".75" strokeDasharray="2 1.5" />
      <rect x="1" y="1.5" width="14" height="2.5" rx=".5" fill={C} />
      <rect x="3" y="6.75" width="10" height="2.5" rx=".5" fill={C} />
      <rect x="2" y="11.5" width="12" height="2.5" rx=".5" fill={C} />
    </svg>
  ),
  rechts: (
    <svg {...SVG}>
      <path d="M14 .5v15" stroke={C} strokeWidth="1.5" />
      <rect x="2" y="1.5" width="10" height="2.5" rx=".5" fill={C} />
      <rect x="6" y="6.75" width="6" height="2.5" rx=".5" fill={C} />
      <rect x="4" y="11.5" width="8" height="2.5" rx=".5" fill={C} />
    </svg>
  ),
  /* ─ Verticale uitlijning: 3 staande balken ─ */
  boven: (
    <svg {...SVG}>
      <path d="M.5 2h15" stroke={C} strokeWidth="1.5" />
      <rect x="1.5" y="4" width="2.5" height="10" rx=".5" fill={C} />
      <rect x="6.75" y="4" width="2.5" height="6" rx=".5" fill={C} />
      <rect x="12" y="4" width="2.5" height="8" rx=".5" fill={C} />
    </svg>
  ),
  midden: (
    <svg {...SVG}>
      <path d="M.5 8h15" stroke={C} strokeWidth=".75" strokeDasharray="2 1.5" />
      <rect x="1.5" y="1" width="2.5" height="14" rx=".5" fill={C} />
      <rect x="6.75" y="3" width="2.5" height="10" rx=".5" fill={C} />
      <rect x="12" y="2" width="2.5" height="12" rx=".5" fill={C} />
    </svg>
  ),
  onder: (
    <svg {...SVG}>
      <path d="M.5 14h15" stroke={C} strokeWidth="1.5" />
      <rect x="1.5" y="2" width="2.5" height="10" rx=".5" fill={C} />
      <rect x="6.75" y="6" width="2.5" height="6" rx=".5" fill={C} />
      <rect x="12" y="4" width="2.5" height="8" rx=".5" fill={C} />
    </svg>
  ),
  /* ─ Gelijkmatig verdelen ─ */
  verdeelV: (
    <svg {...SVG}>
      <rect x="2" y="1" width="12" height="3" rx=".5" fill={C} />
      <rect x="2" y="6.5" width="12" height="3" rx=".5" fill={C} />
      <rect x="2" y="12" width="12" height="3" rx=".5" fill={C} />
    </svg>
  ),
  verdeelH: (
    <svg {...SVG}>
      <rect x="1" y="2" width="3" height="12" rx=".5" fill={C} />
      <rect x="6.5" y="2" width="3" height="12" rx=".5" fill={C} />
      <rect x="12" y="2" width="3" height="12" rx=".5" fill={C} />
    </svg>
  ),
};

const ALIGN_ACTIES = [
  { actie: "links",               label: "Links",              icon: iconen.links,     minCount: 2 },
  { actie: "midden-horizontaal",  label: "Centreer",           icon: iconen.centreer,  minCount: 2 },
  { actie: "rechts",              label: "Rechts",             icon: iconen.rechts,    minCount: 2 },
  { separator: true },
  { actie: "boven",               label: "Boven",              icon: iconen.boven,     minCount: 2 },
  { actie: "midden-verticaal",    label: "Midden",             icon: iconen.midden,    minCount: 2 },
  { actie: "onder",               label: "Onder",              icon: iconen.onder,     minCount: 2 },
  { separator: true },
  { actie: "verdeel-verticaal",   label: "Verdeel gelijk ↕",   icon: iconen.verdeelV,  minCount: 3 },
  { actie: "verdeel-horizontaal", label: "Verdeel gelijk ↔",   icon: iconen.verdeelH,  minCount: 3 },
];

export default function ContextMenu({ x, y, menuType = "align", onAlign, onAction, onClose, itemCount, items, header }) {
  const menuRef = useRef(null);

  // Sluit het menu bij klik buiten het menu
  useEffect(() => {
    function handleMouseDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  // Sluit het menu bij Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: x, top: y }}
    >
      {menuType === "dependency" ? (
        <>
          {header && <div className="context-menu-header">{header}</div>}
          {(items || []).map((item, i) =>
            item.separator ? (
              <div key={`sep-${i}`} className="context-menu-separator" />
            ) : (
              <button
                key={item.actie}
                className="context-menu-item"
                onClick={() => {
                  onAction?.(item.actie);
                  onClose();
                }}
              >
                {item.icon && <span className="context-menu-icon">{item.icon}</span>}
                {item.label}
              </button>
            )
          )}
        </>
      ) : (
        <>
          <div className="context-menu-header">
            {itemCount} elementen
          </div>
          {ALIGN_ACTIES.map((item, i) =>
            item.separator ? (
              <div key={`sep-${i}`} className="context-menu-separator" />
            ) : itemCount < (item.minCount || 2) ? null : (
              <button
                key={item.actie}
                className="context-menu-item"
                onClick={() => {
                  onAlign(item.actie);
                  onClose();
                }}
              >
                <span className="context-menu-icon">{item.icon}</span>
                {item.label}
              </button>
            )
          )}
        </>
      )}
    </div>
  );
}
