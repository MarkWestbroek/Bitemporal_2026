import test from "node:test";
import assert from "node:assert/strict";

import { parseBeleid, VOORBEELD_BELEID } from "../../toegangsspraak/index.js";
import {
  beleidNaarDiagramModel, kruisverbandenUit, naarCoreModel, mergeCoreModel,
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

test("ids zijn inhouds-stabiel: iets toevoegen verandert de ids van de rest niet", () => {
  const { beleid: a } = parseBeleid(VOORBEELD_BELEID);
  // Voeg midden in het beleid een begrip én een regel toe.
  const uitgebreid = VOORBEELD_BELEID
    .replace(
      "    Inkomensgegevens zijn:",
      "    Adresgegevens zijn: alle gegevens van het adres van een natuurlijk persoon.\n    Inkomensgegevens zijn:"
    )
    .replace(
      '  Regel "geen export".',
      '  Regel "adres inzien".\n    Een schuldhulpverlener mag de adresgegevens bekijken.\n\n  Regel "geen export".'
    );
  const { ok, beleid: b } = parseBeleid(uitgebreid);
  assert.ok(ok);

  const idsVan = (model) => new Map(model.elementen.map((e) => [e.id, e.naam]));
  const oud = idsVan(beleidNaarDiagramModel(a));
  const nieuw = idsVan(beleidNaarDiagramModel(b));
  for (const [id, naam] of oud) {
    assert.ok(nieuw.has(id), `id "${id}" (${naam}) veranderde door de toevoeging`);
  }
  // En de leesbaarheid: regel-ids dragen de regelnaam.
  assert.ok(nieuw.has("trg:reg:geen-export"));
  assert.ok(nieuw.has("trg:def:adresgegevens"));
});

test("mergeCoreModel: de layout is heilig bij herpubliceren", () => {
  const { beleid: a } = parseBeleid(VOORBEELD_BELEID);
  const eerste = naarCoreModel(beleidNaarDiagramModel(a), { diagramNaam: a.naam });

  // Simuleer gebruikerswerk: kaart versleept + eigen notitie + pan/zoom.
  const kaartId = "trg:reg:inzage-bij-lopend-dossier";
  const bestaandDiagram = eerste.diagrams[DIAGRAM_ID];
  const bestaand = {
    elements: {
      ...eerste.elements,
      user_notitie: { id: "user_notitie", naam: "Notitie", elementType: "plicht", compartimenten: [], data: { tekst: "check!" } },
    },
    diagrams: {
      [DIAGRAM_ID]: {
        ...bestaandDiagram,
        nodes: [
          ...bestaandDiagram.nodes.map((n) =>
            n.elementId === kaartId ? { ...n, position: { x: 999, y: 777 }, size: { width: 320, height: 90 } } : n
          ),
          { elementId: "user_notitie", position: { x: 5, y: 5 } },
        ],
      },
    },
    viewports: { [DIAGRAM_ID]: { x: 12, y: 34, zoom: 1.5 } },
    actiefDiagramId: DIAGRAM_ID,
    meta: null,
  };

  // Nieuwe tekst: regel "geen export" weg, begrip erbij.
  const aangepast = VOORBEELD_BELEID
    .replace(/\n  Regel "geen export"\.\n    Een schuldhulpverlener mag de inkomensgegevens niet exporteren\.\n/, "\n")
    .replace(
      "    Inkomensgegevens zijn:",
      "    Adresgegevens zijn: alle gegevens van het adres van een natuurlijk persoon.\n    Inkomensgegevens zijn:"
    );
  const { ok, beleid: b } = parseBeleid(aangepast);
  assert.ok(ok);
  const merged = mergeCoreModel(bestaand, naarCoreModel(beleidNaarDiagramModel(b), { diagramNaam: b.naam }));

  const nodes = new Map(merged.diagrams[DIAGRAM_ID].nodes.map((n) => [n.elementId, n]));
  // Versleepte kaart: positie én afmeting behouden.
  assert.deepEqual(nodes.get(kaartId).position, { x: 999, y: 777 });
  assert.deepEqual(nodes.get(kaartId).size, { width: 320, height: 90 });
  // Eigen notitie blijft, mét node.
  assert.ok(merged.elements.user_notitie);
  assert.deepEqual(nodes.get("user_notitie").position, { x: 5, y: 5 });
  // Verwijderde regel is weg (element + node + connectoren).
  assert.equal(merged.elements["trg:reg:geen-export"], undefined);
  assert.equal(nodes.get("trg:reg:geen-export"), undefined);
  assert.ok(!Object.values(merged.elements).some((el) => el.source === "trg:reg:geen-export" || el.target === "trg:reg:geen-export"));
  // Nieuw begrip is er, met een positie.
  assert.ok(merged.elements["trg:def:adresgegevens"]);
  assert.ok(nodes.get("trg:def:adresgegevens").position);
  // Pan/zoom blijft (viewport reist mee het diagram in).
  assert.deepEqual(merged.diagrams[DIAGRAM_ID].viewport, { x: 12, y: 34, zoom: 1.5 });
});

test("naarCoreModel: connectoren dragen hun type-label als lijnnaam", () => {
  const { beleid } = parseBeleid(VOORBEELD_BELEID);
  const core = naarCoreModel(beleidNaarDiagramModel(beleid));
  const labels = new Set(
    Object.values(core.elements).filter((el) => el.source && el.target).map((el) => el.naam)
  );
  for (const verwacht of ["omvat", "wie", "doet", "op", "als", "waarbij", "verwijst naar"]) {
    assert.ok(labels.has(verwacht), `lijnlabel "${verwacht}" ontbreekt`);
  }
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
