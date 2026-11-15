/**
 * doorklik — de Studio-kant van de M3-doorklik (`verwijstNaar`, gedragsverwijzing; 20-10, Mark):
 * openen over profielen heen, de keuzelijst van alle diagrammen, en de andere kant op:
 * welke elementen naar een diagram verwijzen ("Verwezen door").
 *
 * De pure regel (welk diagram een element opent) staat in diagramcore/model/verwijstNaar.js
 * (`doorklikVan`); hier alleen wat de registry van profielen en de menubus nodig heeft.
 */
import { getProfieltypen, getProfieltype } from "./profieltypeRegistry";
import { menuBus } from "./menuBus";
import { verwezenDoor } from "../diagramcore/model/verwezenDoor.js";
import { stelDiagramNaamBronIn } from "../diagramcore/model/diagramNamen.js";

export { verwezenDoor };

/**
 * Open een diagram waar een element naar verwijst, ook in een ander profiel: zet het daar actief
 * en vraag Modelleren om een tab. Geeft false als het diagram niet (meer) bestaat.
 * @param {{profielId: string|null, diagramId: string}} verw
 */
export function openVerwijzing(verw) {
  const p = verw?.profielId ? getProfieltype(verw.profielId) : null;
  const st = p?.useStore?.getState?.();
  if (!st?.diagrams?.[verw.diagramId]) return false;
  st.setActiefDiagram?.(verw.diagramId);
  menuBus.emit("studio:open-diagram", { profielId: verw.profielId, diagramId: verw.diagramId });
  return true;
}

/** Alle diagrammen per profiel, voor de kiezer van `verwijst naar` (alleen profielen met diagrammen). */
export function alleDiagrammen() {
  return getProfieltypen()
    .map((p) => ({
      profielId: p.id,
      label: p.label || p.descriptor?.label || p.id,
      diagrams: Object.values(p.useStore?.getState?.().diagrams || {})
        .map((d) => ({ id: d.id, naam: d.naam }))
        .sort((a, b) => String(a.naam).localeCompare(String(b.naam))),
    }))
    .filter((g) => g.diagrams.length);
}

/** Naam van een diagram waar een verwijzing naar wijst (of null). */
export function naamVanVerwijzing(verw) {
  const d = verw?.profielId ? getProfieltype(verw.profielId)?.useStore?.getState?.().diagrams?.[verw.diagramId] : null;
  return d ? d.naam || d.id : null;
}

/**
 * Doorklik via het type (Mark 15-11, "autoklik"): heeft een element geen eigen `verwijst naar`, maar
 * wel een element-verwijzing met een koppelsoort (het type van een BPMN-data-object), dan zijn de
 * diagrammen waarop dat element staat de doorklik. Gesorteerd op naam; de eerste opent bij
 * dubbelklik, het contextmenu biedt ze allemaal.
 * @param {any} element
 * @param {any} elementType
 * @returns {{profielId: string, diagramId: string, naam: string}[]}
 */
export function diagrammenViaType(element, elementType) {
  const uit = [];
  for (const p of elementType?.properties || []) {
    if (!p?.koppelsoort || p.datatype !== "element-verwijzing") continue;
    const ref = element?.data?.[p.key];
    if (!ref?.profielId || !ref?.elementId) continue;
    const diagrams = getProfieltype(ref.profielId)?.useStore?.getState?.().diagrams || {};
    for (const d of Object.values(diagrams)) {
      if ((d?.nodes || []).some((n) => n?.elementId === ref.elementId)) uit.push({ profielId: ref.profielId, diagramId: d.id, naam: d.naam || d.id });
    }
  }
  return uit.sort((a, b) => String(a.naam).localeCompare(String(b.naam)));
}

/** De profielen uit de registry in de vorm die `verwezenDoor` leest. */
export function profielenUitRegistry() {
  return getProfieltypen().map((p) => {
    const st = p.useStore?.getState?.() || {};
    return { profielId: p.id, elementTypes: p.descriptor?.elementTypes || [], elements: st.elements || {}, diagrams: st.diagrams || {} };
  });
}

/**
 * Bron voor de diagramverwijzing op de plaat (diagramNamen.js): de naam live, ook na hernoemen of
 * verwijderen van het doel in een ander profiel. Abonneert op de diagrammen van alle profielen.
 */
stelDiagramNaamBronIn({
  naam: (verw) => naamVanVerwijzing(verw),
  abonneer: (cb) => {
    const af = getProfieltypen()
      .map((p) => p.useStore?.subscribe?.((s, v) => s.diagrams !== v.diagrams && cb()))
      .filter(Boolean);
    return () => af.forEach((f) => f());
  },
});
