// Studio — wensen van Mark (06-11) bij de projectboom en het canvas:
//   - elementen kopiëren uit een diagram en plakken op een ander (Ctrl+C / Ctrl+V, "werkte in de IDE");
//   - ook kinderen (GE onder ENT) Ctrl-selecteren, en Ctrl-slepen = mét kinderen op een diagram;
//   - een diagram onder een package hangen (M3 uitwerking), zoals onder een UC-realisatie.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inModelleren, inStore, node } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const opDiagram = (page, dId) => inStore(page, "diagram05", `return (store.getState().diagrams["${dId}"]?.nodes || []).map((n) => n.elementId).sort();`);

test("Ctrl+C / Ctrl+V: elementen naar een ander diagram, als verwijzing", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "diagram05", diagramId: "d_bron", diagramNaam: "Bron", elementen: [
    { id: "p", naam: "Persoon", type: "entiteit", pos: { x: 300, y: 460 } },
    { id: "a", naam: "Adres", type: "entiteit", pos: { x: 600, y: 460 } },
  ] });
  await zetModel(page, { profielId: "diagram05", diagramId: "d_doel", diagramNaam: "Doel", elementen: [] });
  await inModelleren(page, 'ms.getState().activeer("diagram05::d_bron");');
  await expect(node(page, "p")).toBeVisible();
  await node(page, "p").click({ position: { x: 30, y: 10 } });
  await node(page, "a").click({ position: { x: 30, y: 10 }, modifiers: ["Control"] });
  await page.keyboard.press("Control+c");
  await inModelleren(page, 'ms.getState().activeer("diagram05::d_doel");');
  await page.locator(".react-flow__pane").first().click({ position: { x: 500, y: 600 }, force: true });
  await page.keyboard.press("Control+v");
  await expect.poll(() => opDiagram(page, "d_doel")).toEqual(["a", "p"]);
  // Verwijzing, geen kopie: het model heeft nog steeds twee entiteiten.
  expect(await inStore(page, "diagram05", 'return Object.values(store.getState().elements).filter((e) => e.elementType === "entiteit").length;')).toBe(2);
  // Nog eens plakken: alles staat er al.
  await page.keyboard.press("Control+v");
  await expect.poll(() => opDiagram(page, "d_doel")).toEqual(["a", "p"]);
});

test("kinderen Ctrl-selecteren in de boom, en Ctrl-slepen zet een entiteit mét GE's op een diagram", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "diagram05", diagramId: "d_leeg", diagramNaam: "Leeg", elementen: [
    { id: "ent", naam: "Persoon", type: "entiteit" },
    { id: "ge1", naam: "Naam", type: "gegevenselement" },
    { id: "ge2", naam: "Geboorte", type: "gegevenselement" },
    { id: "c1", type: "compositie", source: "ent", target: "ge1" },
    { id: "c2", type: "compositie", source: "ent", target: "ge2" },
  ] });
  await inModelleren(page, 'const m = ms.getState().nieuweMap("Model"); ms.getState().plaatsMeerdere(["el::diagram05::ent"], m); ms.getState().zetBoomUitklap("el::diagram05::ent");');
  const kind = (id) => page.getByTestId(`boom-el-${id}`).locator("button.studio-project__element");
  await expect(kind("ge1")).toBeVisible();
  // Kinderen zijn Ctrl-selecteerbaar.
  await kind("ge1").click({ modifiers: ["Control"] });
  await kind("ge2").click({ modifiers: ["Control"] });
  expect(await inModelleren(page, "return ms.getState().multiSelectie;")).toEqual(["el::diagram05::ge1", "el::diagram05::ge2"]);
  await inModelleren(page, "ms.getState().wisMulti();");

  // Ctrl-slepen van de entiteit naar het canvas: entiteit + beide GE's.
  await page.keyboard.down("Control");
  await kind("ent").dragTo(page.locator(".react-flow__pane").first(), { targetPosition: { x: 400, y: 550 }, force: true });
  await page.keyboard.up("Control");
  await expect.poll(() => opDiagram(page, "d_leeg")).toEqual(["ent", "ge1", "ge2"]);
});

test("een diagram onder een package hangen (uitwerking), in het canonieke model", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "diagram05", diagramId: "d_pkg", diagramNaam: "Overzicht", elementen: [{ id: "pkg", naam: "Personen", type: "package" }] });
  await inModelleren(page, 'const m = ms.getState().nieuweMap("Model"); ms.getState().plaatsMeerdere(["el::diagram05::pkg", "diagram05::d_pkg"], m);');
  const diagramRij = page.locator('[data-boomsleutel="diag:diagram05::d_pkg"]');
  await expect(diagramRij).toBeVisible();
  await diagramRij.dragTo(page.getByTestId("boom-el-pkg"));
  await expect.poll(() => inModelleren(page, 'return ms.getState().plaatsing["diagram05::d_pkg"];')).toBe("el::diagram05::pkg");
});

// Mark, 06-11: kopiëren/plakken ook via rechtsklik, en "harde kopie" met Ctrl+Shift+V (na een vraag).
test("rechtsklik Kopiëren / Plakken, en Plakken als kopie dupliceert met de verbindingen ertussen", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "diagram05", diagramId: "d_b2", diagramNaam: "Bron", elementen: [
    { id: "p2", naam: "Persoon", type: "entiteit", pos: { x: 300, y: 460 }, data: { uuid: "u-p2" } },
    { id: "g2", naam: "Naam", type: "gegevenselement", pos: { x: 600, y: 460 } },
    { id: "c2", type: "compositie", source: "p2", target: "g2" },
  ] });
  await zetModel(page, { profielId: "diagram05", diagramId: "d_d2", diagramNaam: "Doel", elementen: [] });
  const doelMap = await inModelleren(page, 'const m = ms.getState().nieuweMap("Doelmap"); ms.getState().plaatsDiagram("diagram05::d_d2", m); return m;');
  await inModelleren(page, 'ms.getState().activeer("diagram05::d_b2");');
  await expect(node(page, "p2")).toBeVisible();
  await node(page, "p2").click({ position: { x: 30, y: 10 } });
  await node(page, "g2").click({ position: { x: 30, y: 10 }, modifiers: ["Control"] });
  // Rechtsklik op een element in de selectie: Kopiëren (2).
  await node(page, "p2").click({ button: "right", position: { x: 30, y: 10 } });
  await page.locator(".dc-contextmenu-item", { hasText: "Kopiëren (2)" }).click();

  // Op het doel: rechtsklik op het canvas → Plakken (2).
  await inModelleren(page, 'ms.getState().activeer("diagram05::d_d2");');
  const pane = page.locator(".react-flow__pane").first();
  await pane.click({ button: "right", position: { x: 500, y: 600 }, force: true });
  await page.locator(".dc-contextmenu-item", { hasText: "Plakken (2)" }).click();
  await expect.poll(() => opDiagram(page, "d_d2")).toEqual(["g2", "p2"]);

  // Ctrl+Shift+V: de vraag, en dan nieuwe elementen met "(kopie)", zonder uuid, met de compositie ertussen.
  await pane.click({ position: { x: 500, y: 600 }, force: true });
  await page.keyboard.press("Control+Shift+v");
  const dlg = page.locator(".studio-dialoog");
  await expect(dlg).toContainText("dupliceren");
  await dlg.getByRole("button", { name: "Dupliceer" }).click();
  const kopieen = () => inStore(page, "diagram05", 'return Object.values(store.getState().elements).filter((e) => (e.naam || "").endsWith("(kopie)")).map((e) => [e.naam, e.data?.uuid || null]).sort();');
  await expect.poll(kopieen).toEqual([["Naam (kopie)", null], ["Persoon (kopie)", null]]);
  const verbonden = await inStore(page, "diagram05", `
    const els = store.getState().elements;
    const p = Object.values(els).find((e) => e.naam === "Persoon (kopie)").id;
    const g = Object.values(els).find((e) => e.naam === "Naam (kopie)").id;
    return Object.values(els).filter((c) => c.elementType === "compositie" && c.source === p && c.target === g).length;`);
  expect(verbonden).toBe(1);
  expect((await opDiagram(page, "d_d2")).length).toBe(4);
  // De kopieën landen in de map van het diagram waarop je plakt (boomregel BOOM-1).
  const pk = await inStore(page, "diagram05", 'return Object.values(store.getState().elements).find((e) => e.naam === "Persoon (kopie)").id;');
  await expect.poll(() => inModelleren(page, `return ms.getState().plaatsing["el::diagram05::${pk}"] || null;`)).toBe(doelMap);
  // Eén Ctrl+Z neemt de hele kopie terug.
  await inStore(page, "diagram05", "store.temporal.getState().undo();");
  await expect.poll(kopieen).toEqual([]);
});

// Mark, 06-11: "Dupliceren werkt niet: dat wordt een puinhoop met alles in dezelfde map. Dan wil
// je kopieer diagram en elders plak diagram, met: elementen niet dupliceren / elementen kopiëren
// op deze plek."
test("diagram kopiëren in de boom en elders plakken: met dezelfde elementen, of met kopieën op die plek", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "diagram05", diagramId: "d_org", diagramNaam: "Origineel", elementen: [
    { id: "po", naam: "Persoon", type: "entiteit", pos: { x: 300, y: 460 }, data: { uuid: "u-po" } },
    { id: "ao", naam: "Adres", type: "entiteit", pos: { x: 600, y: 460 } },
    { id: "ge", naam: "Naam", type: "gegevenselement" },
    { id: "cg", type: "compositie", source: "po", target: "ge" },
  ] });
  const [bronMap, doelMap] = await inModelleren(page, 'const a = ms.getState().nieuweMap("Bron"); const b = ms.getState().nieuweMap("Doel"); ms.getState().plaatsDiagram("diagram05::d_org", a); ms.getState().plaatsMeerdere(["el::diagram05::po", "el::diagram05::ao"], a); return [a, b];');
  const ctx = page.locator(".studio-ctxmenu");
  await page.locator('[data-boomsleutel="diag:diagram05::d_org"]').click({ button: "right" });
  await ctx.getByRole("button", { name: "Kopieer diagram", exact: true }).click();
  // In de map "Doel": Plak diagram ▸ Elementen niet dupliceren.
  const doelKop = page.locator(`[data-boomsleutel="map:${doelMap}"]`);
  await doelKop.click({ button: "right" });
  await ctx.getByRole("button", { name: /^Plak diagram "Origineel"( ▸)?$/ }).click();
  await ctx.getByRole("button", { name: /Elementen niet dupliceren/ }).click();
  const inDoel = () => inModelleren(page, `return Object.entries(ms.getState().plaatsing).filter(([, o]) => o === "${doelMap}").map(([k]) => k);`);
  await expect.poll(async () => (await inDoel()).filter((k) => k.startsWith("diagram05::")).length).toBe(1);
  const d1 = (await inDoel()).find((k) => k.startsWith("diagram05::")).split("::")[1];
  expect(await inStore(page, "diagram05", `return store.getState().diagrams["${d1}"].nodes.map((n) => n.elementId).sort();`)).toEqual(["ao", "po"]);
  expect(await inStore(page, "diagram05", `return store.getState().diagrams["${d1}"].naam;`)).toBe("Origineel");
  expect(await inStore(page, "diagram05", 'return Object.values(store.getState().elements).filter((e) => e.elementType === "entiteit").length;')).toBe(2);

  // Nog eens, nu met kopieën: nieuwe entiteiten én de GE (kind) met de compositie, in "Doel".
  await doelKop.click({ button: "right" });
  await ctx.getByRole("button", { name: /^Plak diagram "Origineel"( ▸)?$/ }).click();
  await ctx.getByRole("button", { name: /Elementen kopiëren naar deze plek/ }).click();
  await expect.poll(async () => (await inDoel()).filter((k) => k.startsWith("diagram05::")).length).toBe(2);
  const d2 = (await inDoel()).filter((k) => k.startsWith("diagram05::")).map((k) => k.split("::")[1]).find((x) => x !== d1);
  const info = await inStore(page, "diagram05", `
    const s = store.getState();
    const ids = s.diagrams["${d2}"].nodes.map((n) => n.elementId);
    const els = ids.map((i) => s.elements[i]);
    const p = els.find((e) => e.naam === "Persoon");
    const ge = Object.values(s.elements).find((e) => e.naam === "Naam" && e.id !== "ge");
    const comp = ge && Object.values(s.elements).find((c) => c.elementType === "compositie" && c.source === p.id && c.target === ge.id);
    return { origineel: ids.filter((i) => i === "po" || i === "ao").length, namen: els.map((e) => e.naam).sort(), uuid: p.data?.uuid || null, geKopie: !!ge, comp: !!comp,
      entiteiten: Object.values(s.elements).filter((e) => e.elementType === "entiteit").length };`);
  expect(info).toEqual({ origineel: 0, namen: ["Adres", "Persoon"], uuid: null, geKopie: true, comp: true, entiteiten: 4 });
  // De kopieën staan in "Doel", het origineel in "Bron".
  const losInDoel = (await inDoel()).filter((k) => k.startsWith("el::diagram05::"));
  expect(losInDoel.length).toBe(2);
  expect(await inModelleren(page, 'return ms.getState().plaatsing["el::diagram05::po"];')).toBe(bronMap);
});
