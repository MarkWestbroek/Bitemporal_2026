// omhangen.test.js — een element in een container hangen of eruit halen (gedeeld door canvas en
// projectboom, 06-11).
import test from "node:test";
import assert from "node:assert/strict";
import { hangOmNaarContainer, waaromNietInContainer, lidmaatschappenVan, lidConnectorVoor, hangOmOnder, boomRelatieVoor, boomRelatiesVan } from "./omhangen.js";

const typen = {
  schema: { id: "schema", containerVoor: "bevat" },
  type: { id: "type", containerVoor: "bevat" },
  element: { id: "element" },
  notitie: { id: "notitie" },
  bevat: { id: "bevat", isConnector: true, bron: { elementTypes: ["schema", "type"] }, doel: { elementTypes: ["type", "element"] } },
  gebruikt: { id: "gebruikt", isConnector: true, bron: { elementTypes: ["type"] }, doel: { elementTypes: ["element"] } },
};

function store(elements) {
  const s = {
    elements: { ...elements },
    addElement: (el) => { s.elements = { ...s.elements, [el.id]: el }; },
    deleteElement: (id) => { const { [id]: _weg, ...rest } = s.elements; s.elements = rest; },
  };
  return { getState: () => s };
}

const basis = () => ({
  S: { id: "S", elementType: "schema" },
  T1: { id: "T1", elementType: "type" },
  T2: { id: "T2", elementType: "type" },
  E: { id: "E", elementType: "element" },
  N: { id: "N", elementType: "notitie" },
});

test("erin hangen legt één lidmaatschap; omhangen verhuist het; losmaken haalt het weg", () => {
  const st = store(basis());
  assert.equal(hangOmNaarContainer(st, typen, "E", "T1").ok, true);
  assert.deepEqual(lidmaatschappenVan(st.getState().elements, typen, "E").map((c) => c.source), ["T1"]);
  assert.equal(hangOmNaarContainer(st, typen, "E", "T2").ok, true);
  assert.deepEqual(lidmaatschappenVan(st.getState().elements, typen, "E").map((c) => c.source), ["T2"], "hooguit één container");
  assert.equal(hangOmNaarContainer(st, typen, "E", null).ok, true);
  assert.deepEqual(lidmaatschappenVan(st.getState().elements, typen, "E"), []);
});

test("weigert: geen container voor dit type, zichzelf, en een kring", () => {
  const st = store(basis());
  assert.equal(waaromNietInContainer(st.getState().elements, typen, "N", "T1"), "geen-container");
  assert.equal(hangOmNaarContainer(st, typen, "T1", "T1").reden, "zichzelf");
  hangOmNaarContainer(st, typen, "T2", "T1");
  assert.equal(hangOmNaarContainer(st, typen, "T1", "T2").reden, "kring");
  assert.equal(lidConnectorVoor(typen, st.getState().elements.S, { elementType: "type" })?.id, "bevat");
});

test("een gewone relatie (geen lidmaatschap) blijft staan bij omhangen", () => {
  const st = store({ ...basis(), g: { id: "g", elementType: "gebruikt", source: "T1", target: "E" } });
  hangOmNaarContainer(st, typen, "E", "T2");
  assert.ok(st.getState().elements.g, "de gebruikt-relatie blijft");
});

// ── Onder een ouder in de boom: lidmaatschap óf insluitende relatie (06-11) ─────────────

const cuml = {
  entiteit: { id: "entiteit" },
  gegevenselement: { id: "gegevenselement" },
  package: { id: "package", containerVoor: "bevat" },
  compositie: { id: "compositie", isConnector: true, aard: "insluiting", bron: { elementTypes: ["entiteit"] }, doel: { elementTypes: ["gegevenselement"] } },
  bevat: { id: "bevat", isConnector: true, bron: { elementTypes: ["package"] }, doel: { elementTypes: ["entiteit"] } },
  ref: { id: "ref", isConnector: true, bron: { elementTypes: ["entiteit"] }, doel: { elementTypes: ["gegevenselement"] } },
};
const HIER = ["bevat", "compositie"];

test("hangOmOnder: een GE ín een entiteit is een compositie (aard insluiting); omhangen verhuist hem", () => {
  const st = store({ E1: { id: "E1", elementType: "entiteit" }, E2: { id: "E2", elementType: "entiteit" }, G: { id: "G", elementType: "gegevenselement" } });
  assert.equal(boomRelatieVoor(cuml, HIER, st.getState().elements.E1, "gegevenselement")?.id, "compositie");
  const uit = hangOmOnder(st, cuml, HIER, "G", "E1");
  assert.equal(uit.ok, true);
  assert.equal(st.getState().elements[uit.connectorId].elementType, "compositie");
  hangOmOnder(st, cuml, HIER, "G", "E2");
  assert.deepEqual(boomRelatiesVan(st.getState().elements, cuml, HIER, "G").map((c) => c.source), ["E2"], "een deel hoort bij één geheel");
  hangOmOnder(st, cuml, HIER, "G", null);
  assert.deepEqual(boomRelatiesVan(st.getState().elements, cuml, HIER, "G"), []);
});

test("hangOmOnder: een hiërarchie zonder aard insluiting (OAS ref, GraphQL veldtype) doet niet mee", () => {
  const st = store({ E: { id: "E", elementType: "entiteit" }, G: { id: "G", elementType: "gegevenselement" } });
  assert.equal(boomRelatieVoor(cuml, ["ref"], st.getState().elements.E, "gegevenselement"), null);
  assert.equal(hangOmOnder(st, cuml, ["ref"], "G", "E").reden, "geen-container");
  // Ook niet als de relatie er al is: een ref is geen boomrelatie, dus losmaken laat hem staan.
  const met = store({ ...st.getState().elements, r: { id: "r", elementType: "ref", source: "E", target: "G" } });
  hangOmOnder(met, cuml, ["ref"], "G", null);
  assert.ok(met.getState().elements.r);
});

test("hangOmOnder roept de hook naVerbinden van het connectortype aan (bv. standaard-kardinaliteit)", () => {
  const met = { ...cuml, compositie: { ...cuml.compositie, hooks: { naVerbinden: (conn, { s }) => s.updateElement(conn.id, { data: { kardinaliteit: "0..*" } }) } } };
  const basisStore = store({ E: { id: "E", elementType: "entiteit" }, G: { id: "G", elementType: "gegevenselement" } });
  const s = basisStore.getState();
  s.updateElement = (id, patch) => { s.elements = { ...s.elements, [id]: { ...s.elements[id], data: { ...s.elements[id].data, ...patch.data } } }; };
  const uit = hangOmOnder(basisStore, met, HIER, "G", "E");
  assert.equal(basisStore.getState().elements[uit.connectorId].data.kardinaliteit, "0..*");
});
