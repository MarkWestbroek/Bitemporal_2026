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

  // Eerst de IDE haar eigen begin laten laden (het model van de API, of zonder API het
  // demo-model): dat komt asynchroon binnen en overschreef anders wat hier wordt gezet (de test
  // faalde daardoor sinds de e2e zonder API draait). Geen model binnen de tijd: toch doorgaan.
  await page
    .waitForFunction(() => Object.keys(window.__useModelStore.getState().elements || {}).length > 0, null, { timeout: 8_000 })
    .catch(() => {});

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
