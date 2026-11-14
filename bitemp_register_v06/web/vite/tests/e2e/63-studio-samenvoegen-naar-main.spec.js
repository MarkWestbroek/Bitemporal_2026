// Studio — "Samenvoegen naar MAIN" in Verschil met MAIN (14-11, plan "Branch terugmergen",
// stap 1 en 2). De API is gemockt: GET …/vergelijk en POST …/samenvoegen. Controleert: de boom met
// vinkjes (map → element, half gekozen ouder), een conflict staat standaard uit en blokkeert niet;
// na bevestiging één POST met de keuze, een melding en opnieuw vergelijken; gekozen wijzigingen
// buiten de map gaan alleen met bevestiging mee (ookBuitenMap); een 409 van de server (samenhang,
// volgnummer verschoven) geeft een begrijpelijke melding.
import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const TAK = "tak-smv-0001";

const el = (id, status, extra = {}) => ({
  soort: "element", profielId: "diagram05", id, naam: id, status, velden: ["naam"], inScope: true,
  mapId: "dienst", ouderId: null, sleutel: `element:diagram05:${id}`, ...extra,
});

const vergelijking = ({ buiten = false } = {}) => ({
  verschillen: [
    el("E", "conflict"),
    el("D", "gewijzigd"),
    el("G", "main", { kant: "main" }),
    ...(buiten ? [el("X", "nieuw", { inScope: false, mapId: "elders" })] : []),
  ],
  telling: { nieuw: buiten ? 1 : 0, gewijzigd: 1, weg: 0, conflict: 1, main: 1 },
  scope: ["dienst"],
  mappen: { dienst: { id: "dienst", naam: "Dienst", ouderId: null }, elders: { id: "elders", naam: "Elders", ouderId: null } },
  meldingen: [],
  main: { projectId: "main-0001", laatsteVolgnummer: 10 },
  tak: { projectId: TAK, laatsteVolgnummer: 4 },
});

const okAntwoord = { main: { projectId: "main-0001", ops: { aantal: 1, van: 11, tot: 11, laatsteVolgnummer: 11 } }, tak: { projectId: TAK, ops: { aantal: 1, van: 5, tot: 5, laatsteVolgnummer: 5 } }, basisVolgnummer: 11, opgelost: 1 };

/** Open het dialoogvenster zoals het Project-menu dat doet. */
async function openDialoog(page) {
  await page.evaluate(async (id) => {
    const m = await import(location.origin + "/viz/react/src/studio/takken/VerschilMetMainDialoog.jsx");
    m.useVerschilMetMainStore.getState().openen({ projectId: id, regel: "Branch van \"Inrichten\" · map \"Dienst\"" });
  }, TAK);
  await expect(page.getByTestId("verschil-met-main")).toBeVisible();
}

test("boom: map met elementen, conflict standaard uit, ouder half; MAIN-wijzigingen apart", async ({ page }) => {
  await openStudio(page);
  await page.route(`**/api/studio/projecten/${TAK}/vergelijk`, (r) => r.fulfill({ json: vergelijking() }));
  await openDialoog(page);
  const boom = page.getByTestId("keuze-boom");
  await expect(boom.locator('[data-knoop="map:dienst"]')).toBeVisible();
  const map = page.getByTestId("keuze-map:dienst");
  const d = page.getByTestId("keuze-eenheid:element:diagram05:D");
  const e = page.getByTestId("keuze-eenheid:element:diagram05:E");
  await expect(d).toBeChecked();
  await expect(e).not.toBeChecked();
  await expect(map).toHaveAttribute("data-stand", "half");
  await expect(boom).toContainText("MAIN houdt de zijne");
  await expect(page.getByTestId("samenvoegen-naar-main")).toBeEnabled();
  await expect(page.getByTestId("samenvoegen-naar-main")).toHaveText("Samenvoegen naar MAIN (1)");
  // Map aan: alles eronder aan, ook het conflict (dan wint de branch).
  await map.click();
  await expect(e).toBeChecked();
  await expect(map).toHaveAttribute("data-stand", "aan");
  await expect(boom).toContainText("versie van de branch");
  await map.click();
  await expect(d).not.toBeChecked();
  // G (alleen op MAIN) staat niet in de boom.
  await expect(boom.locator('[data-verschil-id="G"]')).toHaveCount(0);
  await expect(page.getByTestId("van-main")).toContainText("Alleen op MAIN (1)");
});

test("bevestigen: één POST met de keuze, melding, opnieuw vergelijken", async ({ page }) => {
  await openStudio(page);
  let vergeleken = 0;
  await page.route(`**/api/studio/projecten/${TAK}/vergelijk`, (r) => { vergeleken += 1; r.fulfill({ json: vergelijking() }); });
  const bodies = [];
  await page.route(`**/api/studio/projecten/${TAK}/samenvoegen`, (r) => {
    bodies.push(r.request().postDataJSON());
    r.fulfill({ json: okAntwoord });
  });
  await openDialoog(page);
  let vraag = "";
  page.once("dialog", (d) => { vraag = d.message(); d.accept(); });
  await page.getByTestId("samenvoegen-naar-main").click();
  await expect(page.getByTestId("samenvoeg-melding")).toHaveText(/Samengevoegd: 1 wijziging\(en\) naar MAIN, 1 naar deze branch/);
  expect(vraag).toContain("1 gekozen wijziging(en) gaan naar MAIN.");
  expect(vraag).toContain("Bij 1 conflict(en) houdt MAIN de zijne.");
  expect(vraag).toContain("1 niet gekozen wijziging(en) blijven alleen in deze branch.");
  expect(vraag).not.toContain("buiten");
  expect(bodies).toEqual([{ ookBuitenMap: false, keuze: { "element:diagram05:E": false, "element:diagram05:D": true } }]);
  await expect.poll(() => vergeleken).toBe(2);
});

test("buiten de map: standaard uit; aangevinkt alleen met bevestiging, dan ookBuitenMap", async ({ page }) => {
  await openStudio(page);
  await page.route(`**/api/studio/projecten/${TAK}/vergelijk`, (r) => r.fulfill({ json: vergelijking({ buiten: true }) }));
  const bodies = [];
  await page.route(`**/api/studio/projecten/${TAK}/samenvoegen`, (r) => {
    bodies.push(r.request().postDataJSON());
    r.fulfill({ json: okAntwoord });
  });
  await openDialoog(page);
  const x = page.getByTestId("keuze-eenheid:element:diagram05:X");
  await expect(x).not.toBeChecked();
  await expect(page.getByTestId("keuze-boom")).toContainText("buiten de map");
  await x.click();
  await expect(x).toBeChecked();
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
  expect(bodies[0].ookBuitenMap).toBe(true);
  expect(bodies[0].keuze["element:diagram05:X"]).toBe(true);
});

test("409 samenhang en volgnummer_verschoven: melding, niets kapot", async ({ page }) => {
  await openStudio(page);
  await page.route(`**/api/studio/projecten/${TAK}/vergelijk`, (r) => r.fulfill({ json: vergelijking() }));
  let keer = 0;
  await page.route(`**/api/studio/projecten/${TAK}/samenvoegen`, (r) => {
    keer += 1;
    r.fulfill(keer === 1
      ? { status: 409, json: { error: "samenhang", reden: "samenhang", samenhang: [{ kant: "main", fout: "element diagram05/R: source H ontbreekt" }] } }
      : { status: 409, json: { error: "Er is intussen verder gewerkt", reden: "volgnummer_verschoven" } });
  });
  await openDialoog(page);
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("samenvoegen-naar-main").click();
  await expect(page.getByTestId("samenvoeg-melding")).toContainText("1 verwijzing(en) naar iets wat er niet is");
  await expect(page.getByTestId("samenvoeg-melding")).toContainText("(MAIN) element diagram05/R: source H ontbreekt");
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("samenvoegen-naar-main").click();
  await expect(page.getByTestId("samenvoeg-melding")).toHaveText(/er is intussen verder gewerkt/);
  await expect(page.getByTestId("samenvoegen-naar-main")).toBeEnabled();
});

test("terugzetten (↶): keuze 'terug' in de POST, telt niet als gekozen, knop ook zonder keuze aan", async ({ page }) => {
  await openStudio(page);
  await page.route(`**/api/studio/projecten/${TAK}/vergelijk`, (r) => r.fulfill({ json: vergelijking() }));
  const bodies = [];
  await page.route(`**/api/studio/projecten/${TAK}/samenvoegen`, (r) => {
    bodies.push(r.request().postDataJSON());
    r.fulfill({ json: { main: { ops: { aantal: 0 } }, tak: { ops: { aantal: 1 } } } });
  });
  await openDialoog(page);
  await page.getByTestId("keuze-alles-uit").click();
  await page.getByTestId("terug-eenheid:element:diagram05:D").click();
  await expect(page.getByTestId("terug-label-eenheid:element:diagram05:D")).toHaveText("→ wordt teruggezet naar MAIN");
  await expect(page.getByTestId("keuze-eenheid:element:diagram05:D")).not.toBeChecked();
  await expect(page.getByTestId("samenvoegen-naar-main")).toHaveText("Samenvoegen naar MAIN (0, 1 terug)");
  let vraag = "";
  page.once("dialog", (d) => { vraag = d.message(); d.accept(); });
  await page.getByTestId("samenvoegen-naar-main").click();
  await expect(page.getByTestId("samenvoeg-melding")).toBeVisible();
  expect(vraag).toContain("1 wijziging(en) in deze branch worden teruggezet naar de versie van MAIN.");
  expect(vraag).not.toContain("gekozen wijziging(en) gaan naar MAIN");
  expect(bodies[0].keuze).toEqual({ "element:diagram05:E": false, "element:diagram05:D": "terug" });
});
