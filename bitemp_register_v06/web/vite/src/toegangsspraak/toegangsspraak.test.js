import test from "node:test";
import assert from "node:assert/strict";

import { parseBeleid, padNaarVerwijzing, verwijzingNaarPad } from "./parser.js";
import { renderBeleid, renderVerwijzing } from "./renderer.js";
import { toegangsspraakNaarOdrl } from "./odrlExport.js";

/** De knopen van de ODRL-export (ODRL-AP-NL) op naam; `lijst` maakt van één of meer waarden een lijst van namen. */
const odrlKnopen = (beleid) => Object.fromEntries(toegangsspraakNaarOdrl(beleid).jsonld["@graph"].map((k) => [k["@id"], k]));
const lijst = (w) => [w ?? []].flat().map((x) => x?.["@id"] ?? x);
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
  // "Inkomensgegevens zijn: …" — onbepaalde term, zonder lidwoord.
  assert.equal(beleid.begrippen[1].lidwoord, null);
  assert.equal(beleid.begrippen[1].wat.soort, "alle");
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

  // De doelbinding gaat over het verzoek (verfijning op de handeling), de groep over de gegevens
  // (voorwaarde op de regel).
  const g = odrlKnopen(beleid);
  const doel = g["b:vw-doel-verzuimbegeleiding"];
  assert.deepEqual([doel["odrl:leftOperand"], doel["odrl:operator"], doel["odrl:rightOperand"]], [{ "@id": "odrl:purpose" }, { "@id": "odrl:eq" }, { "@id": "b:doel-verzuimbegeleiding" }]);
  assert.ok(lijst(g["b:handeling-bedrijfsarts-wel"]["odrl:refinement"]).includes("b:vw-doel-verzuimbegeleiding"));
  const groep = g[lijst(g["b:regel-bedrijfsarts-wel"]["odrl:constraint"])[0]];
  assert.equal(groep["@type"], "odrl:LogicalConstraint");
  assert.equal(groep["odrl:or"]["@list"].length, 2);
  assert.deepEqual(g[groep["odrl:or"]["@list"][1]["@id"]]["odrl:operator"], { "@id": "odrl:lt" });

  // Round-trip ook voor geneste blokken
  const opnieuw = parseBeleid(renderBeleid(beleid));
  assert.ok(opnieuw.ok);
  assert.deepEqual(opnieuw.beleid, beleid);
});

test("onbepaalde term zonder dubbele punt parset; canoniek krijgt de dubbele punt", () => {
  const tekst = `Beleid "Contact".

  Begrippen.
    Mail is de email van de persoonscontactgegevens van een persoon.

  Regel "mail bekijken".
    Een beheerder mag mail bekijken.
`;
  const { ok, beleid, fouten } = parseBeleid(tekst);
  assert.deepEqual(fouten, []);
  assert.ok(ok);
  assert.equal(beleid.begrippen[0].lidwoord, null);
  assert.equal(beleid.begrippen[0].naam, "Mail");
  assert.deepEqual(beleid.regels[0].wat, { soort: "begrip", lidwoord: null, naam: "mail" });

  const canoniek = renderBeleid(beleid);
  assert.match(canoniek, /Mail is: de email van de persoonscontactgegevens van een persoon\./);
  assert.match(canoniek, /mag mail bekijken\./);
  // Canonieke vorm blijft round-trip-stabiel.
  const opnieuw = parseBeleid(canoniek);
  assert.ok(opnieuw.ok);
  assert.equal(renderBeleid(opnieuw.beleid), canoniek);
});

test("'alle gegevens van' met van-keten geeft een gegevensgroep-pad met hoofdletters", () => {
  const { beleid } = parseBeleid(VOORBEELD_BELEID);
  const g = odrlKnopen(beleid);
  // Congruente definitie: "Inkomensgegevens zijn: alle gegevens van het
  // inkomen van een natuurlijk persoon." → groep, geen veld-blad.
  assert.deepEqual(g["b:regel-inzage-bij-lopend-dossier"]["odrl:target"], { "@id": "b:gegevens-inkomensgegevens" });
  assert.equal(g["reg:NatuurlijkPersoon.Inkomen"]["dct:identifier"], "NatuurlijkPersoon.Inkomen");
  assert.ok(lijst(g["reg:NatuurlijkPersoon.Inkomen"]["odrl:partOf"]).includes("b:gegevens-inkomensgegevens"));
});

test("bijzinsvolgorde na 'als': beide volgordes parsen naar dezelfde AST; canoniek is de bijzin", () => {
  const bijzin = `Beleid "Taal".

  Regel "geen export".
    Een beheerder mag NatuurlijkPersoon.Naam.achternaam niet exporteren
    als de taal van een trefwoord niet "nl" is.
`;
  const stelling = bijzin.replace('de taal van een trefwoord niet "nl" is', 'de taal van een trefwoord is niet "nl"');

  const a = parseBeleid(bijzin);
  const b = parseBeleid(stelling);
  assert.ok(a.ok);
  assert.ok(b.ok);
  assert.deepEqual(a.beleid, b.beleid);
  assert.equal(a.beleid.regels[0].voorwaarden.operator, "neq");

  // De canonieke vorm gebruikt de bijzinsvolgorde na "als" …
  assert.match(renderBeleid(a.beleid), /als de taal van een trefwoord niet "nl" is\./);
  // … en blijft round-trip-stabiel.
  const canoniek = renderBeleid(a.beleid);
  assert.equal(renderBeleid(parseBeleid(canoniek).beleid), canoniek);
});

test("bijzinsvolgorde met gesplitste operator: '… met \"A\" begint' en '… kleiner dan 18 is'", () => {
  const tekst = `Beleid "Bijzinnen".

  Regel "a".
    Een beheerder mag NatuurlijkPersoon.Naam.achternaam bekijken
    als de achternaam van de naam van de betrokkene met "A" begint.

  Regel "b".
    Een beheerder mag NatuurlijkPersoon.Naam.achternaam bekijken
    als de leeftijd van de betrokkene kleiner dan 18 is.
`;
  const { ok, beleid, fouten } = parseBeleid(tekst);
  assert.deepEqual(fouten, []);
  assert.ok(ok);
  assert.equal(beleid.regels[0].voorwaarden.operator, "begintMet");
  assert.equal(beleid.regels[1].voorwaarden.operator, "lt");
  // In een opsomming blijft de stellingsvorm de canonieke vorm.
  const canoniek = renderBeleid(beleid);
  assert.equal(renderBeleid(parseBeleid(canoniek).beleid), canoniek);
});

test("spans: de parser levert bronposities per element-soort", () => {
  const { spans } = parseBeleid(VOORBEELD_BELEID);
  const soorten = new Set(spans.map((s) => s.soort));
  for (const verwacht of ["subject", "gegevens", "actie", "operator", "waarde", "plicht", "modaliteit", "structuur"]) {
    assert.ok(soorten.has(verwacht), `span-soort "${verwacht}" ontbreekt`);
  }
  // Posities kloppen met de brontekst.
  for (const span of spans.filter((s) => s.soort === "actie")) {
    assert.match(VOORBEELD_BELEID.slice(span.van, span.tot), /^(bekijken|exporteren)$/);
  }
  // "alle gegevens van …" krijgt een buitenste span over het geheel.
  const gegevens = spans.find((s) => s.soort === "gegevens" && s.verwijzing);
  assert.ok(gegevens);
  assert.equal(
    VOORBEELD_BELEID.slice(gegevens.van, gegevens.tot),
    "alle gegevens van het inkomen van een natuurlijk persoon"
  );
  // Bij het verbod ("mag … niet exporteren") kleuren mag én niet als ontkenning.
  const ontkenningen = spans.filter((s) => s.soort === "modaliteit" && s.ontkenning);
  assert.equal(ontkenningen.length, 2);
  assert.deepEqual(
    ontkenningen.map((s) => VOORBEELD_BELEID.slice(s.van, s.tot)).sort(),
    ["mag", "niet"]
  );
});

test("existentie-voorwaarden: 'er is … voor …' in beide volgordes, met ODRL-mapping", () => {
  // De whitepaper-zin, in bijzinsvolgorde (canoniek na "als").
  const tekst = `Beleid "Schuldhulp".

  Regel "inzage bij lopend dossier".
    Een schuldhulpverlener mag alle gegevens van een dossier bekijken
    als er een lopend dossier voor de betrokkene is.
`;
  const a = parseBeleid(tekst);
  assert.deepEqual(a.fouten, []);
  assert.ok(a.ok);
  const voorwaarde = a.beleid.regels[0].voorwaarden;
  assert.equal(voorwaarde.operator, "bestaat");
  assert.deepEqual(voorwaarde.existentie.woorden, ["lopend", "dossier"]);
  assert.equal(voorwaarde.existentie.ontkenning, false);
  assert.equal(voorwaarde.existentie.voor.basis.anker, "betrokkene");

  // Stellingsvorm parset naar dezelfde AST.
  const b = parseBeleid(tekst.replace(
    "als er een lopend dossier voor de betrokkene is.",
    "als er is een lopend dossier voor de betrokkene."
  ));
  assert.ok(b.ok);
  assert.deepEqual(b.beleid, a.beleid);

  // Canoniek: bijzin na "als", en round-trip-stabiel.
  const canoniek = renderBeleid(a.beleid);
  assert.match(canoniek, /als er een lopend dossier voor de betrokkene is\./);
  assert.equal(renderBeleid(parseBeleid(canoniek).beleid), canoniek);

  // ODRL: een PIP-vraag als constraint.
  const constraint = odrlKnopen(a.beleid)["b:vw-er-is-een-lopend-dossier-voor-de-betrokkene"];
  assert.deepEqual(
    [constraint["odrl:leftOperand"], constraint["odrl:operator"], constraint["odrl:rightOperand"], constraint["ts:voor"]],
    [{ "@id": "ts:bestaat.lopendDossier" }, { "@id": "ts:bestaat" }, true, { "@id": "ts:betrokkene" }],
  );
});

test("existentie met ontkenning en in een opsomming (stellingsvorm)", () => {
  const tekst = `Beleid "Schuldhulp".

  Regel "r".
    Een schuldhulpverlener mag alle gegevens van een dossier bekijken
    als aan alle volgende voorwaarden is voldaan:
      - er is een lopend dossier voor de betrokkene;
      - er is geen bewindvoering voor de betrokkene.
`;
  const { ok, beleid, fouten } = parseBeleid(tekst);
  assert.deepEqual(fouten, []);
  assert.ok(ok);
  const [wel, niet] = beleid.regels[0].voorwaarden.items;
  assert.equal(wel.existentie.ontkenning, false);
  assert.equal(niet.existentie.ontkenning, true);
  assert.deepEqual(niet.existentie.woorden, ["bewindvoering"]);

  const canoniek = renderBeleid(beleid);
  assert.match(canoniek, /- er is een lopend dossier voor de betrokkene;/);
  assert.match(canoniek, /- er is geen bewindvoering voor de betrokkene\./);
  assert.equal(renderBeleid(parseBeleid(canoniek).beleid), canoniek);

  // "er is geen …": dezelfde bestaansvraag, met onwaar als antwoord.
  assert.equal(odrlKnopen(beleid)["b:vw-er-is-geen-bewindvoering-voor-de-betrokkene"]["odrl:rightOperand"], false);
});

test("mag niet wordt een ODRL prohibition; mag een permission", () => {
  const { beleid } = parseBeleid(VOORBEELD_BELEID);
  const g = odrlKnopen(beleid);
  const set = g["b:beleid"];
  assert.deepEqual(set["odrl:conflict"], { "@id": "odrl:prohibit" });
  assert.deepEqual(lijst(set["odrl:permission"]), ["b:regel-inzage-bij-lopend-dossier"]);
  assert.deepEqual(lijst(set["odrl:prohibition"]), ["b:regel-geen-export"]);
  assert.equal(g["b:regel-geen-export"]["@type"], "odrl:Prohibition");
  assert.deepEqual(g["b:handeling-geen-export"]["rdf:value"], { "@id": "ts:exporteren" });
  assert.deepEqual(g["b:handeling-inzage-bij-lopend-dossier"]["rdf:value"], { "@id": "odrl:read" });
  assert.equal(g[lijst(g["b:groep-schuldhulpverlener"]["odrl:refinement"])[0]]["odrl:rightOperand"], "schuldhulpverlener");
  assert.deepEqual(g[lijst(g["b:regel-inzage-bij-lopend-dossier"]["odrl:duty"])[0]]["odrl:action"], { "@id": "ts:log" });
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

    // Een vergelijking uit een domeinprofiel wordt een term in de eigen woordenschat; de rechterterm
    // is een ander gegeven, dus een verwijzing en geen waarde.
    const g = odrlKnopen(beleid);
    const constraint = g[lijst(g["b:regel-toezicht-binnen-werkgebied"]["odrl:constraint"])[0]];
    assert.deepEqual(constraint["odrl:operator"], { "@id": "ts:geoBinnen" });
    assert.equal(g["ts:geoBinnen"]["rdfs:label"]["@value"], "valt geheel binnen");
    assert.deepEqual(constraint["odrl:leftOperand"], { "@id": "ts:gegevens.locatie" });
    assert.deepEqual(constraint["odrl:rightOperandReference"], { "@id": "ts:aanvrager.werkgebied" });
    assert.equal(constraint["odrl:rightOperand"], undefined);
    assert.deepEqual(g["b:regel-toezicht-binnen-werkgebied"]["odrl:target"], { "@id": "reg:Pand" });
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
  const g = odrlKnopen(beleid);
  const kenmerk = g[lijst(g["b:groep-registerbeheerder"]["odrl:refinement"])[0]];
  assert.equal(kenmerk["odrl:rightOperand"], "registerbeheerder");
  assert.deepEqual(kenmerk["odrl:leftOperand"], { "@id": "apnl:rolAanvrager" });
  assert.deepEqual(g["b:handeling-corrigeren-met-verantwoording"]["rdf:value"], { "@id": "ts:corrigeren" });
});
