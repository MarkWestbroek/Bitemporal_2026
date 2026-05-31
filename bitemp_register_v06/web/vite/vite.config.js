import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { readdir, readFile, writeFile } from "fs/promises";

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
        universum: resolve(__dirname, "universum.html"),
        modelpicker: resolve(__dirname, "modelpicker.html"),
        "dmn-demo": resolve(__dirname, "dmn-demo.html"),
        "bericht-demo": resolve(__dirname, "bericht-demo.html"),
        "bpmn-demo": resolve(__dirname, "bpmn-demo.html"),
        publicatie: resolve(__dirname, "publicatie.html"),
      },
    },
  },
});
