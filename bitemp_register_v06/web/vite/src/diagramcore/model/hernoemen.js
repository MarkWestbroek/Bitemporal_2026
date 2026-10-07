/**
 * hernoemen — een element hernoemen mét doortrekken van naam-verwijzingen.
 *
 * Velden verwijzen naar andere elementen bij **naam** (PropertyType met
 * `referenceTypes`, bv. het attribuuttype `typeLabel: "Adres"` in
 * canoniek-uml). Hernoem je zo'n element alleen op zijn `naam`, dan wijzen
 * die velden naar een naam die niet meer bestaat en blijft de klasse op het
 * canvas het oude type tonen (gemeld 2026-10-07). Deze helper vervangt bij
 * een hernoeming in één store-stap ook alle verwijzende veldwaarden; een
 * suffix als `{0..*}` blijft staan.
 */

/** Per fieldType-id de property-keys die naar elementen verwijzen. */
function verwijzendeKeys(descriptor) {
  const keys = new Map();
  for (const ft of descriptor?.fieldTypes || []) {
    const lijst = (ft.properties || []).filter((p) => p.referenceTypes?.length).map((p) => p.key);
    if (lijst.length) keys.set(ft.id, lijst);
  }
  return keys;
}

/** Kale naam zonder een `{…}`-suffix (kardinaliteit e.d.). */
function kaal(waarde) {
  return String(waarde).replace(/\s*\{[^}]*\}\s*$/, "").trim();
}

/**
 * Pure kern: de elementen-map met de hernoeming én de doorgetrokken
 * verwijzingen. Geeft hetzelfde object terug als er niets te doen is.
 *
 * @param {Record<string, Object>} elements
 * @param {Object} descriptor  — DiagramType (voor de fieldTypes)
 * @param {string} elementId
 * @param {string} nieuweNaam
 */
export function elementenNaHernoeming(elements, descriptor, elementId, nieuweNaam) {
  const el = elements?.[elementId];
  if (!el) return elements;
  const oudeNaam = (el.naam || "").trim();
  const schoon = (nieuweNaam || "").trim();
  if (!schoon || schoon === oudeNaam) return elements;
  const volgende = { ...elements, [elementId]: { ...el, naam: schoon } };
  if (!oudeNaam) return volgende;
  const keys = verwijzendeKeys(descriptor);
  if (!keys.size) return volgende;
  for (const ander of Object.values(elements)) {
    let gewijzigd = false;
    const compartimenten = (ander.compartimenten || []).map((c) => {
      let cGewijzigd = false;
      const velden = (c.velden || []).map((v) => {
        const lijst = keys.get(v.fieldType);
        if (!lijst) return v;
        let data = v.data;
        for (const key of lijst) {
          const waarde = v.data?.[key];
          if (typeof waarde !== "string" || kaal(waarde) !== oudeNaam) continue;
          data = { ...data, [key]: waarde.replace(oudeNaam, schoon) };
        }
        if (data === v.data) return v;
        cGewijzigd = true;
        return { ...v, data };
      });
      if (!cGewijzigd) return c;
      gewijzigd = true;
      return { ...c, velden };
    });
    if (gewijzigd) {
      const basis = volgende[ander.id] || ander;
      volgende[ander.id] = { ...basis, compartimenten };
    }
  }
  return volgende;
}

/**
 * Hernoem een element in een diagram-store (createDiagramStore) en trek de
 * naam-verwijzingen door — één store-stap, dus één Ctrl+Z.
 */
export function hernoemElement(useStore, descriptor, elementId, nieuweNaam) {
  const state = useStore.getState();
  const volgende = elementenNaHernoeming(state.elements, descriptor, elementId, nieuweNaam);
  if (volgende === state.elements) return false;
  // Via de store-actie (undo-historie); oudere stores zonder actie: setState.
  if (typeof state.zetElementen === "function") state.zetElementen(volgende);
  else useStore.setState({ elements: volgende, isDirty: true });
  return true;
}
