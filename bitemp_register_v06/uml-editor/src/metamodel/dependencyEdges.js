/**
 * Helpers voor dependency-edges («use») in de UML-editor.
 *
 * Een type kan afhankelijk zijn van:
 * - een enumeratie (`enumNaam`)
 * - een gegevenstype / datatype (`datatypeNaam` of legacy `goType`)
 * - een referentielijst-item (`refItemNaam`)
 *
 * Deze functie houdt de target-selectie puur en testbaar, zodat use-lijntjes
 * niet onverwacht verdwijnen bij gewone node-edits.
 */
export function bepaalDependencyTargetIds(nodeData, beschikbareNodes = []) {
  const velden = Array.isArray(nodeData?.velden) ? nodeData.velden : [];
  const nodes = Array.isArray(beschikbareNodes) ? beschikbareNodes : [];

  const vindEnumNodeId = (enumNaam) => {
    if (!enumNaam) return null;
    return nodes.find((n) => n.type === "enumeratie" && n.data?.naam === enumNaam)?.id || null;
  };

  const vindDatatypeNodeId = (datatypeNaam, goType) => {
    const gezochteNaam = datatypeNaam || goType || null;
    if (!gezochteNaam) return null;
    return nodes.find((n) => n.type === "gegevenstype" && n.data?.naam === gezochteNaam)?.id || null;
  };

  const vindRefItemNodeId = (refItemNaam) => {
    if (!refItemNaam) return null;
    return (
      nodes.find(
        (n) =>
          n.type === "entiteit" &&
          n.data?.entiteitSubtype === "referentielijst_item" &&
          n.data?.typenaam === refItemNaam
      )?.id || null
    );
  };

  const vindReferentielijstInstantieNodeId = (systeemnaam) => {
    if (!systeemnaam) return null;
    return (
      nodes.find(
        (n) => n.type === "referentielijstInstantie" && n.data?.systeemnaam === systeemnaam
      )?.id || null
    );
  };

  return [...new Set(
    [
      ...velden.flatMap((veld) => [
        vindEnumNodeId(veld?.enumNaam || veld?.enum || null),
        vindDatatypeNodeId(veld?.datatypeNaam || null, veld?.goType || null),
        vindRefItemNodeId(veld?.refItemNaam || veld?.["$ref"] || null),
      ]),
      vindReferentielijstInstantieNodeId(nodeData?.referentielijstInstantie || null),
    ].filter(Boolean)
  )];
}
