/**
 * simulatiePaneel — de simulatie van BPMN en DMN met cm-objecten, als
 * onder-dock van de BPMN-activiteit op de motor (fase 2 van
 * docs/plans/2026-11-12 Simulatie van BPMN en DMN met cm-objecten).
 *
 * Het paneel is alleen het scherm; de simulatie zelf staat in `src/simulatie/`
 * (pure modules). Wat je ziet:
 *
 *   - het token op het diagram: een rand en een bolletje op het element waar
 *     het staat (indigo = kan verder, oranje = wacht op invoer, cyaan = wacht
 *     op een bericht of een ander proces, rood = vastgelopen); waar het
 *     geweest is blijft een dunne cyaan rand staan. Het diagram volgt het
 *     token naar een ander proces;
 *   - het scenario (startobject, startvariabelen, antwoorden, vulwijze) als
 *     JSON, met de vijf GPK-scenario's als voorbeeld;
 *   - het open gat, met een rudimentair formulier naar de verwachte velden;
 *   - de objecten met hun state, de procesvariabelen en wat er buiten het cm
 *     gebeurd is;
 *   - het log, met terugspoelen naar elke regel.
 *
 * De M1-set: het proces is het BPMN-model van deze activiteit; de
 * beslistabellen komen uit de DMN-profielen van het project; het
 * e-dienstmodel (process-id's en taakformulieren) is een bestand dat je laadt.
 * Ontbreken beslistabellen of e-dienst, dan kun je die van het GPK-voorbeeld
 * gebruiken.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { maakSimulatie } from "../../simulatie/simulatie.js";
import { willekeurig } from "../../simulatie/gaten.js";
import { PROCESINSTANTIE } from "../../simulatie/store.js";
import { leesProcessen, startVan, gewoneStart } from "../../simulatie/procesmodel.js";
import { tokenBeeld, tokenCss, standTekst, mutatieTekst, TOKEN_KLEUR } from "../../simulatie/weergave.js";
import { getProfieltypen } from "../profieltypeRegistry";
import { vraagBevestiging, toonMelding } from "../naamDialog.jsx";
import { menuBus } from "../menuBus";

const VOORBEELDEN = [1, 2, 3, 4, 5];
const laadScenario = async (nr) => (await import(`../../simulatie/fixtures/gpk-scenario-${nr}.json`)).default;
const laadGpk = async () => ({
  proces: (await import("../../diagramprofielen/canoniek-uml/fixtures/cg-test/inrichten-bpmn.bpmn-model.json")).default,
  beslissingen: (await import("../../diagramprofielen/canoniek-uml/fixtures/cg-test/gpk-beslissingen.dmn-model.json")).default,
  edienst: (await import("../../diagramprofielen/canoniek-uml/fixtures/cg-test/gpk-edienst.json")).default,
});

const LEEG_SCENARIO = {
  versie: "0.1",
  naam: "Nieuw scenario",
  start: { type: "Object", id: "startobject", object: {}, variabelen: {} },
  vulwijze: { standaard: "hand", perSoort: { dienst: "willekeurig" } },
  antwoorden: {},
  zaadje: 1,
};

/** De activiteit waar dit paneel onder hangt (bpmnMotorActivity). */
const PROFIEL_ID = "bpmnMotor05";

/**
 * De simulatie leeft buiten het component: in Modelleren is elk diagram een
 * eigen tabblad, en het paneel wordt opnieuw opgebouwd als het diagram het
 * token naar een ander proces volgt. De run mag dan niet verdwijnen.
 */
const S = { sim: null, m1: null, scenarioTekst: null, edienst: null, gpk: null, startProces: null, volg: true, fout: null, versie: 0 };
const luisteraars = new Set();
function zet(patch = {}) {
  Object.assign(S, patch);
  S.versie += 1;
  for (const l of luisteraars) l();
}
const abonneer = (l) => (luisteraars.add(l), () => luisteraars.delete(l));

/** Toon een diagram: als tabblad in Modelleren, en als actief diagram in de losse activiteit. */
function toonDiagram(useStore, diagramId) {
  useStore.getState().setActiefDiagram(diagramId);
  menuBus.emit("studio:open-diagram", { profielId: PROFIEL_ID, diagramId });
}

const knop = { padding: "3px 10px", fontSize: 12, borderRadius: 4, border: "1px solid var(--s-border, #cbd5e1)", background: "var(--s-panel-head, #eceef2)", color: "var(--s-fg, #1f2937)", cursor: "pointer" };
const hoofdknop = { ...knop, background: "linear-gradient(90deg, #60a5fa, #6366f1)", color: "#fff", border: "1px solid #6366f1" };
const kop = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--s-fg-muted, #64748b)", margin: "0 0 4px" };
const kolom = { minWidth: 0, overflow: "auto", padding: "8px 10px", borderRight: "1px solid var(--s-border, #cbd5e1)" };
const veldstijl = { fontSize: 12, padding: "2px 4px", border: "1px solid var(--s-border, #cbd5e1)", borderRadius: 3, background: "var(--s-bg, #fff)", color: "var(--s-fg, #1f2937)", width: "100%", boxSizing: "border-box" };
const mono = { fontFamily: "ui-monospace, Consolas, monospace", fontSize: 11 };

/** De beslissingen (DMN) die in het project staan: elk profiel met een beslissing erin. */
function beslissingenUitProject() {
  const uit = [];
  for (const p of getProfieltypen()) {
    const st = p.useStore?.getState?.();
    if (!st?.elements) continue;
    if (Object.values(st.elements).some((e) => e.elementType === "decision" && e.data?.beslistabel)) uit.push({ model_naam: `Studio-project, profiel ${p.label || p.id}`, model: { elements: st.elements, diagrams: st.diagrams || {} } });
  }
  return uit;
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

/** Het rudimentaire formulier bij een gat: per verwacht veld een invoer naar type; zonder velden vrije JSON. */
function GatFormulier({ gat, zaadje, onVul, hulp }) {
  const [waarde, setWaarde] = useState({});
  const [vrij, setVrij] = useState("{}");
  const [fout, setFout] = useState(null);
  useEffect(() => {
    setWaarde({});
    setVrij("{}");
    setFout(null);
  }, [gat.id]);
  const zet = (naam, w) => setWaarde((v) => ({ ...v, [naam]: w }));
  const vul = () => {
    try {
      onVul(gat.velden.length ? waarde : leesVrijeInvoer(vrij));
    } catch (e) {
      setFout(e.message);
    }
  };
  const AARD = { taak: "taak voor de behandelaar", partner: `antwoord van ${gat.partner || "een andere partij"}`, dienst: `dienst buiten het cm (${gat.actie})`, expressie: "niet te lezen" };
  return (
    <div style={{ border: `2px solid ${TOKEN_KLEUR.gat}`, borderRadius: 6, padding: 8, marginTop: 8 }} data-testid="sim-gat">
      <div style={{ fontSize: 12, fontWeight: 700 }}>{gat.naam}</div>
      <div style={{ fontSize: 11, color: "var(--s-fg-muted, #64748b)", marginBottom: 6 }}>
        Gat: {AARD[gat.aard] || gat.aard}
        {gat.formulier ? ` · formulier ${gat.formulier}${gat.formulierBekend === false ? " (niet gevonden in het e-dienstmodel)" : ""}` : ""}
        {gat.bezoek > 1 ? ` · bezoek ${gat.bezoek}` : ""}
        {gat.reden ? ` · ${gat.reden}` : ""}
      </div>
      {gat.velden.map((v) => (
        <label key={v.naam} style={{ display: "block", fontSize: 12, marginBottom: 5 }}>
          {v.label || v.naam}
          {v.verplicht ? " *" : ""}
          {v.keuzes ? (
            <select style={veldstijl} value={waarde[v.naam] ?? ""} onChange={(e) => zet(v.naam, e.target.value || undefined)} data-testid={`sim-veld-${v.naam}`}>
              <option value="">(kies)</option>
              {v.keuzes.map((k) => (
                <option key={String(k)} value={k}>
                  {String(k)}
                </option>
              ))}
            </select>
          ) : v.type === "boolean" ? (
            <input type="checkbox" style={{ marginLeft: 6 }} checked={!!waarde[v.naam]} onChange={(e) => zet(v.naam, e.target.checked)} />
          ) : (
            <input
              style={veldstijl}
              type={v.type === "number" || v.type === "integer" ? "number" : "text"}
              value={waarde[v.naam] ?? ""}
              onChange={(e) => zet(v.naam, e.target.value === "" ? undefined : v.type === "number" || v.type === "integer" ? Number(e.target.value) : e.target.value)}
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
      {hulp}
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

export default function SimulatiePaneel({ useStore }) {
  const elements = useStore((s) => s.elements);
  const diagrams = useStore((s) => s.diagrams);
  useSyncExternalStore(abonneer, () => S.versie);
  const scenarioTekst = S.scenarioTekst ?? JSON.stringify(LEEG_SCENARIO, null, 2);
  const setScenarioTekst = (tekst) => zet({ scenarioTekst: tekst });
  const { sim, edienst, volg, fout } = S;
  const gpkAanvulling = S.gpk; // {beslissingen, edienst} van het GPK-voorbeeld
  const setFout = (f) => zet({ fout: f });
  const ververs = () => zet();

  const projectBeslissingen = useMemo(() => beslissingenUitProject(), [S.versie]);
  const heeftProces = Object.values(elements || {}).some((e) => e.elementType === "start-event");

  const stand = sim ? sim.stand() : { soort: "niet-gestart" };
  const toestand = sim ? sim.toestand() : null;
  const log = sim ? sim.log : [];
  const beeld = useMemo(() => tokenBeeld(toestand, log), [S.versie]);

  // Het diagram volgt het token: staat het op een element van een ander diagram, dan dat diagram tonen.
  useEffect(() => {
    if (!volg || !toestand) return;
    const tokens = Object.values(toestand.tokens);
    const token = tokens.find((k) => k.status === "klaar") || tokens.find((k) => k.wachtOp?.soort === "gat") || tokens[0];
    if (!token) return;
    const st = useStore.getState();
    const opActief = (st.diagrams[st.actiefDiagramId]?.nodes || []).some((n) => n.elementId === token.plek);
    if (opActief) return;
    const doel = Object.values(st.diagrams).find((d) => (d.nodes || []).some((n) => n.elementId === token.plek));
    if (doel) toonDiagram(useStore, doel.id);
  }, [S.versie, volg]);

  const probeer = (doen) => {
    let f = null;
    try {
      doen();
    } catch (e) {
      f = e.message;
    }
    zet({ fout: f });
  };

  // Welk proces start: wat je hier kiest, anders wat het scenario noemt, anders het diagram dat
  // open staat, anders het eerste proces met een startevent zonder trigger.
  const actiefDiagramId = useStore((s) => s.actiefDiagramId);
  const edienstNu = edienst?.inhoud || gpkAanvulling?.edienst || null;
  const startbaar = useMemo(() => {
    const { elementen, processen } = leesProcessen({ model: { elements, diagrams } }, edienstNu);
    return processen.map((p) => ({ ...p, start: startVan(p, elementen), gewoon: !!gewoneStart(p, elementen) })).filter((p) => p.start);
  }, [elements, diagrams, edienstNu]);
  const scenarioProces = (() => {
    try {
      const naam = JSON.parse(scenarioTekst).start?.proces;
      return startbaar.find((p) => p.id === naam || p.naam === naam)?.id || null;
    } catch {
      return null;
    }
  })();
  const startProces =
    (startbaar.some((p) => p.id === S.startProces) && S.startProces) ||
    scenarioProces ||
    startbaar.find((p) => p.diagramId === actiefDiagramId)?.id ||
    startbaar.find((p) => p.gewoon)?.id ||
    startbaar[0]?.id ||
    null;

  const start = () =>
    probeer(() => {
      const scenario = JSON.parse(scenarioTekst);
      const m1 = {
        proces: { model_naam: "BPMN-model van het project", model: { elements, diagrams } },
        beslissingen: projectBeslissingen.length ? projectBeslissingen : gpkAanvulling ? [gpkAanvulling.beslissingen] : [],
        edienst: edienstNu,
      };
      const nieuw = maakSimulatie({ m1, scenario: { ...scenario, start: { ...scenario.start, proces: startProces } } });
      nieuw.start();
      Object.assign(S, { sim: nieuw, m1 });
    });
  const stop = () => zet({ sim: null, m1: null, fout: null });
  const zaadje = (() => {
    try {
      return JSON.parse(scenarioTekst).zaadje ?? 0;
    } catch {
      return 0;
    }
  })();

  const kiesVoorbeeld = async (nr) => {
    if (!nr) return;
    // Een gekozen scenario noemt zijn eigen startproces; een eerdere keuze hier vervalt.
    zet({ scenarioTekst: JSON.stringify(await laadScenario(nr), null, 2), startProces: null });
    if (!S.gpk) {
      const gpk = await laadGpk();
      zet({ gpk: { beslissingen: gpk.beslissingen, edienst: gpk.edienst } });
    }
  };
  const laadGpkProces = async () => {
    if (heeftProces && !(await vraagBevestiging({ titel: "GPK-voorbeeld laden", tekst: "Dit vervangt het BPMN-model in deze activiteit door de drie GPK-processen. Je kunt het ongedaan maken met Bewerken → Ongedaan maken.", bevestig: "Vervangen" }))) return;
    const gpk = await laadGpk();
    const st = useStore.getState();
    const eerste = Object.values(gpk.proces.model.diagrams).find((d) => d.naam === "Aanvraag oppakken");
    st.laadModel({ diagramTypeId: st.diagramTypeId, elements: gpk.proces.model.elements, diagrams: gpk.proces.model.diagrams, actiefDiagramId: eerste?.id });
    const leeg = !S.scenarioTekst || S.scenarioTekst.includes(`"naam": "${LEEG_SCENARIO.naam}"`);
    zet({ sim: null, m1: null, fout: null, startProces: null, gpk: { beslissingen: gpk.beslissingen, edienst: gpk.edienst }, ...(leeg ? { scenarioTekst: JSON.stringify(await laadScenario(4), null, 2) } : {}) });
    if (eerste) toonDiagram(useStore, eerste.id);
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

  /** Is dit gat er alleen omdat de beslistabel of het e-dienstmodel ontbreekt? */
  const mistBron = (gat) => (gat.formulier && gat.formulierBekend === false) || (gat.kiest === "resultaat" && /niet gevonden/.test(gat.reden || ""));
  const gebruikGpk = async () => {
    const gpk = await laadGpk();
    zet({ gpk: { beslissingen: gpk.beslissingen, edienst: gpk.edienst } });
  };

  const objecten = toestand ? Object.values(toestand.objecten) : [];
  const openGat = stand.soort === "gat" ? stand.gaten[0] : null;
  const standKleur = { loopt: TOKEN_KLEUR.klaar, gat: TOKEN_KLEUR.gat, vastgelopen: TOKEN_KLEUR.vast, uitzondering: TOKEN_KLEUR.vast, uitkomst: "#16a34a" }[stand.soort] || "var(--s-fg-muted, #64748b)";
  const m1 = S.m1;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(250px, 1fr) minmax(240px, 1fr) minmax(280px, 1.3fr)", height: "100%", fontSize: 12, color: "var(--s-fg, #1f2937)" }} data-testid="sim-paneel">
      {sim && <style data-testid="sim-token-stijl">{tokenCss(beeld)}</style>}

      {/* ── Bediening, scenario en het open gat ── */}
      <div style={kolom}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {!sim ? (
            <button style={hoofdknop} onClick={start} disabled={!heeftProces} data-testid="sim-start" title={heeftProces ? "Zet het startobject klaar en start het proces" : "Er is nog geen proces met een startevent"}>
              ▶ Start
            </button>
          ) : (
            <>
              <button style={hoofdknop} onClick={() => probeer(() => sim.stap())} disabled={stand.soort !== "loopt"} data-testid="sim-stap">
                Stap
              </button>
              <button style={knop} onClick={() => probeer(() => sim.loop())} disabled={stand.soort !== "loopt"} data-testid="sim-loop" title="Loop door tot het volgende gat of het einde">
                ▶▶ Doorlopen
              </button>
              <button style={knop} onClick={() => probeer(() => sim.spoelTerug(Math.max(1, log.length - 1)))} disabled={log.length <= 1} title="Eén regel terug">
                ◀ Terug
              </button>
              <button style={knop} onClick={stop} data-testid="sim-stop" title="Stop de simulatie en haal het token van het diagram">
                ■ Stop
              </button>
            </>
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 4 }} title="Toon het diagram waar het token staat">
            <input type="checkbox" checked={volg} onChange={(e) => zet({ volg: e.target.checked })} /> volg het token
          </label>
        </div>
        <div style={{ margin: "8px 0", fontWeight: 600, color: standKleur }} data-testid="sim-stand">
          {standTekst(stand)}
        </div>
        {fout && <div style={{ color: TOKEN_KLEUR.vast, marginBottom: 6 }}>{fout}</div>}
        {openGat && (
          <GatFormulier
            gat={openGat}
            zaadje={zaadje}
            onVul={(w) => (sim.vul(openGat.id, w), ververs())}
            hulp={
              mistBron(openGat) && (
                <div style={{ fontSize: 11, color: "var(--s-fg-muted, #64748b)", marginBottom: 6 }}>
                  {openGat.formulier
                    ? "Het taakformulier staat in het e-dienstmodel, en dat is niet geladen. "
                    : "De beslistabel staat niet in een DMN-profiel van dit project. "}
                  Stop de simulatie en kies onder "Waar de simulatie op draait" een e-dienstmodel of het GPK-voorbeeld; daarna vult de run dit gat zelf of toont hij de velden.
                </div>
              )
            }
          />
        )}

        {!sim && (
          <>
            <p style={{ ...kop, marginTop: 10 }}>Start bij</p>
            <select style={veldstijl} value={startProces || ""} onChange={(e) => zet({ startProces: e.target.value })} data-testid="sim-startproces" title="Het proces waar het startobject binnenkomt">
              {!startbaar.length && <option value="">(geen proces met een startevent)</option>}
              {startbaar.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.naam}
                  {p.gewoon ? "" : ` (start op een bericht${p.start.data?.bericht ? `: ${p.start.data.bericht}` : ""})`}
                </option>
              ))}
            </select>
            <p style={{ ...kop, marginTop: 10 }}>Scenario</p>
            <div style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
              <select style={{ ...veldstijl, width: "auto" }} value="" onChange={(e) => kiesVoorbeeld(Number(e.target.value))} data-testid="sim-voorbeeld">
                <option value="">GPK-scenario…</option>
                {VOORBEELDEN.map((nr) => (
                  <option key={nr} value={nr}>
                    GPK-scenario {nr}
                  </option>
                ))}
              </select>
              <button style={knop} onClick={laadGpkProces} data-testid="sim-laad-gpk" title="Laad de drie GPK-processen in deze activiteit, met beslistabel en e-dienstmodel">
                GPK-voorbeeld laden
              </button>
            </div>
            <textarea style={{ ...veldstijl, ...mono, height: 150, resize: "vertical" }} value={scenarioTekst} onChange={(e) => setScenarioTekst(e.target.value)} spellCheck={false} data-testid="sim-scenario" />
            <div style={{ color: "var(--s-fg-muted, #64748b)", marginTop: 2 }}>
              Vulwijze: <code>hand</code>, <code>willekeurig</code> of <code>fixture</code>; per run (<code>standaard</code>), per soort gat (<code>perSoort</code>) of per gat (<code>perGat</code>).
            </div>
            <p style={{ ...kop, marginTop: 10 }}>Waar de simulatie op draait</p>
            <div>Proces: het BPMN-model van deze activiteit{heeftProces ? "" : " (nog geen startevent)"}.</div>
            <div>
              Beslistabellen: {projectBeslissingen.length ? `${projectBeslissingen.length} DMN-profiel(en) uit het project` : gpkAanvulling ? "die van het GPK-voorbeeld" : "geen; een business rule task wordt een gat"}.
            </div>
            <div>
              E-dienstmodel: {edienst ? edienst.naam : gpkAanvulling ? "dat van het GPK-voorbeeld" : "geen; een taakformulier is dan vrije invoer"}.{" "}
              <label style={{ ...knop, display: "inline-block", marginTop: 4 }}>
                Bestand kiezen
                <input type="file" accept=".json" onChange={kiesEdienst} style={{ display: "none" }} data-testid="sim-edienst" />
              </label>
            </div>
            <div style={{ marginTop: 4 }}>
              {gpkAanvulling ? (
                <button style={knop} onClick={() => zet({ gpk: null })} title="Gebruik alleen wat in het project staat en wat je zelf laadt">
                  GPK-voorbeeld niet meer gebruiken
                </button>
              ) : (
                <button style={knop} onClick={gebruikGpk} data-testid="sim-gebruik-gpk" title="De beslistabel aanvraag-ontvankelijk en het e-dienstmodel (process-id's en taakformulieren) van het GPK-voorbeeld; je eigen BPMN-model blijft staan">
                  Beslistabel en e-dienstmodel van het GPK-voorbeeld gebruiken
                </button>
              )}
            </div>
          </>
        )}
        {sim && m1 && (
          <div style={{ color: "var(--s-fg-muted, #64748b)", marginTop: 10 }}>
            {sim.processen.length} processen: {sim.processen.map((p) => p.id).join(", ")}. Beslistabellen: {m1.beslissingen.length ? m1.beslissingen.map((b) => b.model_naam).join(", ") : "geen"}. E-dienstmodel: {m1.edienst?.edienst?.naam || (m1.edienst ? "geladen" : "geen")}.
          </div>
        )}
      </div>

      {/* ── Objecten, variabelen, buiten het cm ── */}
      <div style={kolom} data-testid="sim-objecten">
        <p style={kop}>Objecten</p>
        {!objecten.length && <div style={{ color: "var(--s-fg-muted, #64748b)" }}>Nog geen objecten.</div>}
        {objecten.map((o) => (
          <details key={o.id} open={o.type !== PROCESINSTANTIE} style={{ marginBottom: 4 }}>
            <summary style={{ cursor: "pointer" }}>
              <b>{o.type === PROCESINSTANTIE ? o.data.naam || o.data.proces : o.id}</b> <span style={{ color: "var(--s-fg-muted, #64748b)" }}>{o.type}</span>
              {(o.data.state || o.data.status) && (
                <span style={{ marginLeft: 6, padding: "0 6px", borderRadius: 8, background: o.data.state === "lopend" ? TOKEN_KLEUR.klaar : o.data.state === "afgebroken" ? TOKEN_KLEUR.vast : "#64748b", color: "#fff", fontSize: 11 }}>{o.data.state || o.data.status}</span>
              )}
            </summary>
            <pre style={{ ...mono, margin: "2px 0 0 12px", padding: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", background: "transparent", color: "inherit", border: "none" }}>{JSON.stringify(o.data, null, 1)}</pre>
          </details>
        ))}
        {toestand && Object.keys(toestand.variabelen).length > 0 && (
          <>
            <p style={{ ...kop, marginTop: 8 }}>Procesvariabelen</p>
            {Object.entries(toestand.variabelen).map(([naam, w]) => (
              <div key={naam} style={mono}>
                {naam} = {JSON.stringify(w)}
              </div>
            ))}
          </>
        )}
        {toestand?.extern.length > 0 && (
          <>
            <p style={{ ...kop, marginTop: 8 }}>Buiten het cm (stub)</p>
            {toestand.extern.map((e, i) => (
              <div key={i} style={mono}>
                {e.actie}
                {e.doel ? ` ${e.doel}` : ""} → {e.verwijzing}
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── Het log, met terugspoelen ── */}
      <div style={{ ...kolom, borderRight: "none" }} data-testid="sim-log">
        <p style={kop}>Log {log.length ? `(${log.length})` : ""}</p>
        {!log.length && <div style={{ color: "var(--s-fg-muted, #64748b)" }}>Start de simulatie; elke stap komt hier te staan. Klik op een regel om daarheen terug te spoelen.</div>}
        {log.map((regel) => {
          const mutaties = regel.wijzigingen.map(mutatieTekst).filter(Boolean);
          return (
            <div key={regel.nr} onClick={() => regel.nr < log.length && probeer(() => sim.spoelTerug(regel.nr))} title={regel.nr < log.length ? "Spoel terug tot na deze regel" : ""} style={{ padding: "2px 4px", borderRadius: 3, cursor: regel.nr < log.length ? "pointer" : "default", background: regel.nr === log.length ? "var(--s-hover, #e5e7eb)" : "transparent" }}>
              <span style={{ color: "var(--s-fg-muted, #64748b)", display: "inline-block", width: 24 }}>{regel.nr}</span>
              <b>{regel.wat}</b>
              {regel.beslissing && <span style={{ color: "var(--s-fg-muted, #64748b)" }}> · regel {regel.beslissing.regel || "geen"}</span>}
              {regel.conditie && <span style={{ color: "var(--s-fg-muted, #64748b)" }}> · {regel.conditie}</span>}
              {regel.bericht && <span style={{ color: "var(--s-fg-muted, #64748b)" }}> · ✉ {regel.bericht}</span>}
              {mutaties.map((t, i) => (
                <div key={i} style={{ ...mono, marginLeft: 24, color: "var(--s-fg-muted, #64748b)", wordBreak: "break-word" }}>
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
