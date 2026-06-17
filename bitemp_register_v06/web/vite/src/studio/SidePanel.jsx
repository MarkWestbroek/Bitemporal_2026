/**
 * SidePanel — inklapbaar zijpaneel met twee standen, herbruikbaar links én rechts.
 *
 * Twee onafhankelijke knoppen in de titelbalk:
 *   📌 Pin/Unpin  → schakelt tussen "vast gedockt" en "auto-hide".
 *   ‹ / ›         → klap handmatig in tot een rail.
 *
 * Standen:
 *   • Gepind (default): het paneel is vast gedockt en neemt layout-ruimte in.
 *   • Auto-hide (unpin): in de layout staat alleen een smalle rail; het paneel
 *     verschijnt als *overlay* boven de canvas zodra je de rail aanwijst, en klapt
 *     vanzelf weer in zodra de muis het paneel verlaat én er geen invoerveld in
 *     focus staat. Dit is het klassieke "auto-hide" gedrag (zoals Visual Studio).
 *   • Handmatig ingeklapt (open=false): altijd een rail; klik om weer te tonen.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { IconChevronLeft, IconChevronRight } from "./icons";

const VERBERG_VERTRAGING = 350; // ms voordat een auto-hide-overlay weer inklapt

export default function SidePanel({
  kant, // "left" | "right"
  titel,
  open,
  onToggle,
  pinned = true,
  onTogglePin,
  width,
  onResize,
  children,
}) {
  const [hoverOpen, setHoverOpen] = useState(false);
  const verbergTimer = useRef(null);
  const overlayRef = useRef(null);
  const autoHide = !pinned;

  // Ruim timers op bij unmount.
  useEffect(() => () => clearTimeout(verbergTimer.current), []);

  // Bij wisselen naar gepind: eventuele hover-overlay sluiten.
  useEffect(() => {
    if (pinned) setHoverOpen(false);
  }, [pinned]);

  const annuleerVerberg = useCallback(() => {
    clearTimeout(verbergTimer.current);
  }, []);

  const plansVerberg = useCallback(() => {
    clearTimeout(verbergTimer.current);
    verbergTimer.current = setTimeout(() => {
      // Houd open zolang een invoerveld binnen het paneel focus heeft.
      const actief = document.activeElement;
      if (overlayRef.current && actief && overlayRef.current.contains(actief)) {
        plansVerberg();
        return;
      }
      setHoverOpen(false);
    }, VERBERG_VERTRAGING);
  }, []);

  const startResize = useCallback(
    (e) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = width;
      const onMove = (ev) => {
        const delta = kant === "left" ? ev.clientX - startX : startX - ev.clientX;
        onResize(startW + delta);
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [kant, width, onResize]
  );

  const Chevron = kant === "left" ? IconChevronLeft : IconChevronRight;

  // Titelbalk (gedeeld door gedockt paneel en overlay).
  const kop = (
    <header className="studio-panel__head">
      <span className="studio-panel__title">{titel}</span>
      <span className="studio-panel__actions">
        {onTogglePin && (
          <button
            type="button"
            className={"studio-panel__pin" + (pinned ? " is-pinned" : "")}
            onClick={onTogglePin}
            title={pinned ? "Auto-hide (losmaken)" : "Vastpinnen"}
          >
            {pinned ? "📌" : "📍"}
          </button>
        )}
        <button
          type="button"
          className="studio-panel__collapse"
          onClick={onToggle}
          title={`${titel} verbergen`}
        >
          <Chevron />
        </button>
      </span>
    </header>
  );

  const splitter = (
    <div
      className={`studio-panel__splitter studio-panel__splitter--${kant}`}
      onMouseDown={startResize}
      role="separator"
      aria-orientation="vertical"
    />
  );

  // ── Handmatig ingeklapt → rail (klik = tonen) ──
  if (!open) {
    return (
      <button
        type="button"
        className={`studio-rail studio-rail--${kant}`}
        onClick={onToggle}
        title={`${titel} tonen`}
      >
        {kant === "left" ? <IconChevronRight /> : <IconChevronLeft />}
        <span className="studio-rail__label">{titel}</span>
      </button>
    );
  }

  // ── Auto-hide → rail in de layout + overlay bij hover ──
  if (autoHide) {
    return (
      <>
        <div
          className={`studio-rail studio-rail--${kant} studio-rail--auto`}
          onMouseEnter={() => {
            annuleerVerberg();
            setHoverOpen(true);
          }}
          onMouseLeave={plansVerberg}
          title={`${titel} (auto-hide) — wijs aan om te tonen`}
        >
          {kant === "left" ? <IconChevronRight /> : <IconChevronLeft />}
          <span className="studio-rail__label">{titel}</span>
        </div>
        {hoverOpen && (
          <aside
            ref={overlayRef}
            className={`studio-panel studio-panel--${kant} studio-panel--overlay`}
            style={{ width, [kant]: "var(--s-rail-w)" }}
            onMouseEnter={annuleerVerberg}
            onMouseLeave={plansVerberg}
          >
            {kop}
            <div className="studio-panel__body">{children}</div>
            {splitter}
          </aside>
        )}
      </>
    );
  }

  // ── Gepind → vast gedockt paneel ──
  return (
    <aside className={`studio-panel studio-panel--${kant}`} style={{ width }}>
      {kop}
      <div className="studio-panel__body">{children}</div>
      {splitter}
    </aside>
  );
}
