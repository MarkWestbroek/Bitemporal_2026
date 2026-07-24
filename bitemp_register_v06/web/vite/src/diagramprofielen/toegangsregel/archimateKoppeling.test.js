import test from "node:test";
import assert from "node:assert/strict";

import { parseBeleid, VOORBEELD_BELEID } from "../../toegangsspraak/index.js";
import { archimateElementenUit, koppelArchimate, PROFIELTYPE_ARCHIMATE } from "./archimateKoppeling.js";
import { PROFIELTYPE_TOEGANGSREGELS } from "./adapter.js";

// NB: dat het archimate-profiel de doeltypen kent (business-object,
// business-rol, goal en het toegevoegde constraint) wordt niet hier maar
// door de typeregistry-validatie bij het laden van de app afgedwongen —
// archimate/index.js importeert JSX en is daarmee niet laadbaar in node:test.

test("archimateElementenUit: begrippen → BO/rol, grondslag → Constraint, doel → Goal", () => {
  const { beleid } = parseBeleid(VOORBEELD_BELEID);
  const gewenst = archimateElementenUit(beleid);
  const per = (type) => gewenst.filter((el) => el.elementType === type);
  assert.deepEqual(per("business-rol").map((el) => el.naam), ["schuldhulpverlener"]);
  assert.deepEqual(per("business-object").map((el) => el.naam), ["Inkomensgegevens"]);
  assert.deepEqual(per("constraint").map((el) => el.naam), ["de Wet gemeentelijke schuldhulpverlening"]);
  assert.deepEqual(per("goal").map((el) => el.naam), ["schuldhulpverlening"]);
});

test("koppelArchimate: additief, hergebruikt bestaande elementen en legt de juiste links", () => {
  const { beleid } = parseBeleid(VOORBEELD_BELEID);
  // Het Goal bestaat al in het ArchiMate-model van de gebruiker (andere id).
  const bestaand = [{ id: "am_998", elementType: "goal", naam: "Schuldhulpverlening" }];
  const { toeTeVoegen, links } = koppelArchimate(beleid, bestaand);

  // Goal wordt hergebruikt (case-ongevoelig), de rest toegevoegd.
  assert.ok(!toeTeVoegen.some((el) => el.elementType === "goal"));
  assert.deepEqual(
    toeTeVoegen.map((el) => el.elementType).sort(),
    ["business-object", "business-rol", "constraint"]
  );

  const linkNaar = (elementId) => links.find((l) => l.kolom.elementId === elementId);
  // Doelbinding: policy realiseert het bestaande Goal.
  const doelLink = linkNaar("am_998");
  assert.deepEqual(doelLink.rij, { profielId: PROFIELTYPE_TOEGANGSREGELS, elementId: "trg:policy" });
  assert.equal(doelLink.soort, "realiseert");
  assert.equal(doelLink.kolom.profielId, PROFIELTYPE_ARCHIMATE);
  // Grondslag: policy komt voort uit de Constraint.
  const wetLink = links.find((l) => l.kolom.elementId.startsWith("arch:trg:wet:"));
  assert.equal(wetLink.soort, "komt voort uit");
  assert.equal(wetLink.rij.elementId, "trg:policy");
  // Begrip: het begrip-element komt voort uit het Business object.
  const boLink = links.find((l) => l.kolom.elementId.startsWith("arch:trg:bo:"));
  assert.equal(boLink.rij.elementId, "trg:def:inkomensgegevens");
  assert.equal(boLink.soort, "komt voort uit");
});

test("koppelArchimate: nogmaals koppelen voegt niets dubbel toe", () => {
  const { beleid } = parseBeleid(VOORBEELD_BELEID);
  const eerste = koppelArchimate(beleid, []);
  // Tweede keer: alles bestaat inmiddels (zelfde ids/namen).
  const tweede = koppelArchimate(beleid, eerste.toeTeVoegen);
  assert.deepEqual(tweede.toeTeVoegen, []);
  // De links wijzen naar dezelfde elementen als de eerste keer.
  assert.deepEqual(tweede.links, eerste.links);
});
