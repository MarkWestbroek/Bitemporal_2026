import test from "node:test";
import assert from "node:assert/strict";
import { useMarksStore, marksVanProject } from "./marksStore.js";
import { abonneer, pasOperatieToe } from "./sync/operaties.js";
import { maakStand, speelOpsNa, bouwWerkbestand } from "../diagramprofielen/ea/sidecarImport.js";

const VELD = { soort: "veld", uuid: "u-1" };

test("marksStore: een wijziging gaat als één patchMarks naar de sync; een operatie van een ander niet terug", () => {
  const ops = [];
  const af = abonneer((op) => ops.push(op));
  const s = useMarksStore.getState();
  s.laadMarks(undefined);
  ops.length = 0;
  s.zetLaag({ id: "algemeen", naam: "Algemeen" });
  s.zetMark({ laag: "algemeen", soort: "register.zoeksleutel", doel: VELD, waarde: true });
  assert.deepEqual(ops.map((o) => [o.store, o.op]), [["marks", "patchMarks"], ["marks", "patchMarks"]]);
  assert.equal(ops[1].args[0].marks.zet[0].soort, "register.zoeksleutel");
  // De eigen context is niet van het project.
  ops.length = 0;
  s.zetActieveContext(["algemeen"]);
  assert.equal(ops.length, 0);
  // Operatie van een ander: toepassen, niet terugmelden.
  const r = pasOperatieToe({ store: "marks", op: "patchMarks", args: [{ marks: { zet: [], wis: [marksVanProject().marks[0].id] } }] });
  assert.equal(r.ok, true);
  assert.equal(marksVanProject().marks.length, 0);
  assert.equal(ops.length, 0);
  af();
});

test("eigen laag: geen operatie naar de sync, niet in het werkbestand; delen stuurt hem alsnog", async () => {
  const { marksVoorWerkruimte } = await import("./marksStore.js");
  const ops = [];
  const af = abonneer((op) => ops.push(op));
  const s = useMarksStore.getState();
  s.laadMarks(undefined);
  s.zetLaag({ id: "algemeen", naam: "Algemeen" });
  ops.length = 0;
  s.zetLaag({ id: "mijn-proef", naam: "Proef", eigen: true });
  s.zetMark({ laag: "mijn-proef", soort: "register.zoeksleutel", doel: VELD, waarde: true });
  assert.deepEqual(ops, []);
  assert.equal(marksVanProject().lagen.some((l) => l.id === "mijn-proef"), false);
  assert.equal(marksVanProject().marks.length, 0);
  assert.deepEqual(marksVoorWerkruimte().lagen.map((l) => l.id), ["mijn-proef"]);
  // Een nieuw werkbestand laden laat de eigen laag staan.
  s.laadMarks({ lagen: [{ id: "algemeen", naam: "Algemeen" }], marks: [] });
  assert.equal(useMarksStore.getState().lagen.some((l) => l.id === "mijn-proef" && l.eigen), true);
  ops.length = 0;
  s.deelLaag("mijn-proef");
  assert.deepEqual(ops.map((o) => o.op), ["patchMarks"]);
  assert.deepEqual(ops[0].args[0].lagen.zet.map((l) => l.id), ["mijn-proef"]);
  assert.equal(ops[0].args[0].marks.zet.length, 1);
  assert.equal(marksVanProject().marks.length, 1);
  af();
});

// Deze test als laatste: maakStand ontkoppelt de stores van de operatielaag (zoals in de sidecar).
test("naspelen op de server: patchMarks komt in het werkbestand", () => {
  const stand = maakStand({ formaat: "studio-project", versie: 4, project: { id: "p", naam: "P" }, profielen: {} });
  const uit = speelOpsNa(stand, [
    { store: "marks", op: "patchMarks", args: [{ lagen: { zet: [{ id: "a", naam: "A", labels: [] }], wis: [] } }] },
    { store: "marks", op: "patchMarks", args: [{ marks: { zet: [{ laag: "a", soort: "register.zoeksleutel", doel: VELD, waarde: true, id: "a|register.zoeksleutel|u:u-1" }], wis: [] } }] },
  ]);
  assert.deepEqual(uit.problemen, []);
  assert.equal(uit.toegepast, 2);
  const wb = bouwWerkbestand(stand);
  assert.equal(wb.marks.marks.length, 1);
  assert.equal(wb.marks.lagen[0].id, "a");
  // Zonder marks blijft het werkbestand zoals het was.
  assert.equal("marks" in bouwWerkbestand(maakStand({ project: { id: "q" }, profielen: {} })), false);
});
