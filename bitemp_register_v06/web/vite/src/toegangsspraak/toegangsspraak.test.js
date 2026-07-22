import test from "node:test";
import assert from "node:assert/strict";

import { parseBeleid, padNaarVerwijzing, verwijzingNaarPad } from "./parser.js";
import { renderBeleid, renderVerwijzing } from "./renderer.js";
import { naarOdrl } from "./odrl.js";
import { registreerOperatoren, resetOperatoren, GEO_OPERATOREN } from "./operatoren.js";
import { VOORBEELD_BELEID } from "./voorbeeld.js";

test("voorbeeldbeleid parset foutloos met de verwachte structuur", () => {
  const { ok, beleid, fouten } = parseBeleid(VOORBEELD_BELEID);
  assert.deepEqual(fouten, []);
  assert.ok(ok);
  assert.equal(beleid.naam, "Inzage inkomen bij schuldhulp");
  assert.equal(beleid.geldigVanaf, "2026-05-01");
  assert.equal(beleid.grondslag, "de Wet gemeentelijke schuldhulpverlening");
  assert.equal(beleid.doel, "schuldhulpverlening");
  assert.equal(beleid.begrippen.length, 2);
  assert.equal(beleid.begrippen[0].soort, "wie");
  assert.deepEqual(beleid.begrippen[0].kenmerken, [{ kenmerk: "rol", waarde: "schuldhulpverlener" }]);
  assert.equal(beleid.regels.length, 2);

  const [inzage, verbod] = beleid.regels;
  assert.equal(inzage.verbod, false);
  assert.equal(inzage.actie, "bekijken");
  assert.equal(inzage.voorwaarden.soort, "en");
  assert.equal(inzage.voorwaarden.items.length, 2);
  assert.equal(inzage.voorwaarden.items[1].operator, "begintMet");
  assert.deepEqual(inzage.plichten, [{ zin: "elke raadpleging wordt vastgelegd in het logboek", nlgov: "nlgov:log" }]);
  assert.equal(verbod.verbod, true);
  assert.equal(verbod.actie, "exporteren");
});

test("round-trip: renderen van het geparste voorbeeld geeft exact dezelfde tekst", () => {
  const { beleid } = parseBeleid(VOORBEELD_BELEID);
  assert.equal(renderBeleid(beleid), VOORBEELD_BELEID);
});

test("round-trip: parse(render(beleid)) is structureel gelijk aan beleid", () => {
  const { beleid } = parseBeleid(VOORBEELD_BELEID);
  const opnieuw = parseBeleid(renderBeleid(beleid));
  assert.ok(opnieuw.ok);
  assert.deepEqual(opnieuw.beleid, beleid);
});

test("van-vorm en registerpad zijn elkaars spiegel", () => {
  const verwijzing = padNaarVerwijzing("NatuurlijkPersoon.Naam.achternaam");
  assert.equal(renderVerwijzing(verwijzing), "de achternaam van de naam van een natuurlijk persoon");
  assert.equal(verwijzingNaarPad(verwijzing), "NatuurlijkPersoon.Naam.achternaam");
});

test("technisch pad wordt als shorthand geaccepteerd en canoniek als van-vorm gerenderd", () => {
  const tekst = `Beleid "Padtest".

  Regel "pad".
    Een beheerder mag NatuurlijkPersoon.Naam.achternaam bekijken.
`;
  const { ok, beleid } = parseBeleid(tekst);
  assert.ok(ok);
  assert.equal(verwijzingNaarPad(beleid.regels[0].wat), "NatuurlijkPersoon.Naam.achternaam");
  assert.match(
    renderBeleid(beleid),
    /mag de achternaam van de naam van een natuurlijk persoon bekijken\./
  );
});

test("geneste opsomming (en > of) parset en wordt in ODRL een LogicalConstraint", () => {
  const tekst = `Beleid "Verzuim".

  Begrippen.
    De medische gegevens zijn: alle gegevens van een medisch dossier.

  Regel "bedrijfsarts wel".
    Een bedrijfsarts mag de medische gegevens bekijken
    als aan alle volgende voorwaarden is voldaan:
      - het doel van de aanvraag is "verzuimbegeleiding";
      - aan ten minste één van de volgende voorwaarden is voldaan:
        - de status van het dossier van de betrokkene is "lopend";
        - de leeftijd van de betrokkene is kleiner dan 18;
    waarbij: elke raadpleging wordt vastgelegd in het logboek.
`;
  const { ok, beleid, fouten } = parseBeleid(tekst);
  assert.deepEqual(fouten, []);
  assert.ok(ok);
  const blok = beleid.regels[0].voorwaarden;
  assert.equal(blok.soort, "en");
  assert.equal(blok.items[1].soort, "of");
  assert.equal(blok.items[1].items.length, 2);

  const odrl = naarOdrl(beleid);
  const constraints = odrl.permission[0].constraint;
  assert.equal(constraints.length, 2);
  assert.deepEqual(constraints[0], {
    leftOperand: { "@id": "nlgov:doelbinding" },
    operator: "eq",
    rightOperand: "verzuimbegeleiding",
  });
  assert.ok(constraints[1].or);
  assert.equal(constraints[1].or["@list"].length, 2);
  assert.equal(constraints[1].or["@list"][1].operator, "lt");

  // Round-trip ook voor geneste blokken
  const opnieuw = parseBeleid(renderBeleid(beleid));
  assert.ok(opnieuw.ok);
  assert.deepEqual(opnieuw.beleid, beleid);
});

test("mag niet wordt een ODRL prohibition; mag een permission", () => {
  const { beleid } = parseBeleid(VOORBEELD_BELEID);
  const odrl = naarOdrl(beleid);
  assert.equal(odrl.conflict, "prohibit");
  assert.equal(odrl.permission.length, 1);
  assert.equal(odrl.prohibition.length, 1);
  assert.equal(odrl.prohibition[0].action["@id"], "nlgov:export");
  assert.equal(odrl.permission[0].action["@id"], "nlgov:view");
  assert.equal(odrl.permission[0].assignee.refinement[0].rightOperand, "schuldhulpverlener");
  assert.equal(odrl.permission[0].duty[0].action["@id"], "nlgov:log");
});

test("onbekende handeling geeft een klare-taal fout met de bekende handelingen", () => {
  const tekst = `Beleid "Fouttest".

  Regel "fout".
    Een beheerder mag NatuurlijkPersoon.Naam.achternaam lezen.
`;
  const { ok, fouten } = parseBeleid(tekst);
  assert.equal(ok, false);
  assert.match(fouten[0].bericht, /Onbekende handeling "lezen"/);
  assert.match(fouten[0].bericht, /bekijken/);
});

test("een niet-gedefinieerd gegevens-begrip is een fout met een hint", () => {
  const tekst = `Beleid "Fouttest".

  Regel "fout".
    Een beheerder mag de inkomensgegevens bekijken.
`;
  const { ok, fouten } = parseBeleid(tekst);
  assert.equal(ok, false);
  assert.match(fouten[0].bericht, /niet gedefinieerd onder Begrippen/);
});

test("geo-domeinprofiel: extra operatoren registreren zonder grammatica-wijziging", () => {
  registreerOperatoren(GEO_OPERATOREN);
  try {
    const tekst = `Beleid "Toezicht".

  Regel "toezicht binnen werkgebied".
    Een toezichthouder mag alle gegevens van een pand bekijken
    als de locatie van de gegevens valt geheel binnen het werkgebied van de aanvrager.
`;
    const { ok, beleid, fouten } = parseBeleid(tekst);
    assert.deepEqual(fouten, []);
    assert.ok(ok);
    const voorwaarde = beleid.regels[0].voorwaarden;
    assert.equal(voorwaarde.operator, "geoBinnen");

    const odrl = naarOdrl(beleid);
    const constraint = odrl.permission[0].constraint[0];
    assert.equal(constraint.operator, "geo:within");
    assert.deepEqual(constraint.leftOperand, { "@id": "nlgov:veldwaarde:locatie" });
    assert.deepEqual(constraint.rightOperand, { "@id": "nlgov:aanvrager:werkgebied" });
    assert.deepEqual(odrl.permission[0].target, { "@type": "Asset", uid: "nlgov:register:Pand" });
  } finally {
    resetOperatoren();
  }
});

test("wie zonder begripsdefinitie wordt een impliciete rol in ODRL", () => {
  const tekst = `Beleid "Correctie".

  Regel "corrigeren met verantwoording".
    Een registerbeheerder mag alle gegevens van een natuurlijk persoon corrigeren
    waarbij: de reden van de wijziging wordt vastgelegd bij de registratie.
`;
  const { ok, beleid } = parseBeleid(tekst);
  assert.ok(ok);
  const odrl = naarOdrl(beleid);
  const assignee = odrl.permission[0].assignee;
  assert.equal(assignee.refinement[0].rightOperand, "registerbeheerder");
  assert.deepEqual(assignee.refinement[0].leftOperand, { "@id": "nlgov:rol" });
  assert.equal(odrl.permission[0].action["@id"], "nlgov:corrigeer");
});
