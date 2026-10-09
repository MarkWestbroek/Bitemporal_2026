/**
 * shapeSet — een shape-set ("gedaante", P07) toepassen op elementtypen. Pure
 * functies, gedeeld door de canvas (DiagramCanvas) en de documenttekenaar
 * (transformatie/sjabloon/schets): zelfde Definitie, andere gedaante.
 *
 * Een skin per elementtype: node-typen `{shape, icoon, kleur, achtergrond}`,
 * connectortypen `{lijn, vorm, markerStart, markerEnd, kleur}` (overschrijft
 * de edgePresentatie). Een kale string telt als alleen-shape.
 *
 * Welke set een diagram gebruikt: `diagram.shapeSetId` (per diagram bewaard,
 * dus ook in documenten), anders de voorkeur van de gebruiker; "" = standaard.
 * Sets komen uit de descriptor (`shapeSets`) en het diagram zelf
 * (`diagram.shapeSets`, eigen gedaanten uit het shape-set-paneel).
 */

/** Eén elementtype met een skin erover. */
export function skinElementType(et, waarde) {
  if (!et || !waarde) return et;
  const skin = typeof waarde === "string" ? { shape: waarde } : waarde;
  if (et.isConnector) {
    return {
      ...et,
      edgePresentatie: {
        ...(et.edgePresentatie || {}),
        ...(skin.lijn ? { lijn: skin.lijn } : {}),
        ...(skin.vorm ? { vorm: skin.vorm } : {}),
        ...("markerStart" in skin ? { markerStart: skin.markerStart || null } : {}),
        ...("markerEnd" in skin ? { markerEnd: skin.markerEnd || null } : {}),
        ...(skin.kleur ? { kleur: skin.kleur } : {}),
      },
    };
  }
  return {
    ...et,
    ...(skin.shape ? { shape: skin.shape } : {}),
    ...(skin.icoon ? { icoon: skin.icoon } : {}),
    ...(skin.kleur ? { kleur: skin.kleur } : {}),
    ...("achtergrond" in skin ? { achtergrond: !!skin.achtergrond } : {}),
  };
}

/** De shapes-mapping van set `setId` (descriptor- of diagram-sets), of null. */
export function vindShapeSet(descriptor, setId, diagram = null) {
  if (!setId) return null;
  const sets = [...(descriptor?.shapeSets || []), ...(diagram?.shapeSets || [])];
  return sets.find((s) => s.id === setId)?.shapes || null;
}

/** Descriptor met de skins van een set toegepast (voor de documenttekenaar). */
export function descriptorMetShapeSet(descriptor, shapes) {
  if (!descriptor || !shapes) return descriptor;
  return {
    ...descriptor,
    elementTypes: (descriptor.elementTypes || []).map((et) => skinElementType(et, shapes[et.id])),
  };
}
