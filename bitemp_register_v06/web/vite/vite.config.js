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
      // Alias naar de UML-editor subtree, zodat imports via @editor/... werken
      "@editor": resolve(__dirname, "../../uml-editor/src"),
      // Zorg dat @xyflow/react vanuit de subtree-bestanden ook resolved wordt
      // vanuit onze eigen node_modules (niet vanuit uml-editor/)
      "@xyflow/react": resolve(__dirname, "node_modules/@xyflow/react"),
      // Vite 8/Rolldown: resolve react en react-dom vanuit de subtree naar
      // onze eigen node_modules (uml-editor heeft geen eigen node_modules)
      "react": resolve(__dirname, "node_modules/react"),
      "react-dom": resolve(__dirname, "node_modules/react-dom"),
    },
  },
  server: {
    port: 5174,
    watch: {
      // Zorg dat wijzigingen in de uml-editor subtree ook HMR triggeren
      ignored: ["!**/uml-editor/src/**"],
    },
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
        publicatie: resolve(__dirname, "publicatie.html"),
      },
    },
  },
});
