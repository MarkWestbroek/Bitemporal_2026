import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  base: "/viz/react/",
  server: {
    port: 5174,
  },
  build: {
    outDir: "../react",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        tijdlijn: resolve(__dirname, "tijdlijn.html"),
        registraties: resolve(__dirname, "registraties.html"),
      },
    },
  },
});
