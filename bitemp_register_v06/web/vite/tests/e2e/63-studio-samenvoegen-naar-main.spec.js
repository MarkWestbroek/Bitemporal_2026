// Studio — "Samenvoegen naar MAIN" in Verschil met MAIN (14-11, plan "Branch terugmergen",
// stap 1). De API is gemockt: GET …/vergelijk en POST …/samenvoegen. Controleert: bij een conflict
// kan het niet; zonder conflict na bevestiging één POST en een melding, daarna opnieuw vergelijken;
// wijzigingen buiten de map gaan alleen met bevestiging mee (ookBuitenMap); een 409 van de server
// geeft een begrijpelijke melding.
import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const TAK = "tak-smv-0001";

const vergelijking = ({ conflict = 0, buiten = false } = {}) => ({
  verschillen: [
    { soort: "element", profielId: "diagram05", id: "D", naam: "D", status: "gewijzigd", velden: ["naam"], inScope: !buiten },
    { soort: "element", profielId: "diagram05", id: "G", naam: "G", status: "main", velden: ["naam"], inScope: true, kant: "main" },
    ...(conflict ? [{ soort: "element", profielId: "diagram05", id: "E", naam: "E", status: "conflict", velden: ["naam"], inScope: true }] : []),
  ],
  telling: { nieuw: 0, gewijzigd: 1, weg: 0, conflict, main: 1 },
  scope: ["dienst"],
  meldingen: [],
  main: { projectId: "main-0001", laatsteVolgnummer: 10 },
  tak: { projectId: TAK, laatsteVolgnummer: 4 },
});

/** Open het dialoogvenster zoals het Project-menu dat doet. */
async function openDialoog(page) {
  await page.evaluate(async (id) => {
    const m = await import(location.origin + "/viz/react/src/studio/takken/VerschilMetMainDialoog.jsx");
    m.useVerschilMetMainStore.getState().openen({ projectId: id, regel: "Branch van \"Inrichten\" · map \"Dienst\"" });
  }, TAK);
  await expect(page.getByTestId("verschil-met-main")).toBeVisible();
}

test("conflict: samenvoegen kan niet", async ({ page }) => {
  await openStudio(page);
  await page.route(`**/api/studio/projecten/${TAK}/vergelijk`, (r) => r.fulfill({ json: vergelijking({ conflict: 1 }) }));
  await openDialoog(page);
  const knop = page.getByTestId("samenvoegen-naar-main");
  await expect(knop).toBeDisabled();
  await expect(knop).toHaveAttribute("title", "Eerst de conflicten oplossen.");
});

test("zonder conflict: bevestigen, één POST, melding, opnieuw vergelijken", async ({ page }) => {
  await openStudio(page);
  let vergeleken = 0;
  await page.route(`**/api/studio/projecten/${TAK}/vergelijk`, (r) => { vergeleken += 1; r.fulfill({ json: vergelijking() }); });
  const bodies = [];
  await page.route(`**/api/studio/projecten/${TAK}/samenvoegen`, (r) => {
    bodies.push(r.request().postDataJSON());
    r.fulfill({ json: { main: { projectId: "main-0001", ops: { aantal: 1, van: 11, tot: 11, laatsteVolgnummer: 11 } }, tak: { projectId: TAK, ops: { aantal: 1, van: 5, tot: 5, laatsteVolgnummer: 5 } }, basisVolgnummer: 11 } });
  });
  await openDialoog(page);
  let vraag = "";
  page.once("dialog", (d) => { vraag = d.message(); d.accept(); });
  await page.getByTestId("samenvoegen-naar-main").click();
  await expect(page.getByTestId("samenvoeg-melding")).toHaveText(/Samengevoegd: 1 wijziging\(en\) naar MAIN, 1 van MAIN naar deze branch/);
  expect(vraag).toContain("1 wijziging(en) uit deze branch gaan naar MAIN.");
  expect(vraag).not.toContain("buiten");
  expect(bodies).toEqual([{ ookBuitenMap: false }]);
  await expect.poll(() => vergeleken).toBe(2);
});

test("buiten de map: alleen met bevestiging, dan ookBuitenMap", async ({ page }) => {
  await openStudio(page);
  await page.route(`**/api/studio/projecten/${TAK}/vergelijk`, (r) => r.fulfill({ json: vergelijking({ buiten: true }) }));
  const bodies = [];
  await page.route(`**/api/studio/projecten/${TAK}/samenvoegen`, (r) => {
    bodies.push(r.request().postDataJSON());
    r.fulfill({ json: { main: { ops: { aantal: 1 } }, tak: { ops: { aantal: 0 } } } });
  });
  await openDialoog(page);
  // Eerst annuleren: geen POST.
  page.once("dialog", (d) => d.dismiss());
  await page.getByTestId("samenvoegen-naar-main").click();
  await page.waitForTimeout(300);
  expect(bodies).toEqual([]);
  let vraag = "";
  page.once("dialog", (d) => { vraag = d.message(); d.accept(); });
  await page.getByTestId("samenvoegen-naar-main").click();
  await expect(page.getByTestId("samenvoeg-melding")).toBeVisible();
  expect(vraag).toContain("buiten de afgesplitste map");
  expect(bodies).toEqual([{ ookBuitenMap: true }]);
});

test("409 volgnummer_verschoven: melding, niets kapot", async ({ page }) => {
  await openStudio(page);
  await page.route(`**/api/studio/projecten/${TAK}/vergelijk`, (r) => r.fulfill({ json: vergelijking() }));
  await page.route(`**/api/studio/projecten/${TAK}/samenvoegen`, (r) =>
    r.fulfill({ status: 409, json: { error: "Er is intussen verder gewerkt", reden: "volgnummer_verschoven" } }));
  await openDialoog(page);
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("samenvoegen-naar-main").click();
  await expect(page.getByTestId("samenvoeg-melding")).toHaveText(/er is intussen verder gewerkt/);
  await expect(page.getByTestId("samenvoegen-naar-main")).toBeEnabled();
});
