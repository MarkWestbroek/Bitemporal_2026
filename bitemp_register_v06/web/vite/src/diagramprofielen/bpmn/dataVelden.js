// @ts-check
/**
 * De velden van data-object, data store en data-associatie in het BPMN-profiel (15-11, Mark;
 * ontwerp Simulatie §11.8). Los van index.js, zodat ze zonder JSX te testen zijn.
 *
 * - type: een verwijzing naar een element in een taal die gegevens draagt (M3-aard "gegevens":
 *   cm-entiteit, UML-klasse, MIM-objecttype, ERD-entiteit). In BPMN-XML: itemSubjectRef. De
 *   simulatie koppelt zo een data-object aan het object van dat type. Waarde: {profielId, elementId}.
 * - rol: Data Input / Data Output (BPMN ioSpecification), de parameters van het proces; een open
 *   of dicht pijltje in het dokje. Leeg = intern in het proces.
 * - toestand: BPMN dataState, onder de naam als "Aanvraag [ingediend]".
 * - richting op de data-associatie: BPMN kent alleen in- en uitvoerassociaties; "lezen en
 *   schrijven" is één lijn met twee pijlen, en de export maakt er twee associaties van.
 */

export const DATA_TYPE_VELD = { key: "type", label: "type (gegevens)", datatype: "element-verwijzing", aard: "gegevens" };

export const DATA_ROL_VELD = {
  key: "rol",
  label: "rol in het proces",
  datatype: "keuze",
  opties: [
    { waarde: "", label: "intern" },
    { waarde: "invoer", label: "invoer (Data Input)" },
    { waarde: "uitvoer", label: "uitvoer (Data Output)" },
  ],
};

export const DATA_TOESTAND_VELD = { key: "toestand", label: "toestand (dataState)", datatype: "string", placeholder: "bv. ingediend" };

export const DATA_RICHTING_VELD = {
  key: "richting",
  label: "richting",
  datatype: "keuze",
  opties: [
    { waarde: "", label: "volgt de lijn (object → taak = lezen)" },
    { waarde: "beide", label: "lezen en schrijven" },
  ],
};

/** De weergavenaam met de toestand erachter; zonder toestand de gewone naam (undefined). */
export function naamMetToestand(el) {
  const t = String(el?.data?.toestand || "").trim();
  return t ? `${el.naam || ""} [${t}]` : undefined;
}

/** Lezen en schrijven: ook een pijl aan het begin van de lijn. */
export function dataAssociatiePresentatie(conn) {
  return conn?.data?.richting === "beide" ? { markerStart: "pijl-open" } : {};
}
