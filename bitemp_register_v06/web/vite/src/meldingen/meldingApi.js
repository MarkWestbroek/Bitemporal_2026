// @ts-check
/**
 * meldingApi — bugs, wensen en vragen melden (plan docs/plans/meldingen/; Go: package
 * meldingen). Gedeeld door de Studio (Help → Melden…, F8, Alt+M, rechtsklik) en de losse pagina
 * melden.html (voor als de Studio hangt).
 */
import { apiBase } from "../shared/apiBase.js";

export const SOORTEN = [
  { waarde: "bug", label: "Bug", uitleg: "iets werkt niet zoals het hoort" },
  { waarde: "wens", label: "Wens", uitleg: "iets dat je graag zou willen" },
  { waarde: "vraag", label: "Vraag", uitleg: "je weet niet hoe iets moet" },
  { waarde: "compliment", label: "Compliment", uitleg: "iets werkt fijn (melding #4)" },
];
export const STATUSSEN = ["nieuw", "in_behandeling", "opgelost", "afgewezen", "dubbel"];
export const STATUS_LABEL = { nieuw: "nieuw", in_behandeling: "in behandeling", opgelost: "opgelost", afgewezen: "afgewezen", dubbel: "dubbel" };
export const PRIORITEITEN = ["laag", "normaal", "hoog"];
export const MAX_BIJLAGE = 10 * 1024 * 1024;
export const BIJLAGE_TYPEN = ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf", "text/plain"];

async function roep(pad, opties = {}) {
  const res = await fetch(`${apiBase()}${pad}`, { credentials: "include", ...opties });
  if (res.status === 204) return null;
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d?.error || (res.status === 401 ? "Log eerst in." : `Serverfout ${res.status}.`));
  return d;
}
const json = (methode, body) => ({ method: methode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const maakMelding = (melding) => roep("/api/meldingen", json("POST", melding));
export const lijstMeldingen = () => roep("/api/meldingen");
export const haalMeldingOp = (id) => roep(`/api/meldingen/${id}`);
export const reageer = (id, tekst) => roep(`/api/meldingen/${id}/reacties`, json("POST", { tekst }));
export const behandel = (id, wijziging) => roep(`/api/meldingen/${id}/behandeling`, json("PUT", wijziging));
export const bestandUrl = (bestand) => `${apiBase()}/api/meldingen/bestanden/${encodeURIComponent(bestand)}`;

/** Eén bijlage (File of Blob) uploaden. */
export function uploadBijlage(id, bestand, omschrijving = "") {
  const fd = new FormData();
  fd.append("bestand", bestand, bestand.name || "schermafbeelding.png");
  if (omschrijving) fd.append("omschrijving", omschrijving);
  return roep(`/api/meldingen/${id}/bijlagen`, { method: "POST", body: fd });
}

/** Controle vóór het versturen: lege string = goed. */
export function controleerMelding({ soort, titel }) {
  if (!SOORTEN.some((s) => s.waarde === soort)) return "Kies bug, wens, vraag of compliment.";
  if (!String(titel || "").trim()) return "Geef een titel: in één regel wat er misging of wat je wilt.";
  if (String(titel).trim().length > 255) return "De titel is te lang (max 255 tekens).";
  return "";
}

/** Een bijlage die we niet kunnen versturen: reden, of "" als hij goed is. */
export function bijlageProbleem(bestand) {
  if (!bestand) return "Geen bestand.";
  if (bestand.size > MAX_BIJLAGE) return `${bestand.name || "Bestand"} is groter dan 10 MB.`;
  if (bestand.type && !BIJLAGE_TYPEN.includes(bestand.type)) return `${bestand.name || "Bestand"}: alleen afbeeldingen, pdf of tekst.`;
  return "";
}

/** Korte omschrijving van browser en venster, zonder de hele user-agent. */
export function browserOmschrijving(nav = globalThis.navigator, win = globalThis.window) {
  const ua = String(nav?.userAgent || "");
  // Volgorde telt: Edge en Opera noemen zich ook Chrome, Chrome noemt zich ook Safari.
  let m = [];
  for (const b of ["Edg", "OPR", "Firefox", "Chrome", "Safari"]) {
    const t = ua.match(new RegExp(`${b}\\/(\\d+)`));
    if (t) { m = [t[0], b, t[1]]; break; }
  }
  const naam = { Edg: "Edge", OPR: "Opera" }[m[1]] || m[1] || "onbekende browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "";
  const maat = win ? `${win.innerWidth}×${win.innerHeight}` : "";
  return [naam + (m[2] ? ` ${m[2]}` : ""), os, maat].filter(Boolean).join(", ");
}

/** Kader uit twee punten: altijd positieve breedte/hoogte, binnen het venster. */
export function normaliseerKader(a, b, venster) {
  const x = Math.max(0, Math.min(a.x, b.x));
  const y = Math.max(0, Math.min(a.y, b.y));
  const r = Math.min(venster.w, Math.max(a.x, b.x));
  const o = Math.min(venster.h, Math.max(a.y, b.y));
  return { x, y, w: Math.max(0, r - x), h: Math.max(0, o - y) };
}

/**
 * Een leesbare "plek" voor wat onder een punt ligt: de dichtstbijzijnde benoemde onderdelen,
 * van buiten naar binnen ("Eigenschappen › Relaties › knop van diagram").
 */
/** Leesbare namen voor de vaste ankers van de Studio (data-tour). */
const ANKER_NAMEN = {
  activiteiten: "activiteitenbalk", "paneel-left": "linkerpaneel", "paneel-right": "eigenschappen",
  "nieuw-diagram": "nieuw diagram", "menu-help": "menu Help",
};

export function plekVan(el) {
  const delen = [];
  for (let n = el; n && n.nodeType === 1 && delen.length < 5; n = n.parentElement) {
    const tour = n.getAttribute?.("data-tour");
    const naam =
      n.getAttribute?.("aria-label") ||
      (tour ? ANKER_NAMEN[tour] || tour.replace(/^menu-/, "menu ") : "") ||
      n.getAttribute?.("data-testid") ||
      (n.tagName === "BUTTON" ? `knop ${String(n.textContent || "").trim().slice(0, 40)}` : "") ||
      (n.classList?.contains("react-flow__node") ? `element ${n.getAttribute("data-id")}` : "");
    if (naam && !delen.includes(naam)) delen.unshift(naam);
  }
  return delen.join(" › ");
}
