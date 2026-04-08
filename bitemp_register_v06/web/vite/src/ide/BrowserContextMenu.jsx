/**
 * BrowserContextMenu — Rechtermuisklik-menu voor de Project Browser.
 *
 * Fase 2/3 basis:
 * - "Open in diagram" (als element op een diagram staat)
 * - "Toon in details" (selecteer en toon in details panel)
 * - "Nieuw diagram" op de diagrammen-map
 * - separator
 * - "Kopieer ID" (naar clipboard)
 */
import { useEffect, useMemo, useRef } from "react";

const MENU_ITEMS = {
  toonInDiagram: { label: "📍 Toon op diagram", types: ["entiteit", "gegevenselement", "relatie", "enumeratie", "gegevenstype", "referentielijstInstantie"] },
  toonDetails: { label: "ℹ️ Toon details", types: ["entiteit", "gegevenselement", "relatie", "enumeratie", "gegevenstype", "referentielijstInstantie"] },
  hernoem: { label: "✏️ Hernoem", types: ["entiteit", "gegevenselement", "relatie", "enumeratie", "gegevenstype", "referentielijstInstantie", "diagram"] },
  separator1: { separator: true },
  kopieerID: { label: "📋 Kopieer ID", types: ["entiteit", "gegevenselement", "relatie", "enumeratie", "gegevenstype", "referentielijstInstantie"] },
  nieuwDiagram: { label: "➕ Nieuw diagram", types: ["diagrams"] },
  openDiagram: { label: "📐 Open diagram", types: ["diagram"] },
};

export default function BrowserContextMenu({ x, y, nodeData, onClose, onAction }) {
  const menuRef = useRef(null);
  const menuPos = useMemo(() => {
    if (typeof window === "undefined") return { left: x, top: y };
    return {
      left: Math.max(8, Math.min(x, window.innerWidth - 220)),
      top: Math.max(8, Math.min(y, window.innerHeight - 220)),
    };
  }, [x, y]);

  // Sluit bij klik erbuiten, Escape, blur, scroll of resize
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    const handleVisibility = () => {
      if (document.hidden) onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    document.addEventListener("scroll", onClose, true);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", onClose);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("scroll", onClose, true);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  if (!nodeData) return null;

  const visibleItems = Object.entries(MENU_ITEMS).filter(([_key, item]) => {
    if (item.separator) return true;
    return item.types.includes(nodeData.nodeType);
  });

  // Verwijder separators aan het begin/einde
  while (visibleItems.length > 0 && visibleItems[0][1].separator) visibleItems.shift();
  while (visibleItems.length > 0 && visibleItems[visibleItems.length - 1][1].separator) visibleItems.pop();

  if (visibleItems.length === 0) return null;

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        left: menuPos.left,
        top: menuPos.top,
        background: "var(--ide-menu-bg, #2d2d2d)",
        border: "1px solid var(--ide-menu-border, #555)",
        borderRadius: 4,
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        padding: "4px 0",
        minWidth: 180,
        maxHeight: "calc(100vh - 16px)",
        overflowY: "auto",
        zIndex: 9999,
        fontSize: 12,
        color: "var(--ide-menu-color, #ccc)",
      }}
    >
      {visibleItems.map(([key, item], i) =>
        item.separator ? (
          <div key={i} style={{ height: 1, background: "var(--ide-menu-sep, #444)", margin: "4px 8px" }} />
        ) : (
          <div
            key={key}
            onClick={() => {
              onAction(key, nodeData);
              onClose();
            }}
            style={{
              padding: "5px 12px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ide-menu-hover, #3a3f4b)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {item.label}
          </div>
        )
      )}
    </div>
  );
}
