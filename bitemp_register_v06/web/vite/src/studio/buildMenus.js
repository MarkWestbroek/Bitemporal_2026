/**
 * buildMenus — stelt de menubalk samen uit een standaardset plus wat de actieve
 * activiteit aanlevert. Zo is de balk "flexibel in te vullen per gekozen thema"
 * (= per actieve functie/activiteit).
 *
 * Een activiteit levert optioneel `menus` aan: een array, of een functie die de
 * shell-context krijgt en een array teruggeeft. Activiteit-menu's met een id dat
 * ook in de standaardset zit, *overschrijven* die standaard; nieuwe id's worden
 * vóór "Help" ingevoegd.
 */

import { groepLabel } from "./activityRegistry";
import { menuBus } from "./menuBus";
import { toonMelding } from "./naamDialog.jsx";
import { resetHints } from "./hints.js";

/**
 * Items van het Ga naar-menu: het opdrachtenpalet bovenaan, daarna per groep
 * een kop met de activiteiten. Status verschijnt als badge; concept-
 * activiteiten (niet in de activity bar) zijn hier gedempt maar wél
 * aanklikbaar — dit menu is hun enige ingang.
 */
function gaNaarItems(activiteiten, actief, setActief) {
  const items = [
    {
      id: "palette",
      label: "Opdrachtenpalet…",
      shortcut: "Ctrl+K",
      uitleg: "Zoek elke activiteit en opdracht op naam of trefwoord.",
      onClick: () => menuBus.emit("palette:open"),
    },
  ];
  let vorigeGroep;
  for (const a of activiteiten || []) {
    if (a.groep !== vorigeGroep) {
      items.push({ type: "kop", label: groepLabel(a.groep) });
      vorigeGroep = a.groep;
    }
    items.push({
      id: `ga-${a.id}`,
      label: a.label,
      badge: a.status || undefined,
      muted: a.status === "concept",
      checked: a.id === actief?.id,
      onClick: () => setActief(a.id),
    });
  }
  return items;
}

/** De handleiding (voorlopig STUDIO.md op GitHub; zie de toelichting in standaardMenus). */
export const DOCS_URL = "https://github.com/MarkWestbroek/Bitemporal_2026/blob/main/bitemp_register_v06/docs/STUDIO.md";
export const openDocumentatie = () => window.open(DOCS_URL, "_blank", "noopener");

/** Bouw de standaard-menu's (Bestand, Beeld, Ga naar, Help). */
function standaardMenus(ctx) {
  const {
    activiteiten,
    actief,
    setActief,
    theme,
    toggleTheme,
    heeftSidebar,
    heeftInspector,
    sidebarOpen,
    inspectorOpen,
    sidebarPinned,
    inspectorPinned,
    toggleSidebar,
    toggleInspector,
    togglePin,
  } = ctx;

  // Index ligt naast de huidige pagina (dev: /, build: /viz/react/).
  const gaNaarIndex = () => {
    window.location.href = window.location.pathname.replace(/[^/]*$/, "") || "/";
  };

  // Documentatie: voorlopig rechtstreeks naar GitHub. De API rendert /docs/<pad>
  // alleen als hij vanuit een git-checkout draait (findProjectRoot zoekt een
  // .git-map); in de productie-image zit alleen de binary, dus daar geeft
  // /docs/... "Markdown file not found". Structurele fix staat op de backlog:
  // gecureerde docs in de image + DOCS_ROOT, dan wordt dit weer /docs/STUDIO.md.
  const openDocs = () => openDocumentatie();

  // Versie-/build-info (compile-time geïnjecteerd via vite.config.js → define).
  const versie = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
  const buildDatum = typeof __BUILD_DATE__ !== "undefined" ? __BUILD_DATE__ : "";
  const sha = typeof __GIT_SHA__ !== "undefined" ? __GIT_SHA__ : "";
  const overTekst =
    `Omnium Studio v${versie}` +
    (sha ? ` (${sha})` : "") +
    (buildDatum ? ` — build ${buildDatum}` : "") +
    "\n\nÉén rondom blik op je informatievoorziening: gegevens, processen, regels, " +
    "connectiviteit, autorisatie en basisgegevens in één geïntegreerde werkbank.";

  return [
    {
      id: "bestand",
      label: "Bestand",
      items: [
        { id: "index", label: "Overzicht (index)…", uitleg: "Naar de startpagina met schema, tijdlijn en registraties.", onClick: gaNaarIndex },
        { id: "herlaad", label: "Pagina herladen", shortcut: "F5", uitleg: "Laadt de Studio opnieuw; je project blijft bewaard.", onClick: () => window.location.reload() },
      ],
    },
    {
      id: "beeld",
      label: "Beeld",
      items: [
        {
          id: "toggle-left",
          label: "Linkerpaneel",
          uitleg: "Projectboom of verkenner tonen of verbergen.",
          checked: sidebarOpen,
          disabled: !heeftSidebar,
          onClick: toggleSidebar,
        },
        {
          id: "toggle-right",
          label: "Rechterpaneel",
          uitleg: "Eigenschappen van de selectie tonen of verbergen.",
          checked: inspectorOpen,
          disabled: !heeftInspector,
          onClick: toggleInspector,
        },
        { type: "separator" },
        {
          id: "pin-left",
          label: "Linkerpaneel vastpinnen",
          checked: sidebarPinned,
          disabled: !heeftSidebar,
          onClick: () => togglePin("sidebar"),
        },
        {
          id: "pin-right",
          label: "Rechterpaneel vastpinnen",
          checked: inspectorPinned,
          disabled: !heeftInspector,
          onClick: () => togglePin("inspector"),
        },
        { type: "separator" },
        {
          id: "theme",
          label: theme === "dark" ? "Licht thema" : "Donker thema",
          uitleg: "Wissel tussen licht en donker.",
          onClick: toggleTheme,
        },
      ],
    },
    {
      id: "ganaar",
      label: "Ga naar",
      items: gaNaarItems(activiteiten, actief, setActief),
    },
    {
      id: "help",
      label: "Help",
      items: [
        { id: "help-palette", label: "Opdrachtenpalet…", shortcut: "Ctrl+K", uitleg: "Zoek elke activiteit en opdracht op naam of trefwoord.", onClick: () => menuBus.emit("palette:open") },
        { id: "tour", label: "Rondleiding", uitleg: "Een korte kennismaking met de Studio, stap voor stap.", onClick: () => menuBus.emit("help:tour") },
        { id: "sneltoetsen", label: "Sneltoetsen…", uitleg: "Overzicht van alle toetsen, ook de instelbare.", onClick: () => menuBus.emit("help:sneltoetsen") },
        {
          id: "tips-reset",
          label: "Tips opnieuw tonen",
          uitleg: "Laat de korte tips (één keer per onderwerp) weer verschijnen.",
          onClick: () => {
            resetHints();
            toonMelding({ titel: "Tips", tekst: "De tips verschijnen weer, één keer per onderwerp, als je iets voor het eerst doet." });
          },
        },
        { type: "separator" },
        { id: "melden", label: "Melden… (bug, wens, vraag)", shortcut: "Alt+M", uitleg: "Meld een bug, wens of vraag; je ziet later de status en het antwoord.", onClick: () => menuBus.emit("help:melden") },
        { id: "melden-kader", label: "Melden met schermafbeelding…", shortcut: "F8", uitleg: "Trek een kader om wat je wilt laten zien; het komt als bijlage in de melding.", onClick: () => menuBus.emit("help:melden-kader") },
        { id: "mijn-meldingen", label: "Mijn meldingen…", uitleg: "Je meldingen met hun status en het gesprek erover.", onClick: () => menuBus.emit("help:mijn-meldingen") },
        { id: "melden-los", label: "Losse meldpagina (als de Studio hangt)…", uitleg: "melden.html: hetzelfde formulier, buiten de Studio.", onClick: () => window.open(window.location.pathname.replace(/[^/]*$/, "") + "melden.html", "_blank", "noopener") },
        { type: "separator" },
        { id: "docs", label: "Documentatie (STUDIO.md)…", uitleg: "De handleiding van de Studio (opent in een nieuw tabblad).", onClick: openDocs },
        { id: "about", label: `Over Omnium Studio (v${versie})`, uitleg: "Versie en build.", onClick: () => toonMelding({ titel: "Over Omnium Studio", tekst: overTekst }) },
      ],
    },
  ];
}

/** Voeg activiteit-menu's samen met de standaard (override by id, nette volgorde).
 *
 * Vaste ankers: Bestand staat vooraan, daarna de activiteit-eigen menu's
 * (bv. Bewerken, Publiceer, Tabel), gevolgd door Beeld, Ga naar en Help.
 * Een activiteit-menu met een bestaand id (bestand/beeld/…) overschrijft de
 * standaard op die ankerplek; nieuwe id's komen in het "midden".
 */
export function buildMenus(ctx) {
  const standaard = standaardMenus(ctx);
  const ruw = typeof ctx.actief?.menus === "function" ? ctx.actief.menus(ctx) : ctx.actief?.menus;
  const eigen = Array.isArray(ruw) ? ruw : [];

  const stdById = new Map(standaard.map((m) => [m.id, m]));
  const eigenById = new Map(eigen.map((m) => [m.id, m]));
  // `aanvullen: true` op een activiteit-menu met een anker-id: de eigen
  // items komen ónder de standaarditems (bv. weergave-instellingen in
  // Beeld) in plaats van het hele menu te vervangen.
  const pick = (id) => {
    const eigenMenu = eigenById.get(id);
    const stdMenu = stdById.get(id);
    if (eigenMenu?.aanvullen && stdMenu) {
      return { ...stdMenu, items: [...stdMenu.items, { type: "separator" }, ...eigenMenu.items] };
    }
    return eigenMenu || stdMenu || null;
  };

  // Ankers die hun vaste plek houden; al het overige (eigen) komt in het midden.
  const ankers = new Set(["bestand", "beeld", "ganaar", "help"]);
  const midden = eigen.filter((m) => !ankers.has(m.id));

  const result = [pick("bestand"), ...midden, pick("beeld"), pick("ganaar"), pick("help")];
  return result.filter(Boolean);
}
