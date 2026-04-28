// Minimal alias-resolver voor node:test.
// Mapt de Vite-aliases (zie vite.config.js) naar relatieve paden.

import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve as resolvePath, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolvePath(__dirname, "..", "src");

const ALIASES = {
  "@umleditor/": resolvePath(SRC, "umleditor") + "/",
  "@store/": resolvePath(SRC, "store") + "/",
  "@shared/": resolvePath(SRC, "shared") + "/",
  "@ide/": resolvePath(SRC, "ide") + "/",
};

export async function resolve(specifier, context, nextResolve) {
  for (const [prefix, target] of Object.entries(ALIASES)) {
    if (specifier.startsWith(prefix)) {
      const rest = specifier.slice(prefix.length);
      const full = target + rest;
      return nextResolve(pathToFileURL(full).href, context);
    }
  }
  return nextResolve(specifier, context);
}
