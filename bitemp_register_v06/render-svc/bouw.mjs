/**
 * Bundelt de M2-profielen voor taal=studio naar dist/studio-profielen.mjs.
 * De rest van de sidecar blijft plain Node; alleen de profielen bevatten JSX.
 *
 * Een .jsx-module wordt hier een stub met dezelfde exportnamen, elk een no-op-functie.
 * Registraties van vormen en iconen doen dan niets, en de schets heeft ze ook niet
 * nodig. Zo komen React en React Flow niet in de bundel. Mist er een naam, dan geeft
 * esbuild een waarschuwing, en die laat de bouw hier falen.
 */
import { build } from "esbuild";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

/** De namen die een module exporteert (zoals de .jsx-bestanden ze schrijven). */
export function exportNamen(bron) {
  const namen = new Set();
  for (const m of bron.matchAll(/^\s*export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([\w$]+)/gm)) namen.add(m[1]);
  for (const m of bron.matchAll(/^\s*export\s*\{([^}]*)\}/gm)) {
    for (const deel of m[1].split(",")) {
      const naam = deel.trim().split(/\s+as\s+/).pop();
      if (naam && naam !== "default") namen.add(naam);
    }
  }
  return [...namen];
}

const leeg = {
  name: "jsx-leeg",
  setup(b) {
    b.onLoad({ filter: /\.jsx$/ }, async (a) => {
      const bron = await fs.readFile(a.path, "utf8");
      const namen = exportNamen(bron).map((n) => `export const ${n} = () => undefined;`);
      if (/^\s*export\s+default\b/m.test(bron)) namen.push("export default () => undefined;");
      return { loader: "js", contents: namen.join("\n") };
    });
  },
};

const uitkomst = await build({
  entryPoints: [fileURLToPath(new URL("./studioProfielen.js", import.meta.url))],
  outfile: fileURLToPath(new URL("./dist/studio-profielen.mjs", import.meta.url)),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  loader: { ".css": "empty", ".svg": "empty", ".png": "empty" },
  plugins: [leeg],
  logLevel: "warning",
});
if (uitkomst.warnings.length) {
  console.error(`render-svc: ${uitkomst.warnings.length} waarschuwing(en), bouw afgekeurd`);
  process.exit(1);
}
console.log("render-svc: dist/studio-profielen.mjs gebouwd");
