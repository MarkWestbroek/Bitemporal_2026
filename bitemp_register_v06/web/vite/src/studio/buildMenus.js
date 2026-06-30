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

  // Documentatie wordt door de API-server gerenderd onder /docs/<pad>.
  // In dev draait Vite op :5174 en de API op :8082.
  const docsBasis = window.location.port === "5174" ? "http://localhost:8082" : "";
  const openDocs = () =>
    window.open(`${docsBasis}/docs/bitemp_register_v06/docs/STUDIO.md`, "_blank", "noopener");

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
        { id: "docs", label: "Documentatie (STUDIO.md)…", onClick: openDocs },
        { id: "about", label: `Over Omnium Studio (v${versie})`, onClick: () => window.alert(overTekst) },
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
  const pick = (id) => eigenById.get(id) || stdById.get(id) || null;

  // Ankers die hun vaste plek houden; al het overige (eigen) komt in het midden.
  const ankers = new Set(["bestand", "beeld", "ganaar", "help"]);
  const midden = eigen.filter((m) => !ankers.has(m.id));

  const result = [pick("bestand"), ...midden, pick("beeld"), pick("ganaar"), pick("help")];
  return result.filter(Boolean);
}
