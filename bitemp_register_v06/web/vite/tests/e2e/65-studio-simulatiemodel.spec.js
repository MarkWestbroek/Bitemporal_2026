// Studio — scenario's in het project (16-11): het profiel Simulatiemodel. Een scenario uit de
// activiteit Simulatie in het project bewaren (als model: simulatie, subjecten, scenario,
// instantie, stubs, verwachting), het uit het project terugkiezen, afspelen, en de afloop
// toetsen aan de verwachting.
// Ontwerp: docs/plans/2026-11-12 Simulatie van BPMN en DMN met cm-objecten §12.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { openStudio } from "./helpers/studio.js";

test.use({ viewport: { width: 1600, height: 1000 } });

const SCHERM = process.env.SIMULATIE_SCHERMAFBEELDINGEN || null;
const foto = async (page, naam) => {
  if (SCHERM) await page.screenshot({ path: `${SCHERM}/${naam}.png` });
};
const naar = (page, activiteit) => page.locator(`.studio-activitybar [title^='${activiteit}']`).first().click();
/** Het simulatiemodel in de store: de elementen per type en de diagrammen. */
const model = (page) =>
  page.evaluate(() => {
    const st = window.__simulatiemodel05Store.getState();
    const els = Object.values(st.elements);
    const tel = {};
    for (const e of els) tel[e.elementType] = (tel[e.elementType] || 0) + 1;
    return { tel, els, diagrammen: Object.values(st.diagrams).map((d) => ({ naam: d.naam, nodes: d.nodes.length })) };
  });

test("scenario bewaren in het project, terugkiezen, afspelen en toetsen aan de verwachting", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("studio05-hints-gezien", JSON.stringify({ gezien: {}, uit: true })));
  await openStudio(page);
  await naar(page, "Simulatie");
  await page.getByTestId("sim-laad-gpk").click();
  const scenario = page.getByTestId("sim-scenario");
  await expect(scenario).toHaveValue(/GPK 4: toegekend/);
  const keuze = page.getByTestId("sim-voorbeeld");
  // Het GPK-voorbeeld zet zijn vijf scenario's ook als model in het project.
  const uitProject = keuze.locator("optgroup[label='Uit het project'] option");
  await expect(uitProject).toHaveCount(5);
  const na = await model(page);
  const gpk4 = JSON.parse(await scenario.inputValue());
  const stubs = Object.values(gpk4.antwoorden).reduce((n, a) => n + (Array.isArray(a) ? a.length : 1), 0);
  expect(na.tel).toMatchObject({ simulatie: 1, subject: 4, scenario: 5, instantie: 5, verwachting: 5 });
  // Het overzicht (simulatie, vier subjecten, vijf scenario's) en een diagram per scenario.
  expect(na.diagrammen[0]).toEqual({ naam: "Simulatie", nodes: 10 });
  expect(na.diagrammen).toHaveLength(6);
  // In de projectboom staan ze samen in de map Simulatie, niet los in de root.
  const inMap = await page.evaluate(async () => {
    const { useModellerenStore } = await import(location.origin + "/viz/react/src/studio/activities/modellerenActivity.jsx");
    const ms = useModellerenStore.getState();
    const map = Object.values(ms.mappen).find((m) => m.naam === "Simulatie");
    return map ? Object.entries(ms.plaatsing).filter(([k, v]) => v === map.id && k.startsWith("simulatiemodel05::")).length : -1;
  });
  expect(inMap).toBe(6);
  expect(na.diagrammen.find((d) => d.naam === gpk4.naam)).toEqual({ naam: gpk4.naam, nodes: 1 + 1 + stubs + 1 });
  // Als boom (Mark 20-11): de ouder gecentreerd bovenaan, alleen «heeft» als boomlijn; tot vier
  // kinderen in één rij, meer verspringend over twee rijen; de instantie links naast het scenario,
  // met een rechte «start met»-lijn langs de kortste weg.
  const boom = await page.evaluate(() => {
    const st = window.__simulatiemodel05Store.getState();
    const els = st.elements;
    return Object.values(st.diagrams).map((d) => {
      const ouder = d.nodes.find((k) => els[k.elementId]?.elementType === (d.naam === "Simulatie" ? "simulatie" : "scenario"));
      const inst = d.nodes.find((k) => els[k.elementId]?.elementType === "instantie");
      const rij = d.nodes.filter((k) => k !== ouder && k !== inst);
      const xs = rij.map((k) => k.position.x);
      const heeft = Object.entries(d.lijnen || {}).filter(([id]) => els[id]?.elementType === "heeft").map(([, l]) => l);
      const start = Object.entries(d.lijnen || {}).filter(([id]) => els[id]?.elementType === "start-met");
      return {
        naam: d.naam,
        rijen: new Set(rij.map((k) => k.position.y)).size,
        onderOuder: rij.every((k) => k.position.y > ouder.position.y),
        gecentreerd: ouder.position.x === Math.round((Math.min(...xs) + Math.max(...xs)) / 2),
        boomlijnen: heeft.length === rij.length && heeft.every((l) => l.vorm === (heeft.length === 1 ? "recht" : "boom") && l.sourceHandle === "source-bottom" && l.targetHandle === "target-top"),
        startRecht: start.length === 1 && start[0][1].vorm === "recht" && start[0][1].sourceHandle === "source-left" && start[0][1].targetHandle === "target-right",
        instantieLinks: inst ? inst.position.y === ouder.position.y && inst.position.x < ouder.position.x : null,
        aantal: rij.length,
      };
    });
  });
  for (const d of boom) expect(d, d.naam).toMatchObject({ onderOuder: true, gecentreerd: true, boomlijnen: true, rijen: d.naam === "Simulatie" || d.aantal <= 4 ? 1 : 2 });
  for (const d of boom.filter((x) => x.naam !== "Simulatie")) expect([d.instantieLinks, d.startRecht], d.naam).toEqual([true, true]);
  expect(boom.find((d) => d.naam === gpk4.naam)).toMatchObject({ aantal: 4, rijen: 1 }); // zoals Mark GPK 4 had
  expect(boom.find((d) => d.naam.startsWith("GPK 5"))).toMatchObject({ aantal: 6, rijen: 2 }); // en GPK 5
  // Verwijzingen naar de andere talen: het subject naar het BPMN-diagram, het scenario naar het
  // startevent, een stub naar zijn taak.
  const subject = na.els.find((e) => e.elementType === "subject" && e.naam === "Aanvraag oppakken");
  expect(subject.data.verwijstNaar.profielId).toBe("bpmnMotor05");
  expect(na.els.find((e) => e.elementType === "scenario" && e.naam === gpk4.naam).data.startBij).toEqual({ profielId: "bpmnMotor05", elementId: "bp_start" });
  expect(na.els.filter((e) => e.elementType === "stub").every((s) => s.data.bij?.profielId === "bpmnMotor05")).toBe(true);

  // Bewaren onder dezelfde naam werkt bij: er komt niets bij.
  await page.getByTestId("sim-bewaar-scenario").click();
  await expect(page.getByText(/staat bijgewerkt in het project/)).toBeVisible();
  await page.getByRole("button", { name: "OK", exact: true }).click();
  expect((await model(page)).tel).toEqual(na.tel);
  // Onder een nieuwe naam: een zesde scenario, met een eigen diagram.
  await scenario.fill(JSON.stringify({ ...gpk4, naam: "Mijn scenario" }, null, 2));
  await page.getByTestId("sim-bewaar-scenario").click();
  await expect(page.getByText(/"Mijn scenario" staat nu in het project/)).toBeVisible();
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await expect(uitProject).toHaveCount(6);
  expect((await model(page)).tel.scenario).toBe(6);

  // Een ander scenario kiezen en dan het bewaarde terug uit het project.
  await keuze.selectOption("1");
  await expect(scenario).toHaveValue(/GPK 1: zonder bsn/);
  await keuze.selectOption(`p:${na.els.find((e) => e.elementType === "scenario" && e.naam === gpk4.naam).id}`);
  const terug = JSON.parse(await scenario.inputValue());
  expect(terug.start.object).toEqual(gpk4.start.object);
  expect(terug.start.proces).toBe("aanvraag-oppakken");
  expect(terug.start.type).toBe(gpk4.start.type);
  expect(terug.verwacht).toEqual(gpk4.verwacht);
  await foto(page, "sm-1-uit-project");

  // Afspelen: het scenario uit het project komt uit waar het hoort, en dat staat erbij.
  await page.getByTestId("sim-start").click();
  await expect(page.getByTestId("sim-verwachting")).toHaveCount(0); // de run loopt nog
  await page.getByTestId("sim-loop").click();
  await expect(page.getByTestId("sim-stand")).toHaveText(/Beschikt/);
  const verwachting = page.getByTestId("sim-verwachting");
  await expect(verwachting).toHaveAttribute("data-klopt", "true");
  await expect(verwachting).toContainText("einde = Beschikt");
  await expect(verwachting).toContainText("via = Stel beschikking op");
  await foto(page, "sm-2-verwachting");

  // Het model is te zien in Modelleren: het scenario-diagram tekent zonder fouten.
  await page.getByTestId("sim-stop").click();
  await page.evaluate((naam) => {
    const st = window.__simulatiemodel05Store.getState();
    st.setActiefDiagram(Object.values(st.diagrams).find((d) => d.naam === naam).id);
  }, gpk4.naam);
});

test("het scenario-diagram tekent in Modelleren: scenario, instantie, stubs en verwachting", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("studio05-hints-gezien", JSON.stringify({ gezien: {}, uit: true })));
  await openStudio(page);
  await naar(page, "Simulatie");
  await page.getByTestId("sim-laad-gpk").click();
  await expect(page.getByTestId("sim-scenario")).toHaveValue(/GPK 4: toegekend/);
  await naar(page, "Modelleren");
  await page.getByText("GPK 4: toegekend", { exact: false }).first().dblclick();
  // De doos van de instantie toont het type en de eerste velden van de json.
  const instantie = page.locator(".react-flow__node", { hasText: "aanvraag-1" }).first();
  await expect(instantie).toBeVisible();
  await expect(instantie).toContainText("aanvraagnummer");
  await expect(page.locator(".react-flow__node", { hasText: "«verwachting»" }).first()).toContainText("einde: Beschikt");
  await foto(page, "sm-3-modelleren");
});

test("cm-vorm zonder e-dienstmodel: de structuur komt uit het canonieke model van het project", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("studio05-hints-gezien", JSON.stringify({ gezien: {}, uit: true })));
  await openStudio(page);
  await naar(page, "Simulatie");
  await page.getByTestId("sim-laad-gpk").click();
  const scenario = page.getByTestId("sim-scenario");
  await expect(scenario).toHaveValue(/GPK 4: toegekend/);
  // Het GPK-e-dienstmodel uit; het startobject is een Aanvraag uit het cm van het project.
  await page.getByRole("button", { name: "GPK-voorbeeld niet meer gebruiken" }).click();
  // Het canonieke model van cg-test in het project (met de GPK-aanvraag als subtype van Aanvraag).
  const v3 = JSON.parse(fs.readFileSync(new URL("../../src/diagramprofielen/canoniek-uml/fixtures/cg-test/inrichten-domeinen-v3.json", import.meta.url), "utf8"));
  await page.evaluate(async (v3) => {
    const { importeerV3 } = await import(location.origin + "/viz/react/src/diagramprofielen/canoniek-uml/serialisatie.js");
    const { getProfieltype } = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    getProfieltype("diagram05").useStore.getState().laadModel(importeerV3(v3));
  }, v3);
  await page.getByTestId("sim-start").click();
  const aanvraag = page.locator('[data-testid="sim-object"][data-object="aanvraag-1"]');
  await expect(aanvraag.getByTestId("sim-cm")).toContainText("zonder e-dienstmodel");
  // De velden van de entiteit met hun waarde uit het platte object, op veldnaam.
  await expect(aanvraag.locator('[data-testid="sim-cm-veld"]', { hasText: "aanvraagnummer" }).first()).toContainText("GPK-2026-0001");
  await expect(aanvraag.getByTestId("sim-cm")).toContainText("erft van Aanvraag");
  await foto(page, "sm-4-cm-direct");
});

test("testset en subjecten: alle scenario's toetsen; de run draait op de subjecten van de simulatie", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("studio05-hints-gezien", JSON.stringify({ gezien: {}, uit: true })));
  await openStudio(page);
  await naar(page, "Simulatie");
  await page.getByTestId("sim-laad-gpk").click();
  await expect(page.getByTestId("sim-scenario")).toHaveValue(/GPK 4: toegekend/);
  // De vijf GPK-scenario's komen uit waar ze horen.
  await page.getByTestId("sim-testset").click();
  const rijen = page.getByTestId("sim-testset-rij");
  await expect(rijen).toHaveCount(5);
  for (let i = 0; i < 5; i++) await expect(rijen.nth(i)).toHaveAttribute("data-uitkomst", "klopt");

  // Een scenario uit het project draait op de subjecten van zijn simulatie: alle vier.
  const gpk4 = await page.evaluate(() => Object.values(window.__simulatiemodel05Store.getState().elements).find((e) => e.elementType === "scenario" && e.naam.startsWith("GPK 4")).id);
  await page.getByTestId("sim-voorbeeld").selectOption(`p:${gpk4}`);
  await page.getByTestId("sim-start").click();
  await expect(page.getByText("Draait op 4 processen (de subjecten van Simulatie)")).toBeVisible();
  await page.getByTestId("sim-stop").click();

  // Zonder het subject Zaak behandelen doet dat proces niet mee: GPK 4 komt niet meer bij Beschikt.
  await page.evaluate(() => {
    const st = window.__simulatiemodel05Store.getState();
    st.deleteElement(Object.values(st.elements).find((e) => e.elementType === "subject" && e.naam === "Zaak behandelen").id);
  });
  await page.getByTestId("sim-testset").click();
  await expect(rijen.filter({ hasText: "GPK 4" })).toHaveAttribute("data-uitkomst", "wijkt af");
  await expect(rijen.filter({ hasText: "GPK 1" })).toHaveAttribute("data-uitkomst", "klopt"); // eindigt al in het oppakproces
  await page.getByTestId("sim-start").click();
  await expect(page.getByText("Draait op 3 processen (de subjecten van Simulatie)")).toBeVisible();
  await foto(page, "sm-5-testset");
});
