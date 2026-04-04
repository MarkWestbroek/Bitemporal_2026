import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { evalueerCelExpressie } from "./celEvaluator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const metamodelPath = path.resolve(__dirname, "../../../../metamodel_v3.json");

async function leesNpWeergavenaamExpressie() {
  const json = JSON.parse(await readFile(metamodelPath, "utf8"));
  const np = (json.entiteiten || []).find((entiteit) => entiteit.typenaam === "NatuurlijkPersoon");
  const weergavenaam = (np?.afgeleideVelden || []).find((veld) => veld.naam === "weergavenaam");
  return weergavenaam?.afleidingsregel || "";
}

function maakContext(naamgebruik, partnerAchternaam = "Jansen") {
  return {
    Naam: {
      voorletters: "J.A.",
      roepnaam: "Jan",
      tussenvoegsel: "van den",
      achternaam: "Berg",
    },
    Partnernaam: {
      achternaam: partnerAchternaam,
    },
    Naamgebruik: {
      naamgebruik,
    },
  };
}

test("NP-weergavenaam volgt BRP-naamgebruik inclusief partnernaam", async () => {
  const expressie = await leesNpWeergavenaamExpressie();

  assert.equal(
    evalueerCelExpressie(expressie, maakContext("EigenNaam")),
    "Jan van den Berg",
  );
  assert.equal(
    evalueerCelExpressie(expressie, maakContext("PartnerNaam")),
    "Jan Jansen",
  );
  assert.equal(
    evalueerCelExpressie(expressie, maakContext("EigenNaam-PartnerNaam")),
    "Jan van den Berg-Jansen",
  );
  assert.equal(
    evalueerCelExpressie(expressie, maakContext("PartnerNaam-EigenNaam")),
    "Jan Jansen-van den Berg",
  );
});

test("NP-weergavenaam valt netjes terug op eigen naam als partnernaam ontbreekt", async () => {
  const expressie = await leesNpWeergavenaamExpressie();

  assert.equal(
    evalueerCelExpressie(expressie, maakContext("PartnerNaam", null)),
    "Jan van den Berg",
  );
});
