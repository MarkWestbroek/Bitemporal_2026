// transformPrompts.js — gedeelde prompt-UI voor B5/B6 (cast/splits).
// Hergebruikt vanuit ProjectBrowser én DiagramCanvas.

import { castEntiteitNaarGE, splitsEntiteit, passToePatch } from "./transformations.js";

/**
 * B5 — Vraag parent en cast entiteit naar GE.
 * @param {Object} useModelStore  - Zustand store hook (met getState/setState)
 * @param {string} entId          - Te casten entiteit
 */
export function promptCastNaarGE(useModelStore, entId) {
  const store = useModelStore.getState();
  const ent = store.elements[entId];
  if (!ent) return;
  const kandidaten = Object.values(store.elements)
    .filter((e) => e.metatype === "entiteit" && e.id !== ent.id)
    .sort((a, b) => {
      const da = a.domein === ent.domein ? 0 : 1;
      const db = b.domein === ent.domein ? 0 : 1;
      if (da !== db) return da - db;
      return (a.naam || "").localeCompare(b.naam || "");
    });
  if (kandidaten.length === 0) {
    window.alert("Geen andere entiteit beschikbaar als parent.");
    return;
  }
  const naamLijst = kandidaten
    .map((e, i) => `${i + 1}. ${e.naam}${e.domein ? ` (${e.domein})` : ""}`)
    .join("\n");
  const keuze = window.prompt(
    `Cast "${ent.naam}" naar gegevenselement onder welke parent-entiteit?\n\n` +
      `Geef nummer of typenaam:\n\n${naamLijst}`
  );
  if (!keuze) return;
  let parent = null;
  const idx = parseInt(keuze, 10);
  if (!isNaN(idx) && idx >= 1 && idx <= kandidaten.length) {
    parent = kandidaten[idx - 1];
  } else {
    parent = kandidaten.find((e) => (e.naam || "").toLowerCase() === keuze.toLowerCase());
  }
  if (!parent) {
    window.alert(`Onbekende parent: "${keuze}"`);
    return;
  }
  const patch = castEntiteitNaarGE(
    { elements: store.elements, structuralEdges: store.structuralEdges },
    ent.id,
    parent.id
  );
  if (!patch.ok) {
    window.alert(`Cast mislukt:\n\n${patch.errors.join("\n")}`);
    return;
  }
  if (patch.warnings.length > 0) {
    const door = window.confirm(
      `Cast slaagt met waarschuwingen:\n\n${patch.warnings.join("\n")}\n\nDoorgaan?`
    );
    if (!door) return;
  }
  passToePatch(useModelStore, patch);
}

/**
 * B6 — Vraag velden en splits entiteit in losse GE's.
 * @param {Object} useModelStore
 * @param {string} entId
 */
export function promptSplitsEntiteit(useModelStore, entId) {
  const store = useModelStore.getState();
  const ent = store.elements[entId];
  if (!ent) return;
  const velden = ent.data?.velden || [];
  if (velden.length === 0) {
    window.alert(`"${ent.naam}" heeft geen velden om te splitsen.`);
    return;
  }
  const lijst = velden.map((v, i) => `${i + 1}. ${v.naam} (${v.type || "?"})`).join("\n");
  const keuze = window.prompt(
    `Welke velden van "${ent.naam}" wil je uitsplitsen naar losse GE's?\n\n` +
      `Geef nummers (komma-gescheiden) of veldnamen:\n\n${lijst}`
  );
  if (!keuze) return;
  const tokens = keuze.split(",").map((s) => s.trim()).filter(Boolean);
  const veldNamen = [];
  for (const tok of tokens) {
    const idx = parseInt(tok, 10);
    if (!isNaN(idx) && idx >= 1 && idx <= velden.length) {
      veldNamen.push(velden[idx - 1].naam);
    } else if (velden.some((v) => v.naam === tok)) {
      veldNamen.push(tok);
    }
  }
  if (veldNamen.length === 0) {
    window.alert("Geen geldige velden geselecteerd.");
    return;
  }
  const patch = splitsEntiteit(
    { elements: store.elements, structuralEdges: store.structuralEdges },
    ent.id,
    veldNamen
  );
  if (!patch.ok) {
    window.alert(`Splits mislukt:\n\n${patch.errors.join("\n")}`);
    return;
  }
  if (patch.warnings.length > 0) {
    window.alert(`Splits geslaagd met waarschuwingen:\n\n${patch.warnings.join("\n")}`);
  }
  passToePatch(useModelStore, patch);
}
