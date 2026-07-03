/**
 * Taskbar (diagramcore) — zwevend, versleepbaar taakbalkje op de canvas.
 *
 * Het raamwerk is core (plan §4.6): dit component + de voorkeuren-hook.
 * De sámenstelling (welke balken, welke acties) komt uit het DiagramType
 * (`taakbalken` in de descriptor); zichtbaarheid en positie zijn
 * gebruikersvoorkeur (TaskbarConfiguration in het metamodel) en worden per
 * opslagsleutel in localStorage onthouden.
 *
 * Actie-model: { id, label, titel?, actief?, onClick } — dezelfde ActionType-
 * gedachte als menu-items, zodat een actie op balk én in menu kan verschijnen.
 */
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voorkeuren (zichtbaarheid + positie per balk), persistent in localStorage.
 * @param {string} opslagSleutel - bv. "studio05-taakbalken-canoniek-uml"
 * @param {Record<string, {zichtbaar: boolean, positie: {x:number,y:number}}>} defaults
 */
export function useTaakbalkVoorkeuren(opslagSleutel, defaults) {
  const [voorkeuren, setVoorkeuren] = useState(() => {
    try {
      const bewaard = JSON.parse(localStorage.getItem(opslagSleutel) || "null");
      return { ...defaults, ...(bewaard || {}) };
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(opslagSleutel, JSON.stringify(voorkeuren));
    } catch {
      /* opslag vol/geblokkeerd: voorkeuren zijn niet kritisch */
    }
  }, [opslagSleutel, voorkeuren]);

  const zetZichtbaar = useCallback(
    (balkId, zichtbaar) =>
      setVoorkeuren((v) => ({ ...v, [balkId]: { ...v[balkId], zichtbaar } })),
    []
  );
  const zetPositie = useCallback(
    (balkId, positie) =>
      setVoorkeuren((v) => ({ ...v, [balkId]: { ...v[balkId], positie } })),
    []
  );

  return { voorkeuren, zetZichtbaar, zetPositie };
}

export function Taskbar({ label, acties, positie, onPositie }) {
  const ref = useRef(null);

  // Verslepen via de titelbalk (pointer events: muis + pen + touch).
  const startDrag = useCallback(
    (ev) => {
      ev.preventDefault();
      const start = { x: ev.clientX, y: ev.clientY };
      const basis = { ...positie };
      const onMove = (m) => {
        onPositie({ x: Math.max(0, basis.x + m.clientX - start.x), y: Math.max(0, basis.y + m.clientY - start.y) });
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [positie, onPositie]
  );

  return (
    <div ref={ref} className="dc-taakbalk" style={{ left: positie.x, top: positie.y }}>
      <div className="dc-taakbalk-kop" onPointerDown={startDrag} title="Sleep om te verplaatsen">
        <span className="dc-taakbalk-grip">⠿</span> {label}
      </div>
      <div className="dc-taakbalk-acties">
        {acties.map((a) => (
          <button
            key={a.id}
            className={"dc-taakbalk-knop" + (a.actief ? " is-actief" : "")}
            title={a.titel || a.label}
            onClick={a.onClick}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
