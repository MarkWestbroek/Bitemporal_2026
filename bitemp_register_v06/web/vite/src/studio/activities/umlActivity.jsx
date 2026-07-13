/**
 * umlActivity — de bestaande UML-model-IDE als activiteit in de werkbank.
 *
 * De UML-IDE (IdePage) brengt zijn eigen docking-layout, project-browser en
 * eigenschappen-paneel mee (FlexLayout). Daarom is dit een `fullMain`-activiteit:
 * de shell toont alleen de menubalk + activity bar en geeft IdePage de volledige
 * ruimte.
 *
 * Menubalk: deze activiteit levert een rijke set hoofdmenu's aan die de Studio-shell
 * combineert met de standaard (zie buildMenus.js). De acties bereiken de IDE op twee
 * manieren:
 *   1. **Direct** op de globale stores — undo/redo (zundo temporal) en het aanmaken
 *      van representaties (`voegNieuwRepToe`, werkt op het actieve diagram).
 *   2. **Via de menuBus** — acties die een dialoog/paneel in IdePage openen
 *      (import/export/upload/publiceer/…) of een layout-commando naar het actieve
 *      DiagramCanvas sturen (`uml:layout`).
 *
 * Hier komt later ook DMN-modellering bij (zie dmnActivity voor de tabellen).
 */
import React, { lazy } from "react";
import { IconUML } from "../icons";
import { menuBus } from "../menuBus";
import useModelStore from "../../store/useModelStore";
import { voegNieuwRepToe } from "../../ide/repCreation";

const IdePage = lazy(() => import("../../pages/IdePage"));

function UmlMain() {
  return <IdePage embedded />;
}

// Index ligt naast de huidige pagina (dev: /, build: /viz/react/).
function gaNaarIndex() {
  window.location.href = window.location.pathname.replace(/[^/]*$/, "") || "/";
}

const undo = () => useModelStore.temporal.getState().undo();
const redo = () => useModelStore.temporal.getState().redo();
const maak = (kind) => voegNieuwRepToe(kind);
const layout = (mode) => menuBus.emit("uml:layout", mode);

/**
 * Bouwt de UML-specifieke menubalk. Krijgt de shell-context (o.a. theme/toggleTheme)
 * en geeft een lijst hoofdmenu's terug die de standaardmenu's (op id) overschrijven.
 */
function umlMenus(ctx) {
  const { theme, toggleTheme } = ctx;
  return [
    {
      id: "bestand",
      label: "Bestand",
      items: [
        { id: "uml-import", label: "Importeer… (bestand of API)", shortcut: "Ctrl+O", onClick: () => menuBus.emit("uml:import") },
        { id: "uml-export", label: "Exporteer…", shortcut: "Ctrl+S", onClick: () => menuBus.emit("uml:export") },
        { type: "separator" },
        { id: "uml-upload", label: "Upload bestand…", onClick: () => menuBus.emit("uml:upload") },
        { type: "separator" },
        { id: "index", label: "Overzicht (index)…", onClick: gaNaarIndex },
        { id: "herlaad-pagina", label: "Pagina herladen", shortcut: "F5", onClick: () => window.location.reload() },
      ],
    },
    {
      id: "bewerken",
      label: "Bewerken",
      items: [
        { id: "uml-undo", label: "Ongedaan maken", shortcut: "Ctrl+Z", onClick: undo },
        { id: "uml-redo", label: "Opnieuw", shortcut: "Ctrl+Y", onClick: redo },
        { type: "separator" },
        {
          id: "uml-maak",
          label: "Maak",
          items: [
            { id: "maak-entiteit", label: "Entiteit", onClick: () => maak("entiteit") },
            { id: "maak-ge", label: "Gegevenselement", onClick: () => maak("gegevenselement") },
            { id: "maak-relatie", label: "Relatie", onClick: () => maak("relatie") },
            { id: "maak-reflijst", label: "Referentielijst", onClick: () => maak("referentielijst") },
            { type: "separator" },
            { id: "maak-enum", label: "Enumeratie", onClick: () => maak("enumeratie") },
            { id: "maak-type", label: "Gegevenstype", onClick: () => maak("gegevenstype") },
            { type: "separator" },
            { id: "maak-notitie", label: "Notitie", onClick: () => maak("notitie") },
            { id: "maak-constraint", label: "Constraint", onClick: () => maak("constraint") },
          ],
        },
      ],
    },
    {
      id: "publiceer",
      label: "Publiceer",
      items: [
        { id: "uml-publiceer", label: "Publiceer schema-versie…", onClick: () => menuBus.emit("uml:publiceer") },
        { id: "uml-delta", label: "Delta-analyse…", onClick: () => menuBus.emit("uml:delta") },
        { id: "uml-rebuild", label: "Rebuild (codegen + herstart)…", onClick: () => menuBus.emit("uml:rebuild") },
        { type: "separator" },
        { id: "uml-pub-rebuild", label: "Publiceer + Rebuild…", onClick: () => menuBus.emit("uml:publiceer-rebuild") },
      ],
    },
    {
      id: "beeld",
      label: "Beeld",
      items: [
        { id: "uml-nieuw-diagram", label: "Nieuw diagram…", onClick: () => menuBus.emit("uml:nieuw-diagram") },
        { id: "uml-herlaad", label: "Herlaad uit database", onClick: () => menuBus.emit("uml:herlaad") },
        { id: "uml-bestanden", label: "Bestanden-paneel", onClick: () => menuBus.emit("uml:bestanden") },
        { type: "separator" },
        { id: "uml-auto-layout", label: "Auto-layout (heel diagram)", onClick: () => layout("auto-layout") },
        { id: "uml-auto-layout-sel", label: "Auto-layout (selectie)", onClick: () => layout("auto-layout-selectie") },
        { id: "uml-snap-grid", label: "Uitlijnen op raster", onClick: () => layout("snap-grid") },
        { id: "uml-normaliseer", label: "Relaties normaliseren", onClick: () => layout("normaliseer-relaties") },
        { type: "separator" },
        {
          id: "uml-uitlijnen",
          label: "Uitlijnen (selectie)",
          items: [
            { id: "align-left", label: "Links", onClick: () => layout("left") },
            { id: "align-right", label: "Rechts", onClick: () => layout("right") },
            { id: "align-top", label: "Boven", onClick: () => layout("top") },
            { id: "align-bottom", label: "Onder", onClick: () => layout("bottom") },
            { type: "separator" },
            { id: "align-center-h", label: "Horizontaal centreren", onClick: () => layout("center-h") },
            { id: "align-center-v", label: "Verticaal centreren", onClick: () => layout("center-v") },
            { type: "separator" },
            { id: "align-dist-h", label: "Horizontaal verdelen", onClick: () => layout("distribute-h") },
            { id: "align-dist-v", label: "Verticaal verdelen", onClick: () => layout("distribute-v") },
          ],
        },
        { type: "separator" },
        { id: "uml-thema", label: theme === "dark" ? "Licht thema" : "Donker thema", onClick: toggleTheme },
      ],
    },
  ];
}

export default {
  id: "uml",
  label: "UML-model",
  standaardVerborgen: true, // gedekt door de Modelleren-host (Canoniek model IDE v1)
  icon: <IconUML />,
  groep: "modelleren",
  fullMain: true,
  Main: UmlMain,
  menus: umlMenus,
};
