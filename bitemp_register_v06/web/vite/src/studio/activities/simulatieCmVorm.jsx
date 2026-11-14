/**
 * Een object uit de simulatie in de cm-vorm (POC, Mark 14-11, ontwerp Simulatie §11.7): de
 * entiteit met haar gegevenselementen en relaties, en per veld de waarde. De state van het
 * object is de verzameling velden met een waarde; verplichte velden hebben er altijd een. Wat
 * niet in het objecttype zit is onbekend. Bovenaan de toets: verplicht ingevuld, relaties met
 * een bekend doel. De logica staat in simulatie/cmVorm.js.
 */
import { useState } from "react";
import { cmVorm } from "../../simulatie/cmVorm.js";

const mono = { fontFamily: "ui-monospace, Consolas, monospace", fontSize: 11 };
const gedempt = { color: "var(--s-fg-muted, #64748b)" };
const ROOD = "#dc2626";
const GROEN = "#16a34a";

const heeftWaarde = (w) => w !== undefined && w !== null && w !== "" && !(Array.isArray(w) && !w.length);
function ietsBekend(kinderen) {
  return kinderen.some((k) => (k.soort === "veld" ? heeftWaarde(k.waarde) : k.voorkomens.some(ietsBekend)));
}
const toon = (w) => (typeof w === "string" ? w : JSON.stringify(w));
/** Markering van een veld dat in de getoonde versie veranderde. */
export const GEWIJZIGD = { background: "rgba(250, 204, 21, 0.28)", borderRadius: 3 };

function Veld({ k, fout, gewijzigd }) {
  const leeg = !heeftWaarde(k.waarde);
  const nieuw = k.platSleutel && gewijzigd?.has(k.platSleutel);
  return (
    <div style={{ ...mono, display: "flex", gap: 6, ...(nieuw ? GEWIJZIGD : {}) }} data-testid="sim-cm-veld" data-pad={k.id} data-gewijzigd={nieuw ? "ja" : undefined} title={nieuw ? "veranderd in deze versie" : undefined}>
      <span style={{ minWidth: 120, color: fout ? ROOD : undefined }}>
        {k.naam}
        {k.verplicht && <span title="verplicht">*</span>}
      </span>
      {!k.inObjecttype ? (
        <span style={{ ...gedempt, fontStyle: "italic" }} title="Dit veld staat niet in het objecttype; de simulatie kent de waarde niet.">
          onbekend
        </span>
      ) : leeg ? (
        <span style={{ ...gedempt, color: fout ? ROOD : gedempt.color }}>{fout ? "ontbreekt" : "—"}</span>
      ) : (
        <span style={{ wordBreak: "break-word" }}>{toon(k.waarde)}</span>
      )}
    </div>
  );
}

/** Eén knoop (GE, relatie, doel, ouder) met zijn voorkomens. */
function Knoop({ k, pad, fouten, binnenDoel, gewijzigd }) {
  const hier = `${pad}.${k.naam}`;
  const bekend = k.voorkomens.some(ietsBekend);
  // Wat niets bekends heeft en niet in het objecttype zit, of een leeg alternatief binnen een doel: één regel.
  if (!bekend && (!k.inObjecttype || (binnenDoel && k.soort === "ge")) && !fouten.some((f) => f.startsWith(hier))) {
    return (
      <div style={{ ...gedempt, fontSize: 11 }} data-testid="sim-cm-leeg">
        {k.soort === "relatie" ? "→ " : ""}
        {k.naam}
        {k.doel ? ` → ${k.doel}` : ""} — {k.inObjecttype ? "leeg" : "niet in het objecttype"}
      </div>
    );
  }
  const kop =
    k.soort === "ouder" ? `erft van ${k.naam}` : k.soort === "relatie" ? `→ ${k.naam}` : k.soort === "doel" ? k.naam : k.naam;
  return (
    <div style={{ margin: "2px 0" }} data-testid={`sim-cm-${k.soort}`} data-pad={k.id}>
      <div style={{ fontWeight: k.soort === "doel" ? 400 : 600, fontSize: 11, color: k.soort === "ouder" ? "var(--s-fg-muted, #64748b)" : undefined }}>
        {kop}
        {k.verplicht && k.soort === "relatie" && <span title="verplichte relatie">*</span>}
        {k.meervoudig && <span style={gedempt}> ({k.voorkomens.length})</span>}
      </div>
      {k.voorkomens.map((kinderen, i) => {
        const vPad = k.meervoudig ? `${hier}[${i}]` : hier;
        return (
          <div key={i} style={{ marginLeft: 10, paddingLeft: 6, borderLeft: "1px solid var(--s-border, #e2e8f0)" }}>
            {k.meervoudig && <div style={{ ...gedempt, fontSize: 10 }}>#{i + 1}</div>}
            {kinderen.map((c, j) =>
              c.soort === "veld" ? (
                <Veld key={j} k={c} fout={fouten.includes(`${vPad}.${c.naam}`)} gewijzigd={gewijzigd} />
              ) : (
                <Knoop key={j} k={c} pad={vPad} fouten={fouten} binnenDoel={binnenDoel || k.soort === "doel"} gewijzigd={gewijzigd} />
              ),
            )}
          </div>
        );
      })}
    </div>
  );
}

/** De platte vorm, per veld op het hoogste niveau, met de gewijzigde velden gemarkeerd. */
export function PlatJson({ data, gewijzigd = new Set() }) {
  return (
    <div style={{ ...mono, marginTop: 2 }}>
      {Object.entries(data || {}).map(([naam, w]) => (
        <div key={naam} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", ...(gewijzigd.has(naam) ? GEWIJZIGD : {}) }} data-gewijzigd={gewijzigd.has(naam) ? "ja" : undefined}>
          "{naam}": {JSON.stringify(w, null, 1)}
        </div>
      ))}
    </div>
  );
}

/** Het object in de cm-vorm, met een knop terug naar de platte vorm (JSON). */
export function CmObject({ beeld, data, bron, gewijzigd = new Set() }) {
  const [alsJson, setAlsJson] = useState(false);
  // Geen memo: de store wijzigt het object ter plekke (zelfde referentie); de omzetting is goedkoop.
  const { boom, problemen, buitenCm } = cmVorm(beeld, data);
  const fouten = problemen.filter((p) => p.ernst === "fout");
  const onbekend = problemen.filter((p) => p.ernst === "onbekend");
  const foutPaden = fouten.map((p) => p.pad);
  const wissel = (
    <span style={{ display: "inline-flex", gap: 4, marginLeft: 6 }}>
      {["cm-vorm", "JSON"].map((v) => (
        <button
          key={v}
          onClick={() => setAlsJson(v === "JSON")}
          style={{ fontSize: 10, padding: "0 6px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--s-border, #cbd5e1)", background: (v === "JSON") === alsJson ? "var(--s-accent, #6366f1)" : "transparent", color: (v === "JSON") === alsJson ? "#fff" : "inherit" }}
          data-testid={`sim-cm-${v === "JSON" ? "json" : "vorm"}`}
        >
          {v}
        </button>
      ))}
    </span>
  );
  if (alsJson)
    return (
      <div style={{ margin: "2px 0 0 12px" }}>
        {wissel}
        <PlatJson data={data} gewijzigd={gewijzigd} />
      </div>
    );
  return (
    <div style={{ margin: "2px 0 0 12px" }} data-testid="sim-cm">
      {wissel}
      <div style={{ fontSize: 11, margin: "4px 0" }} data-testid="sim-cm-toets">
        {fouten.length ? (
          <span style={{ color: ROOD }}>
            ✗ {fouten.length} {fouten.length === 1 ? "fout" : "fouten"} in de state: {fouten.map((f) => `${f.pad.split(".").slice(-2).join(".")} (${f.melding})`).join("; ")}
          </span>
        ) : (
          <span style={{ color: GROEN }}>✓ verplichte velden ingevuld, relaties met een bekend doel</span>
        )}
        {onbekend.length > 0 && (
          <div style={gedempt} title={onbekend.map((p) => `${p.pad}: ${p.melding}`).join("\n")}>
            {onbekend.length} verplicht {onbekend.length === 1 ? "veld of relatie" : "velden of relaties"} buiten het objecttype: onbekend
          </div>
        )}
      </div>
      <div style={{ fontWeight: 700, fontSize: 11 }}>{boom.naam}</div>
      {boom.voorkomens[0].map((c, j) => (
        <Knoop key={j} k={c} pad={boom.naam} fouten={foutPaden} binnenDoel={false} gewijzigd={gewijzigd} />
      ))}
      {Object.keys(buitenCm).length > 0 && (
        <div style={{ marginTop: 6 }} data-testid="sim-cm-buiten">
          <div style={{ fontWeight: 600, fontSize: 11 }} title="Velden op het object die nergens in het cm staan, zoals de behandelvelden van het dossier. Ze komen in het cm met Beslissing en Zaak (ontwerp vraag 12).">
            Buiten het cm
          </div>
          <div style={{ marginLeft: 10, paddingLeft: 6, borderLeft: "1px dashed var(--s-border, #cbd5e1)" }}>
            {Object.entries(buitenCm).map(([naam, w]) => (
              <div key={naam} style={{ ...mono, display: "flex", gap: 6, ...(gewijzigd.has(naam) ? GEWIJZIGD : {}) }} data-gewijzigd={gewijzigd.has(naam) ? "ja" : undefined}>
                <span style={{ minWidth: 120 }}>{naam}</span>
                <span style={{ wordBreak: "break-word" }}>{toon(w)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {bron && <div style={{ ...gedempt, fontSize: 10, marginTop: 4 }}>Structuur uit {bron}.</div>}
    </div>
  );
}
