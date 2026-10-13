// helpers/studio.js — gedeelde opzet voor de Studio-regressietests (2026-10-13).
//
// Draaien (eigen dev-server op 5175, API niet nodig — alles wordt gemockt):
//   VITE_PRESERVE_SYMLINKS=1 npx vite --port 5175 --strictPort --host   (in een worktree)
//   PLAYWRIGHT_BASE_URL=http://localhost:5175 PLAYWRIGHT_API_URL=http://127.0.0.1:9 \
//     npx playwright test tests/e2e/1*-studio-*.spec.js
// PLAYWRIGHT_API_URL naar een dode poort laat global-setup de login overslaan.
//
// De tests vullen de profiel-stores via een dynamische import van de modules
// (zelfde instanties als de app, zolang de dev-server niet tussendoor een HMR-
// wijziging kreeg). Elke test heeft een eigen browsercontext, dus een schone
// localStorage.

/** Mock de API (ingelogde editor, verder 404) en open Modelleren in de Studio. */
export async function openStudio(page) {
  await page.route("**/api/auth/status", (r) => r.fulfill({ json: { auth_enabled: true, ingelogd: true, gebruikersnaam: "test", rol: "editor" } }));
  await page.route("**/api/**", (r) => r.fulfill({ status: 404, json: { error: "mock" } }));
  await page.goto("/viz/react/studio/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".studio-activitybar", { timeout: 60_000 });
  const m = page.locator(".studio-activitybar [title^='Modelleren']").first();
  if (await m.count()) await m.click().catch(() => {});
}

/**
 * Zet een model in een profiel en open (optioneel) het diagram.
 * elementen: [{ id, naam, type, data?, compartimenten?, source?, target?, pos?, size?, gedaante? }]
 * Elementen met `pos` komen op het diagram.
 */
export async function zetModel(page, { profielId, diagramId, diagramNaam = "Test", elementen = [], open = true, zoom = 1 }) {
  await page.evaluate(
    async ({ profielId, diagramId, diagramNaam, elementen, open, zoom }) => {
      const base = location.origin + "/viz/react/";
      const reg = await import(base + "src/studio/profieltypeRegistry.js");
      const { menuBus } = await import(base + "src/studio/menuBus.js");
      let p = null;
      for (let i = 0; i < 150 && !p; i++) {
        p = reg.getProfieltype(profielId);
        if (!p) await new Promise((r) => setTimeout(r, 100));
      }
      const s = p.useStore.getState();
      if (diagramId) s.addDiagram({ id: diagramId, naam: diagramNaam, diagramType: p.descriptor.id });
      for (const e of elementen) {
        s.addElement({ id: e.id, naam: e.naam ?? "", elementType: e.type, data: e.data || {}, compartimenten: e.compartimenten || [], ...(e.source ? { source: e.source, target: e.target } : {}) });
      }
      for (const e of elementen) {
        if (!diagramId || !e.pos) continue;
        s.addElementToDiagram(diagramId, e.id, e.pos);
        if (e.size) s.updateNodeSize(diagramId, e.id, e.size);
      }
      const gedaanten = elementen.filter((e) => e.gedaante && diagramId);
      if (gedaanten.length) {
        p.useStore.setState((st) => ({
          diagrams: { ...st.diagrams, [diagramId]: { ...st.diagrams[diagramId], nodes: st.diagrams[diagramId].nodes.map((n) => {
            const g = gedaanten.find((e) => e.id === n.elementId);
            return g ? { ...n, gedaante: g.gedaante } : n;
          }) } },
        }));
      }
      if (diagramId) {
        s.updateDiagramViewport(diagramId, { x: 0, y: 0, zoom });
        s.setActiefDiagram(diagramId);
        if (open) menuBus.emit("studio:open-diagram", { profielId, diagramId });
      }
      window.__stores = window.__stores || {};
      window.__stores[profielId] = p.useStore;
    },
    { profielId, diagramId, diagramNaam, elementen, open, zoom }
  );
}

/** Voer `fn(store)` uit in de pagina op de store van een profiel (fn als string-body). */
export async function inStore(page, profielId, fn, arg = null) {
  return page.evaluate(({ profielId, body, arg }) => new Function("store", "arg", body)(window.__stores[profielId], arg), { profielId, body: fn, arg });
}

/** De Modelleren-store (projectboom, selectie, mappen). */
export async function inModelleren(page, body, arg = null) {
  return page.evaluate(async ({ body, arg }) => {
    const { useModellerenStore } = await import(location.origin + "/viz/react/src/studio/activities/modellerenActivity.jsx");
    return new Function("ms", "arg", body)(useModellerenStore, arg);
  }, { body, arg });
}

export const node = (page, id) => page.locator(`.react-flow__node[data-id="${id}"]`);

/** Ids van geselecteerde nodes. */
export const geselecteerd = (page) => page.locator(".react-flow__node.selected").evaluateAll((els) => els.map((e) => e.dataset.id));

/** Klik met `dx` px muisbeweging tussen indrukken en loslaten (echte muizen bewegen). */
export async function klikMetBeweging(page, x, y, dx = 0) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  if (dx) await page.mouse.move(x + dx, y, { steps: 2 });
  await page.mouse.up();
}

/** HTML5-slepen met één gedeelde DataTransfer (Playwright's dragTo draagt hem niet betrouwbaar over). */
export async function sleepNaar(page, bron, doel, offset = { x: 200, y: 200 }) {
  const b = await bron.elementHandle();
  const d = await doel.elementHandle();
  await page.evaluate(([b, d, offset]) => {
    const dt = new DataTransfer();
    const r = d.getBoundingClientRect();
    const x = r.left + offset.x, y = r.top + offset.y;
    b.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
    const onder = document.elementFromPoint(x, y) || d;
    onder.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
    onder.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
    b.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, [b, d, offset]);
}

/** Wacht tot een node op het canvas staat én het beeld tot rust is gekomen. */
export async function wachtOpNode(page, id) {
  await page.locator(`.react-flow__node[data-id="${id}"]`).waitFor({ timeout: 20_000 });
  await page.waitForTimeout(700);
}
