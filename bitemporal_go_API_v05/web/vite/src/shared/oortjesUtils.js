/**
 * Gedeelde hulpfuncties voor materiële-tijd "oortjes" (tab-vormige SVG-badges).
 * Gebruikt door zowel IndexRepresentatieVisual als TijdlijnRepresentatiePaneel.
 */

/**
 * Formatteert een datum-string naar NL-formaat met vol jaar: d-m-jjjj (bijv. "1-1-2020", "31-12-1979").
 */
export function korteDatumWeergave(datumStr) {
  if (!datumStr) return null;
  try {
    const d = new Date(datumStr);
    if (isNaN(d.getTime())) return null;
    const dag = d.getDate();
    const maand = d.getMonth() + 1;
    const jaar = d.getFullYear();
    return `${dag}-${maand}-${jaar}`;
  } catch {
    return null;
  }
}

/**
 * SVG-pad voor een oortje-tab: afgeronde bovenkant, open onderkant.
 * Door het pad vóór de entity rect te tekenen bedekt die de onderrand automatisch (kaartlip-effect).
 */
export function oortjePad(x, y, w, h, r = 7) {
  return `M ${x},${y + h} L ${x},${y + r} Q ${x},${y} ${x + r},${y} L ${x + w - r},${y} Q ${x + w},${y} ${x + w},${y + r} L ${x + w},${y + h}`;
}

/** Stijl voor de materiële-tijd oortjes: handschrift-achtig lettertype voor visueel onderscheid. */
export const oortjeStyle = { fontSize: "11px", fontFamily: "'Caveat', cursive", fill: "#334155", fontWeight: 700 };

/** Compactere stijl voor oortjes in de tijdlijn (smaller font). */
export const oortjeStyleNarrow = {
  fontSize: "11.6px",
  fontFamily: "'Arial Narrow', 'Roboto Condensed', 'Bahnschrift Condensed', 'Caveat', cursive",
  fill: "#334155",
  fontWeight: 700,
  letterSpacing: "-0.1px",
};

/**
 * Zoek de actieve (niet-afgevoerde) aanvang en einde items uit childGroups.
 * Werkt voor zowel IndexSchemaPage als TijdlijnSchemaPage.
 */
export function bepaalOortjesUitChildGroups(childGroups, typeMetaByTypenaam) {
  const aanvangGroep = childGroups.find((g) => g.doeltype?.endsWith("_Aanvang") && typeMetaByTypenaam[g.doeltype]?.bovenliggendTypenaam);
  const eindeGroep = childGroups.find((g) => g.doeltype?.endsWith("_Einde") && typeMetaByTypenaam[g.doeltype]?.bovenliggendTypenaam);
  const actiefItem = (items) => (items || []).find((item) => !item.afvoer) || null;
  const aanvangItem = actiefItem(aanvangGroep?.items);
  const eindeItem = actiefItem(eindeGroep?.items);
  return {
    aanvang: aanvangItem ? { item: aanvangItem, group: aanvangGroep, datum: aanvangItem.datum } : null,
    einde: eindeItem ? { item: eindeItem, group: eindeGroep, datum: eindeItem.datum } : null,
  };
}
