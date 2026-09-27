import { useMemo, useRef, useState } from "react";
import { useSchema } from "../../context/SchemaContext";
import { useAiToegestaan } from "../../shared/ai/AiContext";
import { actiefProfiel } from "../../shared/ai/aiProfielen";
import { useAiInstellingen } from "../../shared/ai/useAiInstellingen";
import { vraagAi, AiFout } from "../../shared/ai/vraagAi";
import { invulbareVelden, antwoordSchema, bouwInvulVraag, leesJson, beoordeelAntwoord } from "../../shared/ai/aiInvulhulp";
import { AiInstellingen } from "./AiAssistVeld";

/**
 * AiInvulhulp — "✨ Invullen met AI": een heel formulier VOORinvullen uit een bron. Plak een tekst,
 * of geef een webadres (de server haalt de pagina als tekst op: /api/ai/lees-url; een GitHub-repo
 * wordt zijn README). Het model doet per veld een voorstel; de invuller ziet huidig en voorstel
 * naast elkaar en vinkt aan wat hij overneemt. Lege velden staan standaard aan, gevulde niet.
 *
 * Wat naar de AI-dienst gaat: de bron en de namen/keuzelijsten van de velden, niet wat er al is
 * ingevuld. Lijsten (rijen) en verwijzingen naar andere records vult de invuller zelf.
 *
 * Props: layout, velden (schema-velden van het formulier), values, onToepassen({ pad: waarde }), formulier (naam)
 */
export default function AiInvulhulp({ layout, velden, values, onToepassen, formulier = "" }) {
  const toegestaan = useAiToegestaan();
  const { baseUrl } = useSchema();
  const [inst, bewaarInst] = useAiInstellingen();
  const profiel = actiefProfiel(inst);
  const [open, setOpen] = useState(false);
  const [instellen, setInstellen] = useState(false);
  const [soort, setSoort] = useState("url"); // "url" | "tekst"
  const [url, setUrl] = useState("");
  const [tekst, setTekst] = useState("");
  const [stap, setStap] = useState(""); // "", "ophalen", "vragen"
  const [fout, setFout] = useState("");
  const [voorstellen, setVoorstellen] = useState(null);
  const [bronInfo, setBronInfo] = useState(null);
  // Het gesprek tot nu toe (voor bijsturen): [{ role: "user"|"assistant", content }].
  const [gesprek, setGesprek] = useState([]);
  const [bijsturing, setBijsturing] = useState("");
  const afbreken = useRef(null);

  const veldenByNaam = useMemo(() => Object.fromEntries((velden || []).filter((v) => v?.naam).map((v) => [v.naam, v])), [velden]);
  const invulbaar = useMemo(() => invulbareVelden(layout, veldenByNaam), [layout, veldenByNaam]);
  if (!toegestaan || invulbaar.length === 0) return null;

  async function start(e) {
    e.preventDefault();
    afbreken.current?.abort();
    const ctrl = new AbortController();
    afbreken.current = ctrl;
    setFout(""); setVoorstellen(null); setBronInfo(null); setGesprek([]);
    try {
      let bron = tekst;
      let bronNaam = "";
      if (soort === "url") {
        setStap("ophalen");
        const res = await fetch(`${baseUrl}/api/ai/lees-url`, {
          method: "POST", credentials: "include", signal: ctrl.signal,
          headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new AiFout(d.error ? `Pagina ophalen: ${d.error}` : `Pagina ophalen mislukt (${res.status}).`);
        bron = d.tekst;
        bronNaam = d.url;
        setBronInfo({ url: d.url, titel: d.titel, tekens: d.tekst.length, afgekapt: d.afgekapt });
      }
      if (!String(bron || "").trim()) throw new AiFout("Er is geen tekst om uit te putten.");
      const { systeem, vraag } = bouwInvulVraag(invulbaar, bron, { formulier, bronNaam });
      await vraagEnVerwerk(systeem, vraag, [], ctrl);
    } catch (err) {
      if (err?.name !== "AbortError") setFout(err instanceof AiFout ? err.message : `Onverwachte fout: ${err?.message || err}`);
    } finally {
      setStap("");
    }
  }

  /** Eén beurt: vragen (met het gesprek tot nu toe), JSON lezen, voorstellen tonen, gesprek bijwerken. */
  async function vraagEnVerwerk(systeem, vraag, geschiedenis, ctrl) {
    setStap("vragen");
    const antwoord = await vraagAi(profiel, { systeem, vraag, signal: ctrl.signal, baseUrl, jsonSchema: antwoordSchema(invulbaar), effort: "medium", geschiedenis });
    const json = leesJson(antwoord.tekst);
    if (!json) throw new AiFout("Het antwoord van de AI-dienst was geen bruikbare JSON. Probeer het nog eens.");
    const { voorstellen: lijst, overgeslagen } = beoordeelAntwoord(json, invulbaar, values || {});
    setVoorstellen({ lijst, overgeslagen, model: antwoord.model, ruw: JSON.stringify(json, null, 2), systeem });
    setGesprek([...geschiedenis, { role: "user", content: vraag }, { role: "assistant", content: antwoord.tekst }]);
  }

  /** Bijsturen: een opmerking van de invuller als volgende beurt in hetzelfde gesprek. */
  async function stuurBij(e) {
    e.preventDefault();
    if (!bijsturing.trim() || !voorstellen) return;
    afbreken.current?.abort();
    const ctrl = new AbortController();
    afbreken.current = ctrl;
    setFout("");
    try {
      const vraag = `Bijsturing van de invuller: ${bijsturing.trim()}

Geef opnieuw het volledige JSON-object met alle gevraagde sleutels (null waar niets bekend is).`;
      await vraagEnVerwerk(voorstellen.systeem, vraag, gesprek, ctrl);
      setBijsturing("");
    } catch (err) {
      if (err?.name !== "AbortError") setFout(err instanceof AiFout ? err.message : `Onverwachte fout: ${err?.message || err}`);
    } finally {
      setStap("");
    }
  }

  const zet = (pad, aan) => setVoorstellen((v) => ({ ...v, lijst: v.lijst.map((x) => (x.pad === pad ? { ...x, aan } : x)) }));
  const gekozen = voorstellen?.lijst.filter((x) => x.aan) || [];
  const neemOver = () => {
    onToepassen(Object.fromEntries(gekozen.map((x) => [x.pad, x.voorstel])));
    setVoorstellen(null); setOpen(false);
  };

  const rand = "1px solid #c7d2fe";
  return (
    <div style={{ margin: "0 0 0.75rem" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        style={{ border: rand, background: open ? "#6366f1" : "#eef2ff", color: open ? "#fff" : "#3730a3", borderRadius: 8, padding: "4px 12px", cursor: "pointer" }}>
        ✨ Invullen met AI
      </button>
      {open && (
        <div role="region" aria-label="AI-invulhulp" style={{ marginTop: 6, border: rand, borderRadius: 10, padding: "0.75rem", background: "#f8fafc" }}>
          {(!profiel || instellen) ? (
            <AiInstellingen inst={inst} onOpslaan={(n) => { bewaarInst(n); setInstellen(false); }} onAnnuleer={profiel ? () => setInstellen(false) : null} />
          ) : (
            <>
              <p style={{ margin: "0 0 8px", fontSize: "0.85rem", color: "#475569" }}>
                Geef een bron; de AI doet per veld een voorstel ({invulbaar.length} velden). Jij kiest wat je overneemt.
                <button type="button" onClick={() => setInstellen(true)} title="AI-instellingen"
                  style={{ float: "right", border: "none", background: "none", color: "#64748b", cursor: "pointer" }}>⚙ {profiel.label.split(" (")[0]}</button>
              </p>
              <form onSubmit={start} style={{ display: "grid", gap: 8 }}>
                <div role="radiogroup" aria-label="Soort bron" style={{ display: "flex", gap: 14, fontSize: "0.9rem" }}>
                  <label><input type="radio" name="bron" checked={soort === "url"} onChange={() => setSoort("url")} /> Webadres (bv. een GitHub-repo)</label>
                  <label><input type="radio" name="bron" checked={soort === "tekst"} onChange={() => setSoort("tekst")} /> Tekst plakken</label>
                </div>
                {soort === "url" ? (
                  <input type="url" aria-label="Webadres" className="utrecht-textbox utrecht-textbox--html-input" value={url} onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://github.com/organisatie/project" required />
                ) : (
                  <textarea aria-label="Brontekst" className="utrecht-textarea utrecht-textarea--html-textarea" rows={6} value={tekst} onChange={(e) => setTekst(e.target.value)}
                    placeholder="Plak hier een beschrijving, README, e-mail, …" required />
                )}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button type="submit" className="utrecht-button utrecht-button--primary-action" disabled={Boolean(stap)}>Voorstellen maken</button>
                  {stap && <span style={{ color: "#64748b" }}>{stap === "ophalen" ? "Pagina ophalen…" : "AI denkt na…"}
                    <button type="button" onClick={() => afbreken.current?.abort()} style={{ marginLeft: 8, border: rand, background: "#fff", borderRadius: 6, cursor: "pointer" }}>stop</button></span>}
                </div>
              </form>
              {bronInfo && (
                <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "6px 0 0" }}>
                  Bron: {bronInfo.titel ? `${bronInfo.titel} — ` : ""}{bronInfo.url} ({bronInfo.tekens.toLocaleString("nl-NL")} tekens{bronInfo.afgekapt ? ", afgekapt" : ""})
                </p>
              )}
              {fout && <p role="alert" style={{ color: "#b91c1c", margin: "8px 0 0" }}>{fout}</p>}
              {voorstellen && (
                <div style={{ marginTop: 10 }}>
                  {voorstellen.overgeslagen?.length > 0 && (
                    <details style={{ margin: "0 0 8px", fontSize: "0.8rem", color: "#475569" }} open={voorstellen.lijst.length === 0}>
                      <summary style={{ cursor: "pointer" }}>Niet overgenomen ({voorstellen.overgeslagen.length})</summary>
                      <ul style={{ margin: "4px 0 0", paddingLeft: "1.2rem" }}>
                        {voorstellen.overgeslagen.map((o, i) => (
                          <li key={i}><strong>{o.label}</strong>{o.waarde ? <> = “{o.waarde}”</> : null} — {o.reden}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {voorstellen.lijst.length === 0 ? (
                    <p style={{ margin: 0 }}>De bron gaf geen bruikbare voorstellen voor deze velden.</p>
                  ) : (
                    <>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: 4 }}>Voorstellen ({voorstellen.model}) — vink aan wat je overneemt:</div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", background: "#fff" }}>
                        <thead>
                          <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                            <th style={{ width: 28 }} /><th style={{ padding: 4 }}>Veld</th><th>Nu</th><th>Voorstel</th>
                          </tr>
                        </thead>
                        <tbody>
                          {voorstellen.lijst.map((x) => (
                            <tr key={x.pad} style={{ borderBottom: "1px solid #f1f5f9", verticalAlign: "top" }}>
                              <td style={{ padding: 4 }}><input type="checkbox" aria-label={`${x.label} overnemen`} checked={x.aan} onChange={(e) => zet(x.pad, e.target.checked)} /></td>
                              <td style={{ padding: 4, fontWeight: 600 }}>{x.label}</td>
                              <td style={{ padding: 4, color: "#64748b" }}>{x.huidig || "—"}</td>
                              <td style={{ padding: 4, whiteSpace: "pre-wrap" }}>{x.voorstel}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        <button type="button" className="utrecht-button utrecht-button--primary-action" disabled={gekozen.length === 0} onClick={neemOver}>
                          Overnemen ({gekozen.length})
                        </button>
                        <button type="button" className="utrecht-button utrecht-button--subtle" onClick={() => setVoorstellen(null)}>Weggooien</button>
                      </div>
                    </>
                  )}
                  <form onSubmit={stuurBij} style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <input type="text" aria-label="Bijsturen" className="utrecht-textbox utrecht-textbox--html-input" value={bijsturing}
                      onChange={(e) => setBijsturing(e.target.value)} style={{ flex: 1 }}
                      placeholder="Bijsturen, bv. “maak de omschrijving korter” of “het type is Standaard”" />
                    <button type="submit" className="utrecht-button utrecht-button--secondary-action" disabled={Boolean(stap) || !bijsturing.trim()}>Opnieuw</button>
                  </form>
                  {gesprek.length > 2 && <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 4 }}>Bijgestuurd ({(gesprek.length - 2) / 2}×).</div>}
                  <details style={{ marginTop: 8, fontSize: "0.75rem", color: "#64748b" }}>
                    <summary style={{ cursor: "pointer" }}>Ruw antwoord (JSON)</summary>
                    <pre style={{ margin: "4px 0 0", padding: 8, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, maxHeight: 240, overflow: "auto" }}>{voorstellen.ruw}</pre>
                  </details>
                </div>
              )}
              <p style={{ margin: "8px 0 0", fontSize: "0.72rem", color: "#94a3b8" }}>
                Naar de AI-dienst gaan de bron en de namen van de velden, niet wat je al hebt ingevuld. Lijsten en verwijzingen vul je zelf in.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
