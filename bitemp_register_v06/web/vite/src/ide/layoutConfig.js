/**
 * layoutConfig.js — FlexLayout model definitie en layout-constanten.
 *
 * FlexLayout werkt met een JSON-model dat de indeling beschrijft.
 * De "factory" functie bepaalt welk React component er in elke tab komt.
 */
import * as FlexLayout from "flexlayout-react";

// Component-namen (gebruikt in factory en bij programmatic tab-adds)
export const COMP_BROWSER = "browser";
export const COMP_DIAGRAM = "diagram";
export const COMP_PROPERTIES = "properties";
export const COMP_BESTANDEN = "bestanden";

/**
 * Maak het FlexLayout JSON model.
 * Herstelt uit localStorage als beschikbaar, anders default.
 * Bij fout: verwijder corrupte opslag en gebruik default.
 */
export function createLayoutModel() {
  const saved = localStorage.getItem("ide-layout");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Sanity check: layout moet een object zijn met layout property
      if (parsed && typeof parsed === "object" && parsed.layout) {
        return FlexLayout.Model.fromJson(parsed);
      }
      console.warn("Opgeslagen layout mist 'layout' property, gebruik default.");
    } catch (e) {
      console.warn("Kon opgeslagen layout niet herstellen, gebruik default:", e);
    }
    // Corrupte data → verwijder
    localStorage.removeItem("ide-layout");
  }
  return FlexLayout.Model.fromJson(DEFAULT_LAYOUT);
}

/** Reset layout naar default (verwijder opgeslagen state) */
export function resetLayout() {
  localStorage.removeItem("ide-layout");
}

/** Sla layout op in localStorage */
export function persistLayout(model) {
  try {
    localStorage.setItem("ide-layout", JSON.stringify(model.toJson()));
  } catch (e) {
    console.warn("Layout opslaan mislukt:", e);
  }
}

/**
 * Hernoem de FlexLayout-tab van een diagram (sync na store-rename).
 * Als de tab niet open staat, doet deze functie niets.
 * @param {FlexLayout.Model} model
 * @param {string} diagramId
 * @param {string} nieuweNaam
 */
export function renameDiagramTab(model, diagramId, nieuweNaam) {
  model.visitNodes((node) => {
    if (node.getType?.() !== "tab") return;
    if (node.getComponent?.() !== COMP_DIAGRAM) return;
    if ((node.getConfig?.() || {}).diagramId === diagramId) {
      model.doAction(FlexLayout.Actions.renameTab(node.getId(), nieuweNaam));
    }
  });
}

/**
 * Sluit de FlexLayout-tab(s) van een diagram. Als het diagram in
 * meerdere tabsets open staat, worden alle tabs gesloten. Als de
 * tab niet open staat, doet deze functie niets.
 * @param {FlexLayout.Model} model
 * @param {string} diagramId
 */
export function closeDiagramTab(model, diagramId) {
  const teVerwijderen = [];
  model.visitNodes((node) => {
    if (node.getType?.() !== "tab") return;
    if (node.getComponent?.() !== COMP_DIAGRAM) return;
    if ((node.getConfig?.() || {}).diagramId === diagramId) {
      teVerwijderen.push(node.getId());
    }
  });
  for (const id of teVerwijderen) {
    model.doAction(FlexLayout.Actions.deleteTab(id));
  }
}

/**
 * Voeg een nieuwe diagram-tab toe aan het layout model.
 * @param {FlexLayout.Model} model
 * @param {string} diagramId
 * @param {string} naam
 */
export function openDiagramTab(model, diagramId, naam) {
  // Hergebruik een bestaande tab als dit diagram al open staat.
  const bestaandeTabIds = [];
  model.visitNodes((node) => {
    if (node.getType?.() !== "tab") return;
    if (node.getComponent?.() !== COMP_DIAGRAM) return;
    const config = node.getConfig?.() || {};
    if (config.diagramId === diagramId) {
      bestaandeTabIds.push(node.getId());
    }
  });

  if (bestaandeTabIds.length > 0) {
    const [eersteTabId, ...dubbeleTabs] = bestaandeTabIds;
    dubbeleTabs.forEach((tabId) => {
      model.doAction(FlexLayout.Actions.deleteTab(tabId));
    });
    model.doAction(FlexLayout.Actions.selectTab(eersteTabId));
    return;
  }

  // Zoek de eerste tabset die al een diagram bevat, of de middelste.
  model.doAction(
    FlexLayout.Actions.addNode(
      {
        type: "tab",
        name: naam || diagramId,
        component: COMP_DIAGRAM,
        config: { diagramId },
      },
      findOrFirstTabset(model, COMP_DIAGRAM),
      FlexLayout.DockLocation.CENTER,
      -1,
      true
    )
  );
}

/**
 * Open de Bestanden-tab in het layout model.
 * Hergebruikt een bestaande tab als die al open staat.
 * @param {FlexLayout.Model} model
 */
export function openBestandenTab(model) {
  // Hergebruik bestaande bestanden-tab
  let bestaandeTabId = null;
  model.visitNodes((node) => {
    if (node.getType?.() !== "tab") return;
    if (node.getComponent?.() === COMP_BESTANDEN) {
      bestaandeTabId = node.getId();
    }
  });

  if (bestaandeTabId) {
    model.doAction(FlexLayout.Actions.selectTab(bestaandeTabId));
    return;
  }

  // Voeg toe aan de diagram-tabset (midden)
  model.doAction(
    FlexLayout.Actions.addNode(
      {
        type: "tab",
        name: "Bestanden",
        component: COMP_BESTANDEN,
      },
      findOrFirstTabset(model, COMP_DIAGRAM),
      FlexLayout.DockLocation.CENTER,
      -1,
      true
    )
  );
}

/** Vind een tabset die al een tab met dit component-type bevat, of de eerste tabset. */
function findOrFirstTabset(model, componentType) {
  let firstTabset = null;
  let matchTabset = null;

  model.visitNodes((node) => {
    if (node.getType() === "tabset") {
      if (!firstTabset) firstTabset = node.getId();
      const children = node.getChildren();
      for (const child of children) {
        if (child.getComponent && child.getComponent() === componentType) {
          matchTabset = node.getId();
        }
      }
    }
  });

  return matchTabset || firstTabset || "root";
}

// ─── Default layout ─────────────────────────────────────────

const DEFAULT_LAYOUT = {
  global: {
    tabEnableFloat: false,
    tabEnableRename: true,
    tabSetEnableMaximize: true,
    tabSetEnableDrag: true,
    tabSetEnableDrop: true,
    splitterSize: 4,
  },
  borders: [],
  layout: {
    type: "row",
    weight: 100,
    children: [
      {
        type: "tabset",
        id: "browser-tabset",
        weight: 20,
        minWidth: 200,
        children: [
          {
            type: "tab",
            name: "Project Browser",
            component: COMP_BROWSER,
            enableClose: false,
          },
        ],
      },
      {
        type: "tabset",
        id: "diagram-tabset",
        weight: 55,
        children: [
          {
            type: "tab",
            name: "Overzicht",
            component: COMP_DIAGRAM,
            config: { diagramId: "overzicht" },
          },
        ],
      },
      {
        type: "tabset",
        id: "properties-tabset",
        weight: 25,
        minWidth: 250,
        children: [
          {
            type: "tab",
            name: "Details",
            component: COMP_PROPERTIES,
            enableClose: false,
          },
        ],
      },
    ],
  },
};
