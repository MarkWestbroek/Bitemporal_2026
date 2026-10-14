/**
 * AssistentHost — de AI-assistent in context (AI-2). Rechtsklik in de projectboom:
 *  - op een **map** (of een element: dan de map waar het in staat): "Vraag de assistent…" →
 *    een gesprek over die map. De assistent kent wat er al is (diagrammen, elementen,
 *    relaties) en kan in één opdracht **meerdere talen** gebruiken (een use case met een
 *    activiteitendiagram eronder), **submappen** maken en op **bestaande elementen**
 *    aansluiten (relatie leggen, op een diagram zetten, hernoemen) — stap 1b, 14-10;
 *  - "Velden toevoegen met de assistent…" op een element met een veldencompartiment
 *    (bv. "aap: string, noot: int").
 *
 * Eerst een voorstel (gecontroleerd tegen de profielen, met wat is bijgestuurd of weggelaten
 * en waarom), dan pas **Toepassen**: per profiel één undo-stap, en via de projectsync zien
 * anderen het live. Het gesprek blijft daarna open: je kijkt, en stuurt bij ("de associatie
 * moet naar Leen boek"). Logica: assistentKern.js (regelset) en wijziging.js (toepasser),
 * dezelfde als de MCP (tools/omnium-mcp).
 *
 * menuBus: "assistent:open" {soort: "model", mapId, mapNaam, focus?: {profielId, elementId}}
 *        | {soort: "velden", profielId, elementId}
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { menuBus } from "../menuBus";
import { getProfieltypen, getProfieltype } from "../profieltypeRegistry";
import { apiBase } from "../studioUtils";
import { useAiInstellingen } from "../../shared/ai/useAiInstellingen";
import { actiefProfiel } from "../../shared/ai/aiProfielen";
import { vraagAi } from "../../shared/ai/vraagAi";
import { AiInstellingen } from "../../components/editor/AiAssistVeld.jsx";
import {
  profielSamenvatting, vraagVoorOpdracht, controleerPlan, bestaandInMap, genoemdeTalen,
  leesAntwoord, vraagVoorVelden, veldenToepassing, veldCompartimenten,
} from "./assistentKern.js";
import { maakWijziging } from "./wijziging.js";
import "../../meldingen/meldingen.css";

const LAATSTE_TALEN = "studio05-assistent-talen";
const leesTalen = () => {
  try {
    const v = JSON.parse(localStorage.getItem(LAATSTE_TALEN) || "null");
    if (Array.isArray(v)) return v;
  } catch { /* */ }
  try { const oud = localStorage.getItem("studio05-assistent-taal"); return oud ? [oud] : []; } catch { return []; }
};
const bewaarTalen = (ids) => { try { localStorage.setItem(LAATSTE_TALEN, JSON.stringify(ids)); } catch { /* */ } };

/** Profielen waarin de assistent kan modelleren (eigen motor, met relaties). */
const modelTalen = () => getProfieltypen().filter((p) => !p.vasteDocumenten && (p.descriptor?.elementTypes || []).some((t) => t.isConnector));

/**
 * Maten van de knopen zoals het canvas ze tekent (voorkomen-id → {w, h}), zodat uitlijnen
 * hetzelfde uitkomt als met de werkbalk. offsetWidth/-Height staan los van de zoom.
 */
function meetKnopen() {
  const uit = {};
  try {
    for (const el of document.querySelectorAll(".react-flow__node[data-id]")) {
      if (el.offsetWidth && el.offsetHeight) uit[el.dataset.id] = { w: el.offsetWidth, h: el.offsetHeight };
    }
  } catch { /* geen DOM */ }
  return uit;
}

/** Stand van het project uit de stores, voor de gegeven profielen. */
async function leesStand(profielIds) {
  const { useModellerenStore } = await import("../activities/modellerenActivity.jsx");
  const ms = useModellerenStore.getState();
  const profielen = {};
  for (const id of profielIds) {
    const st = getProfieltype(id)?.useStore?.getState?.();
    if (st) profielen[id] = { elements: st.elements || {}, diagrams: st.diagrams || {} };
  }
  return { mappen: ms.mappen, plaatsing: ms.plaatsing, profielen };
}

function Voorstel({ voorstel, talen }) {
  if (voorstel.soort === "velden") {
    return (
      <div className="ast-voorstel" data-testid="assistent-voorstel">
        {voorstel.uitleg && <p>{voorstel.uitleg}</p>}
        <strong>Velden in “{voorstel.compartiment}”:</strong>
        <ul>{voorstel.nieuw.map((v) => <li key={v.naam}>{v.naam}{v.data.typeLabel ? ` : ${v.data.typeLabel}` : ""}{v.data.verplicht ? " (verplicht)" : ""}</li>)}</ul>
        {!voorstel.nieuw.length && <p className="mld-hulp">Geen nieuwe velden.</p>}
      </div>
    );
  }
  const { plan, wijziging, bestaand } = voorstel;
  const taal = new Map(talen.map((s) => [s.id, s]));
  const typeLabel = (profielId, id) => taal.get(profielId)?.elementen.find((t) => t.id === id)?.label || taal.get(profielId)?.connectoren.find((t) => t.id === id)?.label || id;
  // Naamloze elementen (begin, eind) heten naar hun type.
  const naamVanBestaand = new Map(bestaand.flatMap((p) => p.elementen.map((e) => [e.id, e.naam || `(${typeLabel(p.profielId, e.type)})`])));
  const naamVanNieuw = new Map(plan.elementen.map((e) => [e.sleutel, e.naam || `(${typeLabel(e.profielId, e.type)})`]));
  const naam = (r) => (r?.nieuw ? naamVanNieuw.get(r.nieuw) : naamVanBestaand.get(r?.id)) || "?";
  const mapNaam = new Map(wijziging.mappen.map((m) => [m.id, m.naam]));
  return (
    <div className="ast-voorstel" data-testid="assistent-voorstel">
      {plan.uitleg && <p>{plan.uitleg}</p>}
      {wijziging.mappen.length > 0 && <p><strong>Nieuwe map:</strong> {wijziging.mappen.map((m) => m.naam).join(", ")}</p>}
      {plan.diagrammen.map((d) => {
        const op = plan.elementen.filter((e) => e.diagram === d.sleutel);
        const perType = new Map();
        for (const e of op) { const t = typeLabel(e.profielId, e.type); perType.set(t, [...(perType.get(t) || []), e.naam || "—"]); }
        const doelMap = d.map ? ` — in map ${d.map}` : "";
        return (
          <div key={d.sleutel} className="ast-diagram">
            <p><strong>{d.bestaandId ? "Op diagram" : "Nieuw diagram"}:</strong> {d.naam} <span className="mld-hulp">({taal.get(d.profielId)?.naam || d.profielId}{doelMap})</span></p>
            {[...perType].map(([t, namen]) => <p key={t} className="ast-inspring">{t}: {namen.join(", ")}</p>)}
          </div>
        );
      })}
      {plan.connectoren.length > 0 && (
        <>
          <strong>Relaties:</strong>
          <ul>{plan.connectoren.map((c, i) => <li key={i}>{naam(c.bron)} —{typeLabel(c.profielId, c.type)}→ {naam(c.doel)}{c.data?.guard ? ` [${c.data.guard}]` : ""}</li>)}</ul>
        </>
      )}
      {plan.opstelling?.length > 0 && <p><strong>Opstelling:</strong> {plan.opstelling.map((o) => `${o.actie}${o.elementen.length ? `: ${o.elementen.map(naam).join(", ")}` : " (alles)"}`).join("; ")}</p>}
      {plan.leden?.length > 0 && <p><strong>In een container:</strong> {plan.leden.map((l) => `${naam({ id: l.id })} in ${naam(l.in)}`).join(", ")}</p>}
      {plan.hernoemd.length > 0 && <p><strong>Hernoemd:</strong> {plan.hernoemd.map((h) => `${h.oud} → ${h.naam}`).join(", ")}</p>}
      {plan.verbanden.length > 0 && <p><strong>Verbanden:</strong> {plan.verbanden.map((v) => `${naam(v.van)} ${v.soort} ${naam(v.naar)}`).join("; ")}</p>}
      {plan.opmerkingen.length > 0 && <ul className="ast-opmerkingen">{plan.opmerkingen.map((o, i) => <li key={i}>{o}</li>)}</ul>}
      {!mapNaam.size && !plan.diagrammen.length && !plan.connectoren.length && !plan.hernoemd.length && !plan.verbanden.length && !plan.leden?.length && !plan.opstelling?.length && (
        // Eerlijk (melding #11): de uitleg kan iets beloven wat de assistent niet kan.
        <p className="ast-niets" data-testid="assistent-niets">Dit voorstel verandert niets. De assistent kan elementen, relaties, diagrammen en mappen maken, hernoemen, in een kader zetten, uitlijnen en verbanden leggen — nog niet weghalen.</p>
      )}
    </div>
  );
}

export default function AssistentHost() {
  const [verzoek, setVerzoek] = useState(null);
  const [inst, bewaarInst] = useAiInstellingen();
  const [instellen, setInstellen] = useState(false);
  const [gekozen, setGekozen] = useState(leesTalen);
  const [opdracht, setOpdracht] = useState("");
  const [gesprek, setGesprek] = useState([]); // [{role, content}] — voor de AI
  const [log, setLog] = useState([]); // [{wie: "jij"|"assistent"|"klaar", tekst}] — voor jou
  const [voorstel, setVoorstel] = useState(null);
  const [toegepast, setToegepast] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const logRef = useRef(null);

  useEffect(() => menuBus.on("assistent:open", (v) => {
    setVerzoek(v); setOpdracht(""); setGesprek([]); setLog([]); setVoorstel(null); setToegepast(false); setFout("");
  }), []);
  useEffect(() => {
    if (!verzoek) return undefined;
    const onKey = (e) => e.key === "Escape" && !bezig && setVerzoek(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [verzoek, bezig]);
  useEffect(() => { logRef.current?.scrollTo?.(0, logRef.current.scrollHeight); }, [log, voorstel]);

  const alleTalen = useMemo(() => (verzoek?.soort === "model" ? modelTalen() : []), [verzoek]);
  const veldProfiel = verzoek?.soort === "velden" ? getProfieltype(verzoek.profielId) : null;
  const element = veldProfiel?.useStore?.getState?.().elements?.[verzoek.elementId] || null;
  const aiProfiel = actiefProfiel(inst);
  // Gekozen talen die (nog) bestaan; zonder keuze de eerste.
  const talenIds = useMemo(() => {
    const ids = gekozen.filter((id) => alleTalen.some((p) => p.id === id));
    return ids.length ? ids : alleTalen.slice(0, 1).map((p) => p.id);
  }, [gekozen, alleTalen]);

  if (!verzoek) return null;

  const zetTalen = (ids) => { setGekozen(ids); bewaarTalen(ids); };
  const samenvattingVan = (id) => { const p = getProfieltype(id); return p ? { ...profielSamenvatting(p.descriptor, p.id), naam: p.label || p.descriptor?.label || p.id } : null; };

  async function vraag() {
    if (!aiProfiel) { setInstellen(true); return; }
    const tekst = opdracht.trim();
    if (!tekst) return;
    setBezig(true); setFout("");
    try {
      if (verzoek.soort === "velden") {
        const v = vraagVoorVelden(veldProfiel.descriptor, element, tekst);
        const vraagTekst = voorstel ? `Pas het voorstel aan: ${tekst}` : v.vraag;
        const { tekst: antwoordTekst } = await vraagAi(aiProfiel, { systeem: v.systeem, vraag: vraagTekst, jsonSchema: v.jsonSchema, effort: "medium", geschiedenis: voorstel ? gesprek : [], baseUrl: apiBase() });
        const antwoord = leesAntwoord(antwoordTekst);
        if (!antwoord) throw new Error("Het antwoord was geen bruikbare JSON; probeer het nog eens.");
        setGesprek([...(voorstel ? gesprek : []), { role: "user", content: vraagTekst }, { role: "assistant", content: antwoordTekst }]);
        setVoorstel({ soort: "velden", ...veldenToepassing(antwoord, veldProfiel.descriptor, element) });
        setOpdracht("");
        return;
      }
      // Talen: gekozen + wat de opdracht noemt + wat al in de map staat (zodat de AI ernaar kan verwijzen).
      const alle = alleTalen.map((p) => samenvattingVan(p.id)).filter(Boolean);
      const standAlle = await leesStand(alleTalen.map((p) => p.id));
      const bestaand = bestaandInMap(standAlle, verzoek.mapId || null);
      const ids = [...new Set([...talenIds, ...genoemdeTalen(tekst, alle), ...bestaand.map((b) => b.profielId)])];
      const talen = ids.map(samenvattingVan).filter(Boolean);
      const ms = standAlle.mappen || {};
      const submappen = Object.values(ms).filter((m) => (m.ouderId || null) === (verzoek.mapId || null)).map((m) => m.naam);
      const v = vraagVoorOpdracht(talen, tekst, { mapNaam: verzoek.mapNaam, submappen, bestaand });
      const focus = verzoek.focus ? bestaand.flatMap((b) => b.elementen).find((e) => e.id === verzoek.focus.elementId) : null;
      const vraagTekst = voorstel
        ? `Pas het voorstel aan: ${tekst}`
        : `${toegepast ? "Het vorige voorstel is toegepast; de ids staan nu onder WAT ER AL IS. " : ""}${focus ? `Het gaat om ${focus.type} "${focus.naam}" (${focus.id}). ` : ""}Opdracht:\n${tekst}`;
      const { tekst: antwoordTekst } = await vraagAi(aiProfiel, { systeem: v.systeem, vraag: vraagTekst, jsonSchema: v.jsonSchema, effort: "medium", geschiedenis: gesprek, baseUrl: apiBase() });
      const antwoord = leesAntwoord(antwoordTekst);
      if (!antwoord) throw new Error("Het antwoord was geen bruikbare JSON; probeer het nog eens.");
      const plan = controleerPlan(antwoord, talen, bestaand);
      const stand = { mappen: standAlle.mappen, plaatsing: standAlle.plaatsing, profielen: Object.fromEntries(ids.map((id) => [id, standAlle.profielen[id] || { elements: {}, diagrams: {} }])) };
      const wijziging = maakWijziging(plan, stand, { mapId: verzoek.mapId || null, samenvattingen: talen, gemeten: meetKnopen() });
      setGesprek([...gesprek, { role: "user", content: vraagTekst }, { role: "assistant", content: antwoordTekst }]);
      setLog((l) => [...l, { wie: "jij", tekst }]);
      setVoorstel({ soort: "model", plan, wijziging, bestaand, talen });
      setToegepast(false);
      setOpdracht("");
    } catch (e) {
      setFout(e.message);
    } finally {
      setBezig(false);
    }
  }

  async function pasToe() {
    setFout("");
    try {
      if (voorstel.soort === "velden") {
        if (!voorstel.nieuw.length) return;
        veldProfiel.useStore.getState().updateElement(element.id, { compartimenten: voorstel.compartimenten });
        setLog((l) => [...l, { wie: "klaar", tekst: `${voorstel.nieuw.length} veld(en) toegevoegd aan ${element.naam || element.id}.` }]);
        setVoorstel(null);
        return;
      }
      const w = voorstel.wijziging;
      const { useModellerenStore } = await import("../activities/modellerenActivity.jsx");
      const ms = useModellerenStore.getState();
      for (const m of w.mappen) ms.nieuweMap(m.naam, m.ouderId, m.id);
      for (const [profielId, p] of Object.entries(w.profielen)) {
        if (!Object.keys(p.elements).length && !Object.keys(p.diagrams).length) continue;
        getProfieltype(profielId)?.useStore.getState().pasWijzigingToe(p);
      }
      const perMap = {};
      for (const [key, mapId] of Object.entries(w.plaatsing)) (perMap[mapId ?? "null"] ||= []).push(key);
      if (Object.keys(perMap).length) useModellerenStore.getState().plaatsPerMap(perMap);
      if (w.links.length) {
        const { useKruisStore } = await import("../activities/koppelingenActivity.jsx");
        useKruisStore.getState().patchLinks({ zet: w.links, wis: [] });
      }
      for (const o of w.openen) useModellerenStore.getState().openTab(o.profielId, o.diagramId);
      setLog((l) => [...l, { wie: "assistent", tekst: voorstel.plan.uitleg }, { wie: "klaar", tekst: `Toegepast: ${w.samenvatting} (Ctrl+Z maakt het ongedaan).${w.zonderDiagram.length ? ` ${w.zonderDiagram.length} relatie(s) staan op geen diagram.` : ""}` }]);
      setVoorstel(null);
      setToegepast(true);
    } catch (e) {
      setFout(e.message);
    }
  }

  const nieuwGesprek = () => { setGesprek([]); setLog([]); setVoorstel(null); setToegepast(false); setFout(""); };
  const sluit = () => !bezig && setVerzoek(null);
  const titel = verzoek.soort === "velden" && element ? ` — ${element.naam || element.id}` : verzoek.mapNaam ? ` — map ${verzoek.mapNaam}` : "";
  const nietGekozen = alleTalen.filter((p) => !talenIds.includes(p.id));
  return (
    <div className="mld-dialoog-achter" onMouseDown={sluit}>
      <div className="mld-dialoog ast" role="dialog" aria-label="Assistent" onMouseDown={(e) => e.stopPropagation()} data-testid="assistent">
        <button type="button" className="mld-dialoog__sluit" onClick={sluit} aria-label="Sluiten">×</button>
        <h2 className="mld-titel">✨ Assistent{titel}</h2>
        {instellen ? (
          <div className="ast-instellen">
            <p className="mld-hulp">Kies eerst een AI-dienst: je eigen sleutel, of een toegangscode voor de AI van deze server.</p>
            <AiInstellingen inst={inst} baseUrl={apiBase()} onOpslaan={(n) => { bewaarInst(n); setInstellen(false); }} onAnnuleer={() => setInstellen(false)} />
          </div>
        ) : (
          <>
            {verzoek.soort === "model" && (
              <div className="ast-talen" data-testid="assistent-talen">
                <span className="mld-hulp">Talen:</span>
                {talenIds.map((id) => (
                  <span key={id} className="ast-chip">
                    {getProfieltype(id)?.label || id}
                    {talenIds.length > 1 && <button type="button" aria-label={`${getProfieltype(id)?.label || id} weghalen`} onClick={() => zetTalen(talenIds.filter((x) => x !== id))}>×</button>}
                  </span>
                ))}
                {nietGekozen.length > 0 && (
                  <select aria-label="Taal toevoegen" value="" onChange={(e) => e.target.value && zetTalen([...talenIds, e.target.value])}>
                    <option value="">＋ taal</option>
                    {nietGekozen.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                )}
                <span className="mld-hulp ast-talen-uitleg" title="Talen die je opdracht noemt (bv. 'activiteitendiagram') en die al in de map staan, gaan automatisch mee.">+ automatisch</span>
              </div>
            )}
            {verzoek.soort === "velden" && element && !veldCompartimenten(veldProfiel.descriptor, element.elementType).length && (
              <p className="mld-fout">Dit element heeft geen compartiment voor velden.</p>
            )}
            {(log.length > 0 || voorstel) && (
              <div className="ast-log" ref={logRef} data-testid="assistent-log">
                {log.map((r, i) => <p key={i} className={`ast-log__${r.wie}`}>{r.tekst}</p>)}
                {voorstel && <Voorstel voorstel={voorstel} talen={voorstel.talen || []} />}
                {voorstel?.plan?.problemen?.length > 0 && (
                  // Open: de uitleg van de AI kan meer beloven dan er overblijft (melding #9).
                  <details className="ast-problemen ast-problemen--let-op" open><summary>Let op: {voorstel.plan.problemen.length} onderdeel/onderdelen weggelaten</summary>
                    <ul>{voorstel.plan.problemen.map((p, i) => <li key={i}>{p}</li>)}</ul>
                  </details>
                )}
                {voorstel?.problemen?.length > 0 && (
                  <details className="ast-problemen"><summary>{voorstel.problemen.length} opmerking(en)</summary>
                    <ul>{voorstel.problemen.map((p, i) => <li key={i}>{p}</li>)}</ul>
                  </details>
                )}
              </div>
            )}
            <label className="mld-veld"><span>{voorstel ? "Bijsturen" : log.length ? "Verder" : "Wat moet de assistent doen?"}</span>
              <textarea rows={log.length || voorstel ? 2 : 4} value={opdracht} onChange={(e) => setOpdracht(e.target.value)} disabled={bezig}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && opdracht.trim() && !bezig) vraag(); }}
                placeholder={voorstel ? "bv. noem de actor Klant, of: de associatie moet naar Leen boek"
                  : verzoek.soort === "velden" ? "bv. voeg de attributen toe: aap: string, noot: int, mies: tekst"
                  : log.length ? "bv. verbind gebruiker met test, of: maak er een activiteitendiagram onder"
                  : "bv. maak een map Bibliotheek met een use case-model: leden lenen en verlengen; met een activiteitendiagram voor lenen"} />
            </label>
            {fout && <p className="mld-fout" role="alert">{fout}</p>}
            <div className="mld-acties">
              <span className="mld-hulp" style={{ flex: 1 }}>{aiProfiel ? `AI: ${aiProfiel.label.split(" (")[0]}${aiProfiel.model ? ` · ${aiProfiel.model}` : ""} ` : "Nog geen AI ingesteld "}
                <button type="button" className="mld-knop mld-knop--link" onClick={() => setInstellen(true)}>instellen</button>
                {(log.length > 0 || voorstel) && <> · <button type="button" className="mld-knop mld-knop--link" onClick={nieuwGesprek} disabled={bezig}>nieuw gesprek</button></>}
              </span>
              <button type="button" className={`mld-knop${voorstel ? "" : " mld-knop--hoofd"}`} onClick={vraag} disabled={bezig || !opdracht.trim()}>{bezig ? "Bezig…" : voorstel ? "Aanpassen" : "Vraag"}</button>
              {voorstel && !(voorstel.soort === "model" && voorstel.wijziging.samenvatting === "geen wijzigingen") && <button type="button" className="mld-knop mld-knop--hoofd" onClick={pasToe} disabled={bezig}>Toepassen</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
