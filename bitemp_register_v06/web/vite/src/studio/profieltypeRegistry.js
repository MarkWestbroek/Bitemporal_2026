/**
 * profieltypeRegistry — register van *profieltypen* (consolidatieplan fase 2).
 *
 * Een profieltype is een modelleerprofiel (metamodel) mét zijn runtime-
 * onderdelen: de eigen persistente store, de editor-slots en de menu's.
 * De "Modelleren"-activiteit leest dit register om diagrammen van álle
 * profielen in één projectbrowser + tab-host te tonen; de per-profiel-
 * activiteiten blijven gewoon bestaan (zelfde componenten, zelfde store —
 * dus ook dezelfde inhoud, hoe je hem ook opent).
 *
 * Profieltype-descriptor:
 *   {
 *     id:          string     // activiteit-id (bv. "diagram05")
 *     label:       string
 *     icon:        ReactNode
 *     kleur?:      string     // accentkleur (tab-streepje, sectie-stip)
 *     useStore:    hook       // de zustand-store van dit profiel
 *     descriptor:  DiagramType
 *     Provider:    Component  // context + menuBus-abonnementen van het profiel
 *     Main:        Component
 *     Inspector?:  Component
 *     menus?:      array | (ctx) => array
 *     menuPrefix:  string
 *     diagramTerm: string     // "diagram" of bv. "profiel" (PE trede 2)
 *   }
 */

const _profieltypen = [];
const _index = new Map();

let _versie = 0;
const _luisteraars = new Set();

/** @param {() => void} fn @returns {() => void} afmelden */
export function abonneerOpProfieltypen(fn) {
  _luisteraars.add(fn);
  return () => _luisteraars.delete(fn);
}

/** Snapshot voor useSyncExternalStore. */
export function profieltypenVersie() {
  return _versie;
}

/** Registreer (idempotent op id — vervangt, handig bij HMR en live profielen). */
export function registreerProfieltype(p) {
  if (!p || !p.id) throw new Error("Profieltype vereist een 'id'.");
  if (_index.has(p.id)) {
    const pos = _profieltypen.findIndex((x) => x.id === p.id);
    _profieltypen[pos] = p;
  } else {
    _profieltypen.push(p);
  }
  _index.set(p.id, p);
  _versie += 1;
  _luisteraars.forEach((fn) => fn());
}

/** Alle geregistreerde profieltypen (registratievolgorde). */
export function getProfieltypen() {
  return _profieltypen.slice();
}

/** Eén profieltype op id, of undefined. */
export function getProfieltype(id) {
  return _index.get(id);
}
