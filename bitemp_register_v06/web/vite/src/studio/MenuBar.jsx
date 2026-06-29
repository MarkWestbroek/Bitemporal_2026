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
 *        { id, label, onClick, shortcut?, disabled?, checked? }      // gewoon item
 *        { id, label, items: [ … ] }                                 // submenu (flyout)
 *        { type: "separator" }
 *     ]}
 *   ]
 *
 * Bediening: klik op een titel opent het menu; bewegen over andere titels wisselt
 * (zoals een desktop-menubalk); een item met `items` opent een flyout-submenu bij
 * hover; klik buiten of Escape sluit.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";

/** Eén dropdown-niveau; rendert items en beheert de open flyout-submenu. */
function Dropdown({ items, onKies, flyout = false }) {
  const [openSubId, setOpenSubId] = useState(null);

  return (
    <div className={"studio-menubar__dropdown" + (flyout ? " is-flyout" : "")} role="menu">
      {(items || []).map((item, i) => {
        if (item.type === "separator") {
          return <div key={`sep-${i}`} className="studio-menubar__sep" />;
        }
        const heeftSub = Array.isArray(item.items) && item.items.length > 0;
        if (heeftSub) {
          const sid = item.id || i;
          return (
            <div
              key={sid}
              className="studio-menubar__subwrap"
              onMouseEnter={() => setOpenSubId(sid)}
              onMouseLeave={() => setOpenSubId(null)}
            >
              <button
                type="button"
                role="menuitem"
                className={"studio-menubar__entry" + (item.disabled ? " is-disabled" : "")}
                disabled={item.disabled}
                aria-haspopup="true"
                aria-expanded={openSubId === sid}
              >
                <span className="studio-menubar__check">{item.checked ? "✓" : ""}</span>
                <span className="studio-menubar__label">{item.label}</span>
                <span className="studio-menubar__caret">▸</span>
              </button>
              {openSubId === sid && <Dropdown items={item.items} onKies={onKies} flyout />}
            </div>
          );
        }
        return (
          <button
            key={item.id || i}
            type="button"
            role="menuitem"
            className={"studio-menubar__entry" + (item.disabled ? " is-disabled" : "")}
            onClick={() => onKies(item)}
            disabled={item.disabled}
          >
            <span className="studio-menubar__check">{item.checked ? "✓" : ""}</span>
            <span className="studio-menubar__label">{item.label}</span>
            {item.shortcut && <span className="studio-menubar__shortcut">{item.shortcut}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default function MenuBar({ menus, links = null, brand = null }) {
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
      {brand && <div className="studio-menubar__product">{brand}</div>}
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
            {openId === menu.id && <Dropdown items={menu.items} onKies={kies} />}
          </div>
        ))}
      </div>
      {links && <div className="studio-menubar__right">{links}</div>}
    </div>
  );
}
