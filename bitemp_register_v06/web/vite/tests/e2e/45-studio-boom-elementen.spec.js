// Studio — fase 0 van "Linked data als M2" (§8, akkoord Mark 06-11): elementen maken en nesten in
// de projectboom, zonder diagram. Met XSD: een schema is een container (`containerVoor` "bevat")
// en `bevat` is ook de hiërarchie, dus wat erin hangt staat in de boom onder het schema.
import { test, expect } from "@playwright/test";
import { openStudio, inModelleren } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const menu = (page) => page.locator(".studio-ctxmenu");
const xsd = (page, body) =>
  page.evaluate(async (body) => {
    const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    return new Function("st", body)(reg.getProfieltype("xsd05").useStore.getState());
  }, body);
const idVan = (page, naam) => xsd(page, `return Object.values(st.elements).find((e) => e.naam === ${JSON.stringify(naam)})?.id || null;`);
const containerVan = (page, id) => xsd(page, `return Object.values(st.elements).find((c) => c.elementType === "bevat" && c.target === ${JSON.stringify(id)})?.source || null;`);

async function maakInMenu(page, rij, pad, naam) {
  await rij.click({ button: "right" });
  for (const stap of pad) await menu(page).getByRole("button", { name: new RegExp(`^${stap}( ▸)?$`) }).click();
  const dialoog = page.locator(".studio-dialoog");
  await dialoog.locator("input").fill(naam);
  await dialoog.getByRole("button", { name: "Aanmaken" }).click();
  await expect.poll(() => idVan(page, naam)).not.toBeNull();
  return idVan(page, naam);
}

test("element maken in een map en in een element; slepen hangt het om; naar een map haalt het eruit", async ({ page }) => {
  await openStudio(page);
  const mapId = await inModelleren(page, 'return ms.getState().nieuweMap("Schema\'s");');
  const mapKop = page.locator(`[data-boomsleutel="map:${mapId}"]`);
  await expect(mapKop).toBeVisible();

  // 1. Nieuw element in de map: een schema, zonder diagram.
  const schema = await maakInMenu(page, mapKop, ["Nieuw element", "XML Schema", "Schema"], "Personen");
  expect(await inModelleren(page, `return ms.getState().plaatsing["el::xsd05::${schema}"];`)).toBe(mapId);
  expect(await xsd(page, `return Object.values(st.diagrams).some((d) => (d.nodes || []).some((n) => n.elementId === ${JSON.stringify(schema)}));`)).toBe(false);
  const schemaRij = page.getByTestId(`boom-el-${schema}`);
  await expect(schemaRij).toBeVisible();
  // "Op geen diagram" is geen fout: een rustig teken, geen cursief.
  await expect(schemaRij.getByTestId("geen-diagram")).toHaveCount(1);

  // 2. Nieuw element hierin: een échte bevat-relatie, en het kind staat onder het schema. Eén taal,
  // dus geen taal-laag in het menu (Mark, 06-11: zo kort als het kan).
  const persoon = await maakInMenu(page, schemaRij.locator("button.studio-project__element"), ["Nieuw element hierin", "complexType"], "Persoon");
  expect(await containerVan(page, persoon)).toBe(schema);
  await expect(page.getByTestId(`boom-el-${persoon}`)).toBeVisible();
  expect(await inModelleren(page, `return ms.getState().plaatsing["el::xsd05::${persoon}"] || null;`)).toBeNull();

  // 3. Een los element in de map naar het schema slepen: erin gehangen, eigen plaatsing weg.
  const adres = await maakInMenu(page, mapKop, ["Nieuw element", "XML Schema", "complexType"], "Adres");
  expect(await containerVan(page, adres)).toBeNull();
  await page.getByTestId(`boom-el-${adres}`).locator("button.studio-project__element").dragTo(schemaRij);
  await expect.poll(() => containerVan(page, adres)).toBe(schema);
  expect(await inModelleren(page, `return ms.getState().plaatsing["el::xsd05::${adres}"] || null;`)).toBeNull();

  // 4. Het kind naar de map slepen: de relatie gaat weg, het element staat weer in de map.
  await page.getByTestId(`boom-el-${adres}`).locator("button.studio-project__element").dragTo(mapKop);
  await expect.poll(() => containerVan(page, adres)).toBeNull();
  expect(await inModelleren(page, `return ms.getState().plaatsing["el::xsd05::${adres}"];`)).toBe(mapId);

  // 5. Een kring kan niet: het schema in zijn eigen kind slepen doet niets.
  const persoonRij = page.getByTestId(`boom-el-${persoon}`);
  await schemaRij.locator("button.studio-project__element").dragTo(persoonRij);
  expect(await containerVan(page, schema)).toBeNull();
  expect(await containerVan(page, persoon)).toBe(schema);

  // 6. Later op een diagram in een andere map: de plaatsing in de boom blijft staan (de boomregel
  // raakt alleen niet-ingedeelde elementen), en het teken "op geen diagram" verdwijnt.
  const andereMap = await inModelleren(page, 'return ms.getState().nieuweMap("Diagrammen");');
  await xsd(page, `st.addDiagram({ id: "d_boom", naam: "Schema-diagram", diagramType: "xsd" }); st.addElementToDiagram("d_boom", ${JSON.stringify(schema)}, { x: 100, y: 100 });`);
  await inModelleren(page, `ms.getState().plaatsDiagram("xsd05::d_boom", ${JSON.stringify(andereMap)});`);
  await page.waitForTimeout(300);
  expect(await inModelleren(page, `return ms.getState().plaatsing["el::xsd05::${schema}"];`)).toBe(mapId);
  await expect(schemaRij.getByTestId("geen-diagram")).toHaveCount(0);
});

// Mark, 06-11: "In Entiteit kan dan toch ook een nieuw GE?" — ja: een compositie (M3-aard
// insluiting) telt in de boom als "erin", net als een lidmaatschap.
test("canoniek model: een gegevenselement ín een entiteit maken en omhangen (compositie)", async ({ page }) => {
  await openStudio(page);
  const cm = (body) =>
    page.evaluate(async (body) => {
      const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
      return new Function("st", body)(reg.getProfieltype("diagram05").useStore.getState());
    }, body);
  const idIn = (naam) => cm(`return Object.values(st.elements).find((e) => e.naam === ${JSON.stringify(naam)})?.id || null;`);
  const geheelVan = (id) => cm(`return Object.values(st.elements).find((c) => c.elementType === "compositie" && c.target === ${JSON.stringify(id)})?.source || null;`);
  const maak = async (rij, pad, naam) => {
    await rij.click({ button: "right" });
    for (const stap of pad) await menu(page).getByRole("button", { name: new RegExp(`^${stap}( ▸)?$`) }).click();
    const dialoog = page.locator(".studio-dialoog");
    await dialoog.locator("input").fill(naam);
    await dialoog.getByRole("button", { name: "Aanmaken" }).click();
    await expect.poll(() => idIn(naam)).not.toBeNull();
    return idIn(naam);
  };

  const mapId = await inModelleren(page, 'return ms.getState().nieuweMap("Model");');
  const mapKop = page.locator(`[data-boomsleutel="map:${mapId}"]`);
  const persoon = await maak(mapKop, ["Nieuw element", "Canoniek model", "Entiteit"], "Persoon");
  const adres = await maak(mapKop, ["Nieuw element", "Canoniek model", "Entiteit"], "Adres");
  const persoonRij = page.getByTestId(`boom-el-${persoon}`);

  const naam = await maak(persoonRij.locator("button.studio-project__element"), ["Nieuw gegevenselement hierin"], "Naam");
  expect(await geheelVan(naam)).toBe(persoon);
  await expect(page.getByTestId(`boom-el-${naam}`)).toBeVisible();

  // Een diagram starten met de entiteit en zijn GE (Mark, 06-11): in dezelfde map, als tab open.
  await persoonRij.locator("button.studio-project__element").click({ button: "right" });
  await menu(page).getByRole("button", { name: "Nieuw diagram hiermee (met 1 kind)" }).click();
  const dlg = page.locator(".studio-dialoog");
  await expect(dlg.locator("input")).toHaveValue("Persoon");
  await dlg.getByRole("button", { name: "Aanmaken" }).click();
  await expect.poll(() => cm(`return Object.values(st.diagrams).find((d) => d.naam === "Persoon")?.nodes?.map((n) => n.elementId).sort() || null;`)).toEqual([naam, persoon].sort());
  const diagramId = await cm(`return Object.values(st.diagrams).find((d) => d.naam === "Persoon").id;`);
  expect(await inModelleren(page, `return ms.getState().plaatsing["diagram05::${diagramId}"];`)).toBe(mapId);
  await expect.poll(() => inModelleren(page, "return ms.getState().actieveTab;")).toBe(`diagram05::${diagramId}`);

  // Omhangen naar een andere entiteit: de compositie verhuist (een GE hoort bij één entiteit).
  await page.getByTestId(`boom-el-${naam}`).locator("button.studio-project__element").dragTo(page.getByTestId(`boom-el-${adres}`));
  await expect.poll(() => geheelVan(naam)).toBe(adres);
  expect(await cm(`return Object.values(st.elements).filter((c) => c.elementType === "compositie" && c.target === ${JSON.stringify(naam)}).length;`)).toBe(1);
});

// Mark, 06-11: klikken op een element in de boom sprong naar het eerste diagram met dat element,
// ook als het op twee diagrammen staat. Nu blijf je in het huidige diagram; rechtsklik →
// "Toon gebruik ▸" kiest het diagram.
test("klik op een element blijft in het huidige diagram; Toon gebruik kiest een ander", async ({ page }) => {
  await openStudio(page);
  const { zetModel } = await import("./helpers/studio.js");
  await zetModel(page, { profielId: "usecase05", diagramId: "d_een", diagramNaam: "Eerste", elementen: [{ id: "partij", naam: "Partij", type: "actor", pos: { x: 100, y: 100 } }] });
  await zetModel(page, { profielId: "usecase05", diagramId: "d_twee", diagramNaam: "Tweede", elementen: [{ id: "ander", naam: "Ander", type: "actor", pos: { x: 100, y: 100 } }] });
  await page.evaluate(async () => {
    const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    reg.getProfieltype("usecase05").useStore.getState().addElementToDiagram("d_twee", "partij", { x: 300, y: 100 });
  });
  // Partij in een map, en "Ander" (alleen op Tweede) wordt aangeklikt terwijl Eerste actief is.
  const mapId = await inModelleren(page, 'const m = ms.getState().nieuweMap("Actoren"); ms.getState().plaatsMeerdere(["el::usecase05::partij", "el::usecase05::ander"], m); return m;');
  await inModelleren(page, 'ms.getState().activeer("usecase05::d_een");');
  await page.getByTestId("boom-el-ander").locator("button.studio-project__element").click();
  await page.waitForTimeout(300);
  expect(await inModelleren(page, "return ms.getState().actieveTab;")).toBe("usecase05::d_een");
  expect(await inModelleren(page, "return ms.getState().elementSelectie?.elementId;")).toBe("ander");

  await page.getByTestId("boom-el-partij").locator("button.studio-project__element").click({ button: "right" });
  await menu(page).getByRole("button", { name: /^Toon gebruik \(2\)( ▸)?$/ }).click();
  await expect(menu(page).getByRole("button", { name: "Eerste" })).toBeVisible();
  await menu(page).getByRole("button", { name: "Tweede" }).click();
  await expect.poll(() => inModelleren(page, "return ms.getState().actieveTab;")).toBe("usecase05::d_twee");
  expect(mapId).toBeTruthy();
});
