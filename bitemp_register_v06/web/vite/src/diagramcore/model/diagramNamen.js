/**
 * diagramNamen — de naam van een diagram waar een verwijzing naar wijst, live, voor de
 * diagramverwijzing op de plaat (superprofiel, 20-10). De motor kent de profielen niet; de host
 * (Studio) zet de bron: `stelDiagramNaamBronIn({ naam(verw), abonneer(cb) })`. Zonder bron
 * toont de vorm alleen de id.
 */
import { useSyncExternalStore } from "react";

/** @type {{naam: (verw: {profielId: string|null, diagramId: string}) => string|null, abonneer: (cb: () => void) => () => void}|null} */
let bron = null;

/** Zet de bron (eenmalig door de host). */
export function stelDiagramNaamBronIn(b) {
  bron = b;
}

const geen = () => () => {};

/**
 * Naam van het diagram (of null als het niet bestaat); hertekent als een diagram ergens
 * hernoemd of verwijderd wordt.
 * @param {{profielId: string|null, diagramId: string}|null} verw
 */
export function useDiagramNaam(verw) {
  const profielId = verw?.profielId || null;
  const diagramId = verw?.diagramId || null;
  return useSyncExternalStore(
    bron?.abonneer || geen,
    () => (diagramId && bron ? bron.naam({ profielId, diagramId }) : null),
    () => null
  );
}

/** Naam van het doeldiagram buiten React (lijsten, boom); null zonder bron of als het weg is. */
export function diagramNaamVan(verw) {
  return verw?.diagramId && bron ? bron.naam(verw) : null;
}

/** Is er een bron (anders weet de vorm niet of het diagram bestaat)? */
export function heeftDiagramNaamBron() {
  return !!bron;
}
