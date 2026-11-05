// Studio — één tekenaar, pariteit (regressie 2026-11-05, opruimstap van plan "2026-11-04 Eén
// tekenaar"). Het canvas, documenten, gedeelde plaatjes en de render-API tekenen met dezelfde
// tekenaar. Deze reeks bewaakt dat dat zo blijft:
//
//   1. élk plaatsbaar elementtype van élk geregistreerd profiel tekent op het canvas via de
//      tekenaar (een ShapeType, geen terugval), op precies de maat die de tekenaar zelf meet;
//   2. de lijnen op het canvas hebben hetzelfde pad als de tekenaar geeft voor documenten en de
//      server (lijnvormen, knikken, vaste handles, zelf-lus, punt-nodes, sequence-berichten);
//   3. de activaties van een sequence zijn op het canvas dezelfde als in de tekenaar, en een
//      zelf-aanroep valt binnen de aanroep;
//   4. de vormvoorbeelden buiten het canvas (Studio-instellingen) tekenen met de tekenaar,
//      ook de eigen vormen.
//
// Een nieuw profiel of elementtype doet vanzelf mee (1); wie ConnectorEdge of tekenaar/lijnen.js
// aanpast zonder de ander, ziet het hier (2).
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inStore, wachtOpNode } from "./helpers/studio.js";

test.use({ viewport: { width: 1600, height: 1000 } });

/** Wat de tekenaar (documenten/server) van dit diagram maakt: maat per voorkomen, pad per lijn, activaties. */
async function tekenaarVan(page, profielId, diagramId) {
  return page.evaluate(
    async ({ profielId, diagramId }) => {
      const base = location.origin + "/viz/react/src/";
      const reg = await import(base + "studio/profieltypeRegistry.js");
      const { getDiagramType } = await import(base + "diagramcore/types/typeRegistry.js");
      const { bouwVoorkomen, basisVanPalet } = await import(base + "diagramcore/tekenaar/voorkomen.js");
      const { vormVoor } = await import(base + "diagramcore/tekenaar/vormen.js");
      const { tekenDiagram } = await import(base + "diagramcore/tekenaar/index.js");
      const { maakPalet } = await import(base + "diagramsvg/thema.js");
      const p = reg.getProfieltype(profielId);
      const dt = getDiagramType(p.descriptor.id) || p.descriptor;
      const st = p.useStore.getState();
      const diagram = st.diagrams[diagramId];
      const perId = (lijst) => Object.fromEntries((lijst || []).map((x) => [x.id, x]));
      const typen = perId(dt.elementTypes);
      const basis = basisVanPalet(maakPalet("light"));
      const maten = {};
      for (const n of diagram.nodes) {
        const element = st.elements[n.elementId];
        const et = typen[element.elementType];
        const info = vormVoor(et.shape, et);
        const box = bouwVoorkomen({ element, elementType: et, shapeType: info.shapeType, renderer: info.renderer, ref: n, diagram, elements: st.elements, fieldTypesById: perId(dt.fieldTypes), compartmentTypesById: perId(dt.compartmentTypes), basis, idPrefix: "t" });
        maten[n.elementId] = { w: box.w, h: box.h, terugval: info.terugval, shape: et.shape };
      }
      const paden = {};
      const activaties = {};
      const labels = {};
      const uit = tekenDiagram({ diagram, elements: st.elements, descriptor: dt, thema: "light" });
      (function loop(k, elementId) {
        if (!k || typeof k !== "object") return;
        const id = k.attrs?.["data-element-id"] || elementId;
        if (k.tag === "path" && k.attrs?.class === "dc-lijn") paden[k.attrs["data-connector-id"]] = k.attrs.d;
        // Een label: het midden van de chip ligt 3,5 boven de basislijn van de tekst.
        if (k.tag === "text" && k.attrs?.["data-dc-label"]) (labels[k.attrs["data-dc-label"]] = labels[k.attrs["data-dc-label"]] || []).push({ tekst: k.kinderen.join(""), x: k.attrs.x, y: k.attrs.y - 3.5 });
        if (k.attrs?.class === "dc-seq-activatie") (activaties[id] = activaties[id] || []).push([Math.round(k.attrs.y), Math.round(k.attrs.height), Number(k.attrs["data-diepte"])]);
        (k.kinderen || []).forEach((kind) => loop(kind, id));
      })(uit.boom, null);
      return { maten, paden, activaties, labels, terugval: uit.terugval };
    },
    { profielId, diagramId }
  );
}

/** Wat het canvas tekent: per node de route en de maat, per lijn het pad, per levenslijn de activaties. */
async function canvasVan(page, ids) {
  return page.evaluate((ids) => {
    const nodes = {};
    const activaties = {};
    for (const id of ids) {
      const n = document.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"]`);
      if (!n) continue;
      const sj = n.querySelector(".dc-sjabloon");
      const r = n.getBoundingClientRect();
      nodes[id] = { sjabloon: !!sj, shape: sj?.getAttribute("data-shape") || null, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 };
      const balken = [...n.querySelectorAll("rect.dc-seq-activatie")].map((b) => [Math.round(+b.getAttribute("y")), Math.round(+b.getAttribute("height")), Number(b.dataset.diepte)]);
      if (balken.length) activaties[id] = balken;
    }
    const paden = {};
    for (const e of document.querySelectorAll(".react-flow__edge")) {
      const id = (e.getAttribute("data-id") || "").replace(/^conn:/, "");
      paden[id] = e.querySelector("path.react-flow__edge-path")?.getAttribute("d") || null;
    }
    // Labels staan los van de lijnen in de DOM (EdgeLabelRenderer), gekoppeld via data-edge-id;
    // hun midden staat in de tweede translate van de transform.
    const labels = {};
    for (const l of document.querySelectorAll(".react-flow__edgelabel-renderer [data-edge-id]")) {
      const m = /translate\(-50%,\s*-50%\)\s*translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(l.style.transform || "");
      if (!m) continue;
      const id = l.getAttribute("data-edge-id").replace(/^conn:/, "");
      (labels[id] = labels[id] || []).push({ tekst: l.textContent, x: Number(m[1]), y: Number(m[2]) });
    }
    return { nodes, paden, activaties, labels };
  }, ids);
}

const getallen = (d) => (String(d || "").match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
const letters = (d) => String(d || "").replace(/[^MLQCZ]/g, "");

/** Twee paden zijn gelijk als de opdrachten gelijk zijn en elk getal op een halve pixel na. */
function verwachtGelijkPad(canvas, tekenaar, wat) {
  expect(tekenaar, `${wat}: de tekenaar tekent deze lijn`).toBeTruthy();
  expect(letters(canvas), `${wat}: zelfde padopdrachten\n canvas   ${canvas}\n tekenaar ${tekenaar}`).toBe(letters(tekenaar));
  const a = getallen(canvas);
  const b = getallen(tekenaar);
  expect(a.length, wat).toBe(b.length);
  const grootste = Math.max(0, ...a.map((x, i) => Math.abs(x - b[i])));
  expect(grootste, `${wat}: zelfde coördinaten\n canvas   ${canvas}\n tekenaar ${tekenaar}`).toBeLessThanOrEqual(0.5);
}

test("elk elementtype van elk profiel tekent via de tekenaar, op de maat die de tekenaar meet", async ({ page }) => {
  test.setTimeout(300_000);
  const fouten = [];
  page.on("pageerror", (e) => fouten.push(String(e.message)));
  await openStudio(page);
  // De profieltypen registreren zich bij het opstarten; wacht tot de lijst stabiel is.
  const profielen = await page.evaluate(async () => {
    const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    let vorig = -1;
    for (let i = 0; i < 80; i++) {
      const n = reg.getProfieltypen().length;
      if (n === vorig && n > 5) break;
      vorig = n;
      await new Promise((r) => setTimeout(r, 250));
    }
    return reg
      .getProfieltypen()
      .filter((p) => p.useStore && p.descriptor?.elementTypes?.length && p.useStore.getState().addDiagram)
      .map((p) => ({
        id: p.id,
        typen: p.descriptor.elementTypes.filter((t) => !t.isConnector && !t.isAbstract && !t.randElement && t.id !== "__anker").map((t) => ({ id: t.id, label: t.label || t.id })),
      }));
  });
  expect(profielen.length, "de ingebouwde profielen").toBeGreaterThanOrEqual(20);

  let vormen = 0;
  for (const p of profielen) {
    if (!p.typen.length) continue;
    const did = "d_pariteit";
    // Unieke id's per profiel: het canvas van een vorig profiel kan nog in de DOM staan.
    const ids = p.typen.map((_, i) => `${p.id}__e${i}`);
    await zetModel(page, {
      profielId: p.id,
      diagramId: did,
      diagramNaam: "Pariteit",
      elementen: p.typen.map((t, i) => ({ id: ids[i], naam: t.label, type: t.id, pos: { x: 120 + (i % 6) * 300, y: 120 + Math.floor(i / 6) * 200 } })),
    });
    await wachtOpNode(page, ids[ids.length - 1]);
    const canvas = await canvasVan(page, ids);
    const tekenaar = await tekenaarVan(page, p.id, did);
    expect(Object.keys(canvas.nodes).length, `${p.id}: elk elementtype staat op het canvas`).toBe(ids.length);
    expect(tekenaar.terugval, `${p.id}: geen vorm op de terugval (elk shape-id heeft een ShapeType)`).toEqual([]);
    for (const [i, id] of ids.entries()) {
      const wat = `${p.id} / ${p.typen[i].id} (${tekenaar.maten[id].shape})`;
      expect(canvas.nodes[id].sjabloon, `${wat}: getekend door de tekenaar`).toBe(true);
      expect(Math.abs(canvas.nodes[id].w - tekenaar.maten[id].w), `${wat}: breedte canvas ${canvas.nodes[id].w} = tekenaar ${tekenaar.maten[id].w}`).toBeLessThanOrEqual(1);
      expect(Math.abs(canvas.nodes[id].h - tekenaar.maten[id].h), `${wat}: hoogte canvas ${canvas.nodes[id].h} = tekenaar ${tekenaar.maten[id].h}`).toBeLessThanOrEqual(1);
      vormen += 1;
    }
  }
  expect(vormen, "het aantal gecontroleerde vormen").toBeGreaterThan(250);
  expect(fouten, "geen paginafouten").toEqual([]);
});

test("lijnen: het canvas en de tekenaar geven hetzelfde pad (vormen, knikken, handles, lus, punt-nodes)", async ({ page }) => {
  await openStudio(page);
  // UML: dezelfde schuine ligging in vier lijnvormen, een omweg, vaste handles, twee lussen,
  // een generalisatie en een notitielijn.
  const klasse = (id, x, y) => ({ id, naam: id, type: "klasse", pos: { x, y } });
  await zetModel(page, {
    profielId: "puurUml05",
    diagramId: "d_lijn",
    elementen: [
      klasse("a1", 120, 100), klasse("b1", 300, 240), klasse("a2", 460, 100), klasse("b2", 640, 240),
      klasse("a3", 800, 100), klasse("b3", 980, 240), klasse("a4", 1140, 100), klasse("b4", 1320, 240),
      klasse("c1", 120, 440), klasse("d1", 520, 440), klasse("c2", 800, 420), klasse("d2", 1040, 560),
      klasse("e1", 120, 760), klasse("e2", 400, 760), klasse("f1", 760, 720), klasse("f2", 960, 840),
      { id: "n1", naam: "notitie", type: "notitie", pos: { x: 1200, y: 740 } },
      { id: "v1", naam: "bezier", type: "associatie", source: "a1", target: "b1" },
      { id: "v2", naam: "recht", type: "associatie", source: "a2", target: "b2" },
      { id: "v3", naam: "hoekig", type: "associatie", source: "a3", target: "b3" },
      { id: "v4", naam: "boom", type: "associatie", source: "a4", target: "b4" },
      { id: "k1", naam: "omweg", type: "associatie", source: "c1", target: "d1" },
      { id: "k2", naam: "handles", type: "associatie", source: "c2", target: "d2" },
      { id: "l1", naam: "zelf", type: "associatie", source: "e1", target: "e1" },
      { id: "l2", naam: "zelf", type: "associatie", source: "e2", target: "e2" },
      { id: "g1", naam: "", type: "generalisatie", source: "f2", target: "f1" },
      { id: "nl", naam: "", type: "notitielijn", source: "n1", target: "f1" },
    ],
  });
  await inStore(page, "puurUml05", `
    const s = store.getState();
    s.zetLijn("d_lijn", "v1", { vorm: "bezier" }); s.zetLijn("d_lijn", "v2", { vorm: "recht" });
    s.zetLijn("d_lijn", "v3", { vorm: "hoekig" }); s.zetLijn("d_lijn", "v4", { vorm: "boom" });
    s.zetLijn("d_lijn", "k1", { knikken: [{ x: 180, y: 620 }, { x: 600, y: 620 }] });
    s.zetLijn("d_lijn", "k2", { vorm: "hoekig", sourceHandle: "source-bottom", targetHandle: "target-top" });
    s.zetLijn("d_lijn", "l2", { vorm: "bezier" });`);
  await wachtOpNode(page, "n1");
  await page.waitForTimeout(600);
  let canvas = await canvasVan(page, []);
  let tekenaar = await tekenaarVan(page, "puurUml05", "d_lijn");
  for (const id of ["v1", "v2", "v3", "v4", "k1", "k2", "l1", "l2", "g1", "nl"]) verwachtGelijkPad(canvas.paden[id], tekenaar.paden[id], `uml ${id}`);
  // De vier lijnvormen zijn ook echt vier verschillende paden.
  expect(letters(canvas.paden.v1)).toBe("MC");
  expect(letters(canvas.paden.v2)).toBe("ML");
  expect(letters(canvas.paden.v3)).toContain("Q");
  expect(letters(canvas.paden.k1)).toBe("MLLL");

  // State machine: punt-nodes (begin, keuze, eind) hebben hun handles buiten de vorm.
  await zetModel(page, {
    profielId: "statemachine05",
    diagramId: "d_sm",
    elementen: [
      { id: "sb", naam: "", type: "begin", pos: { x: 200, y: 300 } },
      { id: "st1", naam: "Open", type: "toestand", pos: { x: 300, y: 290 } },
      { id: "sk", naam: "", type: "keuze", pos: { x: 560, y: 420 } },
      { id: "st2", naam: "Dicht", type: "toestand", pos: { x: 700, y: 290 } },
      { id: "se", naam: "", type: "eind", pos: { x: 960, y: 300 } },
      { id: "sr1", naam: "", type: "transitie", source: "sb", target: "st1" },
      { id: "sr2", naam: "sluit", type: "transitie", source: "st1", target: "sk" },
      { id: "sr3", naam: "", type: "transitie", source: "sk", target: "st2" },
      { id: "sr4", naam: "", type: "transitie", source: "st2", target: "se" },
    ],
  });
  await wachtOpNode(page, "se");
  await page.waitForTimeout(600);
  canvas = await canvasVan(page, []);
  tekenaar = await tekenaarVan(page, "statemachine05", "d_sm");
  for (const id of ["sr1", "sr2", "sr3", "sr4"]) verwachtGelijkPad(canvas.paden[id], tekenaar.paden[id], `state machine ${id}`);
});

test("labels: zelfde plaats op canvas en in de tekenaar; conditie en naam op een BPMN-stroom staan onder elkaar", async ({ page }) => {
  await openStudio(page);
  // Een gateway met twee uitgaande stromen die elk een conditie én een naam dragen: twee
  // labels op dezelfde zijde. Die stapelen (18 px), ze vallen niet op elkaar (render 0.3.0 deed
  // dat in de tekenaar wel: gemeld op de eerste echte invoer, GPK "Aanvraag oppakken").
  await zetModel(page, {
    profielId: "bpmnMotor05",
    diagramId: "d_label",
    elementen: [
      { id: "lg", naam: "Ontvankelijk?", type: "exclusief", pos: { x: 300, y: 300 } },
      { id: "lt1", naam: "Zaak aanmaken", type: "taak", pos: { x: 620, y: 282 } },
      { id: "lt2", naam: "Afwijzen", type: "taak", pos: { x: 620, y: 480 } },
      { id: "lf1", naam: "ja", type: "sequence-flow", source: "lg", target: "lt1", data: { conditie: "${toets.ontvankelijk}" } },
      { id: "lf2", naam: "nee", type: "sequence-flow", source: "lg", target: "lt2", data: { conditie: "${!toets.ontvankelijk}" } },
    ],
  });
  await wachtOpNode(page, "lt2");
  await page.waitForTimeout(600);
  const canvas = await canvasVan(page, []);
  const tekenaar = await tekenaarVan(page, "bpmnMotor05", "d_label");
  const opVolgorde = (lijst) => [...(lijst || [])].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const id of ["lf1", "lf2"]) {
    const c = opVolgorde(canvas.labels[id]);
    const t = opVolgorde(tekenaar.labels[id]);
    expect(c.length, `${id}: conditie en naam op het canvas`).toBe(2);
    expect(t.length, `${id}: conditie en naam in de tekenaar`).toBe(2);
    for (const [i, label] of c.entries()) {
      expect(Math.abs(label.x - t[i].x), `${id} label ${i}: x canvas ${label.x} = tekenaar ${t[i].x}`).toBeLessThanOrEqual(0.5);
      expect(Math.abs(label.y - t[i].y), `${id} label ${i}: y canvas ${label.y} = tekenaar ${t[i].y}`).toBeLessThanOrEqual(0.5);
    }
    expect(t[1].y - t[0].y, `${id}: de twee labels staan 18 px onder elkaar`).toBeCloseTo(18, 5);
    expect(t.map((l) => l.tekst).sort(), `${id}: beide teksten`).toEqual(c.map((l) => l.tekst).sort());
  }
});

test("sequence: berichtlijnen en afgeleide activaties gelijk; een zelf-aanroep valt binnen de aanroep", async ({ page }) => {
  await openStudio(page);
  const lijn = (id, x, data = {}) => ({ id, naam: id, type: "levenslijn", data, pos: { x, y: 200 } });
  const punt = (id, lijnId) => ({ id, naam: "", type: "punt", data: { randVan: lijnId } });
  await zetModel(page, {
    profielId: "sequence05",
    diagramId: "d_seq",
    elementen: [
      lijn("A", 300, { kop: "actor" }), lijn("B", 560), lijn("C", 820),
      punt("p1", "A"), punt("p2", "B"), punt("p3", "B"), punt("p4", "B"), punt("p5", "B"), punt("p6", "C"), punt("p7", "C"), punt("p8", "B"), punt("p9", "B"), punt("p10", "A"),
      { id: "m1", naam: "vraag", type: "synchroon", source: "p1", target: "p2" },
      { id: "m2", naam: "valideer", type: "synchroon", source: "p3", target: "p4" },
      { id: "m3", naam: "bewaar", type: "synchroon", source: "p5", target: "p6" },
      { id: "m4", naam: "", type: "retour", source: "p7", target: "p8" },
      { id: "m5", naam: "", type: "retour", source: "p9", target: "p10" },
    ],
  });
  // De punten staan als rand-element op hun levenslijn (positie relatief aan de lijn).
  await inStore(page, "sequence05", `
    const s = store.getState();
    const y = { p1: 130, p2: 130, p3: 180, p4: 195, p5: 250, p6: 250, p7: 300, p8: 300, p9: 360, p10: 360 };
    for (const [id, hoogte] of Object.entries(y)) s.addElementToDiagram("d_seq", id, { x: 1, y: hoogte });`);
  await wachtOpNode(page, "p10");
  await page.waitForTimeout(700);
  const canvas = await canvasVan(page, ["A", "B", "C"]);
  const tekenaar = await tekenaarVan(page, "sequence05", "d_seq");
  for (const id of ["m1", "m2", "m3", "m4", "m5"]) verwachtGelijkPad(canvas.paden[id], tekenaar.paden[id], `sequence ${id}`);
  // De levenslijn tekent via de tekenaar (geen eigen React-component meer) en blijft 14 breed.
  expect(canvas.nodes.B).toMatchObject({ sjabloon: true, shape: "seq-levenslijn", w: 14 });
  // Activaties: canvas = tekenaar, per levenslijn.
  const gesorteerd = (lijst) => [...(lijst || [])].sort((a, b) => a[2] - b[2] || a[0] - b[0]);
  for (const id of ["A", "B", "C"]) expect(gesorteerd(canvas.activaties[id]), `activaties van ${id}`).toEqual(gesorteerd(tekenaar.activaties[id]));
  // B: de aanroep loopt van "vraag" (130) tot haar retour (360); de zelf-aanroep "valideer" is
  // een korte balk erbinnen, één niveau dieper — ook al volgen er nog berichten op.
  const [buitenste, rugzak] = gesorteerd(canvas.activaties.B);
  expect(buitenste[2]).toBe(0);
  expect(rugzak[2]).toBe(1);
  expect(buitenste[0] + buitenste[1], "de buitenste balk loopt door tot de retour").toBeGreaterThan(rugzak[0] + rugzak[1] + 100);
  expect(rugzak[0], "de rugzak begint binnen de buitenste").toBeGreaterThan(buitenste[0]);
  expect(rugzak[1], "de rugzak is kort").toBeLessThan(30);
});

test("vormvoorbeelden buiten het canvas tekenen met de tekenaar, ook de eigen vormen", async ({ page }) => {
  const fouten = [];
  page.on("pageerror", (e) => fouten.push(String(e.message)));
  await openStudio(page);
  await page.locator('[title*="Studio-instellingen"], [aria-label*="Studio-instellingen"]').first().click();
  await expect(page.getByTestId("voorkeur-op-raster")).toBeVisible();
  await expect(page.locator("svg.dc-vormvoorbeeld").first()).toBeVisible();
  await page.waitForTimeout(800);
  const voorbeelden = await page.locator("svg.dc-vormvoorbeeld").evaluateAll((els) => els.map((e) => ({ shape: e.getAttribute("data-shape"), getekend: e.querySelectorAll(".dc-omtrek *").length > 0 })));
  expect(voorbeelden.length, "de galerij toont alle vormen").toBeGreaterThan(90);
  expect(voorbeelden.filter((v) => !v.getekend).map((v) => v.shape), "elk voorbeeld heeft een omtrek").toEqual([]);
  // De meegeleverde eigen vormen (web/vite/vormen/*.json) en een paar ingebouwde.
  const ids = voorbeelden.map((v) => v.shape);
  for (const id of ["ster", "zeshoek", "pijl-naar-rechts", "class-box", "seq-levenslijn", "bpmn-taak", "tr-regelkaart", "diagramverwijzing"]) expect(ids, id).toContain(id);
  // De ster is een silhouet (een pad in een geschaalde groep), geen doos.
  await expect(page.locator('svg.dc-vormvoorbeeld[data-shape="ster"] .dc-omtrek path').first()).toBeAttached();
  expect(fouten).toEqual([]);
});
