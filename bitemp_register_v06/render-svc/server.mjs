/**
 * render-svc — interne Node-sidecar die modeldiagrammen als SVG rendert.
 *
 * Draait de pure tekenaar uit web/vite/src/diagramsvg (dezelfde code als
 * Studio), zodat de Go-API niet een tweede tekenaar hoeft te hebben. De Go-API
 * is de publieke voorkant (auth, model ophalen, asOf, ETag) en praat alleen
 * intern met deze service. Contract: docs/RENDER_API.md.
 *
 *   POST /render/svg  { taal, model | code, diagram, domein, entiteiten,
 *                       richting, theme, velden, afhankelijkheden,
 *                       idPrefix, linkPattern }
 *                     of { taal: "studio", model | code, profiel, diagram, theme, idPrefix }
 *                     → 200 image/svg+xml, of application/problem+json
 *   POST /views       { taal, model | code, profiel } → { diagrammen, domeinen }
 *   GET  /health      → { ok: true, versie }
 *
 * Geen runtime-dependencies. taal=studio gebruikt de profielbundel uit bouw.mjs
 * (`npm install && npm run bouw`); zonder bundel geeft alleen die taal een 503.
 * Omgeving: RENDER_SVC_PORT (standaard 8095),
 * RENDER_SVC_HOST (standaard 127.0.0.1 — niet publiek binden),
 * RENDER_SVC_MAX_BYTES (standaard 5 MB).
 */
import http from "node:http";
import fs from "node:fs";
import { renderDiagramSvg, diagramViews, RenderFout } from "../web/vite/src/diagramsvg/index.js";
import { renderStudioSvg, studioViews, STUDIO_VELDEN } from "../web/vite/src/diagramsvg/studio.js";

const PORT = Number(process.env.RENDER_SVC_PORT || 8095);
const HOST = process.env.RENDER_SVC_HOST || "127.0.0.1";
const MAX_BYTES = Number(process.env.RENDER_SVC_MAX_BYTES || 5 * 1024 * 1024);

/**
 * De versie van deze sidecar (render-svc/package.json; de git-tag is render/v<versie>). Staat in
 * elke SVG als `data-render-versie` en in de header `X-Render-Versie`: de tekening verandert per
 * release, en wie een SVG bewaart (bv. het inrichtingsregister) legt vast waarmee hij getekend is.
 * Het attribuut komt ook door de Go-API, die de body ongewijzigd doorgeeft.
 */
export const RENDER_VERSIE = (() => {
  try {
    return JSON.parse(fs.readFileSync(new URL("./package.json", import.meta.url), "utf8")).version || "onbekend";
  } catch {
    return "onbekend";
  }
})();

/** Zet de versie op het wortelelement; de rest van de SVG blijft byte-gelijk. */
export const metVersie = (svg) => svg.replace(/^<svg\b/, `<svg data-render-versie="${RENDER_VERSIE}"`);

const RENDER_VELDEN = new Set(["taal", "model", "code", "diagram", "domein", "entiteiten", "richting", "theme", "velden", "afhankelijkheden", "idPrefix", "linkPattern"]);
const VIEWS_VELDEN = new Set(["taal", "model", "code"]);
const STUDIO_VIEWS_VELDEN = new Set(["taal", "model", "code", "profiel"]);

function stuurProbleem(res, fout) {
  const body = JSON.stringify(fout.toProblem());
  res.writeHead(fout.status, { "Content-Type": "application/problem+json; charset=utf-8" });
  res.end(body);
}

function probleem(status, code, title, detail) {
  return new RenderFout(status, code, title, detail);
}

function leesBody(req) {
  return new Promise((resolve, reject) => {
    const delen = [];
    let lengte = 0;
    req.on("data", (d) => {
      lengte += d.length;
      if (lengte > MAX_BYTES) {
        reject(probleem(413, "te-groot", "Verzoek te groot", `Het verzoek is groter dan ${MAX_BYTES} bytes.`));
        req.destroy();
        return;
      }
      delen.push(d);
    });
    req.on("end", () => resolve(Buffer.concat(delen).toString("utf8")));
    req.on("error", reject);
  });
}

const isStudio = (invoer) => String(invoer.taal ?? "").toLowerCase() === "studio";

/**
 * De profielen voor taal=studio staan in een aparte bundel (bouw.mjs). Dynamisch geladen:
 * ontbreekt of faalt de bundel, dan blijft taal=v3 gewoon werken.
 */
let bundel;
function laadBundel() {
  bundel ??= import("./dist/studio-profielen.mjs")
    .catch((e) => {
      bundel = undefined;
      console.error("render-svc: profielbundel niet geladen", e);
      throw probleem(503, "studio-niet-beschikbaar", "taal=studio niet beschikbaar", "De profielbundel van de renderservice is niet geladen.");
    });
  return bundel;
}

function controleerVelden(invoer, toegestaan) {
  const onbekend = Object.keys(invoer).filter((k) => !toegestaan.has(k));
  if (onbekend.length) {
    throw new RenderFout(400, "ongeldige-parameter", "Ongeldige parameter", `Onbekende parameter(s): ${onbekend.join(", ")}.`, { parameters: onbekend });
  }
}

async function leesInvoer(req) {
  const tekst = await leesBody(req);
  let invoer;
  try {
    invoer = JSON.parse(tekst || "{}");
  } catch {
    throw probleem(400, "ongeldige-body", "Ongeldige body", "De body is geen geldige JSON.");
  }
  if (invoer === null || typeof invoer !== "object" || Array.isArray(invoer)) {
    throw probleem(400, "ongeldige-body", "Ongeldige body", "De body moet een JSON-object zijn.");
  }
  return invoer;
}

export function maakServer() {
  return http.createServer(async (req, res) => {
    const pad = new URL(req.url, "http://x").pathname;
    try {
      if (req.method === "GET" && pad === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: true, versie: RENDER_VERSIE }));
      }
      // /api/render/svg: hetzelfde pad als de publieke Go-route, zodat een client
      // lokaal rechtstreeks op de sidecar kan draaien (zonder DB/Go-API).
      if (req.method === "POST" && (pad === "/render/svg" || pad === "/api/render/svg")) {
        const invoer = await leesInvoer(req);
        controleerVelden(invoer, isStudio(invoer) ? STUDIO_VELDEN : RENDER_VELDEN);
        const svg = isStudio(invoer) ? renderStudioSvg(invoer, await laadBundel()) : renderDiagramSvg(invoer);
        res.writeHead(200, { "Content-Type": "image/svg+xml; charset=utf-8", "X-Render-Versie": RENDER_VERSIE });
        return res.end(metVersie(svg));
      }
      if (req.method === "POST" && pad === "/views") {
        const invoer = await leesInvoer(req);
        controleerVelden(invoer, isStudio(invoer) ? STUDIO_VIEWS_VELDEN : VIEWS_VELDEN);
        const views = isStudio(invoer) ? studioViews(invoer) : diagramViews(invoer);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify(views));
      }
      stuurProbleem(res, probleem(404, "niet-gevonden", "Niet gevonden", `Geen route ${req.method} ${pad}.`));
    } catch (e) {
      if (e instanceof RenderFout) return stuurProbleem(res, e);
      console.error("render-svc: interne fout", e);
      stuurProbleem(res, probleem(500, "interne-fout", "Interne fout", "Het diagram kon niet worden gerenderd."));
    }
  });
}

// Alleen starten als dit bestand zelf wordt uitgevoerd (niet bij import in tests).
if (process.argv[1]?.endsWith("server.mjs")) {
  maakServer().listen(PORT, HOST, () => console.log(`render-svc luistert op http://${HOST}:${PORT}`));
}
