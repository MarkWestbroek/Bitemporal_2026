import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nieuwFormulier,
  nieuwElement,
  parseLayout,
  serializeLayout,
  voegToe,
  verwijder,
  updateElement,
  verplaats,
  vindElement,
  vindLijstMetBron,
  valideer,
  kinderen,
  isContainer,
} from "./layoutModel.js";

test("parse + serialize is lossless en stript interne id's", () => {
  const bron = {
    type: "formulier",
    elementen: [
      { type: "groep", label: "Product", elementen: [{ type: "veld", veld: "Initiatief.Product.naam" }] },
    ],
  };
  const { root, fout } = parseLayout(bron);
  assert.equal(fout, null);
  assert.ok(root._id, "root krijgt intern id");
  const uit = serializeLayout(root);
  assert.deepEqual(uit, bron);
  assert.ok(!("_id" in uit));
});

test("parseLayout meldt ongeldige JSON", () => {
  const { root, fout } = parseLayout("{niet: geldig");
  assert.equal(root, null);
  assert.match(fout, /Ongeldige JSON/);
});

test("voegToe plaatst veld in de juiste groep", () => {
  let root = nieuwFormulier();
  const groep = nieuwElement("groep", { label: "G" });
  root = voegToe(root, root._id, groep);
  const veld = nieuwElement("veld", { veld: "A.B.c" });
  root = voegToe(root, groep._id, veld);
  const groepInBoom = vindElement(root, groep._id).element;
  assert.equal(kinderen(groepInBoom).length, 1);
  assert.equal(kinderen(groepInBoom)[0].veld, "A.B.c");
});

test("verplaats wisselt volgorde binnen parent", () => {
  let root = nieuwFormulier();
  const a = nieuwElement("veld", { veld: "x.y.a" });
  const b = nieuwElement("veld", { veld: "x.y.b" });
  root = voegToe(root, root._id, a);
  root = voegToe(root, root._id, b);
  root = verplaats(root, b._id, -1);
  assert.deepEqual(kinderen(root).map((e) => e.veld), ["x.y.b", "x.y.a"]);
});

test("updateElement mergt en verwijdert lege waarden", () => {
  let root = nieuwFormulier();
  const v = nieuwElement("veld", { veld: "x.y.z", label: "Oud" });
  root = voegToe(root, root._id, v);
  root = updateElement(root, v._id, { label: "" });
  assert.ok(!("label" in vindElement(root, v._id).element));
});

test("verwijder haalt element weg, root blijft", () => {
  let root = nieuwFormulier();
  const v = nieuwElement("veld", { veld: "a.b.c" });
  root = voegToe(root, root._id, v);
  root = verwijder(root, v._id);
  assert.equal(kinderen(root).length, 0);
});

test("lijst is een container en vindLijstMetBron vindt op bron", () => {
  let root = nieuwFormulier();
  const lijst = nieuwElement("lijst", { bron: "Initiatief.bijdragen", label: "bijdragen" });
  assert.ok(isContainer(lijst), "lijst is container");
  root = voegToe(root, root._id, lijst);
  root = voegToe(root, lijst._id, nieuwElement("veld", { veld: "toelichting" }));
  const gevonden = vindLijstMetBron(root, "Initiatief.bijdragen");
  assert.ok(gevonden, "lijst gevonden op bron");
  assert.equal(kinderen(gevonden).length, 1);
  assert.equal(kinderen(gevonden)[0].veld, "toelichting");
  assert.equal(vindLijstMetBron(root, "X.y"), null);
});

test("lijst overleeft parse+serialize met relatieve velden", () => {
  const bron = {
    type: "formulier",
    elementen: [
      { type: "lijst", bron: "Initiatief.bijdragen", label: "Bijdragen",
        elementen: [{ type: "veld", veld: "toelichting" }, { type: "veld", veld: "score" }] },
    ],
  };
  const { root } = parseLayout(bron);
  assert.deepEqual(serializeLayout(root), bron);
});

test("valideer vlagt dubbele paden en onbekende paden", () => {
  let root = nieuwFormulier();
  root = voegToe(root, root._id, nieuwElement("veld", { veld: "A.B.c" }));
  root = voegToe(root, root._id, nieuwElement("veld", { veld: "A.B.c" }));
  root = voegToe(root, root._id, nieuwElement("veld", { veld: "X.Y.z" }));
  const meldingen = valideer(root, new Set(["A.B.c"]));
  assert.ok(meldingen.some((m) => /2×/.test(m.tekst)), "dubbel pad gemeld");
  assert.ok(meldingen.some((m) => /Onbekend veldpad: X\.Y\.z/.test(m.tekst)), "onbekend pad gemeld");
});
