/**
 * Taskbar (diagramcore) — zwevend, versleepbaar én resizebaar taakbalkje.
 *
 * Het raamwerk is core (plan §4.6): dit component + de voorkeuren-hook.
 * De sámenstelling (welke balken, welke acties) komt uit het DiagramType
 * (`taakbalken` in de descriptor); zichtbaarheid, positie en breedte zijn
 * gebruikersvoorkeur (TaskbarConfiguration in het metamodel) en worden per
 * opslagsleutel in localStorage onthouden.
 *
 * Vormvrijheid: via de resize-greep (rechtsonder) is de balk breed & plat of
 * smal & hoog te maken (de knoppen wrappen). Slepen is geclamped aan de
 * canvas-container zodat een balk nooit onbereikbaar buiten beeld raakt.
 *
 * Actie-model: { id, label, icoon?, titel?, uitleg?, actief?, onClick } —
 * dezelfde ActionType-gedachte als menu-items. `uitleg` is een optionele
 * één-regel-omschrijving voor de eigen tooltip.
 *
 * Tooltips: met `tooltips` (prop, default true) toont de balk een eigen
 * tooltip — groter en direct leesbaar dan de native title, mét de uitleg.
 * Uitgeschakeld (Studio-instellingen) valt hij terug op het title-attribuut.
 */
import { useCallback, useEffect, useRef, useState } from "react";

/** Lees de actuele voorkeuren zonder React (voor menu-checkmarks e.d.). */
export function leesTaakbalkVoorkeuren(opslagSleutel, defaults = {}) {
  try {
    const bewaard = JSON.parse(localStorage.getItem(opslagSleutel) || "null");
    return { ...defaults, ...(bewaard || {}) };
  } catch {
    return defaults;
  }
}

/**
 * Voorkeuren (zichtbaarheid + positie + breedte per balk), persistent.
 * @param {string} opslagSleutel - bv. "studio05-taakbalken-canoniek-uml"
 * @param {Record<string, {zichtbaar: boolean, positie: {x:number,y:number}, breedte?: number}>} defaults
 */
export function useTaakbalkVoorkeuren(opslagSleutel, defaults) {
  const [voorkeuren, setVoorkeuren] = useState(() => leesTaakbalkVoorkeuren(opslagSleutel, defaults));

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
  const zetBreedte = useCallback(
    (balkId, breedte) =>
      setVoorkeuren((v) => ({ ...v, [balkId]: { ...v[balkId], breedte } })),
    []
  );

  return { voorkeuren, zetZichtbaar, zetPositie, zetBreedte };
}

export function Taskbar({ label, acties, positie, breedte, onPositie, onBreedte, tooltips = true }) {
  const ref = useRef(null);

  // Eigen tooltip: {titel, uitleg, x, y} na een korte hover (250ms).
  const [tip, setTip] = useState(null);
  const tipTimer = useRef(null);
  const toonTip = useCallback(
    (ev, a) => {
      if (!tooltips) return;
      const r = ev.currentTarget.getBoundingClientRect();
      clearTimeout(tipTimer.current);
      tipTimer.current = setTimeout(
        () =>
          setTip({
            titel: a.titel || a.label,
            uitleg: a.uitleg || null,
            x: r.left + r.width / 2,
            y: r.bottom + 8,
          }),
        250
      );
    },
    [tooltips]
  );
  const verbergTip = useCallback(() => {
    clearTimeout(tipTimer.current);
    setTip(null);
  }, []);
  useEffect(() => () => clearTimeout(tipTimer.current), []);

  // Verslepen via de titelbalk, geclamped aan de parent-container zodat de
  // balk altijd (deels) zichtbaar en pakbaar blijft.
  const startDrag = useCallback(
    (ev) => {
      ev.preventDefault();
      const start = { x: ev.clientX, y: ev.clientY };
      const basis = { ...positie };
      const el = ref.current;
      const ouder = el?.parentElement;
      const maxX = ouder ? Math.max(0, ouder.clientWidth - (el?.offsetWidth || 60)) : Infinity;
      const maxY = ouder ? Math.max(0, ouder.clientHeight - 28) : Infinity;
      const onMove = (m) => {
        onPositie({
          x: Math.min(maxX, Math.max(0, basis.x + m.clientX - start.x)),
          y: Math.min(maxY, Math.max(0, basis.y + m.clientY - start.y)),
        });
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

  // Native CSS-resize (rechtsonder) → breedte persistent maken.
  useEffect(() => {
    const el = ref.current;
    if (!el || !onBreedte) return;
    let laatste = el.offsetWidth;
    const ro = new ResizeObserver(() => {
      const b = el.offsetWidth;
      if (Math.abs(b - laatste) >= 2) {
        laatste = b;
        if (breedte === undefined || Math.abs(b - breedte) >= 2) onBreedte(b);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [onBreedte, breedte]);

  return (
    <div
      ref={ref}
      className="dc-taakbalk"
      style={{ left: positie.x, top: positie.y, ...(breedte ? { width: breedte } : {}) }}
    >
      <div className="dc-taakbalk-kop" onPointerDown={startDrag} title="Sleep om te verplaatsen; hoekgreep om te vervormen">
        <span className="dc-taakbalk-grip">⠿</span> {label}
      </div>
      <div className="dc-taakbalk-acties">
        {acties.map((a) =>
          a.sep ? (
            <span key={a.id} className="dc-taakbalk-sep" aria-hidden="true" />
          ) : (
            <button
              key={a.id}
              className={
                "dc-taakbalk-knop" + (a.actief ? " is-actief" : "") + (a.icoon ? " is-icoon" : "")
              }
              // Eigen tooltip aan → geen native title erbovenop (dubbel).
              title={tooltips ? undefined : a.titel || a.label}
              onClick={(ev) => {
                verbergTip();
                a.onClick?.(ev);
              }}
              onPointerEnter={(ev) => toonTip(ev, a)}
              onPointerLeave={verbergTip}
            >
              {a.icoon || a.label}
            </button>
          )
        )}
      </div>
      {tip && (
        <div
          className="dc-taakbalk-tooltip"
          ref={(el) => {
            if (!el) return;
            // Binnen het venster houden (links/rechts).
            const r = el.getBoundingClientRect();
            if (r.right > window.innerWidth - 8) el.style.left = `${window.innerWidth - 8 - r.width / 2}px`;
            if (r.left < 8) el.style.left = `${8 + r.width / 2}px`;
          }}
          style={{ left: tip.x, top: tip.y }}
        >
          <div className="dc-taakbalk-tooltip-titel">{tip.titel}</div>
          {tip.uitleg && <div className="dc-taakbalk-tooltip-uitleg">{tip.uitleg}</div>}
        </div>
      )}
    </div>
  );
}
