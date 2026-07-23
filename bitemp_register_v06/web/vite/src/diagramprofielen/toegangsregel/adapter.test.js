import test from "node:test";
import assert from "node:assert/strict";

import { parseBeleid, VOORBEELD_BELEID } from "../../toegangsspraak/index.js";
import {
  beleidNaarDiagramModel, kruisverbandenUit, naarCoreModel,
  PROFIEL_CANONIEK, PROFIELTYPE_TOEGANGSREGELS, DIAGRAM_ID,
} from "./adapter.js";
import { registreerToegangsregelProfiel, toegangsregelDiagramType } from "./index.js";
import { getDiagramType } from "../../diagramcore/types/typeRegistry.js";

test("profieldefinitie registreert geldig op de motor (typecontract)", () => {
  registreerToegangsregelProfiel();
  const type = getDiagramType("toegangsregel");
  assert.ok(type);
  assert.equal(type.label, "Toegangsregel");
  const ids = toegangsregelDiagramType.elementTypes.map((et) => et.id);
  for (const verwacht of ["policy", "map", "toegangsregel", "subject", "handeling", "gegevensselectie", "voorwaardepoort", "voorwaarde", "plicht", "begrip"]) {
    assert.ok(ids.includes(verwacht), `elementtype "${verwacht}" ontbreekt`);
  }
  // Map-ordening is de hiërarchie; policy → regel is aggregatie (herbruikbaar).
  assert.deepEqual(toegangsregelDiagramType.hierarchie, ["bevat"]);
  const omvat = toegangsregelDiagramType.elementTypes.find((et) => et.id === "omvat");
  assert.equal(omvat.edgePresentatie.markerStart, "ruit-open");
});

test("adapter: voorbeeldbeleid → deterministisch profielmodel", () => {
  const { beleid } = parseBeleid(VOORBEELD_BELEID);
  const model = beleidNaarDiagramModel(beleid);
  const nogEens = beleidNaarDiagramModel(beleid);
  assert.deepEqual(model, nogEens); // geen klok/random → stabiel

  const per = (type) => model.elementen.filter((e) => e.elementType === type);
  // Top-level policy met kop-gegevens; regels hangen eraan met "omvat".
  assert.equal(per("policy").length, 1);
  assert.equal(per("policy")[0].naam, "Inzage inkomen bij schuldhulp");
  assert.equal(per("policy")[0].data.geldigVanaf, "2026-05-01");
  assert.equal(model.connectoren.filter((c) => c.elementType === "omvat").length, 2);
  assert.equal(per("toegangsregel").length, 2);
  assert.equal(per("begrip").length, 2);
  assert.equal(per("subject").length, 2);
  assert.equal(per("handeling").length, 2);
  assert.equal(per("gegevensselectie").length, 2);
  assert.equal(per("voorwaardepoort").length, 1); // "aan alle"
  assert.equal(per("voorwaarde").length, 2);
  assert.equal(per("plicht").length, 1);

  // Modaliteit: regel 2 is een verbod.
  assert.deepEqual(per("toegangsregel").map((e) => e.data.modaliteit), ["mag", "mag niet"]);

  // Kernzin-keten: regel —wie→ subject —doet→ handeling —op→ gegevensselectie.
  const kaart = per("toegangsregel")[0];
  const wie = model.connectoren.find((c) => c.elementType === "wie" && c.van === kaart.id);
  assert.ok(wie);
  const doet = model.connectoren.find((c) => c.elementType === "doet" && c.van === wie.naar);
  assert.ok(doet);
  const op = model.connectoren.find((c) => c.elementType === "op" && c.van === doet.naar);
  assert.ok(op);

  // Gegevensselectie verwijst naar het begrip (binnen het diagram).
  const selectie = model.elementen.find((e) => e.id === op.naar);
  assert.equal(selectie.elementType, "gegevensselectie");
  const naarBegrip = model.connectoren.find((c) => c.elementType === "verwijst-naar" && c.van === selectie.id);
  assert.ok(naarBegrip);
});

test("adapter: cross-profiel verwijzing is een paar (profiel, element) met canoniek model als default", () => {
  const tekst = `Beleid "Organisatie".

  Regel "naam inzien".
    Een beheerder mag de naam van de organisatienamen van een organisatie bekijken.
`;
  const { ok, beleid } = parseBeleid(tekst);
  assert.ok(ok);
  const model = beleidNaarDiagramModel(beleid);
  const selectie = model.elementen.find((e) => e.elementType === "gegevensselectie");
  assert.equal(selectie.data.verwijzingsprofiel, PROFIEL_CANONIEK);
  assert.equal(selectie.data.verwijzingselement, "Organisatie.Organisatienamen.naam");
});

test("kruisverbanden (stap 3): verwijzingen worden koppelingen-links met echte element-ids", () => {
  const { beleid } = parseBeleid(VOORBEELD_BELEID);
  const model = beleidNaarDiagramModel(beleid);
  const links = kruisverbandenUit(model);
  // Alleen het begrip "Inkomensgegevens" draagt een registerpad-verwijzing.
  assert.equal(links.length, 1);
  const begrip = model.elementen.find((e) => e.naam === "Inkomensgegevens");
  assert.deepEqual(links[0], {
    rij: { profielId: PROFIELTYPE_TOEGANGSREGELS, elementId: begrip.id },
    kolom: { profielId: PROFIEL_CANONIEK, elementId: "NatuurlijkPersoon.Inkomen" },
    soort: "komt voort uit",
  });
});

test("naarCoreModel (stap 4): store-vorm met connectoren als source/target en beginposities", () => {
  const { beleid } = parseBeleid(VOORBEELD_BELEID);
  const model = beleidNaarDiagramModel(beleid);
  const core = naarCoreModel(model, { diagramNaam: beleid.naam });

  assert.equal(core.diagramTypeId, "toegangsregel");
  // Elementen én connectoren in één elements-map.
  assert.equal(Object.keys(core.elements).length, model.elementen.length + model.connectoren.length);
  const connector = core.elements[model.connectoren[0].id];
  assert.equal(connector.source, model.connectoren[0].van);
  assert.equal(connector.target, model.connectoren[0].naar);

  // Eén diagram met een node + positie voor elk element.
  const diagram = core.diagrams[DIAGRAM_ID];
  assert.equal(diagram.naam, "Inzage inkomen bij schuldhulp");
  assert.equal(diagram.nodes.length, model.elementen.length);
  for (const node of diagram.nodes) {
    assert.ok(Number.isFinite(node.position?.x) && Number.isFinite(node.position?.y), `node ${node.elementId} mist een positie`);
  }
  // Kernzin-keten op één rij: subject, handeling en gegevens delen de y van de kaart.
  const posVan = (id) => diagram.nodes.find((n) => n.elementId === id).position;
  const kaart = model.elementen.find((e) => e.elementType === "toegangsregel");
  const wie = model.connectoren.find((c) => c.elementType === "wie" && c.van === kaart.id);
  assert.equal(posVan(wie.naar).y, posVan(kaart.id).y);
});

test("adapter: geneste opsomming wordt een poortenboom met tak-connectoren", () => {
  const tekst = `Beleid "Nest".

  Regel "r".
    Een beheerder mag alle gegevens van een dossier bekijken
    als aan alle volgende voorwaarden is voldaan:
      - het doel van de aanvraag is "toezicht";
      - aan ten minste één van de volgende voorwaarden is voldaan:
        - de status van een dossier is "lopend";
        - de leeftijd van de betrokkene is kleiner dan 18.
`;
  const { ok, beleid } = parseBeleid(tekst);
  assert.ok(ok);
  const model = beleidNaarDiagramModel(beleid);
  const poorten = model.elementen.filter((e) => e.elementType === "voorwaardepoort");
  assert.deepEqual(poorten.map((p) => p.data.soort), ["alle", "ten minste één"]);
  const takken = model.connectoren.filter((c) => c.elementType === "tak");
  // buitenpoort → (voorwaarde, binnenpoort); binnenpoort → 2 voorwaarden
  assert.equal(takken.length, 4);
  const als = model.connectoren.filter((c) => c.elementType === "als");
  assert.equal(als.length, 1);
});
