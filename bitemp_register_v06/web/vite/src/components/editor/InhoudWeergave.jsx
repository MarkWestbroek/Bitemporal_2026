import { useState } from "react";
import { herkenInhoud, inhoudSamenvatting } from "./inhoudSoort.js";
import JsonBoom from "./JsonBoom";
import BpmnWeergave from "./BpmnWeergave";

/**
 * InhoudWeergave — een lange tekstwaarde leesbaar tonen: JSON als gekleurde,
 * inklapbare boom, BPMN-XML als diagram, anders de tekst zelf. Met de knop
 * "Tekst" zie je altijd de ruwe waarde.
 *
 * Gebruikt in de Inhoud Editor voor bv. de payload van een inrichtingsartefact
 * (voorkomentabel in EntiteitFormulier, en via ?toon=<veld> direct open).
 *
 * Props: waarde, titel, onSluiten (optioneel: toont een sluitknop).
 */
export default function InhoudWeergave({ waarde, titel, onSluiten }) {
  const herkend = herkenInhoud(waarde);
  const [modus, setModus] = useState(herkend && herkend.soort !== "xml" ? "weergave" : "tekst");
  const [jsonSleutel, setJsonSleutel] = useState({ n: 0, openTot: Infinity });
  const ruw = typeof waarde === "string" ? waarde : JSON.stringify(waarde, null, 2);

  const tab = (id, label) => (
    <button type="button" role="tab" aria-selected={modus === id} onClick={() => setModus(id)}
      className={`cg-inhoud-weergave__tab${modus === id ? " cg-inhoud-weergave__tab--actief" : ""}`}>{label}</button>
  );

  return (
    <div className="cg-inhoud-weergave" data-inhoud-soort={herkend?.soort || "tekst"}>
      <div className="cg-inhoud-weergave__kop">
        {titel && <strong>{titel}</strong>}
        <span className="cg-inhoud-weergave__soort">{inhoudSamenvatting(waarde, herkend) || "tekst"}</span>
        <span style={{ flex: 1 }} />
        {herkend?.soort === "json" && modus === "weergave" && (
          <>
            <button type="button" className="cg-inhoud-weergave__knop" onClick={() => setJsonSleutel((s) => ({ n: s.n + 1, openTot: Infinity }))}>alles open</button>
            <button type="button" className="cg-inhoud-weergave__knop" onClick={() => setJsonSleutel((s) => ({ n: s.n + 1, openTot: 1 }))}>inklappen</button>
          </>
        )}
        {herkend && herkend.soort !== "xml" && (
          <span role="tablist" style={{ display: "inline-flex", gap: 2 }}>
            {tab("weergave", herkend.soort === "bpmn" ? "Diagram" : "Weergave")}
            {tab("tekst", "Tekst")}
          </span>
        )}
        <button type="button" className="cg-inhoud-weergave__knop" title="Kopieer de ruwe tekst"
          onClick={() => navigator.clipboard?.writeText(ruw)}>kopieer</button>
        {onSluiten && <button type="button" className="cg-inhoud-weergave__knop" onClick={onSluiten} title="Sluiten">✕</button>}
      </div>
      {modus === "weergave" && herkend?.soort === "json" && <JsonBoom key={jsonSleutel.n} data={herkend.data} openTot={jsonSleutel.openTot} />}
      {modus === "weergave" && herkend?.soort === "bpmn" && <BpmnWeergave xml={herkend.tekst} />}
      {modus === "tekst" && <pre className="cg-inhoud-weergave__tekst">{ruw}</pre>}
    </div>
  );
}
