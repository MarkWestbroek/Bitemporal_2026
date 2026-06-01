/**
 * LineageView.jsx — read-only herkomst-/impactview (stap 6).
 *
 * Toont in twee panelen:
 *   - links: alle velden die ergens gebruikt worden (uit de index), met telling;
 *   - rechts: voor het gekozen veld alle gebruiks-plekken (DMN/bericht/event/
 *     contract), én — via het gedeelde-veld-mechanisme — de gekoppelde
 *     artefacten.
 *
 * Het component is volledig gestuurd door een vooraf gebouwde lineage-index
 * (zie lineageIndex.js); het voegt zelf geen data toe.
 */
import { useMemo, useState } from "react";
import { alleVelden, lineageVoorVeld, gekoppeldeArtefacten } from "./lineageIndex.js";
import "./lineage.css";

const SOORT_LABEL = {
  dmn: "DMN-beslistabel",
  bericht: "Berichttype",
  "bpmn-event": "BPMN-event",
  contract: "Procescontract",
};

const ROL_LABEL = {
  "dmn-input": "input-kolom",
  "dmn-output": "output-kolom",
  "bericht-veld": "veld",
  "contract-input": "input-veld",
  "contract-output": "output-veld",
  "event-message": "message-payload",
  "event-signal": "signal-payload",
};

function soortBadge(soort) {
  return <span className={`ln-badge ln-badge-${soort}`}>{SOORT_LABEL[soort] || soort}</span>;
}

export default function LineageView({ index, title = "Lineage — herkomst & impact" }) {
  const velden = useMemo(() => alleVelden(index), [index]);
  const [gekozen, setGekozen] = useState(null);
  const [filter, setFilter] = useState("");

  const zichtbaar = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return velden;
    return velden.filter((v) => v.ref.veldpad.toLowerCase().includes(f) || v.ref.typenaam.toLowerCase().includes(f));
  }, [velden, filter]);

  const lineage = gekozen ? lineageVoorVeld(index, gekozen) : null;

  // Gekoppelde artefacten: voor elk artefact dat het veld gebruikt, welke
  // ANDERE artefacten delen er een veld mee (de regels↔proces↔data-brug).
  const koppelingen = useMemo(() => {
    if (!lineage) return [];
    const gezien = new Set();
    const uit = [];
    for (const g of lineage.gebruik) {
      if (gezien.has(g.naam)) continue;
      gezien.add(g.naam);
      const gek = gekoppeldeArtefacten(index, g.naam);
      if (gek.length) uit.push({ bron: g, gekoppeld: gek });
    }
    return uit;
  }, [index, lineage]);

  return (
    <div className="ln-root">
      <div className="ln-kop">
        <h3 className="ln-titel">{title}</h3>
        <p className="ln-uitleg">
          Read-only en volledig afgeleid: omdat DMN-regels, berichttypen, events en contracten hun velden uit het
          canoniek model halen, valt de herkomst-/impactanalyse hier kosteloos uit.
        </p>
      </div>
      <div className="ln-body">
        <div className="ln-lijst">
          <input
            className="ln-zoek"
            placeholder="Zoek veld of type…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <div className="ln-velden">
            {zichtbaar.length === 0 && <div className="ln-leeg">Geen velden in gebruik.</div>}
            {zichtbaar.map((v) => (
              <button
                key={v.key}
                className={`ln-veld${gekozen === v.key ? " actief" : ""}`}
                onClick={() => setGekozen(v.key)}
              >
                <span className="ln-veld-pad">{v.ref.veldpad}</span>
                <span className="ln-veld-telling" title="aantal gebruiks-plekken">
                  {v.aantal}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="ln-detail">
          {!lineage ? (
            <div className="ln-leeg">Kies links een veld om de lineage te zien.</div>
          ) : (
            <>
              <div className="ln-detail-kop">
                <div className="ln-detail-pad">{lineage.ref.veldpad}</div>
                <div className="ln-detail-type">{lineage.ref.typenaam}</div>
              </div>

              <h4 className="ln-sectie">Gebruikt in ({lineage.gebruik.length})</h4>
              <ul className="ln-gebruik">
                {lineage.gebruik.map((g, i) => (
                  <li key={i} className="ln-gebruik-rij">
                    {soortBadge(g.soort)}
                    <span className="ln-gebruik-naam">{g.naam}</span>
                    <span className="ln-gebruik-rol">{ROL_LABEL[g.rol] || g.rol}</span>
                  </li>
                ))}
              </ul>

              {koppelingen.length > 0 && (
                <>
                  <h4 className="ln-sectie">Gekoppelde artefacten (delen ≥1 veld)</h4>
                  {koppelingen.map((k, i) => (
                    <div key={i} className="ln-koppel">
                      <div className="ln-koppel-bron">
                        {soortBadge(k.bron.soort)} <span className="ln-gebruik-naam">{k.bron.naam}</span>
                      </div>
                      <ul className="ln-koppel-lijst">
                        {k.gekoppeld.map((g, j) => (
                          <li key={j} className="ln-gebruik-rij">
                            {soortBadge(g.soort)}
                            <span className="ln-gebruik-naam">{g.naam}</span>
                            <span className="ln-gebruik-rol">{g.gedeeld.length} gedeeld veld(en)</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
