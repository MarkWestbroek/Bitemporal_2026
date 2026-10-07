/**
 * velden — pure hulpfuncties op de compartimenten/velden van een element
 * (attributen, operaties, enum-waarden, …): herordenen.
 *
 * Gebruikt door de inspector (knopjes ↑/↓ en Ctrl+↑/↓ op een veldregel) en
 * door de canvas (Ctrl+↑/↓ in het inline-veld van een attribuut). Eén
 * updateElement(…, { compartimenten }) = één undo-stap.
 */

/**
 * Verplaats veld `index` van compartiment `compartmentType` één plek omhoog
 * of omlaag. Geeft de nieuwe compartimenten-lijst + de nieuwe index terug, of
 * `null` als er niets te verschuiven valt (rand van de lijst, onbekend veld).
 *
 * @param {Object} element
 * @param {string} compartmentType
 * @param {number} index
 * @param {"omhoog"|"omlaag"} richting
 * @returns {{compartimenten: Object[], nieuweIndex: number}|null}
 */
export function schuifVeld(element, compartmentType, index, richting) {
  const compartimenten = element?.compartimenten || [];
  const ci = compartimenten.findIndex((c) => c.compartmentType === compartmentType);
  if (ci < 0) return null;
  const velden = compartimenten[ci].velden || [];
  const doel = index + (richting === "omhoog" ? -1 : 1);
  if (index < 0 || index >= velden.length || doel < 0 || doel >= velden.length) return null;
  const nieuw = velden.slice();
  [nieuw[index], nieuw[doel]] = [nieuw[doel], nieuw[index]];
  const volgende = compartimenten.map((c, i) => (i === ci ? { ...c, velden: nieuw } : c));
  return { compartimenten: volgende, nieuweIndex: doel };
}
