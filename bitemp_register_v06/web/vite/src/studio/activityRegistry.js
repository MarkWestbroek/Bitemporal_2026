/**
 * activityRegistry — uitbreidbaar register van "activiteiten" voor de Studio-werkbank.
 *
 * Een *activiteit* is één hoofdfunctie van de IDE (vergelijkbaar met een icoon in de
 * VS Code Activity Bar): UML-model, DMN-tabellen, BPMN-processen, berichtdefinities,
 * API's, toegangverlening, rollen, referentielijsten, …
 *
 * Elke activiteit levert (maximaal) drie UI-slots aan, zodat alle functies dezelfde
 * UX hebben:
 *   - Sidebar   → links, typisch een tree-browser  (mag null zijn)
 *   - Main      → midden, de eigenlijke editor/canvas (verplicht)
 *   - Inspector → rechts, typisch een eigenschappen-paneel (mag null zijn)
 *
 * Optioneel levert een activiteit een `Provider` aan: een React-component die de drie
 * slots omhult en gedeelde state (via context) beschikbaar maakt. Zo blijven de
 * onderliggende modules (dmn/, bpmn/, bericht/, umleditor/, …) netjes gescheiden:
 * het register kent alleen het *contract*, niet de interne werking.
 *
 * Activiteit-descriptor:
 *   {
 *     id:            string   // uniek, bv. "uml"
 *     label:         string   // tooltip + paneeltitel
 *     icon:          ReactNode // icoon in de activity bar
 *     groep?:        string   // visuele groepering ("modelleren" | "data" | "beheer")
 *     Provider?:     Component // wrapt de slots; deelt state via context
 *     Sidebar?:      Component // links (tree). null/undefined → geen linkerpaneel
 *     Main:          Component // midden (verplicht)
 *     Inspector?:    Component // rechts (properties). null/undefined → geen rechterpaneel
 *     sidebarLabel?: string
 *     inspectorLabel?: string
 *     fullMain?:     boolean  // true → activiteit brengt eigen volledige layout mee
 *                             //        (shell toont géén eigen zijpanelen)
 *     status?:       string   // "preview" (in aanbouw, bruikbaar) of "concept"
 *                             // (nog te maken). Getoond als badge; concepten
 *                             // staan niet in de activity bar.
 *     verborgenInBalk?: boolean // true → niet in de activity bar, wel in Ga naar
 *   }
 */

/** Weergavenamen van de groepen (volgorde = balkvolgorde; "beheer" onderaan). */
export const GROEP_LABELS = {
  modelleren: "Modelleren",
  diensten: "Diensten",
  data: "Data",
  presentatie: "Presentatie",
  beheer: "Beheer",
};

/** Weergavenaam van een groep (valt terug op de sleutel zelf). */
export function groepLabel(groep) {
  return GROEP_LABELS[groep] || groep || "";
}

const _activiteiten = [];
const _index = new Map();

// Abonnementen: async registraties (bv. profielen uit de git-map) moeten de
// activity bar kunnen verversen. useSyncExternalStore-vriendelijk: een
// versienummer als snapshot.
let _versie = 0;
const _luisteraars = new Set();

/** @param {() => void} fn @returns {() => void} afmelden */
export function abonneerOpActiviteiten(fn) {
  _luisteraars.add(fn);
  return () => _luisteraars.delete(fn);
}

/** Snapshot voor useSyncExternalStore. */
export function activiteitenVersie() {
  return _versie;
}

/**
 * Registreer één activiteit. Volgorde van registratie = volgorde in de activity bar.
 * @param {object} descriptor
 */
export function registreerActiviteit(descriptor) {
  if (!descriptor || !descriptor.id) {
    throw new Error("Activiteit vereist een 'id'.");
  }
  if (_index.has(descriptor.id)) {
    // Idempotent: vervang bestaande registratie (handig bij HMR).
    const pos = _activiteiten.findIndex((a) => a.id === descriptor.id);
    _activiteiten[pos] = descriptor;
  } else {
    _activiteiten.push(descriptor);
  }
  _index.set(descriptor.id, descriptor);
  _versie += 1;
  _luisteraars.forEach((fn) => fn());
}

/** Registreer meerdere activiteiten in volgorde. */
export function registreerActiviteiten(lijst) {
  (lijst || []).forEach(registreerActiviteit);
}

/** Alle geregistreerde activiteiten (in volgorde). */
export function getActiviteiten() {
  return _activiteiten.slice();
}

/** Eén activiteit op id, of undefined. */
export function getActiviteit(id) {
  return _index.get(id);
}
