/**
 * GebruikPaneel — op welke diagrammen het geselecteerde element staat (melding #5 van Hugo,
 * 16-10-2026). Klik op een diagram opent het. Staat het element nergens, dan zegt het paneel dat
 * het veilig weg kan zonder een diagram te veranderen.
 *
 * Sinds 07-11 ook diagrammen van andere talen waar het element als verwijzing staat
 * (model/vreemd.js): die tonen hun taal erachter.
 *
 * Puur presentatie: de activiteit levert `gebruik` (zie model/gebruik.js) en `onOpen(id, d)`.
 * `isActief(d)` of (oud) `actiefDiagramId` markeert het open diagram.
 */
import React from "react";

export default function GebruikPaneel({ gebruik = [], actiefDiagramId = null, isActief = null, onOpen }) {
  const actief = (d) => (isActief ? isActief(d) : d.id === actiefDiagramId);
  return (
    <div className="dc-inspector-sectie dc-gebruik" data-testid="gebruik-paneel">
      <div className="dc-inspector-sectie-titel">Gebruikt op {gebruik.length ? `(${gebruik.length})` : ""}</div>
      {gebruik.length === 0 ? (
        <p className="dc-gebruik-leeg">Op geen enkel diagram — weghalen verandert geen diagram.</p>
      ) : (
        gebruik.map((d) => (
          <button
            key={`${d.profielId || ""}:${d.id}`}
            type="button"
            className={"dc-gebruik-diagram" + (actief(d) ? " is-actief" : "")}
            title={actief(d) ? "Dit diagram (open)" : "Open dit diagram"}
            onClick={() => onOpen?.(d.id, d)}
          >
            {d.naam}
            {d.aantal > 1 ? <span className="dc-gebruik-aantal"> ×{d.aantal}</span> : null}
            {d.taal ? <span className="dc-gebruik-taal"> — {d.taal}</span> : null}
          </button>
        ))
      )}
    </div>
  );
}
