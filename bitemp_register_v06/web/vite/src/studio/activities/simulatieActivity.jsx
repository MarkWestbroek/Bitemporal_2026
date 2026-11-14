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
 * het canvas: je bewerkt het proces in Modelleren. Daar blijft het token ook
 * zichtbaar zolang de run loopt.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { IconSimulatie } from "../icons";
import { getProfieltype } from "../profieltypeRegistry";
import { tekenDiagram } from "../gedeeldeBeelden.js";
import { vraagBevestiging, toonMelding } from "../naamDialog.jsx";
import { willekeurig } from "../../simulatie/gaten.js";
import { PROCESINSTANTIE } from "../../simulatie/store.js";
import { tokenBeeld, standTekst, mutatieTekst, TOKEN_KLEUR } from "../../simulatie/weergave.js";
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
function DiagramMetToken({ diagramId, beeld, versie }) {
  const { elements, diagrams } = useBpmn();
  const doos = useRef(null);
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
  }, [svg, versie]);
  if (!svg) return <div style={{ ...gedempt, padding: 16 }}>Geen procesdiagram om te tonen.</div>;
  return (
    <div
      ref={doos}
      data-testid="sim-diagram"
      className="sim-diagram"
      style={{ background: "#fff", borderRadius: 6, padding: 12, border: "1px solid var(--s-border, #cbd5e1)", overflow: "auto" }}
      // De tekening komt uit de eigen tekenaar (diagramcore/tekenaar), die tekst als tekstknoop schrijft.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Sidebar: het scenario, waar de run start en waar hij op draait. */
function Sidebar() {
  const S = useRun();
  const { elements, diagrams } = useBpmn();
  const startbaar = useMemo(() => startbareProcessen({ elements, diagrams }), [elements, diagrams, S.versie]);
  const startProces = gekozenStartProces(startbaar);
  const project = useMemo(() => beslissingenUitProject(), [S.versie]);
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
        <select style={{ ...veldstijl, marginBottom: 4 }} value="" onChange={(e) => kiesVoorbeeld(Number(e.target.value))} data-testid="sim-voorbeeld">
          <option value="">GPK-scenario kiezen…</option>
          {VOORBEELDEN.map((v) => (
            <option key={v.nr} value={v.nr} title={v.beschrijving}>
              {v.naam}
            </option>
          ))}
        </select>
        {beschrijving && (
          <div style={{ marginBottom: 4 }} data-testid="sim-scenario-beschrijving">
            <b>{beschrijving.naam}</b>
            {beschrijving.tekst ? <div style={gedempt}>{beschrijving.tekst}</div> : null}
          </div>
        )}
        <textarea style={{ ...veldstijl, ...mono, height: 260, resize: "vertical" }} value={scenarioTekst()} onChange={(e) => zet({ scenarioTekst: e.target.value })} spellCheck={false} data-testid="sim-scenario" />
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
  const afspelen = speeltAf();
  const [snelheid, setSnelheid] = useState("gewoon");
  const sprong = sim ? laatsteSprong() : null;
  const standKleur = { loopt: TOKEN_KLEUR.klaar, gat: TOKEN_KLEUR.gat, vastgelopen: TOKEN_KLEUR.vast, uitzondering: TOKEN_KLEUR.vast, uitkomst: "#16a34a" }[stand.soort] || "var(--s-fg-muted, #64748b)";
  let zaadje = 0;
  try {
    zaadje = JSON.parse(scenarioTekst()).zaadje ?? 0;
  } catch {
    /* het scenario is nog geen geldige JSON */
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, fontSize: 12, color: "var(--s-fg, #1f2937)" }} data-testid="sim-paneel">
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
              <button style={hoofdknop} onClick={() => probeer(() => sim.stap())} disabled={stand.soort !== "loopt" || afspelen} data-testid="sim-stap" title="Eén stap: het token gaat één element verder">
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
              <button style={knop} onClick={() => probeer(() => sim.spoelTerug(Math.max(1, log.length - 1)))} disabled={log.length <= 1 || afspelen} title="Eén regel terug">
                ◀ Terug
              </button>
              <button style={knop} onClick={stop} data-testid="sim-stop" title="Stop de simulatie en haal het token van het diagram">
                ■ Stop
              </button>
            </>
          )}
          <span style={{ fontWeight: 600, color: standKleur, marginLeft: 6 }} data-testid="sim-stand">
            {standTekst(stand)}
          </span>
        </div>
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
            </button>
          ))}
          {sim && S.toonProces && (
            <button style={{ ...knop, border: "none", background: "transparent", textDecoration: "underline" }} onClick={() => zet({ toonProces: null })} title="Toon steeds het proces waar het token is">
              volg het token
            </button>
          )}
        </div>
        {sprong && (
          <div
            data-testid="sim-sprong"
            style={{ margin: "0 0 8px", padding: "4px 8px", borderRadius: 4, fontSize: 12, borderLeft: `3px solid ${TOKEN_KLEUR.wacht}`, background: sprong.recent ? "rgba(34, 211, 238, 0.15)" : "transparent", transition: "background 0.6s" }}
          >
            Het token ging bij stap {sprong.nr} van <b>{sprong.van}</b> naar <b>{sprong.naar}</b>
            {sprong.bericht ? ` (${sprong.bericht})` : ""}.
          </div>
        )}
        <DiagramMetToken diagramId={diagramId} beeld={beeld} versie={S.versie} />
        {!sim && (
          <p style={{ ...gedempt, maxWidth: 640 }}>
            Kies links een scenario en het proces waar het start, en druk op Start. Het token loopt dan over dit diagram; springt het naar een ander proces, dan volgt het beeld. Bewerken doe je in Modelleren; ook daar staat het token op het diagram zolang de run loopt.
          </p>
        )}
      </div>

      <div style={{ flexShrink: 0, height: "32%", minHeight: 120, overflow: "auto", borderTop: "1px solid var(--s-border, #cbd5e1)", padding: "8px 12px" }} data-testid="sim-log">
        <p style={kop}>Log {log.length ? `(${log.length})` : ""}</p>
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

/** Inspector: de objecten met hun state, de procesvariabelen en wat buiten het cm gebeurde. */
function Inspector() {
  const S = useRun();
  const toestand = S.sim ? S.sim.toestand() : null;
  const objecten = toestand ? Object.values(toestand.objecten) : [];
  return (
    <div style={{ padding: "8px 10px", fontSize: 12, color: "var(--s-fg, #1f2937)" }} data-testid="sim-objecten">
      <p style={kop}>Objecten</p>
      {!objecten.length && <div style={gedempt}>Nog geen objecten. Na Start staat hier het startobject, en elke procesinstantie.</div>}
      {objecten.map((o) => (
        <details key={o.id} open={o.type !== PROCESINSTANTIE} style={{ marginBottom: 4 }}>
          <summary style={{ cursor: "pointer" }}>
            <b>{o.type === PROCESINSTANTIE ? o.data.naam || o.data.proces : o.id}</b> <span style={gedempt}>{o.type}</span>
            {(o.data.state || o.data.status) && (
              <span style={{ marginLeft: 6, padding: "0 6px", borderRadius: 8, background: o.data.state === "lopend" ? TOKEN_KLEUR.klaar : o.data.state === "afgebroken" ? TOKEN_KLEUR.vast : "#64748b", color: "#fff", fontSize: 11 }}>{o.data.state || o.data.status}</span>
            )}
          </summary>
          <pre style={{ ...mono, margin: "2px 0 0 12px", padding: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", background: "transparent", color: "inherit", border: "none" }}>{JSON.stringify(o.data, null, 1)}</pre>
        </details>
      ))}
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
          Draait op {S.sim.processen.length} processen. Beslistabellen: {S.m1.beslissingen.length ? S.m1.beslissingen.map((b) => b.model_naam).join(", ") : "geen"}. E-dienstmodel: {S.m1.edienst?.edienst?.naam || (S.m1.edienst ? "geladen" : "geen")}.
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
