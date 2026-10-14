// @ts-check
/**
 * paletOpdrachten — zuivere logica van het opdrachtenpalet (Ctrl+K): de menu's plat
 * slaan tot opdrachten, zoeken en groeperen. Ontwerp: docs/plans/2026-09-10 Begeleiding
 * in de Studio §2.2; besluit Mark 14-10: de `uitleg` staat bij de actie zelf (menu-item
 * of activiteit), zodat menu, palet en later de referentie één bron delen.
 */

/** Volgorde van de groepen in het palet zonder zoekterm. */
export const GROEP_VOLGORDE = ["Ga naar", "Help"];

/**
 * Vlak de menustructuur af tot uitvoerbare opdrachten.
 * @returns {Array<{id:string, categorie:string, label:string, uitleg?:string, shortcut?:string, badge?:string, actief?:boolean, run:Function}>}
 */
export function verzamelOpdrachten({ menus, activiteiten, actiefId, setActief }) {
  const items = [];
  for (const a of activiteiten || []) {
    items.push({
      id: `ga-${a.id}`,
      categorie: "Ga naar",
      label: a.label,
      uitleg: a.uitleg || undefined,
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
        uitleg: it.uitleg || undefined,
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

/** Normaliseer voor zoeken: kleine letters, zonder accenten (ë → e). */
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Zoeken: elke term moet voorkomen in categorie, label of uitleg. Een treffer in het label
 * telt zwaarder dan in de uitleg; het begin van een woord zwaarder dan midden in een woord.
 * Afkortingen werken ook: "nwd" vindt "Nieuw diagram" (beginletters van woorden).
 */
export function filterOpdrachten(items, query, max = 30) {
  const q = norm(query).trim();
  if (!q) return items.slice(0, max);
  const termen = q.split(/\s+/);
  const gescoord = [];
  for (const it of items) {
    const kop = norm(`${it.categorie} ${it.label}`);
    const uitleg = norm(it.uitleg);
    const beginletters = kop.split(/[\s›/-]+/).filter(Boolean).map((w) => w[0]).join("");
    let score = 0;
    let ok = true;
    for (const t of termen) {
      // Volgorde: begin van een woord > beginletters ("nd" = Nieuw diagram) > midden in
      // een woord ("nd" in "bestand") > alleen in de uitleg.
      const idx = kop.search(new RegExp(`(^|[\\s›(/-])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
      if (idx >= 0) {
        score += 3 - idx / 200;
      } else if (t.length >= 2 && beginletters.includes(t)) {
        score += 2;
      } else if (kop.includes(t)) {
        score += 1.5 - kop.indexOf(t) / 200;
      } else if (uitleg.includes(t)) {
        score += 0.6;
      } else {
        ok = false;
        break;
      }
    }
    if (ok) gescoord.push([score, it]);
  }
  gescoord.sort((a, b) => b[0] - a[0]);
  return gescoord.slice(0, max).map(([, it]) => it);
}

/**
 * Groepeer opdrachten per categorie (zonder zoekterm): eerst de menu's van de
 * activiteit in menuvolgorde, dan Ga naar en Help. → [{groep, items}]
 */
export function groepeerOpdrachten(items) {
  const perGroep = new Map();
  for (const it of items) {
    if (!perGroep.has(it.categorie)) perGroep.set(it.categorie, []);
    perGroep.get(it.categorie).push(it);
  }
  const rang = (g) => {
    const i = GROEP_VOLGORDE.indexOf(g);
    return i < 0 ? -1 : i;
  };
  return [...perGroep.entries()]
    .map(([groep, lijst]) => ({ groep, items: lijst }))
    .sort((a, b) => rang(a.groep) - rang(b.groep));
}
