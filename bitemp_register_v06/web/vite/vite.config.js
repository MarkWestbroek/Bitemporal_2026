import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { readdir, readFile, writeFile } from "fs/promises";
import { readFileSync, existsSync, mkdirSync, readdirSync, writeFileSync, unlinkSync } from "fs";
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

// Plugin (alleen dev): /__studio05/<sub> ↔ de map web/vite/<sub>/.
// Zo persisteren Studio-artefacten (profielen: kern+layout+icoon — P04; en
// vormen: data-shapes) als json-bestanden in de repo, die via git meereizen
// naar andere dev-machines. In een productie-build bestaat het endpoint niet;
// de studio valt dan terug op localStorage (+ build-glob).
function studio05Map(sub) {
  const map = resolve(__dirname, sub);
  const geldigId = (id) => /^[a-z0-9][a-z0-9-]*$/.test(id);
  return {
    name: `studio05-${sub}`,
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(`/__studio05/${sub}`, (req, res) => {
        try {
          if (!existsSync(map)) mkdirSync(map, { recursive: true });
          const pad = (req.url || "/").split("?")[0];
          const id = decodeURIComponent(pad.replace(/^\//, ""));
          if (req.method === "GET" && !id) {
            const alles = {};
            for (const f of readdirSync(map).filter((n) => n.endsWith(".json"))) {
              try {
                alles[f.replace(/\.json$/, "")] = JSON.parse(readFileSync(resolve(map, f), "utf8"));
              } catch {
                /* kapot bestand: overslaan, niet crashen */
              }
            }
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(alles));
            return;
          }
          if (req.method === "PUT" && geldigId(id)) {
            let body = "";
            req.on("data", (d) => (body += d));
            req.on("end", () => {
              try {
                JSON.parse(body); // valideer vóór schrijven
                writeFileSync(resolve(map, `${id}.json`), body.endsWith("\n") ? body : `${body}\n`, "utf8");
                res.statusCode = 204;
                res.end();
              } catch (e) {
                res.statusCode = 400;
                res.end(String(e?.message || e));
              }
            });
            return;
          }
          if (req.method === "DELETE" && geldigId(id)) {
            const bestand = resolve(map, `${id}.json`);
            if (existsSync(bestand)) unlinkSync(bestand);
            res.statusCode = 204;
            res.end();
            return;
          }
          res.statusCode = 405;
          res.end();
        } catch (e) {
          res.statusCode = 500;
          res.end(String(e?.message || e));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), normalizeBuildLineEndings(), studio05Map("profielen"), studio05Map("vormen")],
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
