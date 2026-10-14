/**
 * AssistentHost — de AI-assistent in context (AI-2, 14-10-2026). Rechtsklik in de projectboom:
 *  - op een **map**: "Vraag de assistent…" → een nieuw model (elementen, relaties, diagram) in
 *    een gekozen taal, in die map;
 *  - op een **element**: "Vraag de assistent…" → velden erbij (bv. "aap: string, noot: int").
 *
 * Eerst een voorstel (gecontroleerd tegen het profiel, met wat er is weggelaten en waarom), dan
 * pas **Toepassen**: één undo-stap, en via de projectsync zien anderen het live. Bijsturen kan
 * in hetzelfde gesprek ("noem de actor Klant"). AI-dienst: de bestaande AI-instellingen
 * (eigen sleutel of toegangscode voor de Omnium-proxy). Logica: assistentKern.js.
 *
 * menuBus: "assistent:open" {soort: "model", mapId, mapNaam} | {soort: "velden", profielId, elementId}
 */
import React, { useEffect, useMemo, useState } from "react";
import { menuBus } from "../menuBus";
import { getProfieltypen, getProfieltype } from "../profieltypeRegistry";
import { apiBase } from "../studioUtils";
import { useAiInstellingen } from "../../shared/ai/useAiInstellingen";
import { actiefProfiel } from "../../shared/ai/aiProfielen";
import { vraagAi } from "../../shared/ai/vraagAi";
import { AiInstellingen } from "../../components/editor/AiAssistVeld.jsx";
import { planNaarCoreModel } from "../../transformatie/planNaarCoreModel.js";
import { vraagVoorModel, controleerModel, leesAntwoord, vraagVoorVelden, veldenToepassing, veldCompartimenten } from "./assistentKern.js";
import "../../meldingen/meldingen.css";

const LAATSTE_TAAL = "studio05-assistent-taal";
const leesTaal = () => { try { return localStorage.getItem(LAATSTE_TAAL) || ""; } catch { return ""; } };

function Voorstel({ voorstel, profiel }) {
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
  const typeLabel = (id) => profiel?.descriptor?.elementTypes?.find((t) => t.id === id)?.label || id;
  const naamVan = new Map(voorstel.plan.elementen.map((e) => [e.sleutel, e.naam]));
  const perType = new Map();
  for (const e of voorstel.plan.elementen) {
    if (!perType.has(e.type)) perType.set(e.type, []);
    perType.get(e.type).push(e.naam);
  }
  return (
    <div className="ast-voorstel" data-testid="assistent-voorstel">
      {voorstel.uitleg && <p>{voorstel.uitleg}</p>}
      <p><strong>Diagram:</strong> {voorstel.diagramNaam}</p>
      {[...perType].map(([type, namen]) => <p key={type}><strong>{typeLabel(type)}:</strong> {namen.join(", ")}</p>)}
      {voorstel.plan.connectoren.length > 0 && (
        <>
          <strong>Relaties:</strong>
          <ul>{voorstel.plan.connectoren.map((c) => <li key={c.sleutel}>{naamVan.get(c.bron)} —{typeLabel(c.type)}→ {naamVan.get(c.doel)}</li>)}</ul>
        </>
      )}
    </div>
  );
}

export default function AssistentHost() {
  const [verzoek, setVerzoek] = useState(null);
  const [inst, bewaarInst] = useAiInstellingen();
  const [instellen, setInstellen] = useState(false);
  const [taal, setTaal] = useState(leesTaal);
  const [opdracht, setOpdracht] = useState("");
  const [bijsturen, setBijsturen] = useState("");
  const [gesprek, setGesprek] = useState([]); // [{role, content}]
  const [voorstel, setVoorstel] = useState(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [klaar, setKlaar] = useState("");

  useEffect(() => menuBus.on("assistent:open", (v) => {
    setVerzoek(v); setOpdracht(""); setBijsturen(""); setGesprek([]); setVoorstel(null); setFout(""); setKlaar("");
  }), []);
  useEffect(() => {
    if (!verzoek) return undefined;
    const onKey = (e) => e.key === "Escape" && !bezig && setVerzoek(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [verzoek, bezig]);

  const talen = useMemo(() => (verzoek?.soort === "model"
    ? getProfieltypen().filter((p) => !p.vasteDocumenten && (p.descriptor?.elementTypes || []).some((t) => t.isConnector))
    : []), [verzoek]);
  const profiel = verzoek?.soort === "velden" ? getProfieltype(verzoek.profielId) : getProfieltype(taal) || talen[0] || null;
  const element = verzoek?.soort === "velden" ? profiel?.useStore?.getState?.().elements?.[verzoek.elementId] : null;
  const aiProfiel = actiefProfiel(inst);

  if (!verzoek) return null;

  async function vraag(extra) {
    if (!aiProfiel) { setInstellen(true); return; }
    const tekst = extra ? extra.trim() : opdracht.trim();
    if (!tekst) return;
    setBezig(true); setFout(""); setKlaar("");
    try {
      const v = verzoek.soort === "velden"
        ? vraagVoorVelden(profiel.descriptor, element, opdracht)
        : vraagVoorModel(profiel.descriptor, opdracht, { mapNaam: verzoek.mapNaam });
      const geschiedenis = extra ? gesprek : [];
      const vraagTekst = extra ? `Pas het voorstel aan: ${tekst}` : v.vraag;
      const { tekst: antwoordTekst } = await vraagAi(aiProfiel, { systeem: v.systeem, vraag: vraagTekst, jsonSchema: v.jsonSchema, effort: "medium", geschiedenis, baseUrl: apiBase() });
      const antwoord = leesAntwoord(antwoordTekst);
      if (!antwoord) throw new Error("Het antwoord was geen bruikbare JSON; probeer het nog eens.");
      setGesprek([...geschiedenis, { role: "user", content: vraagTekst }, { role: "assistant", content: antwoordTekst }]);
      if (verzoek.soort === "velden") {
        const r = veldenToepassing(antwoord, profiel.descriptor, element);
        setVoorstel({ soort: "velden", ...r });
      } else {
        setVoorstel({ soort: "model", ...controleerModel(antwoord, profiel.descriptor) });
      }
      setBijsturen("");
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
        profiel.useStore.getState().updateElement(element.id, { compartimenten: voorstel.compartimenten });
        setKlaar(`${voorstel.nieuw.length} veld(en) toegevoegd aan ${element.naam || element.id}.`);
      } else {
        const st = profiel.useStore.getState();
        const graaf = { knopen: voorstel.plan.elementen.map((e) => ({ id: e.sleutel })), groepen: [], verbindingen: [], naam: voorstel.diagramNaam };
        const uit = planNaarCoreModel(graaf, voorstel.plan, {
          prefix: "ai", diagramTypeId: profiel.descriptor.id, elementTypes: profiel.descriptor.elementTypes || [],
          bestaand: { elements: st.elements, diagrams: st.diagrams }, bestandsnaam: voorstel.diagramNaam,
        });
        st.importeerModel(uit.core, { modus: "toevoegen" });
        const { useModellerenStore } = await import("../activities/modellerenActivity.jsx");
        const ms = useModellerenStore.getState();
        for (const id of Object.keys(uit.core.diagrams)) {
          if (verzoek.mapId) ms.plaatsDiagram(`${profiel.id}::${id}`, verzoek.mapId);
          ms.openTab(profiel.id, id);
        }
        setKlaar(`${voorstel.plan.elementen.length} elementen en ${voorstel.plan.connectoren.length} relaties toegevoegd (Ctrl+Z maakt het ongedaan).`);
      }
      setVoorstel(null);
    } catch (e) {
      setFout(e.message);
    }
  }

  const sluit = () => !bezig && setVerzoek(null);
  return (
    <div className="mld-dialoog-achter" onMouseDown={sluit}>
      <div className="mld-dialoog ast" role="dialog" aria-label="Assistent" onMouseDown={(e) => e.stopPropagation()} data-testid="assistent">
        <button type="button" className="mld-dialoog__sluit" onClick={sluit} aria-label="Sluiten">×</button>
        <h2 className="mld-titel">✨ Assistent{verzoek.soort === "velden" && element ? ` — ${element.naam || element.id}` : verzoek.mapNaam ? ` — map ${verzoek.mapNaam}` : ""}</h2>
        {instellen ? (
          <div className="ast-instellen">
            <p className="mld-hulp">Kies eerst een AI-dienst: je eigen sleutel, of een toegangscode voor de AI van deze server.</p>
            <AiInstellingen inst={inst} baseUrl={apiBase()} onOpslaan={(n) => { bewaarInst(n); setInstellen(false); }} onAnnuleer={() => setInstellen(false)} />
          </div>
        ) : (
          <>
            {verzoek.soort === "model" && (
              <label className="mld-veld"><span>Taal</span>
                <select value={profiel?.id || ""} onChange={(e) => { setTaal(e.target.value); try { localStorage.setItem(LAATSTE_TAAL, e.target.value); } catch { /* */ } }}>
                  {talen.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </label>
            )}
            {verzoek.soort === "velden" && element && !veldCompartimenten(profiel.descriptor, element.elementType).length && (
              <p className="mld-fout">Dit element heeft geen compartiment voor velden.</p>
            )}
            <label className="mld-veld"><span>Wat moet de assistent doen?</span>
              <textarea rows={4} value={opdracht} onChange={(e) => setOpdracht(e.target.value)} disabled={bezig}
                placeholder={verzoek.soort === "velden" ? "bv. voeg de attributen toe: aap: string, noot: int, mies: tekst" : "bv. maak een use case-model met de actoren gebruiker en beheerder. Gebruiker: maak feature request, …"} />
            </label>
            <div className="mld-acties">
              <span className="mld-hulp" style={{ flex: 1 }}>{aiProfiel ? `AI: ${aiProfiel.label.split(" (")[0]}${aiProfiel.model ? ` · ${aiProfiel.model}` : ""} ` : "Nog geen AI ingesteld "}
                <button type="button" className="mld-knop mld-knop--link" onClick={() => setInstellen(true)}>instellen</button></span>
              <button type="button" className="mld-knop mld-knop--hoofd" onClick={() => vraag()} disabled={bezig || !opdracht.trim()}>{bezig && !voorstel ? "Bezig…" : "Vraag"}</button>
            </div>
            {fout && <p className="mld-fout" role="alert">{fout}</p>}
            {klaar && <p role="status" style={{ color: "#15803d", margin: 0 }} data-testid="assistent-klaar">{klaar}</p>}
            {voorstel && (
              <>
                <Voorstel voorstel={voorstel} profiel={profiel} />
                {voorstel.problemen?.length > 0 && (
                  <details className="ast-problemen"><summary>{voorstel.problemen.length} onderdeel/onderdelen weggelaten</summary>
                    <ul>{voorstel.problemen.map((p, i) => <li key={i}>{p}</li>)}</ul>
                  </details>
                )}
                <div className="mld-acties">
                  <input className="ast-bijsturen" value={bijsturen} onChange={(e) => setBijsturen(e.target.value)} disabled={bezig}
                    placeholder="Bijsturen, bv. noem de actor Klant" aria-label="Bijsturen" onKeyDown={(e) => e.key === "Enter" && bijsturen.trim() && vraag(bijsturen)} />
                  <button type="button" className="mld-knop" onClick={() => vraag(bijsturen)} disabled={bezig || !bijsturen.trim()}>{bezig ? "Bezig…" : "Aanpassen"}</button>
                  <button type="button" className="mld-knop mld-knop--hoofd" onClick={pasToe} disabled={bezig}>Toepassen</button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
