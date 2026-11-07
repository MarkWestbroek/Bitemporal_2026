/**
 * vreemdeSelectie — welk element uit een andere taal op welk diagram geselecteerd is
 * (diagramcore/model/vreemd.js; Mark 07-11).
 *
 * Selecteer je op een diagram van taal A een verwijzing naar een element van taal B, dan toont
 * de Modelleren-host het element in de inspector van B (LosElementInspector). Die inspector
 * weet zelf niet dat het om een verwijzing gaat. Deze kleine store vertelt het hem:
 *  - "Van diagram halen" haalt de verwijzing van het diagram van A (niet van een diagram van B);
 *  - "Verwijder uit model" staat uit: het element hoort bij B, hier staat alleen een verwijzing.
 *
 * Gezet door de canvas-activiteit van A bij selectie, gewist bij elke andere selectie.
 */
import { createContext } from "react";
import { create } from "zustand";

/**
 * true binnen de LosElementInspector van de Modelleren-host: de inspector toont een element van
 * een andere taal dan het actieve diagram. Alleen dán geldt de verwijzings-context; op een
 * diagram van de eigen taal is hetzelfde element gewoon een eigen element.
 */
export const LosGetoondContext = createContext(false);

/**
 * @typedef {{ profielId: string, elementId: string, canvasProfielId: string, diagramId: string,
 *   sleutel: string, haalVanDiagram: () => void } | null} VreemdeSelectie
 */

export const useVreemdeSelectie = create(() => ({ /** @type {VreemdeSelectie} */ selectie: null }));

/** @param {VreemdeSelectie} selectie */
export function zetVreemdeSelectie(selectie) {
  if (useVreemdeSelectie.getState().selectie !== selectie) useVreemdeSelectie.setState({ selectie });
}
