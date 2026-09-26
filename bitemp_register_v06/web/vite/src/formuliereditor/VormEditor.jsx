import { useEffect, useState } from "react";
import { VORMEN, vormenVoor, valideerVormConfig, normaliseerVorm } from "../vormen/vormen";

/**
 * VormEditor — kiest in de formuliereditor de VORM van een veld, lijst of groep en bewerkt de
 * vormConfig (formulier 3.0, ontwerp "Invoersoort en vorm" §9b).
 *  - De keuzelijst toont alleen vormen die de invoersoort van het element bedienen (de matrix
 *    inhoud × vorm uit src/vormen/vormen.js); "standaard" = de vorm die uit het model volgt.
 *  - vormConfig is JSON; bij elke wijziging wordt gecontroleerd op geldige JSON én tegen het
 *    configSchema van de vorm. Ongeldige JSON wordt niet opgeslagen (de tekst blijft staan).
 * Later: een formulier uit het configSchema in plaats van JSON (en gebieden tekenen voor image-map).
 *
 * Props: el, update(id, wijziging), invoersoorten (string[]), stijl { veldStijl, labelStijl }
 */
export default function VormEditor({ el, update, invoersoorten = [], veldStijl, labelStijl }) {
  const huidig = normaliseerVorm(el.vorm) || "";
  const opties = [];
  for (const s of invoersoorten) for (const o of vormenVoor(s)) if (!opties.some((x) => x.naam === o.naam)) opties.push(o);
  const onbekend = huidig && !opties.some((o) => o.naam === huidig);

  const naarTekst = (c) => (c == null ? "" : JSON.stringify(c, null, 2));
  const [tekst, setTekst] = useState(naarTekst(el.vormConfig));
  const [jsonFout, setJsonFout] = useState("");
  useEffect(() => { setTekst(naarTekst(el.vormConfig)); setJsonFout(""); }, [el._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const schemaFouten = huidig && !jsonFout ? valideerVormConfig(huidig, el.vormConfig) : [];
  const vorm = VORMEN[huidig];

  return (
    <div>
      <label style={{ display: "block" }}>
        <span style={labelStijl}>Vorm</span>
        <select style={veldStijl} value={huidig} onChange={(e) => update(el._id, { vorm: e.target.value || undefined })}>
          <option value="">standaard (uit het model)</option>
          {opties.map((o) => <option key={o.naam} value={o.naam}>{o.label} ({o.naam})</option>)}
          {onbekend && <option value={huidig}>{huidig} (past niet bij dit element)</option>}
        </select>
      </label>
      {vorm && <div style={{ fontSize: 11.5, color: "var(--s-fg-muted, #64748b)", marginTop: 3 }}>{vorm.help}</div>}
      {onbekend && <div style={{ fontSize: 11.5, color: "#b45309", marginTop: 3 }}>Deze vorm bedient deze inhoud niet; het formulier valt terug op de standaardvorm.</div>}
      {vorm?.configSchema && (
        <label style={{ display: "block" }}>
          <span style={labelStijl}>vormConfig (JSON)</span>
          <textarea
            style={{ ...veldStijl, minHeight: 120, fontFamily: "monospace", fontSize: 12, borderColor: jsonFout || schemaFouten.length ? "#f59e0b" : undefined }}
            value={tekst}
            spellCheck={false}
            placeholder="{ }"
            onChange={(e) => {
              const t = e.target.value;
              setTekst(t);
              if (!t.trim()) { setJsonFout(""); update(el._id, { vormConfig: undefined }); return; }
              try { update(el._id, { vormConfig: JSON.parse(t) }); setJsonFout(""); }
              catch { setJsonFout("Geen geldige JSON (nog niet opgeslagen)"); }
            }}
          />
          {jsonFout && <div style={{ fontSize: 11.5, color: "#b45309" }}>{jsonFout}</div>}
          {schemaFouten.map((f) => <div key={f} style={{ fontSize: 11.5, color: "#b45309" }}>{f}</div>)}
          {!jsonFout && !schemaFouten.length && el.vormConfig && <div style={{ fontSize: 11.5, color: "#16a34a" }}>volgens het schema van {huidig}</div>}
          <details style={{ fontSize: 11.5, marginTop: 4 }}>
            <summary style={{ cursor: "pointer", color: "var(--s-fg-muted, #64748b)" }}>Eigenschappen van {huidig}</summary>
            <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>
              {Object.entries(vorm.configSchema.properties || {}).map(([k, p]) => (
                <li key={k}>
                  <code>{k}</code>{(vorm.configSchema.required || []).includes(k) ? " *" : ""}
                  {p.enum ? `: ${p.enum.join(" | ")}` : p.type ? `: ${[].concat(p.type).join(" | ")}` : ""}
                  {p["x-omschrijving"] ? ` — ${p["x-omschrijving"]}` : ""}
                </li>
              ))}
            </ul>
          </details>
        </label>
      )}
    </div>
  );
}
