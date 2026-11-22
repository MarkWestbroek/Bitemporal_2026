/**
 * iconenSvg — de ingebouwde iconen als SVG-tekst (plan 2026-11-21 Sidecar-project §7 stap 2).
 *
 * De JSX-iconen blijven de reserve in de code; web/vite/src/diagramcore/shapes/ingebouwdeIconen.js
 * bevat dezelfde iconen als SVG-tekst, voor het weergaveproject. Dit script bundelt de JSX met
 * React (iconenBron.jsx), tekent elk icoon met renderToStaticMarkup en zet het om met
 * markupNaarIcoonSvg (iconenAlsSvg.js).
 *
 *   npm run iconen    ingebouwdeIconen.js opnieuw schrijven (na een wijziging in een JSX-icoon)
 *   npm test          iconenSvg.test.mjs faalt als code en tekst uit elkaar lopen
 *
 * React en react-dom komen uit web/vite/node_modules: dit draait alleen in de ontwikkelomgeving,
 * niet in Dockerfile.render.
 */
import { build } from "esbuild";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const hier = (p) => fileURLToPath(new URL(p, import.meta.url));
export const VAST = hier("../web/vite/src/diagramcore/shapes/ingebouwdeIconen.js");
const VITE_MODULES = hier("../web/vite/node_modules");
const BUNDEL = hier("./dist/iconen-bron.mjs");

/** Kan het hier? (React uit web/vite/node_modules) */
export const kanGenereren = () => fs.existsSync(`${VITE_MODULES}/react-dom/server.js`);

/** Bundel iconenBron.jsx en laad hem. */
export async function laadBron() {
  await build({
    entryPoints: [hier("./iconenBron.jsx")],
    outfile: BUNDEL,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    jsx: "automatic",
    loader: { ".css": "empty", ".svg": "empty", ".png": "empty" },
    nodePaths: [VITE_MODULES],
    // react-dom/server is CommonJS: require() van Node-modules in een ESM-bundel.
    banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "error",
  });
  return import(pathToFileURL(BUNDEL).href + `?t=${Date.now()}`);
}

/** id → SVG-tekst van alle ingebouwde iconen, gesorteerd; plus wat svgSchoon weg moest laten. */
export async function genereer(bron) {
  const iconen = {};
  const weg = {};
  const markup = bron.ingebouwdeIconenAlsMarkup();
  for (const id of Object.keys(markup).sort()) {
    const uit = bron.markupNaarIcoonSvg(markup[id]);
    iconen[id] = uit.svg;
    if (uit.weg.length) weg[id] = uit.weg;
  }
  return { iconen, weg };
}

export function alsModule(iconen) {
  return `// GEGENEREERD door render-svc/iconenSvg.mjs (npm run iconen) — niet met de hand wijzigen.
// De ingebouwde iconen als SVG-tekst (plan 2026-11-21 Sidecar-project §7 stap 2). De reserve blijft
// de JSX in typeIconen.jsx en diagramprofielen/*/iconen.jsx; npm test in render-svc bewaakt dat
// beide gelijk zijn. Standaardiconen per ShapeType hebben de id "vorm:<shape>".
export const INGEBOUWDE_ICONEN = ${JSON.stringify(iconen, null, 2)};
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  if (!kanGenereren()) {
    console.error("iconen: react-dom ontbreekt in web/vite/node_modules (npm ci in web/vite)");
    process.exit(1);
  }
  const { iconen, weg } = await genereer(await laadBron());
  if (Object.keys(weg).length) {
    console.error("iconen: svgSchoon liet iets weg; pas het JSX-icoon aan:", weg);
    process.exit(1);
  }
  if (process.argv.includes("--bijwerken")) {
    fs.writeFileSync(VAST, alsModule(iconen));
    console.log(`iconen: ${Object.keys(iconen).length} iconen naar ${VAST}`);
  } else {
    console.log(`iconen: ${Object.keys(iconen).length} iconen (niets geschreven; --bijwerken om te schrijven)`);
  }
}
