// verzender.test.js — projectsync stap 2, onderdeel 4: outbox → server, operaties van anderen terug.
// Run: node --import ./test/register-aliases.mjs --test src/studio/sync/verzender.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { createDiagramStore } from "../../diagramcore/model/createDiagramStore.js";
import { koppelModelStore, ontkoppelStore, modelStoreNaam } from "./operaties.js";
import { useOutboxStore, clientId } from "./outbox.js";
import { configureer, verzend, haalBinnen, verwerkOp, overweegSnapshot, useSyncStore, _resetVoorTest, SNAPSHOT_NA } from "./verzender.js";

const el = (id) => ({ id, naam: id, elementType: "entiteit", compartimenten: [], data: {} });

function opzet({ stuurOps, haalOpsOp, actief = true }) {
  _resetVoorTest();
  useOutboxStore.getState().wis();
  let laatste = 0;
  configureer({
    projectId: () => "p1",
    actief: () => actief,
    laatsteVolgnummer: () => laatste,
    zetLaatsteVolgnummer: (n) => {
      laatste = n;
    },
    stuurOps: stuurOps || (async () => ({ van: 1, tot: 1, laatsteLokaalNr: 1 })),
    haalOpsOp: haalOpsOp || (async () => ({ ops: [], laatste, meer: false })),
    nu: () => 1000,
  });
  return { laatste: () => laatste };
}

test("verzend stuurt de outbox als batch, bevestigt en onthoudt het volgnummer", async () => {
  const gestuurd = [];
  const { laatste } = opzet({
    stuurOps: async (id, body) => {
      gestuurd.push({ id, body });
      return { van: 10, tot: 10 + body.ops.length - 1, laatsteLokaalNr: body.ops.at(-1).lokaalNr };
    },
  });
  const ob = useOutboxStore.getState();
  ob.voegToe({ store: "model:x", op: "addElement", args: [el("A")] });
  ob.voegToe({ store: "model:x", op: "addElement", args: [el("B")] });
  ob.voegToe({ store: "structuur", op: "nieuweMap", args: ["Map", null, "map_1"] });
  const uit = await verzend();
  assert.equal(uit, "klaar");
  assert.equal(gestuurd.length, 1);
  assert.equal(gestuurd[0].id, "p1");
  assert.equal(gestuurd[0].body.clientId, clientId);
  assert.deepEqual(
    gestuurd[0].body.ops.map((o) => o.op),
    ["addElement", "addElement", "nieuweMap"]
  );
  assert.equal(useOutboxStore.getState().ops.length, 0);
  assert.equal(useSyncStore.getState().stand, "ok");
});

test("verzenden springt niet over operaties van een ander heen (simultaan werken)", async () => {
  const store = createDiagramStore();
  koppelModelStore("sim", store);
  const naam = modelStoreNaam("sim");
  // Server: de ander kreeg 3 en 4 vlak vóór onze batch (5, 6); wij stonden op 2.
  const log = [
    { volgnummer: 3, clientId: "ander", store: naam, op: "addElement", args: [el("VanAnder3")] },
    { volgnummer: 4, clientId: "ander", store: naam, op: "addElement", args: [el("VanAnder4")] },
  ];
  const { laatste } = opzet({
    stuurOps: async (id, body) => {
      body.ops.forEach((o, i) => log.push({ volgnummer: 5 + i, clientId, store: o.store, op: o.op, args: o.args }));
      return { van: 5, tot: 4 + body.ops.length, laatsteLokaalNr: body.ops.at(-1).lokaalNr };
    },
    haalOpsOp: async (id, vanaf) => {
      const ops = log.filter((o) => o.volgnummer > vanaf);
      return { ops, laatste: ops.at(-1)?.volgnummer ?? vanaf, meer: false };
    },
  });
  // Onze eigen operaties zijn lokaal al toegepast; de outbox bevat ze.
  store.getState().addElement(el("Eigen5"));
  store.getState().addElement(el("Eigen6"));
  useOutboxStore.getState().wis();
  useOutboxStore.getState().voegToe({ store: naam, op: "addElement", args: [el("Eigen5")] });
  useOutboxStore.getState().voegToe({ store: naam, op: "addElement", args: [el("Eigen6")] });
  await verzend();
  assert.ok(store.getState().elements.VanAnder3, "operatie 3 van de ander mag niet overgeslagen worden");
  assert.ok(store.getState().elements.VanAnder4);
  assert.equal(laatste(), 6);
  ontkoppelStore(naam);
});

test("netwerkfout: outbox blijft staan, stand offline, opnieuw gepland", async () => {
  opzet({
    stuurOps: async () => {
      const e = new Error("Geen verbinding");
      e.status = 0;
      throw e;
    },
  });
  useOutboxStore.getState().voegToe({ store: "model:x", op: "addElement", args: [el("A")] });
  const uit = await verzend();
  assert.equal(uit, "fout");
  assert.equal(useOutboxStore.getState().ops.length, 1);
  assert.equal(useSyncStore.getState().stand, "offline");
  assert.ok(useSyncStore.getState().opnieuwOm > 1000);
  _resetVoorTest();
});

test("404: project niet op de server, outbox blijft; 400: batch overgeslagen", async () => {
  opzet({
    stuurOps: async () => {
      const e = new Error("weg");
      e.status = 404;
      throw e;
    },
  });
  useOutboxStore.getState().voegToe({ store: "model:x", op: "addElement", args: [el("A")] });
  await verzend();
  assert.equal(useSyncStore.getState().stand, "nietOpServer");
  assert.equal(useOutboxStore.getState().ops.length, 1);

  opzet({
    stuurOps: async () => {
      const e = new Error("args geen array");
      e.status = 400;
      throw e;
    },
  });
  useOutboxStore.getState().voegToe({ store: "model:x", op: "addElement", args: [el("A")] });
  await verzend();
  assert.equal(useSyncStore.getState().stand, "fout");
  assert.equal(useOutboxStore.getState().ops.length, 0, "afgekeurde batch is overgeslagen");
});

test("niet actief: niets versturen", async () => {
  opzet({ actief: false, stuurOps: async () => assert.fail("mag niet sturen") });
  useOutboxStore.getState().voegToe({ store: "model:x", op: "addElement", args: [el("A")] });
  assert.equal(await verzend(), "uit");
  assert.equal(useOutboxStore.getState().ops.length, 1);
});

test("haalBinnen past operaties van anderen toe, slaat eigen over, pagineert", async () => {
  const store = createDiagramStore();
  koppelModelStore("hb", store);
  const naam = modelStoreNaam("hb");
  const paginas = [
    { ops: [
        { volgnummer: 1, clientId: "ander", store: naam, op: "addElement", args: [el("VanAnder")] },
        { volgnummer: 2, clientId: clientId, store: naam, op: "addElement", args: [el("Eigen")] },
      ], laatste: 2, meer: true },
    { ops: [{ volgnummer: 3, clientId: "ander", store: naam, op: "addElement", args: [el("Nog1")] }], laatste: 3, meer: false },
  ];
  const gevraagd = [];
  const { laatste } = opzet({
    haalOpsOp: async (id, vanaf) => {
      gevraagd.push(vanaf);
      return paginas.shift() || { ops: [], laatste: 3, meer: false };
    },
  });
  const n = await haalBinnen();
  assert.equal(n, 2);
  assert.deepEqual(gevraagd, [0, 2]);
  assert.ok(store.getState().elements.VanAnder);
  assert.ok(store.getState().elements.Nog1);
  assert.equal(store.getState().elements.Eigen, undefined, "eigen operatie niet nogmaals toegepast");
  assert.equal(laatste(), 3);
  assert.equal(useOutboxStore.getState().ops.length, 0, "toepassen van remote operaties vult de outbox niet");
  ontkoppelStore(naam);
});

test("haalBinnen met inclusiefEigen (na snapshot) past ook eigen operaties toe", async () => {
  const store = createDiagramStore();
  koppelModelStore("hb2", store);
  const naam = modelStoreNaam("hb2");
  opzet({
    haalOpsOp: async () => ({ ops: [{ volgnummer: 7, clientId: clientId, store: naam, op: "addElement", args: [el("EigenOud")] }], laatste: 7, meer: false }),
  });
  await haalBinnen({ inclusiefEigen: true });
  assert.ok(store.getState().elements.EigenOud);
  ontkoppelStore(naam);
});

test("verwerkOp is idempotent op volgnummer (poll en SSE mogen elkaar overlappen)", () => {
  const store = createDiagramStore();
  koppelModelStore("idem", store);
  const naam = modelStoreNaam("idem");
  const { laatste } = opzet({});
  const op = { volgnummer: 1, clientId: "ander", store: naam, op: "addElement", args: [el("X")] };
  assert.equal(verwerkOp(op), true);
  assert.equal(laatste(), 1);
  store.getState().deleteElement("X");
  assert.equal(verwerkOp(op), false, "al gezien: niet nogmaals toepassen");
  assert.equal(store.getState().elements.X, undefined);
  assert.equal(verwerkOp({ ...op, volgnummer: 2, clientId }), false, "eigen operatie: overslaan, wel opschuiven");
  assert.equal(laatste(), 2);
  ontkoppelStore(naam);
});

test("snapshot-compactie: een nieuwe snapshot na SNAPSHOT_NA operaties, alleen als we bij zijn", async () => {
  let gemaakt = 0;
  let tot = 0;
  let huidig = SNAPSHOT_NA - 1;
  opzet({});
  configureer({
    laatsteVolgnummer: () => huidig,
    totVolgnummer: () => tot,
    maakSnapshot: async () => {
      gemaakt++;
      tot = huidig;
    },
  });
  useSyncStore.setState({ stand: "ok" });
  // Nog niet ver genoeg voorbij de grens.
  assert.equal(await overweegSnapshot(), false);
  // Ver genoeg, maar outbox niet leeg → niet.
  huidig = SNAPSHOT_NA + 5;
  useOutboxStore.getState().voegToe({ store: "model:x", op: "addElement", args: [el("A")] });
  assert.equal(await overweegSnapshot(), false);
  useOutboxStore.getState().wis();
  // Ver genoeg en bij → snapshot.
  assert.equal(await overweegSnapshot(), true);
  assert.equal(gemaakt, 1);
  assert.equal(tot, SNAPSHOT_NA + 5);
  // Grens is opgeschoven → niet nogmaals.
  assert.equal(await overweegSnapshot(), false);
});

test("snapshotNodig van de server: snapshot opnieuw laden in plaats van operaties toepassen", async () => {
  let herladen = 0;
  opzet({ haalOpsOp: async () => ({ ops: [], laatste: 2, meer: false, snapshotNodig: true, totVolgnummer: 400 }) });
  configureer({ herlaadSnapshot: async () => { herladen++; } });
  const n = await haalBinnen();
  assert.equal(n, 0);
  assert.equal(herladen, 1);
});
