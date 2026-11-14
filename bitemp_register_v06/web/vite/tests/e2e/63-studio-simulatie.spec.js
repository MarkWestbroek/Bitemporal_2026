// Studio — simulatie van BPMN en DMN met cm-objecten (13-11): de activiteit
// Simulatie. GPK-voorbeeld laden, starten, het token op het diagram, een gat
// met de hand vullen, doorlopen tot het einde, terugspoelen; en het token op
// het BPMN-canvas in Modelleren als je dat aanzet.
// Ontwerp: docs/plans/2026-11-12 Simulatie van BPMN en DMN met cm-objecten.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, node, wachtOpNode } from "./helpers/studio.js";

test.use({ viewport: { width: 1600, height: 1000 } });

const SCHERM = process.env.SIMULATIE_SCHERMAFBEELDINGEN || null;
const foto = async (page, naam) => {
  if (SCHERM) await page.screenshot({ path: `${SCHERM}/${naam}.png` });
};
const naar = (page, activiteit) => page.locator(`.studio-activitybar [title^='${activiteit}']`).first().click();
/** Het element in de tekening van de activiteit Simulatie. */
const getekend = (page, id) => page.getByTestId("sim-diagram").locator(`g.dc-voorkomen[data-element-id="${id}"]`);

test("GPK: eigen activiteit, token op het diagram, gat met de hand, doorlopen tot Beschikt", async ({ page }) => {
  // De tips (BEGELEIDING) uit: ze schuiven over het scherm.
  await page.addInitScript(() => localStorage.setItem("studio05-hints-gezien", JSON.stringify({ gezien: {}, uit: true })));
  await openStudio(page);
  await naar(page, "Simulatie");
  await expect(page.getByTestId("sim-paneel")).toBeVisible();
  await expect(page.getByTestId("sim-start")).toBeDisabled(); // nog geen proces

  // Het voorbeeld: drie processen, beslistabel, e-dienstmodel en scenario 4.
  await page.getByTestId("sim-laad-gpk").click();
  const scenario = page.getByTestId("sim-scenario");
  await expect(scenario).toHaveValue(/GPK 4: toegekend/);
  // Scenario's hebben een beschrijvende naam en een beschrijving.
  await expect(page.getByTestId("sim-voorbeeld").locator("option").nth(5)).toHaveText("GPK 5: aanvulling, daarna afgewezen");
  await expect(page.getByTestId("sim-scenario-beschrijving")).toContainText("Een volledige aanvraag voor een passagier");
  // Start bij: het proces van het scenario; elk proces met een startevent is te kiezen.
  const startbij = page.getByTestId("sim-startproces");
  await expect(startbij).toHaveValue("aanvraag-oppakken");
  // Vier processen (Mark 13-11): de werkbak en behandelen starten op een signaal, beoordelen is een call activity.
  await expect(startbij.locator("option")).toHaveText([
    /^Aanvraag oppakken$/,
    /^Kies zaak om te behandelen \(start op een signaal: zaak-in-werkbak\)$/,
    /^Zaak behandelen \(start op een signaal: medewerker-gekoppeld\)$/,
    /^Gehandicaptenparkeerkaart beoordelen$/,
  ]);
  // Vóór de start staat het startproces al in beeld.
  await expect(getekend(page, "bp_ontvankelijkheid_toetsen")).toBeVisible();
  // De beoordeling met de hand; de rest uit de fixture.
  const sc = JSON.parse(await scenario.inputValue());
  sc.vulwijze.perGat = { "aanvraag-beoordelen": "hand" };
  await scenario.fill(JSON.stringify(sc, null, 2));

  await page.getByTestId("sim-start").click();
  await expect(page.getByTestId("sim-stand")).toHaveText(/Loopt/);
  await expect(getekend(page, "bp_start")).toHaveAttribute("data-sim-token", "klaar");
  await expect(scenario).toBeDisabled(); // tijdens de run ligt het scenario vast
  await foto(page, "1-gestart");

  await page.getByTestId("sim-stap").click();
  await page.getByTestId("sim-stap").click();
  await expect(page.getByTestId("sim-log")).toContainText("Ontvankelijkheid toetsen");
  await expect(page.getByTestId("sim-log")).toContainText("regel r_ok");
  await expect(getekend(page, "bp_ontvankelijk")).toHaveAttribute("data-sim-token", "klaar");
  await expect(getekend(page, "bp_start")).not.toHaveAttribute("data-sim-token");
  await foto(page, "2-na-beslistabel");
  // De rand ligt om de vorm, ook bij een event en een gateway (stond eerst linksboven; Mark 13-11).
  for (const id of ["bp_start", "bp_ontvankelijk"]) {
    const ligtErOm = await getekend(page, id).evaluate((g) => {
      const rand = g.querySelector("rect.sim-teken").getBoundingClientRect();
      const vormen = [...g.children].filter((k) => !k.classList.contains("sim-teken") && !k.classList.contains("dc-buitenlabel"));
      const buiten = vormen.filter((k) => {
        const b = k.getBoundingClientRect();
        return b.width && !(b.left >= rand.left - 1 && b.top >= rand.top - 1 && b.right <= rand.right + 1 && b.bottom <= rand.bottom + 1);
      });
      return buiten.map((k) => k.outerHTML.slice(0, 120)).join("\n");
    });
    expect(ligtErOm, id).toBe("");
  }

  // Op het modelcanvas alleen als je dat aanzet (Mark 14-11: de run hoort bij de simulatie, niet
  // bij het model); dan staat het token in Modelleren en verdwijnt het niet door te wisselen.
  await expect(page.locator("#sim-token-stijl")).toHaveCount(0);
  await page.getByTestId("sim-op-canvas").check();
  await expect(page.locator("#sim-token-stijl")).toHaveCount(1);
  await naar(page, "Modelleren");
  await page.evaluate(async () => {
    const { menuBus } = await import(location.origin + "/viz/react/src/studio/menuBus.js");
    const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    const st = reg.getProfieltype("bpmnMotor05").useStore.getState();
    const d = Object.values(st.diagrams).find((x) => x.naam === "Aanvraag oppakken");
    menuBus.emit("studio:open-diagram", { profielId: "bpmnMotor05", diagramId: d.id });
  });
  await wachtOpNode(page, "bp_ontvankelijk");
  await expect(node(page, "bp_ontvankelijk")).toHaveCSS("outline-color", "rgb(99, 102, 241)");
  await expect(node(page, "bp_start")).toHaveCSS("outline-color", "rgba(34, 211, 238, 0.55)"); // bezocht
  await expect(page.getByTestId("sim-paneel")).toHaveCount(0); // geen paneel meer onder het canvas
  await foto(page, "3-token-op-het-canvas");
  await naar(page, "Simulatie");
  await expect(page.getByTestId("sim-stand")).toHaveText(/Loopt/); // de run is er nog

  // Doorlopen: stopt bij het gat; het beeld volgt het token naar het beoordelingsproces.
  await page.getByTestId("sim-loop").click();
  await expect(page.getByTestId("sim-stand")).toHaveText(/Wacht op invoer: Aanvraag beoordelen/);
  await expect(getekend(page, "bp_aanvraag_beoordelen")).toHaveAttribute("data-sim-token", "gat");
  const gat = page.getByTestId("sim-gat");
  await expect(gat).toContainText("formulier aanvraag-beoordelen");
  await foto(page, "4-gat-aanvraag-beoordelen");

  // Een verplicht veld leeg laten wordt geweigerd; daarna invullen.
  await page.getByTestId("sim-vul").click();
  await expect(gat).toContainText("verplicht");
  await page.getByTestId("sim-veld-beoordeling").selectOption("toegekend");
  await page.getByTestId("sim-veld-beoordelingToelichting").fill("Advies positief.");
  await page.getByTestId("sim-vul").click();
  // Afspelen: stap voor stap tot het einde; het beeld blijft bij het proces van de laatste stap
  // staan, en de melding boven het diagram zegt waar het token naartoe sprong.
  await page.getByTestId("sim-snelheid").selectOption("snel");
  await page.getByTestId("sim-afspelen").click();
  await expect(page.getByTestId("sim-pauze")).toBeVisible();
  await expect(page.getByTestId("sim-stand")).toHaveText(/Klaar\..*zaak-behandelen: Beschikt/, { timeout: 20000 });
  await expect(page.getByTestId("sim-afspelen")).toBeVisible();
  await expect(page.getByTestId("sim-sprong")).toContainText("Het token ging bij stap");
  await expect(getekend(page, "bp_beoordeel_aanvraag")).toBeVisible(); // Zaak behandelen; niet terug naar Aanvraag oppakken
  // De signalen staan in het log, met wie ze hoorde.
  await expect(page.getByTestId("sim-log")).toContainText("△ zaak-in-werkbak → Kies zaak om te behandelen");
  await expect(page.getByTestId("sim-log")).toContainText("△ medewerker-gekoppeld → Zaak behandelen");
  await expect(page.getByTestId("sim-objecten")).toContainText("zaakAanmaken");
  await expect(page.getByTestId("sim-objecten")).toContainText('"beoordeling": "toegekend"');
  await foto(page, "5-klaar");

  // Een ander proces bekijken, en weer het token volgen.
  await page.getByTestId("sim-processen").getByRole("button", { name: /Kies zaak om te behandelen/ }).click();
  await expect(getekend(page, "bp_kies_al_gekoppeld")).toBeVisible();

  // Terugspoelen: klik op de regel van de beslistabel; het token staat weer vóór de gateway.
  await page.getByTestId("sim-log").getByText("Ontvankelijkheid toetsen", { exact: true }).click();
  await expect(page.getByTestId("sim-stand")).toHaveText(/Loopt/);
  await page.getByTestId("sim-processen").getByRole("button", { name: "volg het token" }).click();
  await expect(getekend(page, "bp_ontvankelijk")).toHaveAttribute("data-sim-token", "klaar");
  await foto(page, "6-teruggespoeld");

  // Stop: het token gaat van het diagram, ook op het canvas.
  await page.getByTestId("sim-stop").click();
  await expect(page.locator("#sim-token-stijl")).toHaveCount(0);
  await expect(page.getByTestId("sim-start")).toBeEnabled();
});
