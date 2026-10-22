/**
 * gedeeldeBeelden — diagrammen als PNG op een openbaar, onraadbaar adres, voor Confluence en
 * wiki's (Mark, 16-10-2026). Confluence laat ingebedde data-URI-plaatjes bij plakken weg, maar
 * toont een extern plaatje wél en houdt het als link. Daarom:
 *
 *   - "momentopname": het plaatje van nu, op een vast adres;
 *   - "actueel": één adres per diagram; verandert het diagram, dan zet Studio er een nieuw
 *     plaatje op, en wie de Confluence-pagina opnieuw laadt ziet het nieuwe.
 *
 * Studio tekent de PNG zelf (dezelfde schets als de documenten, schets.js → svgNaarPng); de
 * server (handlers/studio_beeld_handler.go) bewaart en serveert. Bijwerken gebeurt dus zolang
 * iemand het project in Studio open heeft: elke wijziging komt uit Studio, en een wijziging via
 * de MCP wordt bij het eerstvolgende openen bijgewerkt.
 *
 * De kern (`maakBeeldWachter`) krijgt zijn afhankelijkheden mee, zodat de unittest zonder browser,
 * server en stores draait.
 */
import { naamVanVerwijzing } from "./doorklik.js";
import { create } from "zustand";
import { deelBeeld, lijstBeelden, trekBeeldIn } from "./activities/projectSync.js";
import { svgNaarPng, svgMaat, svgHerkomst, merkHerkomst } from "../transformatie/sjabloon/rijkKopieren.js";
import { maakBeeldWachter } from "./gedeeldeBeeldenKern.js";
import { schetsDiagramSvg } from "../transformatie/sjabloon/schets.js";
import { vindShapeSet, descriptorMetShapeSet } from "../diagramcore/model/shapeSet.js";
import { getProfieltype } from "./profieltypeRegistry";
import { apiBase } from "../shared/apiBase.js";

export const SOORTEN = ["momentopname", "actueel"];
export const WACHT_MS = 4000; // na de laatste wijziging; slepen geeft veel kleine wijzigingen

/** Zichtbare stand: de gedeelde plaatjes van het open project. */
export const useBeeldenStore = create(() => ({ projectId: null, beelden: [], fout: null }));

/**
 * Kan de browser hier naar het klembord schrijven? Null als het kan, anders de uitleg. Het
 * klembord werkt alleen in een "veilige context" (https of localhost); via http://newpcmark:5180
 * (Tailscale) dus niet (Mark, 16-10: bleef hangen op "Plaatjes klaarzetten").
 */
export function klembordFout() {
  if (globalThis.isSecureContext === false) {
    return `Het klembord werkt alleen via https of localhost; deze pagina is ${globalThis.location?.origin || "http"}. Op app (https) werkt het wel.`;
  }
  if (!globalThis.navigator?.clipboard?.write || typeof globalThis.ClipboardItem === "undefined") {
    return "Deze browser kan geen opgemaakte tekst met plaatjes naar het klembord schrijven.";
  }
  return null;
}

/** Absoluut adres van een gedeeld plaatje (voor in Confluence). */
export function beeldAdres(pad, basis = globalThis.location?.href || "http://localhost/") {
  return new URL(`${apiBase()}${pad}`, basis).href;
}

/** Teken een diagram uit de profielstore als SVG (zelfde schets als de documenten), of "". */
export function tekenDiagram(profielId, diagramId) {
  const p = getProfieltype(profielId);
  const st = p?.useStore?.getState?.();
  const diagram = st?.diagrams?.[diagramId];
  if (!diagram) return "";
  return schetsDiagramSvg({
    diagram,
    elements: st.elements,
    descriptor: descriptorMetShapeSet(p.descriptor, vindShapeSet(p.descriptor, diagram.shapeSetId, diagram)),
    idPrefix: "b",
    verwijzingNaam: naamVanVerwijzing,
  });
}

const leesAlsDataUrl = (svg) => svgNaarPng(svg, svgMaat(svg));

/** Voeg een plaatje toe aan (of vervang het in) de lijst, nieuwste bovenaan. */
function zetInLijst(meta) {
  const { beelden } = useBeeldenStore.getState();
  useBeeldenStore.setState({ beelden: [meta, ...beelden.filter((b) => b.token !== meta.token)] });
}

let wachter = null;

/**
 * Deel een gemerkte SVG (zie merkHerkomst) als plaatje op een adres. Zonder herkomst (geen
 * diagram uit dit project) volgt null: de aanroeper sluit het plaatje dan in.
 * @returns {Promise<string|null>} het absolute adres
 */
export async function deelSvg(projectId, svg, soort = "momentopname") {
  const herkomst = svgHerkomst(svg);
  if (!projectId || !herkomst) return null;
  const { breedte, hoogte } = svgMaat(svg);
  const meta = await deelBeeld(projectId, {
    profiel_id: herkomst.profielId,
    diagram_id: herkomst.diagramId,
    diagram_naam: herkomst.naam,
    soort,
    png: await leesAlsDataUrl(svg),
    breedte,
    hoogte,
  });
  zetInLijst(meta);
  // Het actuele plaatje volgt voortaan de tekening van de Studio (zonder merk, zoals de wachter tekent).
  if (soort === "actueel") wachter?.onthoud(herkomst.profielId, herkomst.diagramId, tekenDiagram(herkomst.profielId, herkomst.diagramId));
  return beeldAdres(meta.pad);
}

/** Deel één diagram rechtstreeks uit de store (canvas: "Kopieer als plaatje-link"). */
export async function deelDiagram(projectId, profielId, diagramId, soort = "momentopname") {
  const p = getProfieltype(profielId);
  const naam = p?.useStore?.getState?.().diagrams?.[diagramId]?.naam || "";
  const svg = tekenDiagram(profielId, diagramId);
  if (!svg) throw new Error("Dit diagram is leeg; er is niets om te delen.");
  const adres = await deelSvg(projectId, merkHerkomst(svg, { profielId, diagramId, naam }), soort);
  return { adres, naam, ...svgMaat(svg) };
}

/** Lijst van de server ophalen (bij openen van het project en in het beheerpaneel). */
export async function laadBeelden(projectId) {
  if (!projectId) {
    useBeeldenStore.setState({ projectId: null, beelden: [], fout: null });
    return [];
  }
  try {
    const uit = await lijstBeelden(projectId);
    useBeeldenStore.setState({ projectId, beelden: uit?.beelden || [], fout: null });
    return uit?.beelden || [];
  } catch (e) {
    useBeeldenStore.setState({ projectId, beelden: [], fout: e?.message || String(e) });
    return [];
  }
}

export async function trekIn(projectId, token) {
  await trekBeeldIn(projectId, token);
  useBeeldenStore.setState({ beelden: useBeeldenStore.getState().beelden.filter((b) => b.token !== token) });
}

/**
 * Start het bijwerken voor een project op de server (modellerenActivity, bij openen). Luistert
 * naar de profielstores van de diagrammen met een actueel adres en werkt na een korte stilte bij.
 * @returns {() => void} stop
 */
export function startBeeldWachter(projectId) {
  if (!projectId) return () => {};
  let timer = null;
  let gestopt = false;
  const afmelders = new Map(); // profielId → unsubscribe
  const actueel = () => useBeeldenStore.getState().beelden.filter((b) => b.soort === "actueel");
  wachter = maakBeeldWachter({
    actueel,
    teken: tekenDiagram,
    rasteriseer: leesAlsDataUrl,
    stuur: (invoer) => deelBeeld(projectId, invoer),
    vergeet: (token) => useBeeldenStore.setState({ beelden: useBeeldenStore.getState().beelden.filter((b) => b.token !== token) }),
    bijgewerkt: (meta) => meta && zetInLijst(meta),
  });
  const plan = () => {
    if (gestopt) return;
    clearTimeout(timer);
    timer = setTimeout(() => wachter?.ververs(), WACHT_MS);
  };
  // Luister alleen naar profielen met een actueel plaatje; de lijst kan veranderen.
  const volg = () => {
    const nodig = new Set(actueel().map((b) => b.profiel_id));
    for (const [pid, af] of afmelders) if (!nodig.has(pid)) (af(), afmelders.delete(pid));
    for (const pid of nodig) {
      if (afmelders.has(pid)) continue;
      const store = getProfieltype(pid)?.useStore;
      if (!store?.subscribe) continue;
      afmelders.set(pid, store.subscribe((s, v) => (s.diagrams !== v.diagrams || s.elements !== v.elements) && plan()));
    }
  };
  const afLijst = useBeeldenStore.subscribe((s, v) => s.beelden !== v.beelden && volg());
  laadBeelden(projectId).then(() => {
    volg();
    plan(); // bij openen één keer: vangt wijzigingen die buiten Studio om gingen (MCP)
  });
  return () => {
    gestopt = true;
    clearTimeout(timer);
    afLijst();
    for (const af of afmelders.values()) af();
    afmelders.clear();
    wachter = null;
  };
}

/**
 * Kopieer één diagram als plaatje-link naar het klembord (rechtsklik op het canvas). De
 * ClipboardItem gaat meteen mee met beloftes, zodat de klik geldig blijft terwijl het plaatje
 * naar de server gaat. Geeft het adres terug.
 */
export async function kopieerDiagramAlsLink(profielId, diagramId, soort = "momentopname") {
  const projectId = useBeeldenStore.getState().projectId;
  if (!projectId) throw new Error("Plaatjes als link kan alleen voor een project op de server.");
  const fout = klembordFout();
  if (fout) throw new Error(fout);
  const gedeeld = deelDiagram(projectId, profielId, diagramId, soort);
  const html = gedeeld.then(({ adres, naam, breedte, hoogte }) => {
    const b = Math.min(breedte, 900);
    const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    return `<img src="${esc(adres)}" width="${b}" height="${Math.round((hoogte * b) / breedte)}" alt="${esc(naam || "Diagram")}">`;
  });
  await navigator.clipboard.write([
    new ClipboardItem({
      "text/html": html.then((h) => new Blob([h], { type: "text/html" })),
      "text/plain": gedeeld.then(({ adres }) => new Blob([adres], { type: "text/plain" })),
    }),
  ]);
  return (await gedeeld).adres;
}
