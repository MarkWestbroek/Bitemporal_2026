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

test("leeftijd() met expliciete peildatum rekent hele jaren", () => {
  const ctx = { np: { geb: "1990-06-15" } };
  assert.equal(evalueerCelExpressie('leeftijd(np.geb, "2026-07-09")', ctx), 36);
  assert.equal(evalueerCelExpressie('leeftijd(np.geb, "2026-06-14")', ctx), 35);
  assert.equal(evalueerCelExpressie('leeftijd(np.geb, "2026-06-15")', ctx), 36);
});

test("leeftijd() past BRP-midpoint toe op DatumIncompleet", () => {
  const ctx = { np: { jaar: "1990-00-00", maand: "1990-06-00", leeg: "0000-00-00" } };
  // alleen jaar → 1 juli
  assert.equal(evalueerCelExpressie('leeftijd(np.jaar, "2026-06-30")', ctx), 35);
  assert.equal(evalueerCelExpressie('leeftijd(np.jaar, "2026-07-09")', ctx), 36);
  // jaar + maand → 15e
  assert.equal(evalueerCelExpressie('leeftijd(np.maand, "2026-06-14")', ctx), 35);
  assert.equal(evalueerCelExpressie('leeftijd(np.maand, "2026-07-09")', ctx), 36);
  // volledig onbekend → null
  assert.equal(evalueerCelExpressie('leeftijd(np.leeg, "2026-07-09")', ctx), null);
});

test("leeftijd() accepteert date-time en werkt binnen concatenatie", () => {
  const ctx = { np: { geb: "2000-01-01T12:00:00Z", achternaam: "Jansen" } };
  assert.equal(evalueerCelExpressie('leeftijd(np.geb, "2026-07-09")', ctx), 26);
  assert.equal(
    evalueerCelExpressie('np.achternaam + " (" + string(leeftijd(np.geb, "2026-07-09")) + ")"', ctx),
    "Jansen (26)",
  );
});

test("leeftijd() zonder peildatum gebruikt vandaag (wandklok)", () => {
  const ctx = { np: { geb: "2000-01-01" } };
  const lft = evalueerCelExpressie("leeftijd(np.geb)", ctx);
  assert.ok(lft >= 20 && lft <= 120, `onwaarschijnlijke leeftijd: ${lft}`);
});
