/**
 * menuBus — piepklein event-busje zodat menubalk-acties activiteit-specifieke
 * handlers kunnen aanroepen zonder dat de shell de interne state van een
 * activiteit hoeft te kennen.
 *
 * Een activiteit-Provider registreert handlers met `menuBus.on("dmn:nieuw", fn)`;
 * een menu-item roept `menuBus.emit("dmn:nieuw")` aan. Zo blijven shell en
 * activiteiten netjes ontkoppeld.
 */
const luisteraars = new Map();

export const menuBus = {
  /** Registreer een handler. Geeft een unsubscribe-functie terug. */
  on(event, cb) {
    if (!luisteraars.has(event)) luisteraars.set(event, new Set());
    luisteraars.get(event).add(cb);
    return () => luisteraars.get(event)?.delete(cb);
  },
  /** Roep alle handlers voor een event aan. */
  emit(event, payload) {
    luisteraars.get(event)?.forEach((cb) => {
      try {
        cb(payload);
      } catch (e) {
        console.error(`menuBus-handler voor "${event}" faalde:`, e);
      }
    });
  },
};
