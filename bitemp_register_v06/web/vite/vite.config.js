import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
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
    rolldownOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        tijdlijn: resolve(__dirname, "tijdlijn.html"),
        registraties: resolve(__dirname, "registraties.html"),
        editor: resolve(__dirname, "editor.html"),
        "editor-v2": resolve(__dirname, "editor-v2.html"),
        inhoud: resolve(__dirname, "inhoud.html"),
        ide: resolve(__dirname, "ide.html"),
        publicatie: resolve(__dirname, "publicatie.html"),
      },
    },
  },
});
