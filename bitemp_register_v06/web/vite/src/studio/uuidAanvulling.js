// @ts-check
/**
 * uuidAanvulling — projectformaat 4 (Mark 15-11): elk modelelement en elk veld van canoniek-uml
 * heeft een uuid. De Studio vult een ontbrekende uuid zelf aan:
 *
 *  - na het openen van een project (een ouder project wordt zo bijgewerkt), en
 *  - na elke **eigen** wijziging (een nieuw element, een veld dat een naam krijgt).
 *
 * De uuid is afgeleid (uuid v5, `afgeleideUuidMaker` in canoniek-uml/uuids.js): uit de stam van
 * het project (een branch: zijn MAIN) en het element-id, of voor een veld uit de uuid van zijn
 * element, het compartiment en de veldnaam. Twee clients die tegelijk een oud project openen,
 * komen op dezelfde uuid's uit.
 *
 * Een aanvulling is een gewone modelwijziging (`updateElementen`): ze gaat als operatie naar de
 * server, maar staat niet in de undo-historie. Na een wijziging van een ander vult deze client
 * niets aan: dat doet de maker zelf, anders zou een late aanvulling een gelijktijdige hernoeming
 * terugdraaien. Wie alleen leesrecht heeft, vult niets aan (de server zou het weigeren).
 */
import { abonneer, modelStoreNaam } from "./sync/operaties.js";
import { afgeleideUuidMaker } from "../diagramprofielen/canoniek-uml/uuids.js";

/** @type {Map<string, {store: any, vul: (store: any, maak: any) => number}>} */
const stores = new Map();
let context = { stam: /** @type {string|null} */ (null), magSchrijven: true };
let gepland = false;

/** Voer de aanvulling nu uit (synchroon). → aantal bijgewerkte elementen. */
export function vulNu() {
  if (!context.stam || !context.magSchrijven) return 0;
  const maak = afgeleideUuidMaker(context.stam);
  let n = 0;
  for (const { store, vul } of stores.values()) {
    const t = store.temporal?.getState?.();
    t?.pause?.();
    try {
      n += vul(store, maak) || 0;
    } finally {
      t?.resume?.();
    }
  }
  return n;
}

function plan() {
  if (gepland) return;
  gepland = true;
  // Na de lopende handeling (en buiten elke omwikkelde actie), zodat de aanvulling als eigen
  // operatie wordt vastgelegd.
  setTimeout(() => {
    gepland = false;
    vulNu();
  }, 0);
}

/**
 * Het project waarin aangevuld wordt. Een andere stam of meer rechten: meteen aanvullen
 * (dat is het bijwerken van een ouder project bij het openen).
 * @param {{stam?: string|null, magSchrijven?: boolean}} ctx
 */
export function zetUuidContext(ctx) {
  const vorig = context;
  context = { ...context, ...ctx };
  if (context.stam !== vorig.stam || context.magSchrijven !== vorig.magSchrijven) plan();
}

/** Opnieuw aanvullen (na het laden van een snapshot: dat is geen eigen operatie). */
export function planUuidAanvulling() {
  plan();
}

/**
 * Doe mee met de aanvulling: de store van een profiel met uuid's (canoniek-uml).
 * @param {string} profielId
 * @param {any} store - diagramcore-store (zustand, met `temporal`)
 * @param {(store: any, maak: any) => number} vul - bv. `vulUuids` uit canoniek-uml/uuids.js
 */
export function startUuidAanvulling(profielId, store, vul) {
  const naam = modelStoreNaam(profielId);
  if (stores.has(naam)) return;
  stores.set(naam, { store, vul });
  // Alleen eigen operaties (abonneer meldt geen operaties van anderen).
  abonneer((op) => {
    if (op?.store === naam) plan();
  });
  plan();
}

/** Alleen voor tests. */
export function _resetUuidAanvulling() {
  stores.clear();
  context = { stam: null, magSchrijven: true };
  gepland = false;
}
