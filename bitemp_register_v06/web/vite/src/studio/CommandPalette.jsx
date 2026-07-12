/**
 * CommandPalette — opdrachtenpalet (Ctrl+K), consolidatieplan fase 1.
 *
 * Eén zoekveld over álles wat klikbaar is:
 *  - activiteiten ("Ga naar: …") — ook wat niet in de activity bar staat;
 *  - de menubalk-acties van de actieve activiteit (incl. submenu's, als
 *    "Menu › Submenu › Item"), dezelfde onClick's als de menubalk zelf.
 *
 * Het palet beheert zijn eigen open-stand: Ctrl+K (of Cmd+K) opent/sluit,
 * Escape of een klik op de achtergrond sluit, en menuBus "palette:open"
 * opent hem (voor het menu-item in Ga naar). ↑/↓ + Enter voeren uit.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { menuBus } from "./menuBus";

/** Vlak de menustructuur af tot uitvoerbare opdrachten. */
function verzamelOpdrachten({ menus, activiteiten, actiefId, setActief }) {
  const items = [];
  for (const a of activiteiten || []) {
    items.push({
      id: `ga-${a.id}`,
      categorie: "Ga naar",
      label: a.label,
      badge: a.status,
      actief: a.id === actiefId,
      run: () => setActief(a.id),
    });
  }
  const loop = (menuLabel, list, pad) => {
    for (const it of list || []) {
      if (!it || it.type === "separator" || it.type === "kop") continue;
      if (Array.isArray(it.items) && it.items.length) {
        loop(menuLabel, it.items, [...pad, it.label]);
        continue;
      }
      if (it.disabled || typeof it.onClick !== "function") continue;
      items.push({
        id: `${menuLabel}-${it.id ?? pad.concat(it.label).join("-")}`,
        categorie: menuLabel,
        label: [...pad, it.label].join(" › "),
        shortcut: it.shortcut,
        run: it.onClick,
      });
    }
  };
  for (const m of menus || []) {
    if (m.id === "ganaar") continue; // activiteiten staan er al in
    loop(m.label, m.items, []);
  }
  return items;
}

/** Simpele score: alle zoektermen moeten voorkomen; vroege match telt zwaarder. */
function filterOpdrachten(items, query) {
  const q = query.trim().toLowerCase();
  if (!q) return items.slice(0, 14);
  const termen = q.split(/\s+/);
  const gescoord = [];
  for (const it of items) {
    const tekst = `${it.categorie} ${it.label}`.toLowerCase();
    let score = 0;
    let ok = true;
    for (const t of termen) {
      const idx = tekst.indexOf(t);
      if (idx < 0) { ok = false; break; }
      score += idx === 0 || tekst[idx - 1] === " " || tekst[idx - 1] === "›" ? 2 : 1;
      score -= idx / 100;
    }
    if (ok) gescoord.push([score, it]);
  }
  gescoord.sort((a, b) => b[0] - a[0]);
  return gescoord.slice(0, 14).map(([, it]) => it);
}

export default function CommandPalette({ menus, activiteiten, actiefId, setActief }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectie, setSelectie] = useState(0);
  const inputRef = useRef(null);

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
  const zichtbaar = useMemo(() => filterOpdrachten(alle, query), [alle, query]);
  const geselecteerd = Math.min(selectie, Math.max(0, zichtbaar.length - 1));

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

  return (
    <div className="studio-palette-overlay" onMouseDown={() => setOpen(false)}>
      <div className="studio-palette" role="dialog" aria-label="Opdrachtenpalet" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="studio-palette__input"
          placeholder="Typ een activiteit of opdracht…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectie(0);
          }}
          onKeyDown={onInputKey}
        />
        <div className="studio-palette__lijst" role="listbox">
          {zichtbaar.length === 0 && <div className="studio-palette__leeg">Geen opdrachten gevonden.</div>}
          {zichtbaar.map((item, i) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={i === geselecteerd}
              className={"studio-palette__item" + (i === geselecteerd ? " is-selectie" : "")}
              onMouseEnter={() => setSelectie(i)}
              onClick={() => voerUit(item)}
            >
              <span className="studio-palette__categorie">{item.categorie}</span>
              <span className="studio-palette__label">
                {item.label}
                {item.actief ? " ✓" : ""}
              </span>
              {item.badge && <span className="studio-menubar__badge">{item.badge}</span>}
              {item.shortcut && <span className="studio-palette__shortcut">{item.shortcut}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
