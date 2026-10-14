// Studio — kennismakingstour (HELP-2, 14-10): start vanzelf bij het eerste bezoek, wijst
// echte plekken aan, gaat vanzelf door als je de opdracht doet, en komt daarna niet terug.
import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

test("rondleiding: eerste bezoek, diagram en element maken, klaar en onthouden", async ({ page }) => {
  await openStudio(page, { tour: true });
  const ballon = page.locator(".studio-tour__ballon");
  await expect(ballon).toContainText("Welkom in Omnium Studio", { timeout: 10_000 });
  await page.keyboard.press("ArrowRight");
  await expect(ballon).toContainText("Activiteiten");
  await expect(page.locator(".studio-tour__spot")).toBeVisible();
  await ballon.getByRole("button", { name: /Volgende/ }).click();
  await expect(ballon).toContainText("Het project");
  await page.keyboard.press("Enter");
  await expect(ballon).toContainText("Begin met een diagram");
  // De opdracht doen: een diagram maken. De naamdialoog krijgt de toetsen, niet de tour.
  await page.locator('[data-tour="nieuw-diagram"] button', { hasText: "Use case" }).first().click();
  await page.keyboard.press("Enter");
  await expect(ballon).toContainText("Elementen maken");
  await page.locator('[data-balk-id="maken"] button').first().click();
  await expect(ballon).toContainText("Eigenschappen");
  await page.keyboard.press("ArrowRight");
  await expect(ballon).toContainText("Zoek elke opdracht");
  await page.keyboard.press("ArrowLeft");
  await expect(ballon).toContainText("Eigenschappen");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(ballon).toContainText("Help");
  await ballon.getByRole("button", { name: "Klaar" }).click();
  await expect(page.getByTestId("tour")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("studio05-tour-v1"))).toBe("gezien");
  // Volgende keer niet vanzelf; wel via Help → Rondleiding.
  await page.reload();
  await page.waitForSelector(".studio-activitybar");
  await page.waitForTimeout(1600);
  await expect(page.getByTestId("tour")).toHaveCount(0);
  await page.locator('[data-tour="menu-help"]').click();
  await page.getByText("Rondleiding", { exact: true }).click();
  await expect(ballon).toContainText("Welkom");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("tour")).toHaveCount(0);
});
