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
 *                     → 200 image/svg+xml, of application/problem+json
 *   POST /views       { taal, model | code } → { diagrammen, domeinen }
 *   GET  /health      → { ok: true }
 *
 * Geen dependencies. Omgeving: RENDER_SVC_PORT (standaard 8095),
 * RENDER_SVC_HOST (standaard 127.0.0.1 — niet publiek binden),
 * RENDER_SVC_MAX_BYTES (standaard 5 MB).
 */
import http from "node:http";
import { renderDiagramSvg, diagramViews, RenderFout } from "../web/vite/src/diagramsvg/index.js";

const PORT = Number(process.env.RENDER_SVC_PORT || 8095);
const HOST = process.env.RENDER_SVC_HOST || "127.0.0.1";
const MAX_BYTES = Number(process.env.RENDER_SVC_MAX_BYTES || 5 * 1024 * 1024);

const RENDER_VELDEN = new Set(["taal", "model", "code", "diagram", "domein", "entiteiten", "richting", "theme", "velden", "afhankelijkheden", "idPrefix", "linkPattern"]);
const VIEWS_VELDEN = new Set(["taal", "model", "code"]);

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

async function leesInvoer(req, toegestaan) {
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
  const onbekend = Object.keys(invoer).filter((k) => !toegestaan.has(k));
  if (onbekend.length) {
    throw new RenderFout(400, "ongeldige-parameter", "Ongeldige parameter", `Onbekende parameter(s): ${onbekend.join(", ")}.`, { parameters: onbekend });
  }
  return invoer;
}

export function maakServer() {
  return http.createServer(async (req, res) => {
    const pad = new URL(req.url, "http://x").pathname;
    try {
      if (req.method === "GET" && pad === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end('{"ok":true}');
      }
      // /api/render/svg: hetzelfde pad als de publieke Go-route, zodat een client
      // lokaal rechtstreeks op de sidecar kan draaien (zonder DB/Go-API).
      if (req.method === "POST" && (pad === "/render/svg" || pad === "/api/render/svg")) {
        const svg = renderDiagramSvg(await leesInvoer(req, RENDER_VELDEN));
        res.writeHead(200, { "Content-Type": "image/svg+xml; charset=utf-8" });
        return res.end(svg);
      }
      if (req.method === "POST" && pad === "/views") {
        const views = diagramViews(await leesInvoer(req, VIEWS_VELDEN));
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
