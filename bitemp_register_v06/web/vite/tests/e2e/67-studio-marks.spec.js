// Studio — marks (MDA): aanwijzingen op een modelelement voor een transformatie (18-11).
//  1. Eerste laag maken, een veld als zoeksleutel markeren; teken op het canvas; in het werkbestand.
//  2. Een tweede laag zet de mark uit; met alleen de eerste laag geldt hij weer.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, node } from "./helpers/studio.js";

test.use({ viewport: { width: 1700, height: 1000 } });

const marks = (page) =>
  page.evaluate(async () => {
    const { useMarksStore } = await import(location.origin + "/viz/react/src/studio/marksStore.js");
    const s = useMarksStore.getState();
    return { lagen: s.lagen.map((l) => l.id), marks: s.marks.map((m) => ({ laag: m.laag, soort: m.soort, waarde: m.waarde, doel: m.doel })), actieveContext: s.actieveContext };
  });

async function opzet(page) {
  await openStudio(page);
  await zetModel(page, { profielId: "diagram05", diagramId: "d_cm", diagramNaam: "Kaart", elementen: [
    { id: "ge1", naam: "Kaartgegevens", type: "gegevenselement", pos: { x: 300, y: 350 },
      compartimenten: [{ compartmentType: "velden", velden: [
        { naam: "kaartnummer", fieldType: "attribuut", data: { typeLabel: "string", uuid: "11111111-1111-4111-8111-111111111111" } },
        { naam: "soort", fieldType: "attribuut", data: { typeLabel: "string", uuid: "22222222-2222-4222-8222-222222222222" } },
      ] }] },
  ] });
  await node(page, "ge1").click({ position: { x: 20, y: 10 } });
}

test("een veld markeren als zoeksleutel: paneel, teken op het canvas en het werkbestand", async ({ page }) => {
  await opzet(page);
  const paneel = page.getByTestId("marks-paneel");
  await expect(paneel).toContainText("Marks");
  await expect(node(page, "ge1").getByTestId("node-marks")).toHaveCount(0);
  await paneel.getByTestId("marks-eerste-laag").click();
  const rij = paneel.locator('tr[data-veld="kaartnummer"]');
  await rij.getByTestId("mark-register.zoeksleutel").check();
  await expect(paneel).toContainText("Marks (1)");
  await expect.poll(async () => (await marks(page)).marks).toEqual([
    { laag: "algemeen", soort: "register.zoeksleutel", waarde: true, doel: { soort: "veld", uuid: "11111111-1111-4111-8111-111111111111" } },
  ]);
  // Het teken op het canvas: achter de veldnaam (één mark: alleen het ruitje). Het element zelf
  // heeft geen mark, dus geen teken rechtsboven.
  const veldTeken = node(page, "ge1").locator("[data-dc-mark]");
  await expect(veldTeken).toHaveCount(1);
  await expect(veldTeken).toHaveText("◆");
  await expect(veldTeken).toHaveAttribute("data-dc-mark", "velden:0"); // bij kaartnummer, niet bij soort
  await expect(node(page, "ge1").getByTestId("node-marks")).toHaveCount(0);
  // Erboven hangen toont het kaartje met de inhoud en de laag.
  await veldTeken.hover();
  const popup = page.getByTestId("marks-popup");
  await expect(popup).toContainText("Kaartgegevens.kaartnummer");
  await expect(popup).toContainText("zoeksleutel");
  await expect(popup).toContainText("Algemeen");
  await page.mouse.move(5, 5);
  await expect(popup).toHaveCount(0);
  // Een klik op het teken hernoemt het veld niet, maar brengt de sectie Marks in beeld.
  await page.getByTestId("marks-paneel").evaluate((el) => el.closest(".studio-inspector-pad")?.parentElement?.scrollTo?.(0, 0));
  await veldTeken.click();
  await page.waitForTimeout(400);
  await expect(node(page, "ge1").locator("input, textarea")).toHaveCount(0);
  await expect(paneel).toBeInViewport();
  // Na de klik blijft het kaartje staan, tot je ergens anders klikt.
  await page.mouse.move(5, 5);
  await expect(popup).toBeVisible();
  await paneel.getByText("schrijft in").click();
  await expect(popup).toHaveCount(0);
  // Een tweede mark op hetzelfde veld: het aantal erbij.
  await rij.getByTestId("mark-register.sorteerbaar").check();
  await expect(veldTeken).toHaveText("◆2");
  await rij.getByTestId("mark-register.sorteerbaar").uncheck();
  await expect(veldTeken).toHaveText("◆");
  // In het werkbestand staan de marks los van het model.
  const wb = await page.evaluate(async () => {
    const { marksVanProject } = await import(location.origin + "/viz/react/src/studio/marksStore.js");
    const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    const veld = reg.getProfieltype("diagram05").useStore.getState().elements.ge1.compartimenten[0].velden[0];
    return { marks: marksVanProject().marks.length, veldSleutels: Object.keys(veld.data) };
  });
  expect(wb.marks).toBe(1);
  expect(wb.veldSleutels).not.toContain("_mark");
  expect(wb.veldSleutels).not.toContain("marks");
  // Uitvinken haalt de mark weer weg.
  await rij.getByTestId("mark-register.zoeksleutel").uncheck();
  await expect.poll(async () => (await marks(page)).marks.length).toBe(0);
  await expect(node(page, "ge1").locator("[data-dc-mark]")).toHaveCount(0);
});

test("een tweede laag zet de mark uit; zonder die laag geldt hij weer", async ({ page }) => {
  await opzet(page);
  const paneel = page.getByTestId("marks-paneel");
  await paneel.getByTestId("marks-eerste-laag").click();
  const vak = paneel.locator('tr[data-veld="kaartnummer"]').getByTestId("mark-register.zoeksleutel");
  await vak.check();
  // Tweede laag via de dialoog; die wordt de laatste in de context.
  await paneel.getByTestId("marks-lagen").click();
  const dlg = page.getByTestId("marks-lagen-dialoog");
  await dlg.getByTestId("marks-nieuwe-laag").click();
  await page.locator(".studio-dialoog input").fill("Waterstede");
  await page.locator(".studio-dialoog").getByRole("button", { name: "Maken" }).click();
  await expect(dlg.locator('tr[data-laag="waterstede"]')).toBeVisible();
  await dlg.getByRole("button", { name: "Sluiten" }).click();
  // Schrijven in Waterstede en uitvinken: de algemene mark blijft, Waterstede zet hem uit.
  await paneel.getByTestId("marks-werklaag").selectOption("waterstede");
  await expect(vak).toBeChecked();
  await vak.uncheck();
  await expect.poll(async () => (await marks(page)).marks.map((m) => [m.laag, m.waarde])).toEqual([["algemeen", true], ["waterstede", null]]);
  await expect(node(page, "ge1").locator("[data-dc-mark]")).toHaveCount(0);
  // Waterstede doet niet meer mee: de mark geldt weer.
  await paneel.getByTestId("marks-lagen").click();
  await dlg.locator('tr[data-laag="waterstede"] input[type="checkbox"]').uncheck();
  await dlg.getByRole("button", { name: "Sluiten" }).click();
  await expect(vak).toBeChecked();
  await expect(node(page, "ge1").locator("[data-dc-mark]")).toHaveText("◆");
});

test("een mark op het element zelf: teken rechtsboven, klikbaar", async ({ page }) => {
  await opzet(page);
  // Een soort voor het element als geheel (zo'n soort declareert een transformatie).
  await page.evaluate(async () => {
    const { registreerMarksoorten } = await import(location.origin + "/viz/react/src/marks/marksoorten.js");
    registreerMarksoorten([{ id: "proef.archief", label: "archiveren", datatype: "boolean", doelen: ["element"], profielen: ["canoniek-uml"] }]);
    const { useMarksStore } = await import(location.origin + "/viz/react/src/studio/marksStore.js");
    useMarksStore.getState().zetLaag({ id: "algemeen", naam: "Algemeen", labels: [] });
  });
  const paneel = page.getByTestId("marks-paneel");
  await paneel.getByTestId("mark-proef.archief").check();
  const teken = node(page, "ge1").getByTestId("node-marks");
  await expect(teken).toHaveText("◆");
  await expect(teken).toHaveAttribute("title", "Marks: archiveren");
  await teken.click();
  await expect(paneel).toBeInViewport();
  await expect(page.getByTestId("marks-popup")).toContainText("archiveren");
});

test("een mark waarvan het veld verdwijnt blijft staan en is op te ruimen", async ({ page }) => {
  await opzet(page);
  const paneel = page.getByTestId("marks-paneel");
  await paneel.getByTestId("marks-eerste-laag").click();
  await paneel.locator('tr[data-veld="kaartnummer"]').getByTestId("mark-register.zoeksleutel").check();
  // Het veld weg uit het model.
  await page.evaluate(async () => {
    const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    const s = reg.getProfieltype("diagram05").useStore.getState();
    const el = s.elements.ge1;
    s.updateElementen({ ge1: { compartimenten: el.compartimenten.map((c) => ({ ...c, velden: c.velden.filter((v) => v.naam !== "kaartnummer") })) } });
  });
  expect((await marks(page)).marks.length).toBe(1); // niet stil weggegooid
  await paneel.getByTestId("marks-lagen").click();
  const dlg = page.getByTestId("marks-lagen-dialoog");
  await expect(dlg.getByTestId("marks-wezen")).toContainText("1 mark zonder doel");
  await dlg.getByTestId("marks-wezen-weg").click();
  await page.locator(".studio-dialoog").getByRole("button", { name: "Weghalen" }).click();
  await expect(dlg.getByTestId("marks-wezen")).toHaveCount(0);
  expect((await marks(page)).marks.length).toBe(0);
});
