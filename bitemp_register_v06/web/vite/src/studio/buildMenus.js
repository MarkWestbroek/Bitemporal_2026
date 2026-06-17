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

  return [
    {
      id: "bestand",
      label: "Bestand",
      items: [
        { id: "index", label: "Overzicht (index)…", onClick: gaNaarIndex },
        { id: "herlaad", label: "Pagina herladen", shortcut: "F5", onClick: () => window.location.reload() },
      ],
    },
    {
      id: "beeld",
      label: "Beeld",
      items: [
        {
          id: "toggle-left",
          label: "Linkerpaneel",
          checked: sidebarOpen,
          disabled: !heeftSidebar,
          onClick: toggleSidebar,
        },
        {
          id: "toggle-right",
          label: "Rechterpaneel",
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
          onClick: toggleTheme,
        },
      ],
    },
    {
      id: "ganaar",
      label: "Ga naar",
      items: (activiteiten || []).map((a) => ({
        id: `ga-${a.id}`,
        label: a.label + (a.status === "concept" ? "  (concept)" : ""),
        checked: a.id === actief?.id,
        onClick: () => setActief(a.id),
      })),
    },
    {
      id: "help",
      label: "Help",
      items: [
        { id: "docs", label: "Documentatie (STUDIO.md)…", onClick: () => window.open("https://github.com", "_blank") },
        { id: "about", label: "Over Studio", onClick: () => window.alert("Studio — geïntegreerde werkbank voor het bitemporeel register.") },
      ],
    },
  ];
}

/** Voeg activiteit-menu's samen met de standaard (override by id, nieuwe vóór Help). */
export function buildMenus(ctx) {
  const standaard = standaardMenus(ctx);
  const ruw = typeof ctx.actief?.menus === "function" ? ctx.actief.menus(ctx) : ctx.actief?.menus;
  const eigen = Array.isArray(ruw) ? ruw : [];
  if (eigen.length === 0) return standaard;

  const result = standaard.map((m) => {
    const override = eigen.find((e) => e.id === m.id);
    return override || m;
  });
  const helpIdx = result.findIndex((m) => m.id === "help");
  const nieuwe = eigen.filter((e) => !standaard.some((m) => m.id === e.id));
  if (nieuwe.length) {
    const pos = helpIdx >= 0 ? helpIdx : result.length;
    result.splice(pos, 0, ...nieuwe);
  }
  return result;
}
