// Studio — document kopiëren voor Teams/Confluence (16-10, Mark): rijk klembord (text/html) met
// de diagrammen als PNG i.p.v. SVG-code, plus platte tekst zonder SVG.
import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

test("Kopieer voor Teams/Confluence: html met <img> (PNG), geen <svg>", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openStudio(page);
  await page.evaluate(async () => {
    const { useDocumentStore } = await import(location.origin + "/viz/react/src/studio/activities/documentVoorbeeld.jsx");
    const svg = '<svg width="300" height="120" viewBox="0 0 300 120"><title>Overzicht</title><rect x="10" y="10" width="280" height="100" fill="#bae6fd" stroke="#0369a1"/><text x="40" y="70">Leen boek</text></svg>';
    const markdown = `# Testdocument\n\nEen alinea.\n\n## Diagram: Overzicht\n\n${svg}\n`;
    useDocumentStore.getState().toon({ titel: "Testdocument", markdown, html: `<html><body>${svg}</body></html>` });
  });
  await page.getByTestId("kopieer-rijk").click();
  await expect(page.getByText("Gekopieerd voor Teams/Confluence")).toBeVisible();
  const klembord = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    const html = await (await item.getType("text/html")).text();
    const tekst = await (await item.getType("text/plain")).text();
    return { html, tekst, typen: item.types };
  });
  expect(klembord.typen).toEqual(expect.arrayContaining(["text/html", "text/plain"]));
  expect(klembord.html).not.toContain("<svg");
  expect(klembord.html).toMatch(/<img src="data:image\/png;base64,[A-Za-z0-9+/=]{200,}" width="300" height="120" alt="Overzicht">/);
  expect(klembord.html).toContain("Testdocument");
  expect(klembord.tekst).toContain("[Diagram 1]");
  expect(klembord.tekst).not.toContain("<svg");
});
