/**
 * MenuBar — klassieke applicatie-menubalk bovenin (Bestand, Bewerken, … Help).
 *
 * Volledig data-gedreven: krijgt een lijst menu's binnen en rendert dropdowns.
 * De inhoud is *flexibel per activiteit* — de shell stelt de menu's samen uit een
 * standaardset plus wat de actieve activiteit aanlevert (zie buildMenus.js).
 *
 * Menu-model:
 *   menus: [
 *     { id, label, items: [
 *        { id, label, onClick, shortcut?, disabled?, checked? } |
 *        { type: "separator" }
 *     ]}
 *   ]
 *
 * Bediening: klik op een titel opent het menu; bewegen over andere titels wisselt
 * (zoals een desktop-menubalk); klik buiten of Escape sluit.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";

export default function MenuBar({ menus, links = null }) {
  const [openId, setOpenId] = useState(null);
  const barRef = useRef(null);

  // Sluit bij klik buiten de balk of Escape.
  useEffect(() => {
    if (!openId) return;
    const onDocClick = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) setOpenId(null);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpenId(null);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [openId]);

  const kies = useCallback((item) => {
    if (item.disabled || item.type === "separator") return;
    setOpenId(null);
    item.onClick?.();
  }, []);

  return (
    <div className="studio-menubar" ref={barRef}>
      <div className="studio-menubar__menus">
        {(menus || []).map((menu) => (
          <div className="studio-menubar__item" key={menu.id}>
            <button
              type="button"
              className={"studio-menubar__title" + (openId === menu.id ? " is-open" : "")}
              onClick={() => setOpenId((cur) => (cur === menu.id ? null : menu.id))}
              onMouseEnter={() => openId && setOpenId(menu.id)}
            >
              {menu.label}
            </button>
            {openId === menu.id && (
              <div className="studio-menubar__dropdown" role="menu">
                {(menu.items || []).map((item, i) =>
                  item.type === "separator" ? (
                    <div key={`sep-${i}`} className="studio-menubar__sep" />
                  ) : (
                    <button
                      key={item.id || i}
                      type="button"
                      role="menuitem"
                      className={"studio-menubar__entry" + (item.disabled ? " is-disabled" : "")}
                      onClick={() => kies(item)}
                      disabled={item.disabled}
                    >
                      <span className="studio-menubar__check">{item.checked ? "✓" : ""}</span>
                      <span className="studio-menubar__label">{item.label}</span>
                      {item.shortcut && (
                        <span className="studio-menubar__shortcut">{item.shortcut}</span>
                      )}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {links && <div className="studio-menubar__right">{links}</div>}
    </div>
  );
}
