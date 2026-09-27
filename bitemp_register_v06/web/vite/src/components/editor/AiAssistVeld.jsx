import { useState, useRef, useId } from "react";
import { useSchema } from "../../context/SchemaContext";
import { useAiToegestaan } from "../../shared/ai/AiContext";
import { ACTIES, bouwVraag, voegVoorstelIn } from "../../shared/ai/aiAssist";
import { PRESETS, zetProfiel, actiefProfiel } from "../../shared/ai/aiProfielen";
import { useAiInstellingen } from "../../shared/ai/useAiInstellingen";
import { vraagAi, AiFout, haalModellen } from "../../shared/ai/vraagAi";

/**
 * AiAssistVeld — de vorm `ai-assist`: een tekstvak met een assistent (✨) die een VOORSTEL doet.
 * De invuller ziet het voorstel naast de eigen tekst en kiest: overnemen, invoegen of weggooien.
 * Er wordt nooit iets zonder die keuze in het veld gezet.
 *
 * Wat er naar de AI-dienst gaat: de tekst van dit veld, de opdracht, en het label/de
 * beschrijving van het veld (en de naam van het formulier als die in config.formulier staat) —
 * niet de rest van het formulier. Op het openbare aanmeldformulier staat AI uit (AiContext).
 *
 * Props: waarde, onChange, readOnly, labelId, config { acties, formulier, rows }, veld
 */
export default function AiAssistVeld({ waarde, onChange, readOnly = false, labelId, config = {}, veld }) {
  const toegestaan = useAiToegestaan();
  const { baseUrl } = useSchema();
  const [open, setOpen] = useState(false);
  const [instellen, setInstellen] = useState(false);
  const [eigen, setEigen] = useState("");
  const [voorstel, setVoorstel] = useState(null); // { tekst, model, systeem, gesprek }
  const [bijsturing, setBijsturing] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const afbreken = useRef(null);
  // Eén gedeelde bron voor alle AI-velden: sleutel één keer invoeren, overal ingesteld.
  const [inst, bewaarInst] = useAiInstellingen();
  const profiel = actiefProfiel(inst);
  const tekst = String(waarde ?? "");

  const tekstvak = (
    <textarea className="utrecht-textarea utrecht-textarea--html-textarea" aria-labelledby={labelId} value={tekst} readOnly={readOnly}
      rows={config.rows || 5} onChange={(e) => onChange(e.target.value)} style={{ width: "100%" }} />
  );
  if (readOnly || !toegestaan) return readOnly ? <div style={{ whiteSpace: "pre-wrap" }}>{tekst || "—"}</div> : tekstvak;

  const acties = Array.isArray(config.acties) && config.acties.length ? ACTIES.filter((a) => config.acties.includes(a.id)) : ACTIES;

  async function vraag(actie, bijsturen = null) {
    // Bijsturen: dezelfde systeemtekst, het gesprek tot nu toe, en de opmerking als nieuwe beurt.
    const v = bijsturen
      ? { systeem: voorstel.systeem, vraag: `${bijsturen}

Geef opnieuw ALLEEN de nieuwe tekst voor het veld.`, geschiedenis: voorstel.gesprek }
      : bouwVraag({ actie, eigenOpdracht: actie ? "" : eigen, tekst, veldLabel: veld?.label || veld?.naam || "", beschrijving: veld?.description || "", formulier: config.formulier || "" });
    if (!v) return;
    afbreken.current?.abort();
    const ctrl = new AbortController();
    afbreken.current = ctrl;
    setBezig(true); setFout(""); if (!bijsturen) setVoorstel(null);
    try {
      const a = await vraagAi(profiel, { ...v, signal: ctrl.signal, baseUrl });
      setVoorstel({ ...a, systeem: v.systeem, gesprek: [...(v.geschiedenis || []), { role: "user", content: v.vraag }, { role: "assistant", content: a.tekst }] });
      if (bijsturen) setBijsturing("");
    } catch (e) {
      if (e?.name !== "AbortError") setFout(e instanceof AiFout ? e.message : `Onverwachte fout: ${e?.message || e}`);
    } finally {
      setBezig(false);
    }
  }

  const knop = { border: "1px solid #c7d2fe", background: "#eef2ff", color: "#3730a3", borderRadius: 999, padding: "3px 10px", cursor: "pointer", fontSize: "0.85rem" };
  const sluit = () => { afbreken.current?.abort(); setOpen(false); setVoorstel(null); setFout(""); };

  return (
    <div>
      <div style={{ position: "relative" }}>
        {tekstvak}
        <button type="button" onClick={() => (open ? sluit() : setOpen(true))} aria-expanded={open} title="AI-assistent"
          style={{ position: "absolute", right: 8, bottom: 10, border: "1px solid #c7d2fe", background: open ? "#6366f1" : "#fff", color: open ? "#fff" : "#4f46e5",
            borderRadius: 8, padding: "2px 8px", cursor: "pointer", fontSize: "0.85rem" }}>
          ✨ AI
        </button>
      </div>
      {open && (
        <div role="region" aria-label="AI-assistent" style={{ marginTop: 6, border: "1px solid #c7d2fe", borderRadius: 10, padding: "0.6rem 0.75rem", background: "#f8fafc" }}>
          {(!profiel || instellen) ? (
            <AiInstellingen inst={inst} onOpslaan={(nieuw) => { bewaarInst(nieuw); setInstellen(false); }} onAnnuleer={profiel ? () => setInstellen(false) : null} />
          ) : (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                {acties.map((a) => (
                  <button key={a.id} type="button" style={knop} disabled={bezig} onClick={() => vraag(a.id)} title={a.opdracht}>{a.label}</button>
                ))}
                <button type="button" onClick={() => setInstellen(true)} style={{ ...knop, marginLeft: "auto", background: "none", border: "none", color: "#64748b" }}
                  title="AI-instellingen">⚙ {profiel.label.split(" (")[0]}</button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); vraag(null); }} style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input type="text" className="utrecht-textbox utrecht-textbox--html-input" value={eigen} onChange={(e) => setEigen(e.target.value)}
                  placeholder="Eigen opdracht, bv. schrijf een korte samenvatting van onze doelstellingen" aria-label="Eigen opdracht" style={{ flex: 1 }} />
                <button type="submit" className="utrecht-button utrecht-button--secondary-action" disabled={bezig || !eigen.trim()}>Vraag</button>
              </form>
              {bezig && <p style={{ margin: "8px 0 0", color: "#64748b" }}>Bezig… <button type="button" onClick={() => afbreken.current?.abort()} style={{ ...knop, padding: "0 8px" }}>stop</button></p>}
              {fout && <p role="alert" style={{ margin: "8px 0 0", color: "#b91c1c" }}>{fout}</p>}
              {voorstel && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: 4 }}>Voorstel ({voorstel.model}) — jij beslist:</div>
                  <div style={{ whiteSpace: "pre-wrap", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.5rem 0.65rem" }}>{voorstel.tekst}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <button type="button" className="utrecht-button utrecht-button--primary-action" onClick={() => { onChange(voorstel.tekst); setVoorstel(null); }}>Overnemen</button>
                    <button type="button" className="utrecht-button utrecht-button--secondary-action" onClick={() => { onChange(voegVoorstelIn(tekst, voorstel.tekst)); setVoorstel(null); }}>Invoegen</button>
                    <button type="button" className="utrecht-button utrecht-button--subtle" onClick={() => setVoorstel(null)}>Weggooien</button>
                  </div>
                  <form onSubmit={(e) => { e.preventDefault(); if (bijsturing.trim()) vraag(null, bijsturing.trim()); }} style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <input type="text" aria-label="Bijsturen" className="utrecht-textbox utrecht-textbox--html-input" value={bijsturing}
                      onChange={(e) => setBijsturing(e.target.value)} placeholder="Bijsturen, bv. “nog korter” of “noem ook de gemeenten”" style={{ flex: 1 }} />
                    <button type="submit" className="utrecht-button utrecht-button--secondary-action" disabled={bezig || !bijsturing.trim()}>Opnieuw</button>
                  </form>
                </div>
              )}
              <p style={{ margin: "8px 0 0", fontSize: "0.72rem", color: "#94a3b8" }}>
                Naar de AI-dienst gaan alleen de tekst van dit veld, de opdracht en de naam van het veld.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Kies de dienst en geef een sleutel of toegangscode (bewaard in deze browser). */
export function AiInstellingen({ inst, onOpslaan, onAnnuleer }) {
  const [preset, setPreset] = useState(inst.actief || "claude");
  const huidig = inst.profielen.find((p) => p.id === preset);
  const def = PRESETS.find((p) => p.id === preset);
  const [sleutel, setSleutel] = useState(huidig?.sleutel || "");
  const [model, setModel] = useState(huidig?.model || def.model);
  const [endpoint, setEndpoint] = useState(huidig?.endpoint || "");
  const [modellen, setModellen] = useState(null); // [{ id, naam }] van de dienst zelf
  const [modellenFout, setModellenFout] = useState("");
  const [modellenBezig, setModellenBezig] = useState(false);
  const { baseUrl } = useSchema();
  const id = useId();
  async function laadModellen() {
    setModellenBezig(true); setModellenFout("");
    try {
      setModellen(await haalModellen({ ...def, sleutel: sleutel.trim(), endpoint: def.endpointInvullen ? endpoint.trim() : def.endpoint }, { baseUrl }));
    } catch (e) {
      setModellenFout(e instanceof AiFout ? e.message : String(e?.message || e));
    } finally {
      setModellenBezig(false);
    }
  }
  const kies = (id) => {
    setPreset(id);
    const p = inst.profielen.find((x) => x.id === id);
    setSleutel(p?.sleutel || "");
    setModel(p?.model || PRESETS.find((x) => x.id === id).model);
    setEndpoint(p?.endpoint || "");
    setModellen(null); setModellenFout("");
  };
  const endpointGoed = !def.endpointInvullen || /^https:\/\//.test(endpoint.trim());
  return (
    <form onSubmit={(e) => { e.preventDefault(); onOpslaan(zetProfiel(inst, preset, { sleutel: sleutel.trim(), model: model.trim(), endpoint: endpoint.trim() })); }}
      style={{ display: "grid", gap: 8 }}>
      <strong style={{ fontSize: "0.9rem" }}>AI instellen</strong>
      <div style={{ display: "grid", gap: 2 }}>
        <label htmlFor={`${id}-dienst`}>Dienst</label>
        <select id={`${id}-dienst`} className="utrecht-select utrecht-select--html-select" value={preset} onChange={(e) => kies(e.target.value)}>
          {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gap: 2 }}>
        <label htmlFor={`${id}-sleutel`}>{def.sleutelLabel}</label>
        <input id={`${id}-sleutel`} type="password" autoComplete="off" className="utrecht-textbox utrecht-textbox--html-input" value={sleutel} onChange={(e) => setSleutel(e.target.value)} />
      </div>
      {def.endpointInvullen && (
        <div style={{ display: "grid", gap: 2 }}>
          <label htmlFor={`${id}-endpoint`}>Endpoint (chat/completions)</label>
          <input id={`${id}-endpoint`} type="url" className="utrecht-textbox utrecht-textbox--html-input" value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)} placeholder={def.endpointVoorbeeld} />
          {preset === "alibaba" && (
            <span style={{ fontSize: "0.72rem", color: "#64748b" }}>Regio en workspace-id staan in de Model Studio-console; een sleutel werkt alleen in zijn eigen regio.</span>
          )}
        </div>
      )}
      {preset !== "server" && (
        <div style={{ display: "grid", gap: 2 }}>
          <label htmlFor={`${id}-model`}>Model</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input id={`${id}-model`} type="text" list={`${id}-modellen`} className="utrecht-textbox utrecht-textbox--html-input" value={model}
              onChange={(e) => setModel(e.target.value)} style={{ flex: 1 }} />
            <button type="button" className="utrecht-button utrecht-button--secondary-action" onClick={laadModellen}
              disabled={modellenBezig || !sleutel.trim() || (def.endpointInvullen && !/^https:\/\//.test(endpoint.trim()))}>
              {modellenBezig ? "Ophalen…" : "Modellen ophalen"}
            </button>
          </div>
          <datalist id={`${id}-modellen`}>
            {(modellen || []).map((m) => <option key={m.id} value={m.id}>{m.naam !== m.id ? m.naam : undefined}</option>)}
          </datalist>
          {modellen && <span style={{ fontSize: "0.72rem", color: "#64748b" }}>{modellen.length} modellen van de dienst; klik in het veld om te kiezen.</span>}
          {modellenFout && <span role="alert" style={{ fontSize: "0.75rem", color: "#b91c1c" }}>{modellenFout}</span>}
        </div>
      )}
      <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>
        {preset === "server"
          ? "Een toegangscode krijg je van de beheerder; hij is tijdelijk en heeft een daglimiet."
          : "Je eigen sleutel blijft in deze browser en gaat alleen naar de gekozen dienst. Gebruik dit niet op een gedeelde computer."}
      </p>
      <div style={{ display: "flex", gap: 6 }}>
        <button type="submit" className="utrecht-button utrecht-button--primary-action" disabled={!sleutel.trim() || !endpointGoed || (def.endpointInvullen && !model.trim())}>Opslaan</button>
        {onAnnuleer && <button type="button" className="utrecht-button utrecht-button--subtle" onClick={onAnnuleer}>Annuleren</button>}
      </div>
    </form>
  );
}
