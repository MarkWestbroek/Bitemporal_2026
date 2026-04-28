// Node ESM loader hook — resolved Vite-style aliases voor `node --test`.
// Gebruik:
//   node --import ./test/register-aliases.mjs --test src/...
//
// Houdt de aliases gesynchroniseerd met vite.config.js.

import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./alias-resolver.mjs", import.meta.url);
