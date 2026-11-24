/**
 * simulatieActivity — de activiteit "Simulatie": een BPMN-proces met zijn
 * beslistabellen doorlopen met een startobject uit het canonieke model
 * (docs/plans/2026-11-12 Simulatie van BPMN en DMN met cm-objecten, §10.5 en §11.1).
 *
 * Een eigen activiteit en geen paneel onder een BPMN-diagram: een run is één
 * afhandeling over meerdere processen en hoort bij geen enkel diagram. De run
 * zelf staat in `studio/simulatieRun.js`, de simulatie in `src/simulatie/`
 * (pure modules); dit bestand is alleen het scherm.
 *
 *   Sidebar    het scenario (startobject, antwoorden, vulwijze), waar de run
 *              start en waar hij op draait (proces, beslistabellen, e-dienstmodel)
 *   Main       de bediening, het open gat, het procesdiagram met het token, het log
 *   Inspector  de objecten met hun state, de procesvariabelen, wat buiten het cm gebeurde
 *
 * Het diagram hier is een tekening (dezelfde tekenaar als de documenten), niet
 * het canvas: je bewerkt het proces in Modelleren. Het token staat daar alleen
 * als je "ook op het modeldiagram" aanzet (Mark 14-11); het model verandert nooit.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { IconSimulatie } from "../icons";
import { getProfieltype } from "../profieltypeRegistry";
import { tekenDiagram } from "../gedeeldeBeelden.js";
import { vraagBevestiging, toonMelding } from "../naamDialog.jsx";
import { willekeurig } from "../../simulatie/gaten.js";
import { PROCESINSTANTIE, versiesVan } from "../../simulatie/store.js";
import { tokenBeeld, standTekst, mutatieTekst, TOKEN_KLEUR } from "../../simulatie/weergave.js";
import { objectenBijDataObjecten, toetsStartobject } from "../../simulatie/dataObjecten.js";
import { toetsLijnen } from "../../simulatie/dataLijnen.js";
import { CmObject, CmOpties, PlatJson, GEWIJZIGD } from "./simulatieCmVorm.jsx";
import { objectVorm } from "../../simulatie/objectVorm.js";
import { cmVorm } from "../../simulatie/cmVorm.js";
import {
  BPMN_PROFIEL,
  VOORBEELDEN,
  useRun,
  zet,
  probeer,
  start,
  stop,
  scenarioTekst,
  beslissingenUitProject,
  startbareProcessen,
  gekozenStartProces,
  procesVanToken,
  laatsteSprong,
  speelAf,
  pauzeer,
  speeltAf,
  SNELHEDEN,
  gebruikGpk,
  kiesVoorbeeld,
  laadGpkProces,
  conditiesProjectNaarCel,
  cmBeeldVoor,
  useRunNu,
  zetVerbergLeeg,
  scenariosUitProject,
  SIMULATIEMODEL_PROFIEL,
  kiesProjectScenario,
  bewaarScenarioInProject,
  draaiTestset,
  verwachtingVanRun,
} from "../simulatieRun.js";
import { juelCondities } from "../../diagramprofielen/bpmn/conditiesNaarCel.js";

const knop = { padding: "3px 10px", fontSize: 12, borderRadius: 4, border: "1px solid var(--s-border, #cbd5e1)", background: "var(--s-panel-head, #eceef2)", color: "var(--s-fg, #1f2937)", cursor: "pointer" };
const hoofdknop = { ...knop, background: "linear-gradient(90deg, #60a5fa, #6366f1)", color: "#fff", border: "1px solid #6366f1" };
const kop = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--s-fg-muted, #64748b)", margin: "0 0 4px" };
const veldstijl = { fontSize: 12, padding: "2px 4px", border: "1px solid var(--s-border, #cbd5e1)", borderRadius: 3, background: "var(--s-bg, #fff)", color: "var(--s-fg, #1f2937)", width: "100%", boxSizing: "border-box" };
const mono = { fontFamily: "ui-monospace, Consolas, monospace", fontSize: 11 };
const gedempt = { color: "var(--s-fg-muted, #64748b)" };

/** Het BPMN-model van het project, levend: de activiteit tekent opnieuw als het proces verandert. */
function useBpmn() {
  const useStore = getProfieltype(BPMN_PROFIEL)?.useStore;
  const elements = useStore ? useStore((s) => s.elements) : {};
  const diagrams = useStore ? useStore((s) => s.diagrams) : {};
  return { elements, diagrams };
}

/**
 * Vrije invoer bij een gat zonder bekende velden: JSON. Gekrulde aanhalingstekens
 * (uit een tekstverwerker of een telefoon) tellen als rechte.
 */
function leesVrijeInvoer(tekst) {
  const recht = String(tekst || "").replace(/[“”„«»]/g, '"').replace(/[‘’]/g, "'").trim();
  try {
    const w = JSON.parse(recht || "{}");
    if (!w || typeof w !== "object" || Array.isArray(w)) throw new Error("geen object");
    return w;
  } catch (e) {
    throw new Error(`Dit is geen geldige JSON. Verwacht iets als {"veld": "waarde"} (${e.message}).`);
  }
}

/** Is dit gat er alleen omdat de beslistabel of het e-dienstmodel ontbreekt? */
const mistBron = (gat) => (gat.formulier && gat.formulierBekend === false) || (gat.kiest === "resultaat" && /niet gevonden/.test(gat.reden || ""));

/** Het rudimentaire formulier bij een gat: per verwacht veld een invoer naar type; zonder velden vrije JSON. */
function GatFormulier({ gat, zaadje, onVul }) {
  const [waarde, setWaarde] = useState({});
  const [vrij, setVrij] = useState("{}");
  const [fout, setFout] = useState(null);
  useEffect(() => {
    setWaarde({});
    setVrij("{}");
    setFout(null);
  }, [gat.id]);
  const zetVeld = (naam, w) => (setWaarde((v) => ({ ...v, [naam]: w })), setFout(null));
  const vul = () => {
    try {
      onVul(gat.velden.length ? waarde : leesVrijeInvoer(vrij));
    } catch (e) {
      setFout(e.message);
    }
  };
  const AARD = { taak: "taak voor de behandelaar", partner: `antwoord van ${gat.partner || "een andere partij"}`, dienst: `dienst buiten het cm (${gat.actie})`, expressie: "niet te lezen" };
  return (
    <div style={{ border: `2px solid ${TOKEN_KLEUR.gat}`, borderRadius: 6, padding: 8, margin: "8px 0", maxWidth: 520 }} data-testid="sim-gat">
      <div style={{ fontSize: 12, fontWeight: 700 }}>{gat.naam}</div>
      <div style={{ fontSize: 11, ...gedempt, marginBottom: 6 }}>
        Gat: {AARD[gat.aard] || gat.aard}
        {gat.formulier ? ` · formulier ${gat.formulier}${gat.formulierBekend === false ? " (niet gevonden in het e-dienstmodel)" : ""}` : ""}
        {gat.kandidaatgroep ? ` · voor groep ${gat.kandidaatgroep}` : ""}
        {gat.bezoek > 1 ? ` · bezoek ${gat.bezoek}` : ""}
        {gat.reden ? ` · ${gat.reden}` : ""}
      </div>
      {gat.velden.map((v) => (
        <label key={v.naam} style={{ display: "block", fontSize: 12, marginBottom: 5 }}>
          {v.label || v.naam}
          {v.verplicht ? " *" : ""}
          {v.keuzes ? (
            <select style={veldstijl} value={waarde[v.naam] ?? ""} onChange={(e) => zetVeld(v.naam, e.target.value || undefined)} data-testid={`sim-veld-${v.naam}`}>
              <option value="">(kies)</option>
              {v.keuzes.map((k) => (
                <option key={String(k)} value={k}>
                  {String(k)}
                </option>
              ))}
            </select>
          ) : v.type === "boolean" ? (
            <input type="checkbox" style={{ marginLeft: 6 }} checked={!!waarde[v.naam]} onChange={(e) => zetVeld(v.naam, e.target.checked)} />
          ) : (
            <input
              style={veldstijl}
              type={v.type === "number" || v.type === "integer" ? "number" : "text"}
              value={waarde[v.naam] ?? ""}
              onChange={(e) => zetVeld(v.naam, e.target.value === "" ? undefined : v.type === "number" || v.type === "integer" ? Number(e.target.value) : e.target.value)}
              data-testid={`sim-veld-${v.naam}`}
            />
          )}
        </label>
      ))}
      {!gat.velden.length && (
        <label style={{ display: "block", fontSize: 12, marginBottom: 5 }}>
          Geen velden bekend; vrije invoer (JSON)
          <textarea style={{ ...veldstijl, ...mono, height: 54 }} value={vrij} onChange={(e) => (setVrij(e.target.value), setFout(null))} data-testid="sim-vrij" />
        </label>
      )}
      {mistBron(gat) && (
        <div style={{ fontSize: 11, ...gedempt, marginBottom: 6 }}>
          {gat.formulier ? "Het taakformulier staat in het e-dienstmodel, en dat is niet geladen. " : "De beslistabel staat niet in een DMN-profiel van dit project. "}
          Stop de simulatie en kies links onder "Waar de simulatie op draait" een e-dienstmodel of het GPK-voorbeeld; daarna vult de run dit gat zelf of toont hij de velden.
        </div>
      )}
      {fout && <div style={{ color: TOKEN_KLEUR.vast, fontSize: 11, marginBottom: 4 }}>{fout}</div>}
      <div style={{ display: "flex", gap: 6 }}>
        <button style={hoofdknop} onClick={vul} data-testid="sim-vul">
          Vul
        </button>
        {gat.velden.length > 0 && (
          <button style={knop} onClick={() => setWaarde(willekeurig(gat.velden, `${zaadje}/${gat.sleutels[0]}/${gat.bezoek}/${Date.now()}`))} title="Vul de velden met een willekeurige waarde die bij het type past">
            Willekeurig
          </button>
        )}
      </div>
    </div>
  );
}

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Het procesdiagram als tekening, met het token erop: een rand om het element
 * en een bolletje rechtsboven (met het aantal bij meer tokens); waar het token
 * geweest is een dunne rand.
 */
/** De log: standaard- en minimumhoogte, en waar de gekozen hoogte bewaard wordt. */
const LOG_STANDAARD = 220;
const LOG_MIN = 60;
const LOG_SLEUTEL = "studio-simulatie-log-hoogte";

/** De breedte waar een zwevend object bij het plaatsen op rekent. */
const KAART_BREEDTE = 240;

function DiagramMetToken({ diagramId, beeld, versie, objecten = {}, lijnToets = null, children = null }) {
  const { elements, diagrams } = useBpmn();
  const doos = useRef(null);
  const buiten = useRef(null);
  const svg = useMemo(() => (diagramId ? tekenDiagram(BPMN_PROFIEL, diagramId) : ""), [diagramId, elements, diagrams]);
  useLayoutEffect(() => {
    const wortel = doos.current?.querySelector("svg");
    if (!wortel) return;
    wortel.querySelectorAll(".sim-teken").forEach((n) => n.remove());
    wortel.style.maxWidth = "100%";
    wortel.style.height = "auto";
    const maak = (naam, attrs, tekst) => {
      const n = document.createElementNS(SVG_NS, naam);
      n.setAttribute("class", "sim-teken");
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
      if (tekst) n.textContent = tekst;
      return n;
    };
    const groep = (id) => wortel.querySelector(`g.dc-voorkomen[data-element-id="${CSS.escape(id)}"]`);
    // De omvang van de vorm: de vereniging van alles wat de vorm tekent, zonder het buitenlabel en
    // zonder eerdere simulatietekens, in de ruimte van de groep. getBBox() van een kind telt de
    // eigen transform van dat kind niet mee; een event of gateway is een <g transform="scale(1.8)">,
    // dus zonder die transform viel de rand te klein en linksboven de vorm (gemeld door Mark 13-11).
    const omvang = (g) => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const kind of g.children) {
        if (kind.classList.contains("sim-teken") || kind.classList.contains("dc-buitenlabel")) continue;
        const b = /** @type {SVGGraphicsElement} */ (kind).getBBox?.();
        if (!b || (!b.width && !b.height)) continue;
        const m = /** @type {SVGGraphicsElement} */ (kind).transform?.baseVal?.consolidate()?.matrix;
        const hoeken = [
          [b.x, b.y],
          [b.x + b.width, b.y],
          [b.x, b.y + b.height],
          [b.x + b.width, b.y + b.height],
        ].map(([x, y]) => (m ? [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f] : [x, y]));
        for (const [x, y] of hoeken) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
      }
      return x0 === Infinity ? g.getBBox() : { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    };
    const rand = (g, kleur, dikte) => {
      const b = omvang(g);
      g.appendChild(maak("rect", { x: b.x - 4, y: b.y - 4, width: b.width + 8, height: b.height + 8, rx: 8, fill: "none", stroke: kleur, "stroke-width": dikte, "pointer-events": "none" }));
      return b;
    };
    for (const id of beeld.bezocht) {
      const g = groep(id);
      if (g) rand(g, "rgba(34, 211, 238, 0.7)", 2);
    }
    for (const [id, p] of Object.entries(beeld.plekken)) {
      const g = groep(id);
      if (!g) continue;
      const kleur = TOKEN_KLEUR[p.status] || TOKEN_KLEUR.klaar;
      const b = rand(g, kleur, 3);
      g.setAttribute("data-sim-token", p.status);
      const bol = maak("circle", { cx: b.x + b.width + 4, cy: b.y - 4, r: 9, fill: kleur, stroke: "#fff", "stroke-width": 2 });
      if (p.status === "klaar") bol.setAttribute("class", "sim-teken sim-puls");
      g.appendChild(bol);
      if (p.aantal > 1) g.appendChild(maak("text", { x: b.x + b.width + 4, y: b.y, "text-anchor": "middle", "font-size": 11, "font-weight": 700, fill: "#fff" }, String(p.aantal)));
    }
    for (const g of wortel.querySelectorAll("g[data-sim-token]")) if (!beeld.plekken[g.getAttribute("data-element-id")]) g.removeAttribute("data-sim-token");

    // Data-objecten (§11.8 stap 3, Mark 15-11): het object van de simulatie dat bij het type hoort.
    // Rechtsonder een kenmerk met de versie; geel omrand als het in de laatste stap veranderde,
    // rood gestippeld als de toestand niet klopt met die op het model ("[ingediend]"). Een klik
    // toont het object onder het diagram.
    for (const g of wortel.querySelectorAll("g[data-sim-object]")) {
      g.removeAttribute("data-sim-object");
      g.removeAttribute("data-sim-gewijzigd");
      g.removeAttribute("data-sim-klopt");
      g.style.cursor = "";
      g.onclick = null;
      g.querySelector(":scope > title.sim-teken")?.remove();
    }
    for (const [id, info] of Object.entries(objecten)) {
      const g = groep(id);
      if (!g) continue;
      const titel = maak("title", {}, "");
      if (!info.objecten.length) {
        titel.textContent = `${info.typeNaam}: nog geen object in deze run`;
        g.insertBefore(titel, g.firstChild);
        continue;
      }
      const o = info.objecten[0];
      const b = omvang(g);
      // Klikvlak over de hele vorm (ook tussen de lijnen en de naam door).
      g.insertBefore(maak("rect", { x: b.x - 4, y: b.y - 4, width: b.width + 8, height: b.height + 8, fill: "transparent", "pointer-events": "all" }), g.firstChild);
      if (o.gewijzigd) g.appendChild(maak("rect", { x: b.x - 7, y: b.y - 7, width: b.width + 14, height: b.height + 14, rx: 9, fill: "none", stroke: "rgba(250, 204, 21, 0.95)", "stroke-width": 3, "pointer-events": "none" }));
      if (o.klopt === false) g.appendChild(maak("rect", { x: b.x - 10, y: b.y - 10, width: b.width + 20, height: b.height + 20, rx: 10, fill: "none", stroke: TOKEN_KLEUR.vast, "stroke-width": 1.5, "stroke-dasharray": "4 3", "pointer-events": "none" }));
      const tekst = `v${o.versie}${info.objecten.length > 1 ? ` ×${info.objecten.length}` : ""}`;
      const bw = 8 + tekst.length * 6.5;
      const bx = b.x + b.width - bw / 2;
      const by = b.y - 8; // rechtsboven, niet over de naam
      g.appendChild(maak("rect", { x: bx, y: by, width: bw, height: 15, rx: 7.5, fill: "#6366f1", stroke: "#fff", "stroke-width": 1.5 }));
      g.appendChild(maak("text", { x: bx + bw / 2, y: by + 11, "text-anchor": "middle", "font-size": 10, "font-weight": 700, fill: "#fff", "data-testid": "sim-dataobject-versie" }, tekst));
      titel.textContent =
        info.objecten.map((x) => `${x.id} (${x.type}) v${x.versie}${x.toestand ? `, toestand ${x.toestand}` : ""}`).join("\n") +
        (o.klopt === false ? `\nHet model zegt [${info.modelToestand}]` : "") +
        "\nKlik: toon het object";
      g.insertBefore(titel, g.firstChild);
      g.setAttribute("data-sim-object", o.id);
      if (o.gewijzigd) g.setAttribute("data-sim-gewijzigd", "");
      if (o.klopt !== null) g.setAttribute("data-sim-klopt", String(o.klopt));
      g.style.cursor = "pointer";
      // Klik (16-11): het object komt als los, verplaatsbaar object naast het data-object te hangen
      // (rechts; links als daar geen plaats is). Een tweede object komt erbij.
      g.onclick = () => {
        const a = g.getBoundingClientRect();
        const vlak = buiten.current?.getBoundingClientRect();
        if (!vlak) return;
        const rechts = a.right - vlak.left + 14;
        const links = a.left - vlak.left - KAART_BREEDTE - 14;
        toonZwevend(o.id, { left: rechts + KAART_BREEDTE <= vlak.width ? rechts : links >= 0 ? links : Math.max(4, vlak.width - KAART_BREEDTE - 4), top: Math.max(4, a.top - vlak.top - 6) });
      };
    }

    // Lijnen en objecten (§11.8 stap 4, Mark 16-11): een data-associatie die niet past bij wat de
    // run doet, krijgt een rode stippellijn over zich heen; een taak met een bevinding een rood
    // uitroepteken linksonder. De tooltip zegt waarom (simulatie/dataLijnen.js).
    for (const g of wortel.querySelectorAll("g[data-sim-lijnfout]")) g.removeAttribute("data-sim-lijnfout");
    for (const [lijnId, lijst] of Object.entries(lijnToets?.lijnen || {})) {
      const pad = wortel.querySelector(`path.dc-lijn[data-connector-id="${CSS.escape(lijnId)}"]`);
      if (!pad) continue;
      const over = maak("path", { d: pad.getAttribute("d") || "", fill: "none", stroke: TOKEN_KLEUR.vast, "stroke-width": 3, "stroke-dasharray": "6 4", "stroke-linecap": "round", opacity: 0.9, "data-testid": "sim-lijn-fout", "data-lijn": lijnId });
      over.appendChild(maak("title", {}, lijst.map((b) => b.reden).join("\n")));
      pad.parentNode?.appendChild(over);
    }
    for (const [taak, lijst] of Object.entries(lijnToets?.taken || {})) {
      const g = groep(taak);
      if (!g) continue;
      const b = omvang(g);
      g.setAttribute("data-sim-lijnfout", String(lijst.length));
      const teken = maak("g", { "data-testid": "sim-taak-lijnfout" });
      teken.appendChild(maak("title", {}, lijst.map((x) => x.reden).join("\n")));
      teken.appendChild(maak("circle", { cx: b.x, cy: b.y + b.height, r: 8, fill: TOKEN_KLEUR.vast, stroke: "#fff", "stroke-width": 1.5 }));
      teken.appendChild(maak("text", { x: b.x, y: b.y + b.height + 4, "text-anchor": "middle", "font-size": 11, "font-weight": 700, fill: "#fff" }, "!"));
      g.appendChild(teken);
    }
  }, [svg, versie, objecten, lijnToets]);
  if (!svg) return <div style={{ ...gedempt, padding: 16 }}>Geen procesdiagram om te tonen.</div>;
  return (
    <div ref={buiten} style={{ position: "relative" }}>
      <div
        ref={doos}
        data-testid="sim-diagram"
        // dc-canvasvlak: dezelfde thema-tokens als het canvas (donker thema: donker vlak, lichte kaarten, lichte buitenlabels; Mark 15-11).
        className="sim-diagram dc-canvasvlak"
        style={{ background: "var(--dc-canvas-achtergrond, #fff)", borderRadius: 6, padding: 12, border: "1px solid var(--s-border, #cbd5e1)", overflow: "auto" }}
        // De tekening komt uit de eigen tekenaar (diagramcore/tekenaar), die tekst als tekstknoop schrijft.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {children}
    </div>
  );
}

/** Sidebar: het scenario, waar de run start en waar hij op draait. */
function Sidebar() {
  const S = useRun();
  const { elements, diagrams } = useBpmn();
  const startbaar = useMemo(() => startbareProcessen({ elements, diagrams }), [elements, diagrams, S.versie]);
  const startProces = gekozenStartProces(startbaar);
  const project = useMemo(() => beslissingenUitProject(), [S.versie]);
  // De scenario's die als model in het project staan (profiel Simulatiemodel, 16-11); levend.
  const smStore = getProfieltype(SIMULATIEMODEL_PROFIEL)?.useStore;
  const smElements = smStore ? smStore((s) => s.elements) : null;
  const uitProject = useMemo(() => scenariosUitProject(), [smElements, S.versie]);
  const loopt = !!S.sim;
  const heeftProces = startbaar.length > 0;
  const nJuel = useMemo(() => juelCondities(elements), [elements]);
  // De naam en beschrijving van het scenario in de tekst, zodat je ziet wat je gekozen hebt.
  const beschrijving = useMemo(() => {
    try {
      const sc = JSON.parse(scenarioTekst());
      return sc.naam ? { naam: sc.naam, tekst: sc.beschrijving || "" } : null;
    } catch {
      return null;
    }
  }, [S.versie]);
  // Past het startobject bij het invoer-data-object van het startproces (§11.8 stap 4, Mark 16-11)?
  const startToets = useMemo(() => {
    const p = startbaar.find((x) => x.id === startProces);
    if (!p) return [];
    let startType = null;
    try {
      startType = JSON.parse(scenarioTekst()).start?.type || null;
    } catch {
      /* het scenario is nog geen geldige JSON */
    }
    return toetsStartobject({ bpmnElementen: elements, diagram: diagrams?.[p.diagramId], elementenVan: (pid) => getProfieltype(pid)?.useStore?.getState?.().elements || null, startType }).map((t) => ({ ...t, startType, proces: p.naam }));
  }, [startbaar, startProces, elements, diagrams, S.versie]);
  const laadGpk = async () => {
    if (heeftProces && !(await vraagBevestiging({ titel: "GPK-voorbeeld laden", tekst: "Dit vervangt het BPMN-model van het project door de vier GPK-processen (oppakken, werkbak, behandelen, beoordelen). Je kunt het in de BPMN-activiteit ongedaan maken met Bewerken → Ongedaan maken.", bevestig: "Vervangen" }))) return;
    await laadGpkProces();
  };
  const kiesEdienst = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((tekst) => {
      try {
        zet({ edienst: { naam: file.name, inhoud: JSON.parse(tekst) } });
      } catch (err) {
        toonMelding({ titel: "E-dienstmodel", tekst: `Geen geldige JSON: ${err.message}` });
      }
    });
  };
  return (
    <div style={{ padding: "8px 10px", fontSize: 12, color: "var(--s-fg, #1f2937)" }} data-testid="sim-zijbalk">
      {loopt && <div style={{ ...gedempt, marginBottom: 8 }}>De run loopt. Stop hem om het scenario of de bronnen te wijzigen.</div>}
      <fieldset disabled={loopt} style={{ border: "none", padding: 0, margin: 0, opacity: loopt ? 0.6 : 1 }}>
        <p style={kop}>Start bij</p>
        <select style={veldstijl} value={startProces || ""} onChange={(e) => zet({ startProces: e.target.value })} data-testid="sim-startproces" title="Het proces waar het startobject binnenkomt">
          {!startbaar.length && <option value="">(geen proces met een startevent)</option>}
          {startbaar.map((p) => (
            <option key={p.id} value={p.id}>
              {p.naam}
              {p.gewoon ? "" : p.start.data?.soort === "signaal" ? ` (start op een signaal${p.start.data?.signaal ? `: ${p.start.data.signaal}` : ""})` : ` (start op een bericht${p.start.data?.bericht ? `: ${p.start.data.bericht}` : ""})`}
            </option>
          ))}
        </select>

        <p style={{ ...kop, marginTop: 12 }}>Scenario</p>
        <select style={{ ...veldstijl, marginBottom: 4 }} value="" onChange={(e) => (e.target.value.startsWith("p:") ? kiesProjectScenario(e.target.value.slice(2)) : kiesVoorbeeld(Number(e.target.value)))} data-testid="sim-voorbeeld">
          <option value="">Scenario kiezen…</option>
          {uitProject.length > 0 && (
            <optgroup label="Uit het project">
              {uitProject.map((v) => (
                <option key={v.id} value={`p:${v.id}`} title={v.beschrijving}>
                  {v.naam}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="GPK-voorbeeld (met eigen beslistabel en e-dienstmodel)">
            {VOORBEELDEN.map((v) => (
              <option key={v.nr} value={v.nr} title={v.beschrijving}>
                {v.naam}
              </option>
            ))}
          </optgroup>
        </select>
        {uitProject.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            <button style={knop} onClick={() => probeer(() => draaiTestset())} disabled={loopt} data-testid="sim-testset" title="Draait alle scenario's van het project door tot een gat of een einde en toetst de afloop aan hun verwachting. De run in beeld verandert niet.">
              Alle scenario's toetsen
            </button>
            {S.testset && (
              <div style={{ marginTop: 4 }} data-testid="sim-testset-uitkomst">
                {S.testset.map((r) => {
                  const kleur = r.uitkomst === "klopt" ? "#16a34a" : r.uitkomst === "geen verwachting" ? "var(--s-fg-muted, #64748b)" : TOKEN_KLEUR.vast;
                  return (
                    <div key={r.id} style={{ color: kleur, cursor: loopt ? "default" : "pointer", marginBottom: 2 }} title={`${r.tekst}${loopt ? "" : "\nKlik: kies dit scenario"}`} onClick={() => !loopt && kiesProjectScenario(r.id)} data-testid="sim-testset-rij" data-uitkomst={r.uitkomst}>
                      {r.uitkomst === "klopt" ? "✓" : r.uitkomst === "geen verwachting" ? "–" : "✗"} {r.naam}
                      {r.uitkomst !== "klopt" && <span style={{ fontSize: 11 }}>: {r.uitkomst === "wijkt af" || r.uitkomst === "fout" ? r.tekst : r.uitkomst}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {beschrijving && (
          <div style={{ marginBottom: 4 }} data-testid="sim-scenario-beschrijving">
            <b>{beschrijving.naam}</b>
            {beschrijving.tekst ? <div style={gedempt}>{beschrijving.tekst}</div> : null}
          </div>
        )}
        {startToets.map((t) => (
          <div key={t.dataObject} style={{ marginBottom: 4, color: t.past ? "#16a34a" : TOKEN_KLEUR.vast }} data-testid="sim-startobject-toets" data-past={String(t.past)}>
            {t.past
              ? `✓ Het startobject (${t.startType}) is een ${t.typeNaam}, het invoer-data-object ${t.naam} van ${t.proces}.`
              : `! ${t.proces} verwacht een ${t.typeNaam} (invoer-data-object ${t.naam}); het scenario start met ${t.startType || "een object zonder type"}.`}
          </div>
        ))}
        <textarea style={{ ...veldstijl, ...mono, height: 260, resize: "vertical" }} value={scenarioTekst()} onChange={(e) => zet({ scenarioTekst: e.target.value })} spellCheck={false} data-testid="sim-scenario" />
        <button
          style={{ ...knop, marginTop: 4 }}
          onClick={() => {
            const uit = bewaarScenarioInProject();
            if (uit) toonMelding({ titel: "Scenario bewaard", tekst: `"${uit.naam}" staat ${uit.nieuw ? "nu" : "bijgewerkt"} in het project, als model in het profiel Simulatiemodel (Modelleren). Het gaat mee met bewaren en synchroniseren van het project.` });
          }}
          data-testid="sim-bewaar-scenario"
          title="Bewaart dit scenario in het project, als model in het profiel Simulatiemodel: het scenario, de startgegevens (instantie), de stubs en de verwachting. Een scenario met dezelfde naam wordt bijgewerkt."
        >
          Bewaar in het project
        </button>
        <div style={{ ...gedempt, marginTop: 2 }}>
          Vulwijze: <code>hand</code>, <code>willekeurig</code> of <code>fixture</code>; per run (<code>standaard</code>), per soort gat (<code>perSoort</code>) of per gat (<code>perGat</code>).
        </div>

        <p style={{ ...kop, marginTop: 12 }}>Waar de simulatie op draait</p>
        <div>Proces: het BPMN-model van het project{heeftProces ? ` (${startbaar.length} te starten)` : " (nog geen startevent)"}.</div>
        {nJuel > 0 && (
          <div style={{ marginTop: 4 }} data-testid="sim-juel">
            {nJuel === 1 ? "Eén conditie staat" : `${nJuel} condities staan`} nog in JUEL (<code>{"${…}"}</code>). CEL is de taal in het model; de export maakt er weer JUEL van.{" "}
            <button
              style={{ ...knop, marginTop: 4 }}
              data-testid="sim-naar-cel"
              title="Zet de condities op de sequence flows om naar CEL; in Modelleren ongedaan te maken met Bewerken → Ongedaan maken"
              onClick={() => {
                const uit = conditiesProjectNaarCel();
                toonMelding({
                  titel: "Condities naar CEL",
                  tekst: `${uit.omgezet} omgezet.${uit.blijft.length ? ` Blijft JUEL: ${uit.blijft.map((b) => `${b.naam || b.id} (${b.fout})`).join("; ")}.` : ""}`,
                });
              }}
            >
              Naar CEL
            </button>
          </div>
        )}
        <div style={{ marginTop: 4 }}>Beslistabellen: {project.length ? `${project.length} DMN-profiel(en) uit het project` : S.gpk ? "die van het GPK-voorbeeld" : "geen; een business rule task wordt een gat"}.</div>
        <div style={{ marginTop: 4 }}>
          E-dienstmodel: {S.edienst ? S.edienst.naam : S.gpk ? "dat van het GPK-voorbeeld" : "geen; een taakformulier is dan vrije invoer"}.{" "}
          <label style={{ ...knop, display: "inline-block", marginTop: 4 }}>
            Bestand kiezen
            <input type="file" accept=".json" onChange={kiesEdienst} style={{ display: "none" }} data-testid="sim-edienst" />
          </label>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8, alignItems: "flex-start" }}>
          {S.gpk ? (
            <button style={knop} onClick={() => zet({ gpk: null })} title="Gebruik alleen wat in het project staat en wat je zelf laadt">
              GPK-voorbeeld niet meer gebruiken
            </button>
          ) : (
            <button style={knop} onClick={gebruikGpk} data-testid="sim-gebruik-gpk" title="De beslistabel aanvraag-ontvankelijk en het e-dienstmodel (process-id's en taakformulieren) van het GPK-voorbeeld; je eigen BPMN-model blijft staan">
              Beslistabel en e-dienstmodel van het GPK-voorbeeld gebruiken
            </button>
          )}
          <button style={knop} onClick={laadGpk} data-testid="sim-laad-gpk" title="Zet de vier GPK-processen in het BPMN-profiel van het project, met beslistabel, e-dienstmodel en een scenario">
            GPK-voorbeeld laden (ook de processen)
          </button>
        </div>
      </fieldset>
    </div>
  );
}

/** Main: de bediening, het open gat, het diagram met het token en het log. */
function Main() {
  const S = useRun();
  const { elements, diagrams } = useBpmn();
  const sim = S.sim;
  const stand = sim ? sim.stand() : { soort: "niet-gestart" };
  const log = sim ? sim.log : [];
  const beeld = useMemo(() => tokenBeeld(sim ? sim.toestand() : null, log), [S.versie]);
  const startbaar = useMemo(() => startbareProcessen({ elements, diagrams }), [elements, diagrams, S.versie]);
  const processen = sim ? sim.processen : startbaar;
  // Welk proces staat in beeld: wat je kiest, anders waar het token is, anders het startproces.
  const getoond = (processen.some((p) => p.id === S.toonProces) && S.toonProces) || procesVanToken() || (sim ? null : gekozenStartProces(startbaar)) || processen[0]?.id || null;
  const diagramId = processen.find((p) => p.id === getoond)?.diagramId || null;
  const metInstantie = new Set(sim ? Object.values(sim.toestand().objecten).filter((o) => o.type === PROCESINSTANTIE).map((o) => o.data.proces) : []);
  const metToken = new Set(sim ? Object.values(sim.toestand().tokens).map((k) => sim.processen.find((p) => p.elementen.has(k.plek))?.id) : []);
  const openGat = stand.soort === "gat" ? stand.gaten[0] : null;
  // Het scenario als test (16-11): klopt de afloop met `verwacht`? Pas als de run stilstaat.
  const verwachting = useMemo(() => verwachtingVanRun(), [S.versie]);
  // Data-objecten met een type: welk object van de run erbij hoort (§11.8 stap 3).
  const bijDataObjecten = useMemo(
    () =>
      sim
        ? objectenBijDataObjecten({ bpmnElementen: elements, elementenVan: (pid) => getProfieltype(pid)?.useStore?.getState?.().elements || null, toestand: sim.toestand(), log })
        : {},
    [S.versie, elements]
  );
  // Passen de lijnen bij wat de run doet (§11.8 stap 4)? Alleen de bevindingen op het getoonde diagram in de lijst.
  const lijnToets = useMemo(
    () => (sim ? toetsLijnen({ bpmnElementen: elements, diagrams, elementenVan: (pid) => getProfieltype(pid)?.useStore?.getState?.().elements || null, log }) : null),
    [S.versie, elements, diagrams]
  );
  const opDitDiagram = new Set((diagrams?.[diagramId]?.nodes || []).map((n) => n.elementId));
  const lijnBevindingen = (lijnToets?.bevindingen || []).filter((b) => opDitDiagram.has(b.taak));
  /** @type {Record<string, number>} */
  const bevindingenPerProces = {};
  for (const b of lijnToets?.bevindingen || []) {
    const p = processen.find((x) => (diagrams?.[x.diagramId]?.nodes || []).some((n) => n.elementId === b.taak));
    if (p) bevindingenPerProces[p.id] = (bevindingenPerProces[p.id] || 0) + 1;
  }
  const afspelen = speeltAf();
  const [snelheid, setSnelheid] = useState("gewoon");
  const sprong = sim ? laatsteSprong() : null;
  const standKleur = { loopt: TOKEN_KLEUR.klaar, gat: TOKEN_KLEUR.gat, vastgelopen: TOKEN_KLEUR.vast, uitzondering: TOKEN_KLEUR.vast, uitkomst: "#16a34a" }[stand.soort] || "var(--s-fg-muted, #64748b)";
  // Pijltjestoetsen (Mark 16-11): → is een stap, ← een regel terug. Niet in een invoerveld, niet
  // tijdens het afspelen, en alleen als dit paneel in beeld is (een verborgen activiteit luistert niet).
  const paneelRef = useRef(null);
  const toetsRef = useRef(null);
  toetsRef.current = { sim, stand, log, afspelen };
  useEffect(() => {
    const opToets = (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;
      const doel = /** @type {HTMLElement|null} */ (e.target);
      if (doel && (doel.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(doel.tagName))) return;
      if (!paneelRef.current || !paneelRef.current.offsetParent) return;
      const { sim, stand, log, afspelen } = toetsRef.current;
      if (!sim || afspelen) return;
      if (e.key === "ArrowRight" && stand.soort === "loopt") {
        e.preventDefault();
        probeer(() => sim.stap());
      } else if (e.key === "ArrowLeft" && log.length > 1) {
        e.preventDefault();
        probeer(() => sim.spoelTerug(log.length - 1));
      }
    };
    window.addEventListener("keydown", opToets);
    return () => window.removeEventListener("keydown", opToets);
  }, []);
  // De log (Mark 16-11): hoogte met een greep te verslepen (bewaard per browser), en hij schuift mee
  // zodat de nieuwste regel in beeld is.
  const logRef = useRef(null);
  const [logHoogte, setLogHoogte] = useState(() => {
    const h = Number(localStorage.getItem(LOG_SLEUTEL));
    return Number.isFinite(h) && h >= LOG_MIN ? h : LOG_STANDAARD;
  });
  const zetLogHoogte = (h) => {
    const nieuw = Math.max(LOG_MIN, Math.min(Math.round(h), Math.round(window.innerHeight * 0.8)));
    setLogHoogte(nieuw);
    localStorage.setItem(LOG_SLEUTEL, String(nieuw));
  };
  const begin = (e) => {
    e.preventDefault();
    const y0 = e.clientY;
    const h0 = logHoogte;
    const beweeg = (m) => zetLogHoogte(h0 - (m.clientY - y0));
    const los = () => {
      window.removeEventListener("mousemove", beweeg);
      window.removeEventListener("mouseup", los);
    };
    window.addEventListener("mousemove", beweeg);
    window.addEventListener("mouseup", los);
  };
  useLayoutEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length]);
  let zaadje = 0;
  try {
    zaadje = JSON.parse(scenarioTekst()).zaadje ?? 0;
  } catch {
    /* het scenario is nog geen geldige JSON */
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, fontSize: 12, color: "var(--s-fg, #1f2937)" }} data-testid="sim-paneel" ref={paneelRef}>
      {/* De tekenaar geeft een buitenlabel dezelfde klasse als het canvas (dc-buitenlabel); de
          canvasregel verschuift het daar met een transform, en dat mag in de tekening niet meedoen. */}
      <style>{`@keyframes sim-puls { 0%, 100% { r: 9px; } 50% { r: 12px; } } .sim-puls { animation: sim-puls 1.2s ease-in-out infinite; }
.sim-diagram svg text.dc-buitenlabel { transform: none; }`}</style>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--s-border, #cbd5e1)", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {!sim ? (
            <button style={hoofdknop} onClick={start} disabled={!startbaar.length} data-testid="sim-start" title={startbaar.length ? "Zet het startobject klaar en start het proces" : "Er is nog geen proces met een startevent"}>
              ▶ Start
            </button>
          ) : (
            <>
              <button style={hoofdknop} onClick={() => probeer(() => sim.stap())} disabled={stand.soort !== "loopt" || afspelen} data-testid="sim-stap" title="Eén stap: het token gaat één element verder (→)">
                Stap
              </button>
              {afspelen ? (
                <button style={hoofdknop} onClick={pauzeer} data-testid="sim-pauze" title="Pauzeer het afspelen">
                  ❚❚ Pauze
                </button>
              ) : (
                <button style={knop} onClick={() => speelAf(SNELHEDEN[snelheid])} disabled={stand.soort !== "loopt"} data-testid="sim-afspelen" title="Stap voor stap afspelen tot het volgende gat of het einde; het beeld volgt het token">
                  ▶ Afspelen
                </button>
              )}
              <select style={{ ...knop, padding: "2px 4px" }} value={snelheid} onChange={(e) => setSnelheid(e.target.value)} disabled={afspelen} title="Tempo van het afspelen" data-testid="sim-snelheid">
                {Object.keys(SNELHEDEN).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button style={knop} onClick={() => probeer(() => sim.loop())} disabled={stand.soort !== "loopt" || afspelen} data-testid="sim-loop" title="In één keer door tot het volgende gat of het einde">
                ⏭ Doorlopen
              </button>
              <button style={knop} onClick={() => probeer(() => sim.spoelTerug(Math.max(1, log.length - 1)))} disabled={log.length <= 1 || afspelen} title="Eén regel terug (←)">
                ◀ Terug
              </button>
              <button style={knop} onClick={stop} data-testid="sim-stop" title="Stop de simulatie en haal het token van het diagram">
                ■ Stop
              </button>
            </>
          )}
          {sim && (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--s-fg-muted, #64748b)" }} title="Laat het token ook op het modeldiagram zien (alleen in deze tab; een PNG/SVG-export van het diagram neemt het dan mee). Het model zelf verandert niet.">
              <input type="checkbox" checked={!!S.opCanvas} onChange={(e) => zet({ opCanvas: e.target.checked })} data-testid="sim-op-canvas" />
              ook op het modeldiagram
            </label>
          )}
          <span style={{ fontWeight: 600, color: standKleur, marginLeft: 6 }} data-testid="sim-stand">
            {standTekst(stand)}
          </span>
        </div>
        {verwachting && (
          <div style={{ marginTop: 6, color: verwachting.klopt ? "#16a34a" : TOKEN_KLEUR.vast }} data-testid="sim-verwachting" data-klopt={String(verwachting.klopt)}>
            {verwachting.klopt ? "✓ De afloop klopt met de verwachting van het scenario" : "! De afloop wijkt af van de verwachting van het scenario"}
            {": "}
            {verwachting.punten.map((p) => (p.klopt ? `${p.wat} ${p.toon}` : `${p.wat}: verwacht ${p.toon}, gevonden ${JSON.stringify(p.gevonden)}`)).join("; ")}
          </div>
        )}
        {S.fout && <div style={{ color: TOKEN_KLEUR.vast, marginTop: 6 }}>{S.fout}</div>}
        {openGat && <GatFormulier gat={openGat} zaadje={zaadje} onVul={(w) => (sim.vul(openGat.id, w), zet())} />}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "8px 12px" }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }} data-testid="sim-processen">
          {processen.map((p) => (
            <button
              key={p.id}
              onClick={() => zet({ toonProces: p.id })}
              style={{ ...knop, fontWeight: p.id === getoond ? 700 : 400, borderColor: p.id === getoond ? "#6366f1" : knop.border.split(" ").pop(), opacity: sim && !metInstantie.has(p.id) ? 0.55 : 1 }}
              title={sim ? (metToken.has(p.id) ? "Hier staat een token" : metInstantie.has(p.id) ? "Dit proces heeft gelopen" : "Dit proces doet (nog) niet mee") : "Toon dit proces"}
            >
              {metToken.has(p.id) ? "● " : ""}
              {p.naam}
              {bevindingenPerProces[p.id] ? (
                <span style={{ marginLeft: 6, padding: "0 5px", borderRadius: 8, background: TOKEN_KLEUR.vast, color: "#fff", fontSize: 10, fontWeight: 700 }} title="Lijnen en objecten: bevindingen in dit proces" data-testid="sim-proces-bevindingen">
                  {bevindingenPerProces[p.id]}
                </span>
              ) : null}
            </button>
          ))}
          {sim && S.toonProces && (
            <button style={{ ...knop, border: "none", background: "transparent", textDecoration: "underline" }} onClick={() => zet({ toonProces: null })} title="Toon steeds het proces waar het token is">
              volg het token
            </button>
          )}
        </div>
        {lijnBevindingen.length > 0 && (
          <div style={{ margin: "0 0 8px", padding: "4px 8px", borderRadius: 4, borderLeft: `3px solid ${TOKEN_KLEUR.vast}`, fontSize: 12 }} data-testid="sim-lijnen">
            <b>Lijnen en objecten ({lijnBevindingen.length})</b>
            {lijnBevindingen.map((b, i) => (
              <div key={i} style={{ padding: "1px 0" }}>
                <span style={{ color: TOKEN_KLEUR.vast, fontWeight: 700 }}>!</span> {b.reden}
              </div>
            ))}
          </div>
        )}
        {sprong && (
          <div
            data-testid="sim-sprong"
            style={{ margin: "0 0 8px", padding: "4px 8px", borderRadius: 4, fontSize: 12, borderLeft: `3px solid ${TOKEN_KLEUR.wacht}`, background: sprong.recent ? "rgba(34, 211, 238, 0.15)" : "transparent", transition: "background 0.6s" }}
          >
            Het token ging bij stap {sprong.nr} van <b>{sprong.van}</b> naar <b>{sprong.naar}</b>
            {sprong.bericht ? ` (${sprong.bericht})` : ""}.
          </div>
        )}
        <DiagramMetToken
          diagramId={diagramId}
          beeld={beeld}
          versie={S.versie}
          objecten={bijDataObjecten}
          lijnToets={lijnToets}
        >
          <CmOpties.Provider value={{ verbergLeeg: !!S.verbergLeeg }}>
            {(S.zwevend || []).map((z) => (
              <ZwevendObject key={z.id} z={z} S={S} />
            ))}
          </CmOpties.Provider>
        </DiagramMetToken>
        {!sim && (
          <p style={{ ...gedempt, maxWidth: 640 }}>
            Kies links een scenario en het proces waar het start, en druk op Start. Het token loopt dan over dit diagram; springt het naar een ander proces, dan volgt het beeld. Bewerken doe je in Modelleren; ook daar staat het token op het diagram zolang de run loopt.
          </p>
        )}
      </div>

      <div
        onMouseDown={begin}
        onDoubleClick={() => zetLogHoogte(LOG_STANDAARD)}
        style={{ flexShrink: 0, height: 6, cursor: "row-resize", borderTop: "1px solid var(--s-border, #cbd5e1)", background: "transparent" }}
        title="Sleep om de log groter of kleiner te maken; dubbelklik: standaardhoogte"
        data-testid="sim-log-greep"
      />
      <div ref={logRef} style={{ flexShrink: 0, height: logHoogte, minHeight: LOG_MIN, overflow: "auto", padding: "0 12px 8px" }} data-testid="sim-log">
        <p style={{ ...kop, position: "sticky", top: 0, margin: 0, padding: "4px 0", background: "var(--s-bg, var(--dc-canvas-achtergrond, #fff))", zIndex: 1 }}>Log {log.length ? `(${log.length})` : ""}</p>
        {!log.length && <div style={gedempt}>Elke stap komt hier te staan. Klik op een regel om daarheen terug te spoelen.</div>}
        {log.map((regel) => {
          const mutaties = regel.wijzigingen.map(mutatieTekst).filter(Boolean);
          const terug = regel.nr < log.length;
          return (
            <div key={regel.nr} onClick={() => terug && probeer(() => sim.spoelTerug(regel.nr))} title={terug ? "Spoel terug tot na deze regel" : ""} style={{ padding: "2px 4px", borderRadius: 3, cursor: terug ? "pointer" : "default", background: terug ? "transparent" : "var(--s-hover, #e5e7eb)" }}>
              <span style={{ ...gedempt, display: "inline-block", width: 24 }}>{regel.nr}</span>
              <b>{regel.wat}</b>
              {regel.beslissing && <span style={gedempt}> · regel {regel.beslissing.regel || "geen"}</span>}
              {regel.conditie && <span style={gedempt}> · {regel.conditie}</span>}
              {regel.bericht && <span style={gedempt}> · ✉ {regel.bericht}</span>}
              {regel.signaal && (
                <span style={gedempt} data-testid="sim-log-signaal">
                  {" "}
                  · △ {regel.signaal.naam} → {regel.signaal.ontvangers.length ? regel.signaal.ontvangers.join(", ") : "niemand luistert"}
                  {regel.signaal.geweigerd?.map((g, i) => (
                    <span key={i} style={{ color: TOKEN_KLEUR.vast }}>
                      {" "}
                      · niet bij {g.waar}: {g.reden}
                    </span>
                  ))}
                </span>
              )}
              {mutaties.map((t, i) => (
                <div key={i} style={{ ...mono, ...gedempt, marginLeft: 24, wordBreak: "break-word" }}>
                  {t}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Eén object met zijn versies (Mark 14-11): elke stap die het object raakt is een versie, zoals
 * een registratie met een wijziging in het bitemporele register. Het nummer staat naast de naam;
 * de velden die in de getoonde versie veranderden zijn gemarkeerd. Klik op een versie om het
 * object te zien zoals het na die stap was (de run zelf blijft staan); "nu" gaat terug.
 */
function ObjectKaart({ o, S, begin = "cm-vorm" }) {
  const [bekijk, setBekijk] = useState(null);
  // "Toon in het objectenpaneel" vanuit de tekening: in beeld schuiven en even oplichten.
  const hier = useRef(null);
  const [licht, setLicht] = useState(false);
  useEffect(() => {
    if (!S.wijsAan || S.wijsAan.id !== o.id) return undefined;
    hier.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    setLicht(true);
    const t = setTimeout(() => setLicht(false), 1600);
    return () => clearTimeout(t);
  }, [S.wijsAan, o.id]);
  const versies = versiesVan(S.sim.log, o.id);
  const getoond = (bekijk && versies.find((v) => v.nr === bekijk)) || null;
  const laatste = versies[versies.length - 1];
  // Zonder gekozen versie: markeer wat in de laatste stap van de run veranderde.
  const markeer = getoond || (laatste && laatste.nr === S.sim.log.length ? laatste : null);
  const gewijzigd = new Set(markeer?.velden || []);
  const data = getoond ? S.sim.toestand(getoond.nr).objecten[o.id]?.data || {} : o.data;
  // Het cm-beeld: via het e-dienstmodel, of zonder e-dienstmodel rechtstreeks uit het cm van het project.
  const cm = o.type !== PROCESINSTANTIE && S.cm ? cmBeeldVoor(o.type) : null;
  const beeld = cm?.beeld || null;
  const chip = (actief) => ({ fontSize: 10, padding: "0 5px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--s-border, #cbd5e1)", background: actief ? "var(--s-accent, #6366f1)" : "transparent", color: actief ? "#fff" : "inherit" });
  return (
    <details ref={hier} open={o.type !== PROCESINSTANTIE || undefined} style={{ marginBottom: 4, borderRadius: 4, outline: licht ? "2px solid #facc15" : "none", outlineOffset: 2 }} data-testid="sim-object" data-object={o.id} data-aangewezen={licht ? "ja" : undefined}>
      <summary style={{ cursor: "pointer" }}>
        <b>{o.type === PROCESINSTANTIE ? o.data.naam || o.data.proces : o.id}</b> <span style={gedempt}>{o.type}</span>
        {(data.state || data.status) && (
          <span style={{ marginLeft: 6, padding: "0 6px", borderRadius: 8, background: data.state === "lopend" ? TOKEN_KLEUR.klaar : data.state === "afgebroken" ? TOKEN_KLEUR.vast : "#64748b", color: "#fff", fontSize: 11 }}>{data.state || data.status}</span>
        )}
        <span style={{ ...gedempt, marginLeft: 6, fontSize: 11 }} title="Elke stap die dit object raakte is een versie" data-testid="sim-object-versie">
          v{getoond ? getoond.versie : versies.length}
          {getoond ? ` van ${versies.length}` : ""}
        </span>
      </summary>
      {versies.length > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center", margin: "2px 0 2px 12px" }} data-testid="sim-versies">
          <span style={{ ...gedempt, fontSize: 10 }}>versies:</span>
          {versies.map((v) => (
            <button key={v.nr} style={chip(getoond?.nr === v.nr)} onClick={() => setBekijk(getoond?.nr === v.nr ? null : v.nr)} title={`stap ${v.nr}: ${v.wat}${v.velden.length ? `\nvelden: ${v.velden.join(", ")}` : ""}${v.relaties.length ? `\nrelaties: ${v.relaties.join(", ")}` : ""}`} data-testid={`sim-versie-${v.versie}`}>
              v{v.versie}
            </button>
          ))}
          <button style={chip(!getoond)} onClick={() => setBekijk(null)} data-testid="sim-versie-nu">
            nu
          </button>
        </div>
      )}
      {markeer && (
        <div style={{ ...gedempt, fontSize: 10, margin: "0 0 2px 12px" }} data-testid="sim-versie-wat">
          v{markeer.versie}, stap {markeer.nr}: {markeer.wat}
          {markeer.relaties.length ? ` · ${markeer.relaties.join(", ")}` : ""}
        </div>
      )}
      {beeld ? (
        <CmObject beeld={beeld} data={data} bron={cm.bron} gewijzigd={gewijzigd} type={o.type} begin={begin} />
      ) : (
        <div style={{ margin: "2px 0 0 12px" }}>
          <PlatJson data={data} gewijzigd={gewijzigd} />
        </div>
      )}
    </details>
  );
}

/** Een object erbij zetten in de tekening (of het bestaande naar voren halen); een tweede schuift iets op. */
function toonZwevend(id, plek) {
  const S = useRunNu();
  const lijst = (S.zwevend || []).filter((z) => z.id !== id);
  const bestaand = (S.zwevend || []).find((z) => z.id === id);
  let p = bestaand ? { left: bestaand.left, top: bestaand.top } : plek;
  while (!bestaand && lijst.some((z) => Math.abs(z.left - p.left) < 12 && Math.abs(z.top - p.top) < 12)) p = { left: p.left + 22, top: p.top + 22 };
  zet({ zwevend: [...lijst, { ...(bestaand || {}), id, ...p }] });
}

/** De kleuren van een object in de tekening, naar de vormen van het cm. */
const OBJECT_KLEUR = { entiteit: "#fde68a", relatie: "#ede9fe", gegevenselement: "#bbf7d0" };
const OBJECT_RAND = "#64748b";
/** Waar een object begint als het nog niet versleept is: een kolom per niveau, van boven naar beneden. */
const OBJECT_KOLOM = 268;

/** Een waarde zoals hij achter de = staat. */
const alsWaarde = (w) => (typeof w === "string" ? w : JSON.stringify(w));

/** Eén veld: `naam = waarde` (UML: = geeft de waarde; de : staat alleen in de kop, bij het type). */
function ObjectVeld({ v, inspring }) {
  return (
    <div style={{ padding: `0 6px 0 ${inspring ? 14 : 6}px`, overflowWrap: "anywhere", ...(v.gewijzigd ? GEWIJZIGD : {}) }} data-testid="sim-object-veld" data-veld={v.naam} data-gewijzigd={v.gewijzigd ? "ja" : undefined}>
      <span style={{ fontWeight: v.verplicht ? 700 : 400, color: v.fout ? TOKEN_KLEUR.vast : undefined }}>{v.naam}</span>
      {" = "}
      {v.fout && (v.waarde === undefined || v.waarde === null || v.waarde === "") ? <span style={{ color: TOKEN_KLEUR.vast }}>ontbreekt</span> : <span style={{ wordBreak: "break-word" }}>{Array.isArray(v.waarde) ? v.waarde.map(alsWaarde).join(", ") : alsWaarde(v.waarde)}</span>}
      {v.extra ? <span style={{ color: "#475569" }}> ({v.extra})</span> : null}
    </div>
  );
}

/**
 * Eén object in de vorm van het cm ("neem op in Entiteit"), met waarden: de kop «stereotype» en
 * onderstreept `naam : Type`, de enkelvoudige gegevenselementen genest. Zonder kardinaliteit en
 * typen; alleen wat een waarde heeft.
 */
function ObjectDoos({ d, kleur, toestand = null, versie = null, plek, onSleep, onMenu, meet }) {
  const begin = useRef(null);
  return (
    <div
      ref={meet}
      data-testid="sim-objectdoos"
      data-doos={d.id}
      data-stereotype={d.stereotype}
      style={{ position: "absolute", left: plek.left, top: plek.top, minWidth: 140, maxWidth: 236, width: "max-content", border: `2px solid ${OBJECT_RAND}`, borderRadius: 10, background: kleur, color: "#0f172a", fontSize: 10.5, lineHeight: 1.35, cursor: "grab", userSelect: "none", touchAction: "none", boxShadow: "0 4px 14px rgba(0, 0, 0, 0.3)", paddingBottom: 4 }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        begin.current = { x: e.clientX, y: e.clientY, left: plek.left, top: plek.top };
      }}
      onPointerMove={(e) => {
        const b = begin.current;
        if (b) onSleep({ left: b.left + e.clientX - b.x, top: b.top + e.clientY - b.y }, false);
      }}
      onPointerUp={(e) => {
        const b = begin.current;
        if (!b) return;
        begin.current = null;
        onSleep({ left: b.left + e.clientX - b.x, top: b.top + e.clientY - b.y }, true);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onMenu(e);
      }}
    >
      <div style={{ textAlign: "center", padding: "2px 8px 3px", borderBottom: `1.5px solid ${OBJECT_RAND}`, position: "relative" }}>
        <div style={{ fontStyle: "italic", fontSize: 9.5 }}>«{d.stereotype}»</div>
        <div style={{ fontWeight: 700, fontSize: 11, textDecoration: "underline", overflowWrap: "anywhere" }} data-testid="sim-objectdoos-kop">
          {d.kop}
        </div>
        {toestand ? <div style={{ fontSize: 10 }}>[{toestand}]</div> : null}
        {versie ? (
          <span style={{ position: "absolute", right: 6, top: 2, fontSize: 9, fontWeight: 700, color: "#4338ca" }} title="de versie van het object in deze run">
            {versie}
          </span>
        ) : null}
      </div>
      {d.velden.length > 0 && (
        <div style={{ paddingTop: 3 }}>
          {d.velden.map((v) => (
            <ObjectVeld key={v.naam} v={v} />
          ))}
        </div>
      )}
      {d.secties.map((sectie) => (
        <div key={sectie.naam} style={{ paddingTop: 3 }} data-testid="sim-object-ge" data-ge={sectie.naam}>
          <div style={{ fontWeight: 700, padding: "0 6px" }}>{sectie.naam}</div>
          {sectie.velden.map((v) => (
            <ObjectVeld key={v.naam} v={v} inspring />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Het aanhechtpunt van een lijn tussen twee objecten: de zijden die naar elkaar toe liggen. */
function lijnPunten(a, b) {
  if (b.left >= a.left + a.width) return [a.left + a.width, a.top + Math.min(a.height / 2, 28), b.left, b.top + Math.min(b.height / 2, 28)];
  if (b.left + b.width <= a.left) return [a.left, a.top + Math.min(a.height / 2, 28), b.left + b.width, b.top + Math.min(b.height / 2, 28)];
  if (b.top >= a.top + a.height) return [a.left + a.width / 2, a.top + a.height, b.left + b.width / 2, b.top];
  return [a.left + a.width / 2, a.top, b.left + b.width / 2, b.top + b.height];
}

/**
 * Een object van de run als een klein objectdiagram over de tekening (Mark 16-11, ontwerp §12.6):
 * het hoofdobject in de vorm van het cm, met de meervoudige gegevenselementen en de relaties als
 * losse objecten ernaast, verbonden met lijnen (`simulatie/objectVorm.js`). Geen venster eromheen.
 * Het hoofdobject slepen verplaatst het geheel, een los object alleen zichzelf. Rechtsklik sluit
 * het of wijst het aan in het objectenpaneel (voor de versies en de json). Het toont de stand van
 * nu; wat in de laatste stap veranderde is gemarkeerd.
 */
function ZwevendObject({ z, S }) {
  const [sleep, setSleep] = useState(null); // {id, left, top} zolang er gesleept wordt
  const [menu, setMenu] = useState(null);
  const [maten, setMaten] = useState({});
  const dozen = useRef({});
  useEffect(() => {
    if (!menu) return undefined;
    const dicht = () => setMenu(null);
    window.addEventListener("pointerdown", dicht);
    return () => window.removeEventListener("pointerdown", dicht);
  }, [menu]);
  // De maten van de objecten, voor de opstelling en de lijnen; opnieuw na elke stap van de run.
  useLayoutEffect(() => {
    const nu = {};
    for (const [id, el] of Object.entries(dozen.current)) if (el) nu[id] = { width: el.offsetWidth, height: el.offsetHeight };
    setMaten((oud) => (JSON.stringify(oud) === JSON.stringify(nu) ? oud : nu));
  }, [S.versie, z.id]);

  const o = S.sim?.toestand().objecten[z.id];
  if (!o) return null;
  const versies = versiesVan(S.sim.log, o.id);
  const laatste = versies[versies.length - 1];
  const gewijzigd = new Set(laatste && laatste.nr === S.sim.log.length ? laatste.velden : []);
  const cm = cmBeeldVoor(o.type);
  const vorm = cm ? cmVorm(cm.beeld, o.data) : null;
  // Zonder type in het cm: één object met de platte velden.
  const { objecten, lijnen } = vorm?.boom
    ? objectVorm(vorm.boom, { objectNaam: o.id, fouten: vorm.problemen.filter((p) => p.ernst === "fout").map((p) => p.pad), gewijzigd })
    : { objecten: [{ id: "hoofd", stereotype: "object", kop: `${o.id} : ${o.type}`, type: o.type, kolom: 0, velden: Object.entries(o.data || {}).map(([naam, waarde]) => ({ naam, waarde, gewijzigd: gewijzigd.has(naam) })), secties: [] }], lijnen: [] };
  const kleurVan = (d) => (d.stereotype === "entiteit" && (cm?.beeld.model?.entiteiten || []).find((e) => e.typenaam === d.type)?.kleur) || OBJECT_KLEUR[d.stereotype] || "#fef9c3";

  // De opstelling: een kolom per niveau, van boven naar beneden; wat versleept is blijft waar het staat.
  const hoogte = {};
  const plekken = {};
  for (const d of objecten) {
    const vast = z.delen?.[d.id];
    const y = hoogte[d.kolom] || 0;
    plekken[d.id] = sleep?.id === d.id ? { left: sleep.left, top: sleep.top } : vast || { left: d.kolom * OBJECT_KOLOM + (d.inspring ? 28 : 0), top: y };
    hoogte[d.kolom] = y + (maten[d.id]?.height || 60) + 18;
  }
  const groep = sleep?.id === "#groep" ? sleep : { left: z.left, top: z.top };
  const vak = (id) => (maten[id] ? { ...plekken[id], ...maten[id] } : null);
  const sluit = (alle) => zet({ zwevend: alle ? [] : (S.zwevend || []).filter((x) => x.id !== o.id) });
  const bewaar = (patch) => zet({ zwevend: [...(S.zwevend || []).filter((x) => x.id !== o.id), { ...z, ...patch }] });
  const regel = { display: "block", width: "100%", textAlign: "left", padding: "4px 10px", fontSize: 12, border: "none", background: "transparent", color: "inherit", cursor: "pointer" };
  return (
    <div data-testid="sim-dataobject-object" data-plek="tekening" data-object={o.id} style={{ position: "absolute", left: groep.left, top: groep.top, width: 0, height: 0, zIndex: sleep ? 7 : 5 }}>
      <svg style={{ position: "absolute", left: 0, top: 0, width: 1, height: 1, overflow: "visible", pointerEvents: "none" }}>
        <defs>
          <marker id={`sim-ruit-${o.id}`} viewBox="0 0 14 8" refX="0" refY="4" markerWidth="14" markerHeight="8" orient="auto">
            <path d="M0 4 L7 0 L14 4 L7 8 Z" fill={OBJECT_RAND} />
          </marker>
          <marker id={`sim-pijl-${o.id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto">
            <path d="M1 1 L9 5 L1 9" fill="none" stroke={OBJECT_RAND} strokeWidth="1.5" />
          </marker>
        </defs>
        {lijnen.map((l) => {
          const [a, b] = [vak(l.van), vak(l.naar)];
          if (!a || !b) return null;
          const [x1, y1, x2, y2] = lijnPunten(a, b);
          return (
            <g key={`${l.van}>${l.naar}`} data-testid="sim-object-lijn" data-soort={l.soort}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={OBJECT_RAND} strokeWidth="1.5" markerStart={l.soort === "compositie" ? `url(#sim-ruit-${o.id})` : undefined} markerEnd={l.soort === "doel" ? `url(#sim-pijl-${o.id})` : undefined} />
              {l.label ? (
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 4} textAnchor="middle" fontSize="10" fill="var(--s-fg, #1f2937)">
                  {l.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {objecten.map((d) => (
        <ObjectDoos
          key={d.id}
          d={d}
          kleur={kleurVan(d)}
          toestand={d.id === "hoofd" ? o.data.status || o.data.state || null : null}
          versie={d.id === "hoofd" ? `v${versies.length}` : null}
          plek={plekken[d.id]}
          meet={(el) => (dozen.current[d.id] = el)}
          onMenu={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setMenu({ x: plekken[d.id].left + e.clientX - r.left, y: plekken[d.id].top + e.clientY - r.top });
          }}
          onSleep={(p, klaar) => {
            // Het hoofdobject neemt het geheel mee; een los object verplaatst alleen zichzelf.
            if (d.id === "hoofd") {
              const naar = { left: Math.max(0, z.left + p.left - plekken.hoofd.left), top: Math.max(0, z.top + p.top - plekken.hoofd.top) };
              if (klaar) (setSleep(null), bewaar(naar));
              else setSleep({ id: "#groep", ...naar });
            } else if (klaar) (setSleep(null), bewaar({ delen: { ...(z.delen || {}), [d.id]: p } }));
            else setSleep({ id: d.id, ...p });
          }}
        />
      ))}
      {menu && (
        <div
          data-testid="sim-zwevend-menu"
          onPointerDown={(e) => e.stopPropagation()}
          style={{ position: "absolute", left: menu.x, top: menu.y, zIndex: 9, minWidth: 190, padding: "4px 0", borderRadius: 6, border: "1px solid var(--s-border, #cbd5e1)", background: "var(--s-panel, #fff)", color: "var(--s-fg, #1f2937)", boxShadow: "0 6px 20px rgba(0, 0, 0, 0.35)", cursor: "default" }}
        >
          <button style={regel} onClick={() => (setMenu(null), zet({ wijsAan: { id: o.id, tik: Date.now() } }))} data-testid="sim-zwevend-paneel">
            Toon in het objectenpaneel
          </button>
          {Object.keys(z.delen || {}).length > 0 && (
            <button style={regel} onClick={() => (setMenu(null), bewaar({ delen: {} }))}>
              Opnieuw opstellen
            </button>
          )}
          <button style={regel} onClick={() => (setMenu(null), sluit(false))} data-testid="sim-zwevend-sluit">
            Sluiten
          </button>
          {(S.zwevend || []).length > 1 && (
            <button style={regel} onClick={() => (setMenu(null), sluit(true))}>
              Alle objecten sluiten
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Inspector: de objecten met hun state, de procesvariabelen en wat buiten het cm gebeurde. */
function Inspector() {
  const S = useRun();
  const toestand = S.sim ? S.sim.toestand() : null;
  const objecten = toestand ? Object.values(toestand.objecten) : [];
  return (
    <div style={{ padding: "8px 10px", fontSize: 12, color: "var(--s-fg, #1f2937)" }} data-testid="sim-objecten">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <p style={{ ...kop, margin: 0 }}>Objecten</p>
        <label style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--s-fg-muted, #64748b)" }} title="Lege optionele velden niet tonen, in het paneel en bij de objecten in de tekening. Een verplicht veld zonder waarde blijft staan.">
          <input type="checkbox" checked={!!S.verbergLeeg} onChange={(e) => zetVerbergLeeg(e.target.checked)} data-testid="sim-verberg-leeg" />
          lege velden verbergen
        </label>
      </div>
      {!objecten.length && <div style={gedempt}>Nog geen objecten. Na Start staat hier het startobject, en elke procesinstantie.</div>}
      <CmOpties.Provider value={{ verbergLeeg: !!S.verbergLeeg }}>
        {objecten.map((o) => (
          <ObjectKaart key={o.id} o={o} S={S} />
        ))}
      </CmOpties.Provider>
      {toestand && Object.keys(toestand.variabelen).length > 0 && (
        <>
          <p style={{ ...kop, marginTop: 10 }}>Procesvariabelen</p>
          {Object.entries(toestand.variabelen).map(([naam, w]) => (
            <div key={naam} style={{ ...mono, wordBreak: "break-word" }}>
              {naam} = {JSON.stringify(w)}
            </div>
          ))}
        </>
      )}
      {toestand?.extern.length > 0 && (
        <>
          <p style={{ ...kop, marginTop: 10 }}>Buiten het cm (stub)</p>
          {toestand.extern.map((e, i) => (
            <div key={i} style={{ ...mono, wordBreak: "break-word" }}>
              {e.actie}
              {e.doel ? ` ${e.doel}` : ""} → {e.verwijzing}
            </div>
          ))}
        </>
      )}
      {S.sim && S.m1 && (
        <p style={{ ...gedempt, marginTop: 12 }}>
          Draait op {S.sim.processen.length} processen{S.subjecten ? ` (de subjecten van ${S.subjecten.simulatie})` : ""}. Beslistabellen: {S.m1.beslissingen.length ? S.m1.beslissingen.map((b) => b.model_naam).join(", ") : "geen"}. E-dienstmodel: {S.m1.edienst?.edienst?.naam || (S.m1.edienst ? "geladen" : "geen")}.
        </p>
      )}
    </div>
  );
}

export default {
  id: "simulatie",
  label: "Simulatie",
  icon: <IconSimulatie />,
  groep: "modelleren",
  status: "preview",
  Sidebar,
  Main,
  Inspector,
  sidebarLabel: "Scenario en bronnen",
  inspectorLabel: "Objecten",
};
