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
  // Pijltjestoetsen (Mark 16-11): → een stap, ← een regel terug.
  await page.keyboard.press("ArrowRight");
  await expect(getekend(page, "bp_start")).not.toHaveAttribute("data-sim-token", "klaar");
  await page.keyboard.press("ArrowLeft");
  await expect(getekend(page, "bp_start")).toHaveAttribute("data-sim-token", "klaar");

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
  // De aanvraag in de cm-vorm (POC 14-11): entiteit, geërfde GE's, de toets, en wat buiten het cm staat.
  const cm = page.getByTestId("sim-cm").first();
  await expect(cm).toContainText("Gehandicaptenparkeerkaartaanvraag");
  await expect(cm).toContainText("erft van Aanvraag");
  await expect(cm.getByTestId("sim-cm-toets")).toContainText("✓ verplichte velden ingevuld");
  await expect(cm.locator('[data-pad="Aanvraag.Aanvraagidentificatie.aanvraagnummer"]')).toContainText("GPK-2026-0001");
  await expect(cm.getByTestId("sim-cm-buiten")).toContainText("toegekend");
  await foto(page, "5b-cm-vorm");
  // Versies (Mark 14-11): elke stap die het object raakt; een oude versie bekijken markeert wat er toen veranderde.
  const aanvraag = page.locator('[data-testid="sim-object"][data-object="aanvraag-1"]');
  await expect(aanvraag.getByTestId("sim-object-versie")).toHaveText("v5");
  await aanvraag.getByTestId("sim-versie-3").click();
  await expect(aanvraag.getByTestId("sim-object-versie")).toHaveText("v3 van 5");
  await expect(aanvraag.getByTestId("sim-versie-wat")).toContainText("Kies zaak om te behandelen");
  await expect(aanvraag.getByTestId("sim-cm-buiten").locator('[data-gewijzigd="ja"]')).toHaveText(/behandelaar/);
  await expect(aanvraag.getByTestId("sim-cm-buiten")).not.toContainText("toegekend"); // toen nog niet beoordeeld
  await foto(page, "5c-versie-3");
  await aanvraag.getByTestId("sim-versie-nu").click();
  await expect(aanvraag.getByTestId("sim-object-versie")).toHaveText("v5");
  await page.getByTestId("sim-cm-json").first().click();
  await expect(page.getByTestId("sim-objecten")).toContainText('"beoordeling": "toegekend"');
  // De kaart (Mark 15-11): de entiteit met de GE's erin en de waarden.
  await page.getByTestId("sim-cm-kaart").first().click();
  const kaart = page.getByTestId("sim-kaart").first();
  await expect(kaart).toContainText("«entiteit»");
  await expect(kaart.locator('[data-testid="sim-kaart-ge"][data-pad="Aanvraag.Aanvraagidentificatie"]')).toContainText("GPK-2026-0001");
  await expect(kaart.getByTestId("sim-kaart-relatie").first()).toBeVisible();
  await foto(page, "5d-kaart");
  await page.getByTestId("sim-cm-vorm").first().click();
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

test("donker thema: de tekening volgt het thema, namen buiten de vorm zijn licht (Mark 15-11)", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("studio05-hints-gezien", JSON.stringify({ gezien: {}, uit: true })));
  await openStudio(page);
  await naar(page, "Simulatie");
  // Het thema blijft bewaard; staat het al op donker, dan heet de knop "Licht thema".
  const wissel = page.getByTitle(/^(Donker|Licht) thema$/).first();
  if ((await wissel.getAttribute("title")) === "Donker thema") await wissel.click();
  await expect(page.locator('[data-studio-theme="dark"]').first()).toBeVisible();
  await page.getByTestId("sim-laad-gpk").click();
  await expect(page.getByTestId("sim-scenario")).toHaveValue(/GPK 4: toegekend/);
  await expect(page.getByTestId("sim-start")).toBeEnabled();
  await page.getByTestId("sim-start").click();
  const tekening = page.getByTestId("sim-diagram");
  const achtergrond = await tekening.evaluate((d) => getComputedStyle(d).backgroundColor);
  expect(achtergrond).not.toBe("rgb(255, 255, 255)");
  // De buitenlabels (events, gateways) zijn licht op het donkere vlak.
  const label = await tekening.locator("text.dc-buitenlabel").first().evaluate((t) => getComputedStyle(t).fill);
  expect(label).not.toBe("rgb(15, 23, 42)");
  await foto(page, "7-donker");
});

test("data-object met een type toont het object van de run: versie, geel bij een wijziging, toets op de toestand, klik toont het object (Mark 15-11)", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("studio05-hints-gezien", JSON.stringify({ gezien: {}, uit: true })));
  await openStudio(page);
  // Het cm: Aanvraag (id "Aanvraag", zoals het type van het data-object in het voorbeeld) met het subtype van het scenario-object.
  await zetModel(page, { profielId: "diagram05", diagramId: "d_cm", diagramNaam: "Aanvragen", open: false, elementen: [
    { id: "Aanvraag", naam: "Aanvraag", type: "entiteit", pos: { x: 100, y: 100 } },
    { id: "e_gpk", naam: "GehandicaptenparkeerkaartAanvraag", type: "entiteit", pos: { x: 100, y: 300 } },
    { id: "g1", type: "generalisatie", source: "e_gpk", target: "Aanvraag" },
  ] });
  await naar(page, "Simulatie");
  await page.getByTestId("sim-laad-gpk").click();
  await expect(page.getByTestId("sim-scenario")).toHaveValue(/GPK 4: toegekend/);
  // Het startobject past bij het invoer-data-object van Aanvraag oppakken (§11.8 stap 4).
  await expect(page.getByTestId("sim-startobject-toets")).toHaveAttribute("data-past", "true");
  await expect(page.getByTestId("sim-startobject-toets")).toContainText("is een Aanvraag");
  // Het data-object "Aanvraag [ingediend]" boven Ontvankelijkheid toetsen staat in het voorbeeld (Mark 15-11).
  const DO = "bp_1794782741400_1";
  const toets = (toestand) =>
    page.evaluate(async ({ DO, toestand }) => {
      const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
      const st = reg.getProfieltype("bpmnMotor05").useStore.getState();
      st.updateElement(DO, { data: { ...st.elements[DO].data, toestand } });
    }, { DO, toestand });
  await page.getByTestId("sim-start").click();
  const dobj = getekend(page, DO);
  await expect(dobj).toHaveAttribute("data-sim-object", "aanvraag-1");
  await expect(dobj).toHaveAttribute("data-sim-gewijzigd", "");
  await expect(dobj).toHaveAttribute("data-sim-klopt", "true");
  await expect(dobj.getByTestId("sim-dataobject-versie")).toHaveText("v1");
  // Een stap die het object niet raakt: niet meer geel.
  await page.getByTestId("sim-stap").click();
  await expect(dobj).not.toHaveAttribute("data-sim-gewijzigd", "");
  // Klik: het object in de cm-vorm onder het diagram.
  await dobj.click();
  await expect(page.getByTestId("sim-dataobject-object")).toContainText("aanvraag-1");
  // Zet het model een andere toestand op het data-object, dan klopt het niet meer (rood gestippeld).
  await toets("beoordeeld");
  await expect(dobj).toHaveAttribute("data-sim-klopt", "false");
  // Doorlopen tot het einde: de aanvraag heeft versies erbij (terug naar Aanvraag oppakken om het te zien).
  await page.getByTestId("sim-loop").click();
  await expect(page.getByTestId("sim-stand")).toHaveText(/^Klaar/);
  // De log (Mark 16-11): schuift mee naar de nieuwste regel, en is met de greep groter te maken.
  const logvak = page.getByTestId("sim-log");
  await expect.poll(() => logvak.evaluate((el) => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) < 4)).toBe(true);
  const voor = (await logvak.boundingBox()).height;
  const greep = await page.getByTestId("sim-log-greep").boundingBox();
  await page.mouse.move(greep.x + 50, greep.y + 3);
  await page.mouse.down();
  await page.mouse.move(greep.x + 50, greep.y - 97, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => Math.round((await logvak.boundingBox()).height - voor)).toBe(100);
  await page.getByTestId("sim-log-greep").dblclick();
  await page.getByTestId("sim-processen").getByRole("button", { name: "Aanvraag oppakken" }).click();
  await expect(dobj.getByTestId("sim-dataobject-versie")).not.toHaveText("v1");
  await foto(page, "8-dataobject");
  // Lijnen en objecten (§11.8 stap 4, Mark 16-11): de medewerker schrijft de aanvraag, maar de lijn leest alleen.
  await expect(page.getByTestId("sim-processen").getByRole("button", { name: /Zaak behandelen/ }).getByTestId("sim-proces-bevindingen")).toHaveText("1");
  await page.getByTestId("sim-processen").getByRole("button", { name: /Gehandicaptenparkeerkaart beoordelen/ }).click();
  await expect(page.getByTestId("sim-lijnen")).toContainText("Aanvraag beoordelen schrijft aanvraag-1 (GehandicaptenparkeerkaartAanvraag)");
  await expect(page.getByTestId("sim-diagram").locator('[data-testid="sim-lijn-fout"][data-lijn="conn_do_beo_aanvraag"]')).toHaveCount(1);
  await expect(getekend(page, "bp_aanvraag_beoordelen")).toHaveAttribute("data-sim-lijnfout", "1");
  await page.getByTestId("sim-processen").getByRole("button", { name: /Zaak behandelen/ }).click();
  await expect(page.getByTestId("sim-lijnen")).toContainText("Stel beschikking op schrijft aanvraag-1");
  await foto(page, "9-lijnen");
});
