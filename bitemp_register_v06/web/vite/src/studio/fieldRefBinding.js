// @ts-check
/**
 * fieldRefBinding — FieldRefs (DMN-kolommen, berichtvelden, …) binden aan het canonieke
 * model van het project via de uuid van het modelveld (besluit Mark 31-10):
 *   - binnen het model loopt een link via de uuid; hernoem je het origineel, dan gaat de
 *     link mee — het naampad (`typenaam`, `veldpad`, …) in de FieldRef is de leesbare kopie
 *     en wordt hier vanuit de uuid ververst, bij het laden en na elke modelwijziging;
 *   - bij een export (Operaton, documentatie, register) is het naampad van dát moment de
 *     identificatie (de artefact-transformaties lezen het naampad, of zoeken op de uuid).
 *
 * Bron: het canonieke model in het project (de profielstore met descriptor canoniek-uml),
 * via exporteerV3 → pickerTypesUitV3, dezelfde vorm als /api/schema/model/code. Zonder
 * projectmodel: geen types (de ModelPicker valt dan terug op de API).
 * Mogelijk volgt een indicator "primair canoniek model" per project (Mark, 31-10); tot die
 * er is, is dat de hele canoniek-uml-store.
 */
import { useEffect, useState } from "react";
import { getProfieltypen, abonneerOpProfieltypen } from "./profieltypeRegistry.js";
import { exporteerV3 } from "../diagramprofielen/canoniek-uml/serialisatie.js";
import { pickerTypesUitV3 } from "../modelpicker/pickerTypesUitV3.js";
import { fieldRefsOpUuid, verversFieldRef } from "../modelpicker/modelTree.js";

const CANONIEK_UML_ID = "canoniek-uml";

/** Een object is een FieldRef als het een uuid én een veldpad draagt (zie maakFieldRef). */
const isFieldRef = (o) => !!o && typeof o === "object" && !Array.isArray(o) && typeof o.uuid === "string" && "veldpad" in o;

/**
 * Ververs alle FieldRefs (op elke diepte) in een waarde; dezelfde waarde terug als er
 * niets verandert (identiteit), zodat de aanroeper alleen echte wijzigingen patcht.
 * @param {any} waarde
 * @param {Map<string, any>} index
 * @returns {any}
 */
export function verversDiep(waarde, index) {
  if (Array.isArray(waarde)) {
    let anders = false;
    const uit = waarde.map((x) => {
      const n = verversDiep(x, index);
      if (n !== x) anders = true;
      return n;
    });
    return anders ? uit : waarde;
  }
  if (!waarde || typeof waarde !== "object") return waarde;
  if (isFieldRef(waarde)) return verversFieldRef(waarde, index);
  let anders = false;
  const uit = {};
  for (const [k, v] of Object.entries(waarde)) {
    const n = verversDiep(v, index);
    if (n !== v) anders = true;
    uit[k] = n;
  }
  return anders ? uit : waarde;
}

/**
 * Patches (voor updateElementen) voor de elementen van één store waarvan een FieldRef een
 * ander naampad krijgt.
 * @param {{elements?: Record<string, any>}} state
 * @param {Map<string, any>} index
 * @returns {Record<string, {data: any}>}
 */
export function fieldRefPatches(state, index) {
  const patches = {};
  if (!index.size) return patches;
  for (const el of Object.values(state?.elements || {})) {
    if (!el?.data) continue;
    const data = verversDiep(el.data, index);
    if (data === el.data) continue;
    const diff = {};
    for (const k of Object.keys(data)) if (data[k] !== el.data[k]) diff[k] = data[k];
    patches[el.id] = { data: diff };
  }
  return patches;
}

/** Het profiel met het canonieke model van het project, of null. */
export function canoniekProfiel() {
  return getProfieltypen().find((p) => p?.descriptor?.id === CANONIEK_UML_ID) || null;
}

/** Types per elements-object (de store maakt bij elke wijziging een nieuw object). */
const typesCache = new WeakMap();

/**
 * Picker-types uit het canonieke projectmodel; null zonder (leeg) projectmodel.
 * @returns {any[]|null}
 */
export function projectTypes() {
  const p = canoniekProfiel();
  const st = p?.useStore?.getState?.();
  if (!st?.elements || !Object.keys(st.elements).length) return null;
  if (typesCache.has(st.elements)) return typesCache.get(st.elements);
  let types = null;
  try {
    types = pickerTypesUitV3(exporteerV3(st).v3);
  } catch {
    types = null; // een half getekend model mag de picker niet laten vallen
  }
  typesCache.set(st.elements, types);
  return types;
}

/**
 * React-hook: de picker-types uit het projectmodel (live), of null → ModelPicker gebruikt
 * dan zijn baseUrl. Gebruik: <ModelPicker injectedTypes={useProjectTypes()} baseUrl={…} />.
 */
export function useProjectTypes() {
  const [types, setTypes] = useState(() => projectTypes());
  useEffect(() => {
    let afmelden = null;
    const koppel = () => {
      afmelden?.();
      const p = canoniekProfiel();
      setTypes(projectTypes());
      afmelden = p?.useStore?.subscribe?.((s, vorig) => {
        if (s.elements !== vorig?.elements) setTypes(projectTypes());
      }) || null;
    };
    koppel();
    const af = abonneerOpProfieltypen(koppel);
    return () => {
      afmelden?.();
      af?.();
    };
  }, []);
  return types;
}

/** Ververs de FieldRefs in alle andere profielstores (één keer). @returns {number} aantal elementen */
export function verversAlleFieldRefs() {
  const types = projectTypes();
  if (!types) return 0;
  const index = fieldRefsOpUuid(types);
  if (!index.size) return 0;
  const canoniek = canoniekProfiel();
  let n = 0;
  for (const p of getProfieltypen()) {
    if (!p?.useStore || p === canoniek) continue;
    const patches = fieldRefPatches(p.useStore.getState(), index);
    const aantal = Object.keys(patches).length;
    if (!aantal) continue;
    // Bijwerken van een kopie is geen bewerking van de gebruiker: buiten de undo-historie.
    const t = p.useStore.temporal?.getState?.();
    t?.pause?.();
    try {
      p.useStore.getState().updateElementen(patches);
    } finally {
      t?.resume?.();
    }
    n += aantal;
  }
  return n;
}

let gestart = false;

/**
 * Start de binding (idempotent): nu één keer, en daarna na elke wijziging in het
 * canonieke model (gedebounced) en bij het registreren van een profiel (laden).
 */
export function startFieldRefBinding({ wacht = 400 } = {}) {
  if (gestart) return;
  gestart = true;
  let timer = null;
  let afmelden = null;
  const plan = () => {
    clearTimeout(timer);
    timer = setTimeout(verversAlleFieldRefs, wacht);
  };
  const koppel = () => {
    afmelden?.();
    afmelden = canoniekProfiel()?.useStore?.subscribe?.((s, vorig) => {
      if (s.elements !== vorig?.elements) plan();
    }) || null;
    plan();
  };
  koppel();
  abonneerOpProfieltypen(koppel);
}

/**
 * React-hook voor activiteiten die hun FieldRefs in lokale state houden (bericht, de oude
 * DMN-tabel): na elke wijziging van het projectmodel `zet(s => verversDiep(s, index))`.
 * @param {any[]|null} types  uit useProjectTypes
 * @param {(fn: (s: any) => any) => void} zet  een React-setState
 */
export function useVerversFieldRefs(types, zet) {
  useEffect(() => {
    if (!types) return;
    const index = fieldRefsOpUuid(types);
    if (index.size) zet((s) => verversDiep(s, index));
  }, [types, zet]);
}
