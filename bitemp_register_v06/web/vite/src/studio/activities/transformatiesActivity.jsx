/**
 * transformatiesActivity — "Transformaties": de regelsets bekijken en proefdraaien
 * (docs/TRANSFORMATIES.md §9.3, backlog TRANS-1 stap 1; Mark 10-11 en 18-11).
 *
 * Een regelset is M2: hoe elk model in taal A in taal B of in een extern formaat uitkomt. Tot nu
 * toe waren ze alleen in de broncode te lezen. Deze view is een **lezer**: links de regelsets uit
 * de catalogus (`transformatie/regelsetCatalogus.js`), rechts de regels in volgorde (volgorde =
 * voorrang) en een proefdraai tegen een proefbron: geplakte tekst of een map uit het project.
 * De proefdraai toont per regel welke bron-items hij pakte, welke regels niets raakten en welke
 * items bij geen regel landden. Er wordt niets in het model geschreven.
 *
 * Nog niet: bewerken, regelsets uit een bestand of het register (stap 2 en 3), en een
 * voorvertoning als diagram (nu een lijst van wat er gemaakt zou worden).
 */
import React, { useMemo, useState } from "react";
import { create } from "zustand";
import { IconTransformatie } from "../icons";
import { alleRegelsets, regelsetsPerRichting, getRegelsetVermelding, regelRijen, controleer, proefdraai } from "../../transformatie/regelsetCatalogus.js";
import { modelNaarGraaf } from "../../transformatie/modelNaarGraaf.js";
import { geenProefUitleg } from "./regelsetsIngebouwd.js";
import SchemaPaneel from "../../vormen/SchemaPaneel.jsx";
import { getProfieltype } from "../profieltypeRegistry.js";
import { useModellerenStore } from "./modellerenActivity.jsx";
import { collectMapModel, mapProfielen } from "./transformaties.js";

const useKeuze = create((set) => ({ gekozen: null, kies: (id) => set({ gekozen: id }) }));

const HEEL_MODEL = "__heel_model";

const gedempt = { color: "var(--s-fg-muted, #64748b)" };
const kader = { border: "1px solid var(--s-border, #e2e8f0)", borderRadius: 8 };
const cel = { padding: "4px 8px", verticalAlign: "top", borderBottom: "1px solid var(--s-border, #f1f5f9)" };
const ACTIE_LABEL = { gemaakt: "gemaakt", gezet: "gezet", opgegaan: "opgegaan in een ander", genegeerd: "genegeerd", overgeslagen: "overgeslagen", "geen-regel": "geen regel" };

function Sidebar() {
  const gekozen = useKeuze((s) => s.gekozen);
  const kies = useKeuze((s) => s.kies);
  const alle = alleRegelsets();
  const actief = gekozen || alle[0]?.regelset.id;
  return (
    <div data-testid="regelset-lijst" style={{ padding: 6, fontSize: 13, overflow: "auto" }}>
      {regelsetsPerRichting().map((groep) => (
        <div key={groep.id} data-richting={groep.id} style={{ marginBottom: 10 }}>
          <div style={{ padding: "4px 8px 2px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", ...gedempt }} title={groep.uitleg}>
            {groep.label} <span style={{ textTransform: "none", letterSpacing: 0 }}>· {groep.uitleg}</span>
          </div>
      {groep.vermeldingen.map((v) => (
        <button
          key={v.regelset.id}
          type="button"
          data-regelset={v.regelset.id}
          onClick={() => kies(v.regelset.id)}
          style={{
            display: "block", width: "100%", textAlign: "left", padding: "6px 8px", margin: "0 0 2px", border: 0, borderRadius: 6, cursor: "pointer", color: "inherit",
            background: actief === v.regelset.id ? "var(--s-bg-actief, rgba(99,102,241,0.14))" : "transparent",
          }}
        >
          <div>{v.regelset.titel || v.regelset.id}</div>
          <div style={{ fontSize: 11, ...gedempt }}>
            {v.vorm === "regels" ? `${v.regelset.regels.length} regels` : "instellingen"} · versie {String(v.regelset.versie ?? "–")} · {v.vindplaats}
          </div>
        </button>
      ))}
        </div>
      ))}
    </div>
  );
}

/** De mappen van het project die inhoud van dit profiel hebben. */
function useMappenMet(profielId) {
  const mappen = useModellerenStore((s) => s.mappen);
  const plaatsing = useModellerenStore((s) => s.plaatsing);
  return useMemo(
    () => (profielId ? Object.values(mappen || {}).filter((m) => mapProfielen(m.id).includes(profielId)).sort((a, b) => String(a.naam).localeCompare(String(b.naam), "nl")) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mappen, plaatsing, profielId]
  );
}

function Proef({ vermelding }) {
  const { regelset, proef } = vermelding;
  const [tekst, setTekst] = useState(proef?.voorbeeld || "");
  const [mapId, setMapId] = useState("");
  const [uit, setUit] = useState(null); // { resultaat, doeltekst } | { fout }
  const mappen = useMappenMet(proef?.soort === "map" ? proef.profielId : null);

  if (!proef) {
    return <p data-testid="proef-geen" style={{ fontSize: 13, ...gedempt }}>{geenProefUitleg(vermelding)}</p>;
  }

  const draai = () => {
    try {
      let grafen;
      if (proef.soort === "tekst") {
        grafen = proef.lees(tekst, { DOMParser: globalThis.DOMParser });
      } else {
        // "Het hele model": alles van dit profiel, ook wat (nog) in geen map staat.
        const model = mapId === HEEL_MODEL ? getProfieltype(proef.profielId)?.useStore?.getState() : collectMapModel(mapId)?.[proef.profielId];
        if (!model || !Object.keys(model.elements || {}).length) throw new Error("Hier staat geen model van dit profiel.");
        grafen = [modelNaarGraaf({ elements: model.elements, elementTypes: getProfieltype(proef.profielId)?.descriptor?.elementTypes || [] })];
      }
      const resultaat = proefdraai(regelset, grafen);
      const doeltekst = proef.schrijf ? resultaat.plannen.map((plan, i) => proef.schrijf(plan, grafen[i])).join("\n") : null;
      setUit({ resultaat, doeltekst });
    } catch (fout) {
      setUit({ fout: fout?.message || String(fout) });
    }
  };

  const r = uit?.resultaat;
  const zonderTreffer = r ? r.perRegel.filter((rij) => !rij.items.length) : [];
  return (
    <div data-testid="proef">
      <p style={{ margin: "0 0 6px", fontSize: 13, ...gedempt }}>{proef.uitleg} Er wordt niets in het model geschreven.</p>
      {proef.soort === "tekst" ? (
        <textarea
          data-testid="proef-tekst"
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
          spellCheck={false}
          style={{ width: "100%", minHeight: 150, fontFamily: "ui-monospace, monospace", fontSize: 12, padding: 8, ...kader, background: "var(--s-bg, #fff)", color: "inherit" }}
        />
      ) : (
        <select data-testid="proef-map" value={mapId} onChange={(e) => setMapId(e.target.value)} style={{ padding: "4px 6px", ...kader, background: "var(--s-bg, #fff)", color: "inherit" }}>
          <option value="">Kies een bereik…</option>
          <option value={HEEL_MODEL}>Het hele model van dit profiel</option>
          {mappen.map((m) => <option key={m.id} value={m.id}>{m.naam}</option>)}
        </select>
      )}
      <div style={{ marginTop: 8 }}>
        <button type="button" className="studio-btn studio-btn--primary" data-testid="proef-draai" disabled={proef.soort === "map" ? !mapId : !tekst.trim()} onClick={draai}>Proefdraaien</button>
      </div>

      {uit?.fout && <p role="alert" data-testid="proef-fout" style={{ color: "#b91c1c", fontSize: 13 }}>De proefbron is niet te lezen: {uit.fout}</p>}

      {r && (
        <div data-testid="proef-uitkomst" style={{ marginTop: 12, fontSize: 13 }}>
          <p data-testid="proef-telling" style={{ margin: "0 0 8px" }}>
            {r.telling.bronItems} bron-items: {r.telling.gemaakt} gemaakt, {r.telling.gezet} gezet, {r.telling.opgegaan} opgegaan, {r.telling.genegeerd} genegeerd,{" "}
            {r.telling.overgeslagen} overgeslagen, <strong>{r.telling["geen-regel"]} zonder regel</strong>.{" "}
            {zonderTreffer.length} van de {r.perRegel.length} regels raakten niets.
          </p>

          {r.zonderRegel.length > 0 && (
            <div data-testid="proef-zonder-regel" style={{ ...kader, padding: 8, marginBottom: 10, borderColor: "#f59e0b" }}>
              <strong>Bron-items zonder regel</strong> (niet overgenomen)
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {r.zonderRegel.map((s, i) => <li key={i}>{s.soort}: {s.omschrijving || s.bronId}</li>)}
              </ul>
            </div>
          )}

          <table data-testid="proef-per-regel" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}><th style={cel}>#</th><th style={cel}>regel</th><th style={cel}>treffers</th><th style={cel}>bron-items</th></tr>
            </thead>
            <tbody>
              {r.perRegel.map((rij) => (
                <tr key={rij.nr} data-regel={rij.naam} style={{ opacity: rij.items.length ? 1 : 0.5 }}>
                  <td style={cel}>{rij.nr}</td>
                  <td style={cel}>{rij.naam}</td>
                  <td style={cel} data-testid="treffers">{rij.items.length}</td>
                  <td style={cel}>
                    {rij.items.slice(0, 8).map((s, i) => (
                      <div key={i}>{s.omschrijving || s.bronId}{s.actie !== "gemaakt" ? <span style={gedempt}> ({ACTIE_LABEL[s.actie] || s.actie})</span> : null}</div>
                    ))}
                    {rij.items.length > 8 && <div style={gedempt}>… en {rij.items.length - 8} meer</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {r.diagnostics.length > 0 && (
            <details style={{ marginTop: 10 }}>
              <summary>Meldingen ({r.diagnostics.length})</summary>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {r.diagnostics.slice(0, 100).map((d, i) => <li key={i}>{d.severity === "warning" ? "⚠ " : ""}{d.message}</li>)}
              </ul>
            </details>
          )}

          <h4 style={{ margin: "14px 0 4px" }}>Wat er gemaakt zou worden</h4>
          {uit.doeltekst != null ? (
            <pre data-testid="proef-doeltekst" style={{ ...kader, padding: 8, margin: 0, overflow: "auto", fontSize: 12 }}>{uit.doeltekst}</pre>
          ) : (
            <table data-testid="proef-plan" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ textAlign: "left" }}><th style={cel}>type</th><th style={cel}>naam</th><th style={cel}>van → naar</th><th style={cel}>door regel</th></tr></thead>
              <tbody>
                {r.plannen.flatMap((plan, p) => [
                  ...plan.elementen.map((e) => <tr key={`${p}e${e.sleutel}`}><td style={cel}>{e.type}</td><td style={cel}>{e.naam}</td><td style={cel} /><td style={cel}>{e.regel}</td></tr>),
                  ...plan.connectoren.map((c) => <tr key={`${p}c${c.sleutel}`}><td style={cel}>{c.type}</td><td style={cel}>{c.naam}</td><td style={cel}>{c.bron} → {c.doel}</td><td style={cel}>{c.regel}</td></tr>),
                ])}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function Main() {
  const gekozen = useKeuze((s) => s.gekozen);
  const alle = alleRegelsets();
  const vermelding = getRegelsetVermelding(gekozen || alle[0]?.regelset.id);
  if (!vermelding) return <div style={{ padding: 16 }}>Geen regelsets gevonden.</div>;
  const { regelset, vorm, vindplaats, bestand, schema, schrijver } = vermelding;
  const fouten = controleer(regelset, schema);
  const rijen = regelRijen(regelset);
  // Bij instellingen: alles behalve de kop, zoals het in de regelset staat.
  const { id, versie, titel, bron, doel, regels, ...rest } = regelset;

  return (
    <div data-testid="regelset" data-regelset={id} style={{ padding: 16, overflow: "auto", height: "100%", boxSizing: "border-box" }}>
      <h2 style={{ margin: "0 0 4px" }}>{titel || id}</h2>
      <p style={{ margin: "0 0 10px", fontSize: 13, ...gedempt }}>
        <code>{id}</code> · versie {String(versie ?? "–")} · van <strong>{bron || "–"}</strong> naar <strong>{doel || "–"}</strong> · vindplaats: {vindplaats}
        {bestand ? <> (<code>{bestand}</code>)</> : null}
      </p>
      {fouten.length > 0 ? (
        <div role="alert" style={{ ...kader, borderColor: "#dc2626", padding: 8, marginBottom: 10, fontSize: 13 }}>
          Deze regelset is niet geldig:
          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{fouten.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </div>
      ) : vorm === "regels" ? (
        <p data-testid="regelset-geldig" style={{ margin: "0 0 10px", fontSize: 13 }}>✓ Geldig: {rijen.length} regels. Per bron-item wint de eerste regel die past.</p>
      ) : schema ? (
        <p data-testid="regelset-geldig" style={{ margin: "0 0 10px", fontSize: 13 }}>✓ Geldig voor het schema van de schrijver.</p>
      ) : null}

      {vorm === "regels" ? (
        <>
          <h3 style={{ margin: "12px 0 6px" }}>Proefdraaien</h3>
          <Proef key={id} vermelding={vermelding} />

          <h3 style={{ margin: "18px 0 6px" }}>Regels</h3>
          <table data-testid="regels-tabel" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left" }}><th style={cel}>#</th><th style={cel}>regel</th><th style={cel}>bij</th><th style={cel}>als</th><th style={cel}>dan</th></tr>
            </thead>
            <tbody>
              {rijen.map((rij) => (
                <tr key={rij.nr}>
                  <td style={cel}>{rij.nr}</td>
                  <td style={cel}>{rij.naam}{rij.meld ? <span title="Deze regel meldt dat hij is toegepast" style={gedempt}> (meldt)</span> : null}</td>
                  <td style={cel}>{rij.bij}</td>
                  <td style={cel}>{rij.als.length ? rij.als.map((a, i) => <div key={i}>{a}</div>) : <span style={gedempt}>altijd</span>}</td>
                  <td style={cel}>{rij.actie}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {Object.keys(rest).length > 0 && (
            <details style={{ marginTop: 10, fontSize: 13 }}>
              <summary>Overige instellingen ({Object.keys(rest).join(", ")})</summary>
              <pre style={{ ...kader, padding: 8, overflow: "auto", fontSize: 12 }}>{JSON.stringify(rest, null, 2)}</pre>
            </details>
          )}
        </>
      ) : (
        <>
          <p style={{ fontSize: 13 }}>{geenProefUitleg(vermelding)}</p>
          {schema ? (
            <>
              <h3 style={{ margin: "12px 0 2px" }}>Instellingen van de schrijver</h3>
              <p style={{ margin: "0 0 10px", fontSize: 13, ...gedempt }}>
                Schrijver: {schrijver}. De bron is het model in de map waarop je de transformatie draait; deze stand zegt hoe de
                schrijver het omzet. Alleen-lezen.
              </p>
              <SchemaPaneel schema={schema} waarde={rest} />
              <details style={{ marginTop: 10, fontSize: 13 }}>
                <summary>Als JSON</summary>
                <pre data-testid="regelset-instellingen" style={{ ...kader, padding: 8, overflow: "auto", fontSize: 12 }}>{JSON.stringify(rest, null, 2)}</pre>
              </details>
            </>
          ) : (
            <pre data-testid="regelset-instellingen" style={{ ...kader, padding: 8, overflow: "auto", fontSize: 12 }}>{JSON.stringify(rest, null, 2)}</pre>
          )}
        </>
      )}
    </div>
  );
}

export default {
  id: "transformaties",
  // Sinds stap 9 deel 2 (Mark 22-11) heet het zicht op het project "Transformaties"
  // (projectZicht.jsx); deze lezer is daar de knop Proefdraaien… en staat standaard niet in de balk.
  label: "Regelsets proefdraaien",
  icon: <IconTransformatie />,
  groep: "beheer",
  status: "preview",
  standaardVerborgen: true,
  Sidebar,
  Main,
};
