// @ts-check
/**
 * scheidingen — groepsscheidingen in afgeleide taakbalken.
 *
 * De Maken- en Verbinding-balken worden afgeleid uit de elementtypen van het
 * DiagramType. Bij een groot profiel (ArchiMate: 24 knoppen) lopen de lagen
 * dan ongemerkt in elkaar over. Elementtypen kunnen daarom een
 * `taakbalkGroep` dragen; op elke groepsgrens komt een scheidingsteken
 * (het bestaande `{sep: true}`-actie-model van de Taskbar, zoals de
 * uitlijn-balk dat al gebruikt).
 *
 * Zonder groepen gebeurt er niets — bestaande profielen veranderen niet.
 */

/**
 * Voeg sep-acties toe op de grenzen tussen taakbalkgroepen.
 *
 * @template T
 * @param {T[]} acties - de al afgeleide taakbalk-acties, in descriptor-volgorde
 * @param {(index: number) => string|undefined} groepVan - groep van het
 *   elementtype achter actie i (bv. `(i) => types[i].taakbalkGroep`)
 * @returns {(T | {sep: true, id: string})[]}
 */
export function metGroepScheidingen(acties, groepVan) {
  const uit = [];
  for (let i = 0; i < acties.length; i++) {
    const vorige = i > 0 ? groepVan(i - 1) : undefined;
    const huidige = groepVan(i);
    // Alleen een streepje op een échte grens: nooit vooraan, en niet wanneer
    // geen van beide buren een groep heeft (ongegroepeerde profielen).
    if (i > 0 && huidige !== vorige && (huidige || vorige)) {
      uit.push({ sep: true, id: `sep-${i}` });
    }
    uit.push(acties[i]);
  }
  return uit;
}
