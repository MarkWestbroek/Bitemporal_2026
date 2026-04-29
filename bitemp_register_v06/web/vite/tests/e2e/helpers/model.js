// Helpers voor e2e-tests: model-injectie via window.__useModelStore (dev-only hook).
//
// In dev-build is `window.__useModelStore` de Zustand store. We gebruiken hem om
// snel een minimaal test-model te injecteren zonder UI-import door te lopen.

/**
 * Injecteer een minimaal modelstaat met:
 *  - één domein "test_dom"
 *  - twee entiteiten A en B
 *  - één diagram "smoke_diag"
 *
 * @param {import('@playwright/test').Page} page
 * @param {{diagramId?: string, diagramNaam?: string, domein?: string}} [opts]
 */
export async function injectMinimaalModel(page, opts = {}) {
  const diagramId = opts.diagramId || "smoke_diag";
  const diagramNaam = opts.diagramNaam || "Smoke diagram";
  const domein = opts.domein || "test_dom";

  await page.waitForFunction(() => !!window.__useModelStore, null, { timeout: 10_000 });

  await page.evaluate(
    ({ diagramId, diagramNaam, domein }) => {
      const store = window.__useModelStore.getState();
      // Reset naar lege staat (behoudens domains-lijst)
      window.__useModelStore.setState({
        elements: {
          A: { id: "A", naam: "A", type: "entiteit", domein, data: { typenaam: "A", velden: [], afgeleideVelden: [] } },
          B: { id: "B", naam: "B", type: "entiteit", domein, data: { typenaam: "B", velden: [], afgeleideVelden: [] } },
        },
        diagrams: {
          [diagramId]: {
            id: diagramId,
            naam: diagramNaam,
            domein,
            nodes: [
              { id: "A", type: "entiteit", position: { x: 100, y: 100 }, data: { name: "A" } },
              { id: "B", type: "entiteit", position: { x: 400, y: 100 }, data: { name: "B" } },
            ],
            edges: [],
          },
        },
        domains: Array.from(new Set([...(store.domains || []), domein])),
      });
    },
    { diagramId, diagramNaam, domein }
  );
}
