/**
 * prismSetup — laad prismjs core en maak het als globale `Prism` beschikbaar.
 *
 * De taal-componenten van prismjs (`prismjs/components/prism-*`) verwachten een
 * globale `Prism`-variabele wanneer ze evalueren. In de dev-server wordt die
 * global meestal vanzelf gezet, maar in de **productiebundel** (Vite 8 / rolldown,
 * strikte ESM) niet — daardoor crasht de pagina alleen in productie met
 * "Prism is not defined" (o.a. op studio.html en ide.html, via ExpressieEditor).
 *
 * Door dit module te importeren *vóór* de `prismjs/components/prism-*`-imports
 * staat `globalThis.Prism` klaar op het moment dat die componenten zichzelf
 * registreren. Importeer in een component dus eerst dit bestand en daarna de
 * gewenste taal-componenten.
 */
import Prism from "prismjs";

if (typeof globalThis !== "undefined" && !globalThis.Prism) {
  globalThis.Prism = Prism;
}

export default Prism;
