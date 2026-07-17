/**
 * externDrop — het MIME-type voor een cross-profiel element-referentie
 * ({profielId, elementId}) in drag-and-drop. Gezet door de elementen-/
 * projectbrowser, gelezen door DiagramCanvas (onExternDrop → bv. een
 * levenslijn typeren met instantie-van).
 *
 * Eigen mini-module (niet in DiagramCanvas.jsx): de canvas is lazy-geladen
 * en de browsers hebben de constante eager nodig.
 */
export const ELEMENT_REF_MIME = "application/studio05-element-ref";
