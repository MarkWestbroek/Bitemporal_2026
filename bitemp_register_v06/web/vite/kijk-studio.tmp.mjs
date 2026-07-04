// Kijkscript (tijdelijk): taakbalk-close-ups per 0.5-profiel in beide thema's.
import { chromium } from "playwright";

const uit = "C:/Users/User/AppData/Local/Temp/claude/d--Git-Bitemporal-2026/1e13b26d-261b-44c7-976e-9c4cb2e47fb6/scratchpad";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("[console]", m.text()); });
// window.prompt bij "+ Nieuw diagram": naam invullen.
page.on("dialog", (d) => d.accept("Proefdiagram"));

await page.goto("http://localhost:5174/viz/react/studio.html", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

async function huidigThema() {
  return page.evaluate(() =>
    document.querySelector("[data-studio-theme]")?.getAttribute("data-studio-theme") || "?"
  );
}
async function wisselThema(doel) {
  for (let i = 0; i < 2; i++) {
    if ((await huidigThema()) === doel) return;
    await page.locator('button[title*="thema"]').first().click();
    await page.waitForTimeout(350);
  }
  console.log("thema nu:", await huidigThema(), "(gevraagd:", doel + ")");
}

const clip = { x: 335, y: 90, width: 880, height: 560 };

async function schiet(naam) {
  await wisselThema("light");
  await page.screenshot({ path: `${uit}/06-${naam}-licht.png`, clip });
  await wisselThema("dark");
  await page.screenshot({ path: `${uit}/06-${naam}-donker.png`, clip });
}

// 1) canoniek: heeft al inhoud.
await page.locator('button[title="Diagrammen (0.5) (preview)"]').click();
await page.waitForTimeout(800);
await schiet("canoniek");

// 2..4) lege sandboxes: eerst een diagram aanmaken.
const rest = [
  ["UML (0.5) (preview)", "puur-uml"],
  ["OAS (0.5) (preview)", "oas31"],
  ["Profiel-ontwerp (0.5) (preview)", "profiel-ontwerp"],
];
for (const [titel, naam] of rest) {
  await page.locator(`button[title="${titel}"]`).click();
  await page.waitForTimeout(700);
  const nieuw = page.locator("button", { hasText: "+ Nieuw diagram" }).first();
  const leeg = await page.getByText("Geen diagram geselecteerd").count();
  if (leeg && (await nieuw.count())) {
    await nieuw.click();
    await page.waitForTimeout(700);
  }
  await schiet(naam);
}

await browser.close();
console.log("klaar, thema:", await new Promise((r) => r("zie screenshots")));
