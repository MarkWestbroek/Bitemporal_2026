import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { readdir, readFile, writeFile } from "fs/promises";
import { readFileSync } from "fs";
import { execSync } from "child_process";

// ── Versie-/build-info voor de frontend ───────────────────────────────────
// Eén bron van waarheid: de version uit package.json. Wordt via `define`
// (zie onder) als compile-time constanten in de bundle gezet en bv. in het
// "Over Omnium Studio"-dialoog getoond. Zo komt de frontend-versie overeen met
// de Docker-image-tag (zie docs/TRUENAS_DEPLOYMENT.md).
const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8"));
const APP_VERSION = pkg.version;
const BUILD_DATE = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
// Git short-SHA is handig maar niet altijd beschikbaar: in de Docker-build wordt
// alleen web/vite/ gekopieerd (geen .git). Daarom guarded met fallback op een
// env-var (door de build mee te geven) en anders leeg.
let GIT_SHA = process.env.VITE_GIT_SHA || "";
if (!GIT_SHA) {
  try {
    GIT_SHA = execSync("git rev-parse --short HEAD", { cwd: __dirname, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    GIT_SHA = "";
  }
}

// Plugin: normaliseer line endings naar LF in alle HTML-bestanden na de build.
// Voorkomt CRLF/mixed-ending diffs tussen Windows en Mac (Git ziet mixed endings als binary).
function normalizeBuildLineEndings() {
  return {
    name: "normalize-line-endings",
    apply: "build",
    async closeBundle() {
      const outDir = resolve(__dirname, "../react");
      const files = await readdir(outDir);
      for (const f of files.filter((n) => n.endsWith(".html"))) {
        const p = resolve(outDir, f);
        const content = await readFile(p, "utf8");
        const normalized = content.replace(/\r\n|\r/g, "\n");
        if (normalized !== content) {
          await writeFile(p, normalized, "utf8");
          console.log(`  ✓ LF-normalized: ${f}`);
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), normalizeBuildLineEndings()],
  base: "/viz/react/",
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __BUILD_DATE__: JSON.stringify(BUILD_DATE),
    __GIT_SHA__: JSON.stringify(GIT_SHA),
  },
  resolve: {
    alias: {
      // Alias naar de UML-editor module binnen web/vite/src/umleditor
      "@umleditor": resolve(__dirname, "src/umleditor"),
    },
  },
  server: {
    port: 5174,
  },
  build: {
    outDir: "../react",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        tijdlijn: resolve(__dirname, "tijdlijn.html"),
        registraties: resolve(__dirname, "registraties.html"),
        editor: resolve(__dirname, "editor.html"),
        "editor-v2": resolve(__dirname, "editor-v2.html"),
        inhoud: resolve(__dirname, "inhoud.html"),
        ide: resolve(__dirname, "ide.html"),
        studio: resolve(__dirname, "studio.html"),
        universum: resolve(__dirname, "universum.html"),
        modelpicker: resolve(__dirname, "modelpicker.html"),
        "dmn-demo": resolve(__dirname, "dmn-demo.html"),
        "bericht-demo": resolve(__dirname, "bericht-demo.html"),
        "bpmn-demo": resolve(__dirname, "bpmn-demo.html"),
        "lineage-demo": resolve(__dirname, "lineage-demo.html"),
        publicatie: resolve(__dirname, "publicatie.html"),
      },
    },
  },
});
