import test from "node:test";
import assert from "node:assert/strict";

import { parseBeleid, renderBeleid, VOORBEELD_BELEID } from "../../toegangsspraak/index.js";
import { beleidNaarDiagramModel, naarCoreModel } from "./adapter.js";
import { terugNaarTekst } from "./terugweg.js";

function coreState(beleid) {
  return { elements: naarCoreModel(beleidNaarDiagramModel(beleid)).elements };
}

test("gouden round-trip: tekst → diagram-model → tekst is verliesvrij", () => {
  const { beleid } = parseBeleid(VOORBEELD_BELEID);
  const { tekst, meldingen } = terugNaarTekst(coreState(beleid));
  assert.deepEqual(meldingen, []);
  const terug = parseBeleid(tekst);
  assert.deepEqual(terug.fouten, []);
  assert.ok(terug.ok);
  // Na normalisatie exact de oorspronkelijke canonieke tekst.
  assert.equal(renderBeleid(terug.beleid), VOORBEELD_BELEID);
});

test("canvas-bewerkingen vloeien terug naar de tekst", () => {
  const { beleid } = parseBeleid(VOORBEELD_BELEID);
  const state = coreState(beleid);

  // 1. Subject hernoemd via de inspector.
  state.elements["trg:reg:inzage-bij-lopend-dossier:wie"].naam = "een bewindvoerder";
  // 2. Nieuwe voorwaarde bijgetekend onder de poort (taakbalk + tak-lijn);
  //    de eigenschappen zijn via de inspector gevuld, de naam niet.
  state.elements.trg_nieuw_9 = {
    id: "trg_nieuw_9",
    elementType: "voorwaarde",
    naam: "Voorwaarde",
    compartimenten: [],
    data: { links: "de leeftijd van de betrokkene", vergelijking: "is kleiner dan", rechts: "18" },
  };
  state.elements.trg_nieuw_c9 = {
    id: "trg_nieuw_c9",
    elementType: "tak",
    naam: "",
    source: "trg:reg:inzage-bij-lopend-dossier:als",
    target: "trg_nieuw_9",
    compartimenten: [],
    data: {},
  };

  const { tekst, meldingen } = terugNaarTekst(state);
  assert.deepEqual(meldingen, []);
  const terug = parseBeleid(tekst);
  assert.ok(terug.ok, JSON.stringify(terug.fouten));
  const canoniek = renderBeleid(terug.beleid);
  assert.match(canoniek, /Een bewindvoerder mag de inkomensgegevens bekijken/);
  assert.match(canoniek, /- de leeftijd van de betrokkene is kleiner dan 18[;.]/);
  // De bestaande voorwaarden staan er nog steeds in.
  assert.match(canoniek, /het doel van de aanvraag is "schuldhulpverlening";/);
});

test("onvolledige canvas-regels worden overgeslagen met een melding", () => {
  const { beleid } = parseBeleid(VOORBEELD_BELEID);
  const state = coreState(beleid);
  state.elements.trg_nieuw_1 = {
    id: "trg_nieuw_1",
    elementType: "toegangsregel",
    naam: "half afgemaakt",
    compartimenten: [],
    data: { modaliteit: "mag" },
  };

  const { tekst, meldingen } = terugNaarTekst(state);
  assert.equal(meldingen.length, 1);
  assert.match(meldingen[0], /"half afgemaakt" is onvolledig/);
  assert.match(meldingen[0], /subject \(wie\)/);
  // De rest leest gewoon terug.
  const terug = parseBeleid(tekst);
  assert.ok(terug.ok);
  assert.equal(terug.beleid.regels.length, 2);
});

test("zonder policy-element: duidelijke melding, geen tekst", () => {
  const { tekst, meldingen } = terugNaarTekst({ elements: {} });
  assert.equal(tekst, null);
  assert.match(meldingen[0], /Geen policy-element/);
});
