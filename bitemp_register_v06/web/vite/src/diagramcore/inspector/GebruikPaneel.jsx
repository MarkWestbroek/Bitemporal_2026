/**
 * GebruikPaneel — op welke diagrammen het geselecteerde element staat (melding #5 van Hugo,
 * 16-10-2026). Klik op een diagram opent het. Staat het element nergens, dan zegt het paneel dat
 * het veilig weg kan zonder een diagram te veranderen.
 *
 * Puur presentatie: de activiteit levert `gebruik` (zie model/gebruik.js) en `onOpen`.
 */
import React from "react";

export default function GebruikPaneel({ gebruik = [], actiefDiagramId = null, onOpen }) {
  return (
    <div className="dc-inspector-sectie dc-gebruik" data-testid="gebruik-paneel">
      <div className="dc-inspector-sectie-titel">Gebruikt op {gebruik.length ? `(${gebruik.length})` : ""}</div>
      {gebruik.length === 0 ? (
        <p className="dc-gebruik-leeg">Op geen enkel diagram — weghalen verandert geen diagram.</p>
      ) : (
        gebruik.map((d) => (
          <button
            key={d.id}
            type="button"
            className={"dc-gebruik-diagram" + (d.id === actiefDiagramId ? " is-actief" : "")}
            title={d.id === actiefDiagramId ? "Dit diagram (open)" : "Open dit diagram"}
            onClick={() => onOpen?.(d.id)}
          >
            {d.naam}
            {d.aantal > 1 ? <span className="dc-gebruik-aantal"> ×{d.aantal}</span> : null}
          </button>
        ))
      )}
    </div>
  );
}
