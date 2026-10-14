/**
 * CommandPalette — opdrachtenpalet (Ctrl+K), consolidatieplan fase 1; uitleg, groepen en
 * "Meer…" uit het ontwerp Begeleiding in de Studio §2.2 (14-10).
 *
 * Eén zoekveld over álles wat klikbaar is:
 *  - activiteiten ("Ga naar: …") — ook wat niet in de activity bar staat;
 *  - de menubalk-acties van de actieve activiteit (incl. submenu's, als
 *    "Menu › Submenu › Item"), dezelfde onClick's als de menubalk zelf.
 * Elke opdracht kan een regel `uitleg` hebben (bij het menu-item of de activiteit); daarop
 * wordt ook gezocht. Zonder zoekterm staan de opdrachten per menu gegroepeerd.
 *
 * Het palet beheert zijn eigen open-stand: Ctrl+K (of Cmd+K) opent/sluit,
 * Escape of een klik op de achtergrond sluit, en menuBus "palette:open"
 * opent hem (voor de menu-items in Ga naar en Help). ↑/↓ + Enter voeren uit.
 * Logica (verzamelen, zoeken, groeperen): paletOpdrachten.js.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { menuBus } from "./menuBus";
import { verzamelOpdrachten, filterOpdrachten, groepeerOpdrachten } from "./paletOpdrachten.js";

export default function CommandPalette({ menus, activiteiten, actiefId, setActief }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectie, setSelectie] = useState(0);
  const inputRef = useRef(null);
  const lijstRef = useRef(null);

  // Ctrl/Cmd+K opent (of sluit); menu-item "Opdrachtenpalet…" via de menuBus.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    const af = menuBus.on("palette:open", () => setOpen(true));
    return () => {
      window.removeEventListener("keydown", onKey);
      af();
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectie(0);
      // Na de render focussen, anders bestaat het veld nog niet.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const alle = useMemo(
    () => (open ? verzamelOpdrachten({ menus, activiteiten, actiefId, setActief }) : []),
    [open, menus, activiteiten, actiefId, setActief]
  );
  const zoekt = query.trim() !== "";
  // Zonder zoekterm: gegroepeerd per menu, in menuvolgorde; met zoekterm: op score.
  const groepen = useMemo(
    () => (zoekt ? [{ groep: null, items: filterOpdrachten(alle, query) }] : groepeerOpdrachten(alle)),
    [alle, query, zoekt]
  );
  const zichtbaar = useMemo(() => groepen.flatMap((g) => g.items), [groepen]);
  const geselecteerd = Math.min(selectie, Math.max(0, zichtbaar.length - 1));

  // Selectie in beeld houden bij ↑/↓.
  useEffect(() => {
    lijstRef.current?.querySelector(".is-selectie")?.scrollIntoView?.({ block: "nearest" });
  }, [geselecteerd, open]);

  if (!open) return null;

  const voerUit = (item) => {
    setOpen(false);
    item?.run?.();
  };

  const onInputKey = (e) => {
    if (e.key === "Escape") setOpen(false);
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectie((i) => Math.min(i + 1, zichtbaar.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectie((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      voerUit(zichtbaar[geselecteerd]);
    }
  };

  let index = -1;
  return (
    <div className="studio-palette-overlay" onMouseDown={() => setOpen(false)}>
      <div className="studio-palette" role="dialog" aria-label="Opdrachtenpalet" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="studio-palette__input"
          placeholder="Typ wat je wilt doen: een activiteit, opdracht of trefwoord…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectie(0);
          }}
          onKeyDown={onInputKey}
          aria-label="Zoek een opdracht"
        />
        <div className="studio-palette__lijst" role="listbox" ref={lijstRef}>
          {zichtbaar.length === 0 && <div className="studio-palette__leeg">Geen opdrachten gevonden.</div>}
          {groepen.map((g) => (
            <React.Fragment key={g.groep || "_"}>
              {g.groep && g.items.length > 0 && <div className="studio-palette__groep">{g.groep}</div>}
              {g.items.map((item) => {
                index += 1;
                const i = index;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={i === geselecteerd}
                    className={"studio-palette__item" + (i === geselecteerd ? " is-selectie" : "")}
                    onMouseEnter={() => setSelectie(i)}
                    onClick={() => voerUit(item)}
                  >
                    {zoekt && <span className="studio-palette__categorie">{item.categorie}</span>}
                    <span className="studio-palette__tekst">
                      <span className="studio-palette__label">
                        {item.label}
                        {item.actief ? " ✓" : ""}
                      </span>
                      {item.uitleg && <span className="studio-palette__uitleg">{item.uitleg}</span>}
                    </span>
                    {item.badge && <span className="studio-menubar__badge">{item.badge}</span>}
                    {item.shortcut && <span className="studio-palette__shortcut">{item.shortcut}</span>}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
        <div className="studio-palette__voet">
          <span>↑↓ kiezen · Enter uitvoeren · Esc sluiten</span>
          <button type="button" className="studio-palette__meer" onClick={() => { setOpen(false); menuBus.emit("help:sneltoetsen"); }}>
            Sneltoetsen
          </button>
          <button type="button" className="studio-palette__meer" onClick={() => { setOpen(false); menuBus.emit("help:documentatie"); }}>
            Meer… (documentatie)
          </button>
        </div>
      </div>
    </div>
  );
}
