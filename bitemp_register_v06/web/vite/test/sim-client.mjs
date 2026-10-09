// sim-client.mjs — één gesimuleerde Studio-client voor de projectsync (stap 2, onderdeel 4).
// Twee processen tegelijk starten = "Chrome en Edge" die simultaan werken:
//
//   node --import ./test/register-aliases.mjs test/sim-client.mjs <api> <projectId> <naam> <aantal> <ms>
//
// Elke client: eigen modelstore + verzender tegen de echte API, voegt <aantal>
// elementen toe met <ms> tussenpozen terwijl hij pollt, wacht dan tot alles
// verzonden en binnengehaald is en drukt de element-ids af (gesorteerd).
// Vergelijk de uitvoer van beide processen: die moet gelijk zijn.
import { createDiagramStore } from "../src/diagramcore/model/createDiagramStore.js";
import { koppelModelStore, modelStoreNaam } from "../src/studio/sync/operaties.js";
import { useOutboxStore } from "../src/studio/sync/outbox.js";
import { configureer, verzend, haalBinnen, useSyncStore } from "../src/studio/sync/verzender.js";

const [api, projectId, naam, aantalArg, msArg] = process.argv.slice(2);
const aantal = Number(aantalArg) || 20;
const ms = Number(msArg) || 50;

async function roep(pad, body) {
  const r = await fetch(api + pad, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => null);
  if (!r.ok) {
    const e = new Error(json?.error || `HTTP ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return json;
}

const store = createDiagramStore();
koppelModelStore("sim", store);
const storeNaam = modelStoreNaam("sim");
let laatste = 0;
useOutboxStore.getState().wis();
configureer({
  projectId: () => projectId,
  actief: () => true,
  laatsteVolgnummer: () => laatste,
  zetLaatsteVolgnummer: (n) => {
    laatste = n;
  },
  stuurOps: (id, body) => roep(`/api/studio/projecten/${id}/ops`, body),
  haalOpsOp: (id, vanaf) => roep(`/api/studio/projecten/${id}/ops?vanaf=${vanaf}&limiet=1000`),
});

const slaap = (t) => new Promise((r) => setTimeout(r, t));
const poll = setInterval(() => haalBinnen(), 200);
for (let i = 0; i < aantal; i++) {
  store.getState().addElement({ id: `${naam}-${i}`, naam: `${naam} ${i}`, elementType: "entiteit", compartimenten: [], data: {} });
  await slaap(ms);
}
// Uitlopen: alles versturen en binnenhalen tot het stil is.
for (let r = 0; r < 40; r++) {
  await verzend();
  await haalBinnen();
  if (!useOutboxStore.getState().ops.length && useSyncStore.getState().stand === "ok") {
    await slaap(300);
    await haalBinnen();
    if (!useOutboxStore.getState().ops.length) break;
  }
  await slaap(200);
}
clearInterval(poll);
const ids = Object.keys(store.getState().elements).sort();
console.log(JSON.stringify({ client: naam, laatste, aantal: ids.length, stand: useSyncStore.getState().stand, ids }));
process.exit(0);
