// Meet de effectieve canvas-achtergrond in donker thema (tijdelijk script).
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto("http://localhost:5174/viz/react/studio.html", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.locator('button[title="Diagrammen (0.5) (preview)"]').click();
await page.waitForTimeout(800);

for (const doel of ["light", "dark"]) {
  const nu = await page.evaluate(() =>
    document.querySelector("[data-studio-theme]")?.getAttribute("data-studio-theme")
  );
  if (nu !== doel) {
    await page.locator('button[title*="thema"]').first().click();
    await page.waitForTimeout(350);
  }
  const info = await page.evaluate(() => {
    const el = document.querySelector(".dc-canvas");
    const kleuren = [];
    let n = el;
    while (n && n !== document.documentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
        kleuren.push(`${n.className?.toString().slice(0, 40) || n.tagName}: ${bg}`);
      }
      n = n.parentElement;
    }
    const stijl = getComputedStyle(el);
    return {
      kleuren,
      sCanvas: stijl.getPropertyValue("--s-canvas").trim(),
      markerVulling: stijl.getPropertyValue("--dc-marker-vulling").trim(),
      canvasToken: stijl.getPropertyValue("--dc-canvas-achtergrond").trim(),
    };
  });
  console.log(doel, JSON.stringify(info, null, 1));
}
await browser.close();
