/**
 * RelatiesPaneel — de relaties van of naar het geselecteerde element, met
 * hun stand op het actieve diagram (Mark, 13-10: "een inspector van relaties
 * van of naar een element is erg welkom").
 *
 * Puur presentatie: de activiteit berekent de rijen en levert de handelingen.
 *   relaties: [{ id, typeLabel, richting: "uit"|"in", naam, anderNaam,
 *                stand: "zichtbaar"|"verborgen"|"buiten" }]
 *   - zichtbaar: beide uiteinden op dit diagram, lijn getekend
 *   - verborgen: beide uiteinden op dit diagram, lijn alleen hier verborgen
 *   - buiten:    het andere uiteinde staat niet op dit diagram
 * Van het diagram halen = verbergen op dít diagram; het model houdt de
 * relatie. Uit het model verwijderen gaat via een eigen knop.
 */
import React from "react";

const STAND_LABEL = {
  zichtbaar: "op dit diagram",
  verborgen: "verborgen op dit diagram",
  buiten: "andere kant niet op dit diagram",
};

export default function RelatiesPaneel({ relaties = [], onSelecteer, onVerberg, onToon, onVerwijder }) {
  if (!relaties.length) return null;
  return (
    <div className="dc-inspector-sectie dc-relaties">
      <div className="dc-inspector-sectie-titel">Relaties ({relaties.length})</div>
      {relaties.map((r) => (
        <div key={r.id} className={"dc-relatie is-" + r.stand}>
          <button
            type="button"
            className="dc-relatie-naam"
            title="Selecteer deze relatie"
            onClick={() => onSelecteer?.(r.id)}
          >
            <span className="dc-relatie-richting" aria-hidden="true">{r.richting === "uit" ? "→" : "←"}</span>
            <span className="dc-relatie-type">{r.typeLabel}</span>
            {r.naam ? <span className="dc-relatie-label">“{r.naam}”</span> : null}
            <span className="dc-relatie-ander">{r.anderNaam}</span>
          </button>
          <div className="dc-relatie-stand">
            <span>{STAND_LABEL[r.stand] || r.stand}</span>
            {r.stand === "zichtbaar" && (
              <button type="button" className="dc-mini-knop" title="Alleen op dit diagram verbergen; de relatie blijft in het model" onClick={() => onVerberg?.(r.id)}>
                van diagram
              </button>
            )}
            {r.stand === "verborgen" && (
              <button type="button" className="dc-mini-knop" title="Weer tonen op dit diagram" onClick={() => onToon?.(r.id)}>
                toon
              </button>
            )}
            <button type="button" className="dc-mini-knop" title="Uit het hele model verwijderen" onClick={() => onVerwijder?.(r.id)}>
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
