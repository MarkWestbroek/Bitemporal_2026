// @ts-check
/**
 * verzender — de outbox naar de server en de operaties van anderen terug
 * (plan 2026-10-07 Projectsync, stap 2, onderdeel 4).
 *
 *  - `verzend()`: stuurt de outbox in batches naar POST …/ops, bevestigt de
 *    verzonden regels en onthoudt het laatst bekende servervolgnummer.
 *    Netwerkfout → opnieuw met oplopende wachttijd; 404 → het project staat
 *    niet (meer) op de server, de outbox blijft staan; een afgekeurde batch
 *    (4xx) wordt gemeld en overgeslagen (anders blokkeert hij alles).
 *  - `haalBinnen()`: GET …/ops?vanaf=<laatste> en past de operaties van
 *    anderen toe (eigen client-id overgeslagen). Dit is de **terugval**: de
 *    poll draait zolang de tab zichtbaar is, maar slaat het ophalen over als
 *    het SSE-kanaal verbonden is.
 *  - `startKanaal()` (onderdeel 5): EventSource op GET …/events; elke operatie
 *    komt als event `op` binnen en gaat door dezelfde `verwerkOp`. Valt de
 *    verbinding weg, dan herverbindt de browser zelf met Last-Event-ID en
 *    speelt de server na; intussen vangt de poll het op.
 *
 * Alles wat de verzender van de Studio moet weten komt via `configureer()`:
 * welk project, of live-sync aan staat, het laatst bekende volgnummer. De
 * API-aanroepen zijn injecteerbaar (tests). Geen DOM-afhankelijkheden
 * behalve de optionele poll (document/visibility).
 */
import { create } from "zustand";
import { useOutboxStore, clientId } from "./outbox.js";
import { pasOperatieToe } from "./operaties.js";
import { stuurOps as stuurOpsApi, haalOpsOp as haalOpsOpApi, eventsUrl as eventsUrlApi } from "../activities/projectSync.js";

export const BATCH_GROOTTE = 200;
/** Na zoveel operaties voorbij de snapshot-grens zet een online client een nieuwe snapshot. */
export const SNAPSHOT_NA = 200;
const BACKOFF_START = 1000;
const BACKOFF_MAX = 30000;
export const POLL_INTERVAL = 5000; // standaard; de server kan dit zetten (STUDIO_SYNC_POLL_MS)

/**
 * Zichtbare stand voor menu en indicator.
 * stand: "uit" (geen project op de server / live-sync uit) | "ok" | "bezig" |
 *        "offline" (netwerk, opnieuw om …) | "nietOpServer" | "fout"
 */
export const useSyncStore = create(() => ({
  stand: "uit",
  /** SSE-kanaal: "uit" | "verbindt" | "verbonden" | "verbroken" */
  kanaal: "uit",
  /** presence (onderdeel 7): open verbindingen in dit project, incl. deze tab: [{clientId, actor}] */
  aanwezig: [],
  teVerzenden: 0,
  fout: null,
  opnieuwOm: null,
  laatsteContact: null,
  /** operaties van anderen die sinds de start zijn toegepast */
  ontvangen: 0,
}));

const zet = (patch) => useSyncStore.setState(patch);

let cfg = {
  projectId: () => null,
  actief: () => false,
  laatsteVolgnummer: () => 0,
  zetLaatsteVolgnummer: (_n) => {},
  stuurOps: stuurOpsApi,
  haalOpsOp: haalOpsOpApi,
  eventsUrl: eventsUrlApi,
  nu: () => Date.now(),
  /** poll-interval in ms: admin-instelling van de instantie (GET /api/studio/instellingen) */
  pollMs: POLL_INTERVAL,
  /** snapshot-grens van het project op de server (studio_projecten.tot_volgnummer) */
  totVolgnummer: () => 0,
  /** zet stil een nieuwe snapshot (PUT met tot_volgnummer = laatste); 409 = ander was eerder */
  maakSnapshot: async () => {},
  /** laad de snapshot opnieuw (server zegt: te oud om bij te praten) */
  herlaadSnapshot: async () => {},
};

/**
 * Effectief poll-interval: lokale override voor ontwikkeling
 * (localStorage "studio-sync-poll-ms") wint van de server-instelling.
 */
export function pollIntervalMs() {
  try {
    const lokaal = Number(globalThis.localStorage?.getItem("studio-sync-poll-ms"));
    if (lokaal >= 500) return lokaal;
  } catch {
    /* geen opslag */
  }
  return Math.max(500, Number(cfg.pollMs) || POLL_INTERVAL);
}

/** Koppel de verzender aan het project (modellerenActivity doet dit in zijn Provider). */
export function configureer(patch) {
  cfg = { ...cfg, ...patch };
  const id = cfg.projectId();
  useOutboxStore.getState().zetProject(id);
  useOutboxStore.getState().zetPersisteren(!!id && cfg.actief());
  zet({ stand: cfg.actief() ? "ok" : "uit", teVerzenden: useOutboxStore.getState().ops.length });
}

let bezig = false;
let retryTimer = null;
let backoff = BACKOFF_START;

function planOpnieuw() {
  if (retryTimer) return;
  const wacht = backoff;
  backoff = Math.min(backoff * 2, BACKOFF_MAX);
  zet({ opnieuwOm: cfg.nu() + wacht });
  retryTimer = setTimeout(() => {
    retryTimer = null;
    verzend();
  }, wacht);
}

/**
 * Verstuur wat er in de outbox staat (één batch per keer, door tot hij leeg is).
 * @returns {Promise<"klaar"|"uit"|"bezig"|"fout">}
 */
export async function verzend() {
  if (!cfg.actief() || !cfg.projectId()) {
    zet({ stand: "uit" });
    return "uit";
  }
  if (bezig) return "bezig";
  const outbox = useOutboxStore.getState();
  const ops = outbox.ops.slice(0, BATCH_GROOTTE);
  zet({ teVerzenden: outbox.ops.length });
  if (!ops.length) {
    zet({ stand: "ok", fout: null, opnieuwOm: null });
    return "klaar";
  }
  bezig = true;
  zet({ stand: "bezig" });
  try {
    const uit = await cfg.stuurOps(cfg.projectId(), {
      clientId,
      ops: ops.map(({ lokaalNr, store, op, args }) => ({ lokaalNr, store, op, args })),
    });
    useOutboxStore.getState().bevestig(ops[ops.length - 1].lokaalNr);
    // Het laatst bekende volgnummer NIET naar `uit.tot` zetten: tussen ons
    // vorige ophalen en deze batch kan de ander nummers hebben gekregen die
    // wij nog niet zagen; springen we daaroverheen, dan komen die nooit meer
    // (gemeld 2026-10-07 bij simultaan werken in twee browsers). haalBinnen
    // loopt het log door en slaat onze eigen operaties over op client-id.
    backoff = BACKOFF_START;
    zet({ stand: "ok", fout: null, opnieuwOm: null, laatsteContact: cfg.nu(), teVerzenden: useOutboxStore.getState().ops.length });
    bezig = false;
    if (useOutboxStore.getState().ops.length) return verzend();
    // Direct ook de ander binnenhalen: wie verzendt, werkt — en ziet dan meteen.
    await haalBinnen();
    return "klaar";
  } catch (e) {
    bezig = false;
    const status = e?.status ?? 0;
    if (status === 404) {
      zet({ stand: "nietOpServer", fout: e.message });
      return "fout";
    }
    if (status === 401 || status === 403) {
      zet({ stand: "fout", fout: e.message });
      return "fout";
    }
    if (status >= 400 && status < 500) {
      // Afgekeurde batch: overslaan, anders komt er nooit meer iets door.
      useOutboxStore.getState().bevestig(ops[ops.length - 1].lokaalNr);
      zet({ stand: "fout", fout: `Batch afgekeurd en overgeslagen: ${e.message}`, teVerzenden: useOutboxStore.getState().ops.length });
      return "fout";
    }
    zet({ stand: "offline", fout: e.message });
    planOpnieuw();
    return "fout";
  }
}

/**
 * Eén operatie van de server verwerken (poll én SSE): idempotent op volgnummer
 * (al gezien = overslaan), eigen operaties overslaan op client-id (behalve na
 * een snapshot, `inclusiefEigen`), daarna het laatst bekende volgnummer opschuiven.
 * @returns {boolean} toegepast
 */
export function verwerkOp(o, { inclusiefEigen = false } = {}) {
  if (typeof o?.volgnummer !== "number" || o.volgnummer <= cfg.laatsteVolgnummer()) return false;
  let toegepast = false;
  if (inclusiefEigen || o.clientId !== clientId) {
    toegepast = pasOperatieToe({ store: o.store, op: o.op, args: o.args }).ok;
  }
  cfg.zetLaatsteVolgnummer(o.volgnummer);
  return toegepast;
}

/**
 * Haal de operaties ná het laatst bekende volgnummer op en pas ze toe.
 * @param {{inclusiefEigen?: boolean}} [opties]  na een snapshot ook de eigen (oude) operaties
 * @returns {Promise<number>} aantal toegepaste operaties
 */
export async function haalBinnen({ inclusiefEigen = false } = {}) {
  if (!cfg.actief() || !cfg.projectId()) return 0;
  let toegepast = 0;
  let meer = true;
  let rondes = 0;
  while (meer && rondes < 50) {
    rondes++;
    let uit;
    try {
      uit = await cfg.haalOpsOp(cfg.projectId(), cfg.laatsteVolgnummer());
    } catch (e) {
      zet({ stand: e?.status === 404 ? "nietOpServer" : "offline", fout: e?.message || String(e) });
      return toegepast;
    }
    if (uit?.snapshotNodig) {
      // Compactie (onderdeel 6): de operaties tussen ons volgnummer en de grens
      // zijn opgeruimd. Eigen werk eerst weg, dan de snapshot opnieuw laden;
      // herlaadSnapshot haalt daarna zelf de operaties ná de grens binnen.
      await verzend();
      await cfg.herlaadSnapshot();
      return toegepast;
    }
    for (const o of uit?.ops || []) {
      if (verwerkOp(o, { inclusiefEigen })) toegepast++;
    }
    if (typeof uit?.laatste === "number") cfg.zetLaatsteVolgnummer(Math.max(cfg.laatsteVolgnummer(), uit.laatste));
    meer = !!uit?.meer;
  }
  zet({ laatsteContact: cfg.nu(), ontvangen: useSyncStore.getState().ontvangen + toegepast });
  if (useSyncStore.getState().stand === "offline") zet({ stand: "ok", fout: null, opnieuwOm: null });
  return toegepast;
}

// ── Automatisch: outbox-wijziging → verzenden; poll zolang de tab zichtbaar is ──

let debounceTimer = null;
useOutboxStore.subscribe((s, vorige) => {
  zet({ teVerzenden: s.ops.length });
  if (s.ops.length <= (vorige?.ops?.length ?? 0)) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => verzend(), 300);
});

let pollTimer = null;
export function startPoll() {
  stopPoll();
  const tik = async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    await verzend();
    // Met een verbonden SSE-kanaal is pollen overbodig; anders is dit de terugval.
    if (useSyncStore.getState().kanaal !== "verbonden") await haalBinnen();
    await overweegSnapshot();
  };
  pollTimer = setInterval(tik, pollIntervalMs());
  tik();
}
export function stopPoll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

/**
 * Snapshot-compactie (onderdeel 6): staat het log ver genoeg voorbij de grens
 * en zijn we zelf bij (outbox leeg, stand ok), zet dan een nieuwe snapshot.
 * Meerdere clients kunnen dit tegelijk proberen; de server kiest met de
 * versiecontrole (409 voor de verliezer, die neemt gewoon de nieuwe grens over).
 */
let snapshotBezig = false;
export async function overweegSnapshot() {
  if (snapshotBezig || !cfg.actief() || !cfg.projectId()) return false;
  const st = useSyncStore.getState();
  if (st.stand !== "ok" || useOutboxStore.getState().ops.length) return false;
  if (cfg.laatsteVolgnummer() - cfg.totVolgnummer() < SNAPSHOT_NA) return false;
  snapshotBezig = true;
  try {
    await cfg.maakSnapshot();
    return true;
  } catch {
    return false;
  } finally {
    snapshotBezig = false;
  }
}

// ── SSE-kanaal (onderdeel 5) ──────────────────────────────────────────

let bron = null;

/** Open het SSE-kanaal voor het huidige project (no-op zonder EventSource, bv. in node). */
export function startKanaal() {
  stopKanaal();
  if (typeof EventSource === "undefined" || !cfg.actief() || !cfg.projectId()) return;
  const url = cfg.eventsUrl(cfg.projectId(), cfg.laatsteVolgnummer(), clientId);
  zet({ kanaal: "verbindt" });
  try {
    bron = new EventSource(url, { withCredentials: true });
  } catch (e) {
    zet({ kanaal: "verbroken", fout: e?.message || String(e) });
    return;
  }
  bron.onopen = () => zet({ kanaal: "verbonden", laatsteContact: cfg.nu() });
  // De browser herverbindt zelf (met Last-Event-ID); tot die tijd vangt de poll het op.
  bron.onerror = () => zet({ kanaal: "verbroken" });
  bron.addEventListener("op", (e) => {
    try {
      const o = JSON.parse(e.data);
      const toegepast = verwerkOp(o);
      zet({ laatsteContact: cfg.nu(), ontvangen: useSyncStore.getState().ontvangen + (toegepast ? 1 : 0) });
    } catch {
      /* onleesbaar event: de poll/herverbinding haalt het alsnog op */
    }
  });
  bron.addEventListener("snapshot", async () => {
    // Te oud om bij te praten: kanaal dicht, snapshot opnieuw, dan weer verbinden
    // (vanaf de nieuwe grens). Zie haalBinnen voor de poll-variant.
    stopKanaal();
    await verzend();
    await cfg.herlaadSnapshot();
    startKanaal();
  });
  bron.addEventListener("presence", (e) => {
    try {
      const { aanwezig } = JSON.parse(e.data);
      if (Array.isArray(aanwezig)) zet({ aanwezig });
    } catch {
      /* negeren */
    }
  });
  bron.addEventListener("stand", (e) => {
    try {
      const { laatste } = JSON.parse(e.data);
      if (typeof laatste === "number") cfg.zetLaatsteVolgnummer(Math.max(cfg.laatsteVolgnummer(), laatste));
    } catch {
      /* negeren */
    }
  });
}

export function stopKanaal() {
  if (bron) {
    try {
      bron.close();
    } catch {
      /* al dicht */
    }
  }
  bron = null;
  if (useSyncStore.getState().kanaal !== "uit") zet({ kanaal: "uit", aanwezig: [] });
}

/** Voor tests: interne stand terugzetten. */
export function _resetVoorTest() {
  stopKanaal();
  snapshotBezig = false;
  bezig = false;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  backoff = BACKOFF_START;
  stopPoll();
  zet({ stand: "uit", kanaal: "uit", aanwezig: [], teVerzenden: 0, fout: null, opnieuwOm: null, laatsteContact: null, ontvangen: 0 });
}

/**
 * Presence samengevat voor de UI: per persoon één regel, met het aantal tabs;
 * zonder auth heet iedereen "anoniem" en telt alleen het aantal.
 * @returns {{personen: Array<{naam: string, tabs: number, ik: boolean}>, totaal: number, anderen: number}}
 */
export function aanwezigSamengevat() {
  const lijst = useSyncStore.getState().aanwezig || [];
  const per = new Map();
  for (const a of lijst) {
    const naam = a.actor || "anoniem";
    const rij = per.get(naam) || { naam, tabs: 0, ik: false };
    rij.tabs++;
    if (a.clientId === clientId) rij.ik = true;
    per.set(naam, rij);
  }
  const personen = [...per.values()].sort((x, y) => (x.ik === y.ik ? x.naam.localeCompare(y.naam) : x.ik ? -1 : 1));
  return { personen, totaal: lijst.length, anderen: lijst.filter((a) => a.clientId !== clientId).length };
}
