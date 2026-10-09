/**
 * opslag.js — de bewaarplaats van de profielstores (persist-laag van
 * createDiagramStore): **IndexedDB** met localStorage als terugval en als bron
 * voor een eenmalige migratie.
 *
 * Waarom (Mark, 10-10): localStorage heeft een plafond van ±5 MB per site,
 * gedeeld door alle stores — de Zandbak MW (25.800 MIM-elementen) past daar
 * niet in. Bovendien is localStorage synchroon: elke store-stap zette de hele
 * store als JSON-tekst op de hoofddraad. IndexedDB heeft een plafond van
 * honderden MB, schrijft asynchroon en bewaart objecten (structured clone),
 * dus zonder JSON-tekst van megabytes.
 *
 * Werking per persistKey:
 *   - getItem: IndexedDB; staat er niets maar wél een oude JSON in
 *     localStorage, dan migreren we die (lezen, parsen, in IndexedDB zetten,
 *     uit localStorage halen — dat maakt het quotum weer vrij).
 *   - setItem: gebundeld (debounce, WACHT ms) en pas ná de hydratatie van die
 *     sleutel: de laatste stand wint. Een stand van vóór het inladen wordt
 *     genegeerd — niet gebufferd (dat wiste de bewaarde store, 10-10). Bij
 *     verbergen van het tabblad en bij pagehide wordt meteen weggeschreven.
 *   - fouten (quotum, geblokkeerde IndexedDB): in `opslagFouten` en een
 *     `studio:opslag-vol`-event; de store werkt dan gewoon in het geheugen.
 *
 * De vorm van wat we bewaren is die van zustand/persist: `{ state, version }`.
 * De `kv`-backend is injecteerbaar (tests): { get(naam), put(naam, waarde), del(naam) }.
 */

const DB_NAAM = "omnium-studio";
const STORE_NAAM = "profielstores";
const WACHT_MS = 150;

/**
 * Opslagfouten per persistKey (laatste fout). Wie wil weten of bewaren lukte
 * kijkt hier (de EA-import meldt het in zijn verslag).
 * @type {Map<string, Error>}
 */
export const opslagFouten = new Map();

function meldFout(persistKey, e) {
  if (!opslagFouten.has(persistKey)) console.warn(`[diagramcore] "${persistKey}" niet bewaard (${e?.name || "fout"}): ${e?.message || e}`);
  opslagFouten.set(persistKey, e);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("studio:opslag-vol", { detail: { persistKey, fout: e } }));
}

export function heeftIndexedDb() {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

let dbPromise = null;
/** Eén databaseverbinding voor alle stores. */
function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((ok, fout) => {
      const req = indexedDB.open(DB_NAAM, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE_NAAM)) req.result.createObjectStore(STORE_NAAM);
      };
      req.onsuccess = () => ok(req.result);
      req.onerror = () => fout(req.error || new Error("IndexedDB open mislukt"));
      req.onblocked = () => fout(new Error("IndexedDB geblokkeerd"));
    }).catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

function verzoek(req) {
  return new Promise((ok, fout) => {
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fout(req.error || new Error("IndexedDB-verzoek mislukt"));
  });
}

/** De IndexedDB-backend: één objectstore, sleutel = persistKey. */
export const indexedDbKv = {
  async get(naam) {
    const db = await openDb();
    return verzoek(db.transaction(STORE_NAAM, "readonly").objectStore(STORE_NAAM).get(naam));
  },
  async put(naam, waarde) {
    const db = await openDb();
    const tx = db.transaction(STORE_NAAM, "readwrite");
    tx.objectStore(STORE_NAAM).put(waarde, naam);
    return new Promise((ok, fout) => {
      tx.oncomplete = () => ok();
      tx.onerror = () => fout(tx.error || new Error("IndexedDB schrijven mislukt"));
      tx.onabort = () => fout(tx.error || new Error("IndexedDB schrijven afgebroken"));
    });
  },
  async del(naam) {
    const db = await openDb();
    return verzoek(db.transaction(STORE_NAAM, "readwrite").objectStore(STORE_NAAM).delete(naam));
  },
};

/** Backend op een Map (tests, of browsers zonder IndexedDB). */
export function geheugenKv(map = new Map()) {
  return {
    async get(naam) { return map.get(naam); },
    async put(naam, waarde) { map.set(naam, waarde); },
    async del(naam) { map.delete(naam); },
    map,
  };
}

/**
 * Maak de persist-storage voor één store.
 * @param {string} persistKey
 * @param {{kv?: {get:Function, put:Function, del:Function}, localStorage?: Storage|null, wachtMs?: number}} [opties]
 * @returns {{getItem:Function, setItem:Function, removeItem:Function, flush:Function}}
 */
export function maakStoreOpslag(persistKey, { kv = indexedDbKv, localStorage: ls = globalThis.localStorage || null, wachtMs = WACHT_MS } = {}) {
  let gehydrateerd = false;
  let laatste = undefined; // laatste aangeboden waarde (nog niet weggeschreven)
  let timer = null;
  let bezig = null; // lopende put

  const schrijf = async () => {
    timer = null;
    if (!gehydrateerd || laatste === undefined) return;
    const waarde = laatste;
    laatste = undefined;
    try {
      bezig = kv.put(persistKey, waarde);
      await bezig;
      opslagFouten.delete(persistKey);
    } catch (e) {
      meldFout(persistKey, e);
    } finally {
      bezig = null;
    }
    // Intussen nieuwe stand? Dan die ook.
    if (laatste !== undefined && !timer) timer = setTimeout(schrijf, 0);
  };
  const plan = () => {
    if (!timer) timer = setTimeout(schrijf, wachtMs);
  };
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    return schrijf();
  };
  if (typeof document !== "undefined" && typeof window !== "undefined") {
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
    window.addEventListener("pagehide", () => flush());
  }

  return {
    async getItem(naam) {
      try {
        let waarde = await kv.get(naam);
        if (waarde === undefined || waarde === null) {
          // Eenmalige migratie uit localStorage (de oude bewaarplaats).
          const oud = ls?.getItem?.(naam);
          if (oud) {
            try {
              waarde = JSON.parse(oud);
              await kv.put(naam, waarde);
              ls.removeItem(naam);
            } catch (e) {
              meldFout(persistKey, e);
            }
          }
        }
        return waarde ?? null;
      } catch (e) {
        meldFout(persistKey, e);
        // IndexedDB kapot (privémodus, geblokkeerd): val terug op localStorage.
        const oud = ls?.getItem?.(naam);
        return oud ? JSON.parse(oud) : null;
      } finally {
        gehydrateerd = true;
      }
    },
    setItem(naam, waarde) {
      // Vóór de hydratatie negeren — niet bufferen. Zustand 5 schrijft de
      // geladen stand ná het hydrateren niet zelf terug (alleen na een
      // migratie), dus een hier gebufferde lege beginstand werd ná de
      // hydratatie als "laatste stand" weggeschreven en wiste de bewaarde
      // store; de volgende herlaad was leeg (dataverlies, Mark 10-10 08:52).
      if (!gehydrateerd) return;
      laatste = waarde;
      plan();
    },
    async removeItem(naam) {
      laatste = undefined;
      if (timer) clearTimeout(timer);
      timer = null;
      try {
        await kv.del(naam);
      } catch (e) {
        meldFout(persistKey, e);
      }
      ls?.removeItem?.(naam);
    },
    flush,
    /** @internal voor tests */
    _stand: () => ({ gehydrateerd, wachtend: laatste !== undefined, bezig: !!bezig }),
  };
}
