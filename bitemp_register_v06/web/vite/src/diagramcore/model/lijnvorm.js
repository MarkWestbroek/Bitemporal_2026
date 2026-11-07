// @ts-check
/**
 * lijnvorm — de lijndata die een lijnbewerking op een diagram zet (`diagram.lijnen[connector]`,
 * via createDiagramStore.zetLijnen). Gedeeld door het rechtsklikmenu van het canvas en de
 * assistent/MCP (`lijnen` in het plan; Mark 07-11: "kan de MCP ook lijntypes wijzigen?").
 *
 *  - vorm: bezier (krom), hoekig, recht, boom; een nieuwe vorm wist de knikken (die winnen anders).
 *  - boomstijl (EA "tree style"): haakse vorm, uiteinden vast aan de kant van ouder en kind.
 *    Bij een verbinding die van kind naar ouder wijst (generalisatie, specialisatie;
 *    types/layoutStijl.wijstNaarOuder) is het doel de ouder: handles gespiegeld en
 *    `boomOuder: "doel"`, zodat de lat bij de ouder ligt (zwevendeRand.boomPunten).
 *  - uiteinden vastzetten: een zijde of `null` (automatisch).
 */

/** De lijnvormen, met hun Nederlandse naam. */
export const LIJNVORMEN = Object.freeze({ bezier: "krom", hoekig: "hoekig", recht: "recht", boom: "boom" });

/** Kanten in het Nederlands → handle-zijde. */
export const ZIJDE = Object.freeze({ boven: "top", onder: "bottom", links: "left", rechts: "right" });

/** Per kant waar de ouder staat t.o.v. het kind: [zijde van de ouder, zijde van het kind]. */
const BOOM_ZIJDEN = {
  boven: ["bottom", "top"],
  onder: ["top", "bottom"],
  links: ["right", "left"],
  rechts: ["left", "right"],
};
export const BOOM_KANTEN = Object.freeze(Object.keys(BOOM_ZIJDEN));

/**
 * Lijndata voor de boomstijl.
 * @param {string} kant - waar de ouder staat t.o.v. het kind (boven, onder, links, rechts)
 * @param {boolean} [ouderAanDoel] - de verbinding wijst van kind naar ouder (generalisatie)
 */
export function boomLijn(kant, ouderAanDoel = false) {
  const [ouder, kind] = BOOM_ZIJDEN[kant] || BOOM_ZIJDEN.boven;
  // null (niet undefined) wist een oude vlag; null overleeft ook JSON in de sync-ops.
  return ouderAanDoel
    ? { vorm: "boom", knikken: [], sourceHandle: `source-${kind}`, targetHandle: `target-${ouder}`, boomOuder: "doel" }
    : { vorm: "boom", knikken: [], sourceHandle: `source-${ouder}`, targetHandle: `target-${kind}`, boomOuder: null };
}

/**
 * De verbindingen waarvan `ouderId` de ouder is: de bron, of het doel bij een verbinding die van
 * kind naar ouder wijst. Zelf-lussen tellen niet mee (die hebben hun eigen vorm).
 * @param {Record<string, any>} elements
 * @param {string} ouderId
 * @param {(elementType: string) => boolean} isConnector
 * @param {(elementType: string) => boolean} wijstNaarOuder
 */
export function boomKinderen(elements, ouderId, isConnector, wijstNaarOuder) {
  return Object.values(elements || {}).filter(
    (c) => c?.source && c?.target && c.source !== c.target && isConnector(c.elementType) && (wijstNaarOuder(c.elementType) ? c.target === ouderId : c.source === ouderId)
  );
}
