// @ts-check
/**
 * opname — deel-voorkomens die ín hun geheel getoond worden (ontwerpprincipe
 * "gedaanten van een samenstel", derde vorm naast ASOC en samentrekking).
 *
 * Een ElementType kan verklaren dat het als *deel* in zijn geheel opgenomen
 * mag worden:
 *
 *     opname: {
 *       gedaante: "ingebed",          // waarde van DiagramNode.gedaante
 *       relatieTypes: ["compositie"], // geheel ◆── deel (deel = doel)
 *       compartiment: "gegevenselementen", // CompartmentType-id op het geheel
 *       labelIngebed, labelLos,       // contextmenu-teksten
 *     }
 *
 * Staat een voorkomen van het deel op `gedaante === opname.gedaante`, en staat
 * het geheel (bron van zo'n relatie) ook op dit diagram, dan:
 *
 *   - rendert het deel-voorkomen níet als eigen node (positie en maat blijven
 *     bewaard voor als het weer losgemaakt wordt);
 *   - vervalt de relatielijn geheel→deel — de nesting zegt het al;
 *   - hangen andere lijnen van het deel (bv. «use») aan het geheel;
 *   - toont het geheel het deel als sub-vak in `opname.compartiment`.
 *
 * Het is een keuze per voorkomen, dus per diagram — niet automatisch. Staat
 * het geheel níet op het diagram, dan valt het deel terug op zijn gewone
 * gedaante: een ingebed deel mag nooit onzichtbaar worden.
 *
 * Puur en store-loos: testbaar met kale objecten.
 */
import { voorkomenId, voorkomensPerElement } from "../model/voorkomens.js";

/** Standaard compartiment-id als het profiel er geen noemt. */
export const OPNAME_COMPARTIMENT = "__opname";

/**
 * @typedef {Object} Opnames
 * @property {Set<string>} ingebedVoorkomens  voorkomen-ids die niet als node renderen
 * @property {Map<string, string>} geheelVan  deel-element-id → geheel-element-id
 * @property {Map<string, Array<{deel: Object, connector: Object}>>} delenVan
 *   geheel-element-id → opgenomen delen (in element-volgorde)
 * @property {Set<string>} opnameConnectoren  relatie-ids die niet getekend worden
 */

/**
 * @param {Record<string, Object>} elements
 * @param {Object} diagram
 * @param {Record<string, Object>} elementTypesById
 * @returns {Opnames}
 */
export function bepaalOpnames(elements, diagram, elementTypesById) {
  /** @type {Opnames} */
  const resultaat = {
    ingebedVoorkomens: new Set(),
    geheelVan: new Map(),
    delenVan: new Map(),
    opnameConnectoren: new Set(),
  };
  const nodes = diagram?.nodes || [];
  if (!nodes.some((n) => n?.gedaante)) return resultaat;
  const refs = voorkomensPerElement(nodes);

  for (const conn of Object.values(elements || {})) {
    if (!conn?.source || !conn?.target || !elementTypesById[conn.elementType]?.isConnector) continue;
    const deel = elements[conn.target];
    const opname = elementTypesById[deel?.elementType]?.opname;
    if (!opname || !(opname.relatieTypes || []).includes(conn.elementType)) continue;
    if (conn.source === conn.target || !refs.has(conn.source)) continue;
    // Eén geheel per deel (compositie): de eerste passende relatie wint.
    const bestaand = resultaat.geheelVan.get(deel.id);
    if (bestaand && bestaand !== conn.source) continue;

    const ingebed = (refs.get(deel.id) || []).filter((r) => r.gedaante === opname.gedaante);
    if (!ingebed.length) continue;
    for (const r of ingebed) resultaat.ingebedVoorkomens.add(voorkomenId(r));
    resultaat.opnameConnectoren.add(conn.id);
    if (bestaand) continue;
    resultaat.geheelVan.set(deel.id, conn.source);
    const lijst = resultaat.delenVan.get(conn.source) || [];
    lijst.push({ deel, connector: conn });
    resultaat.delenVan.set(conn.source, lijst);
  }
  return resultaat;
}

/**
 * Het sub-vak-compartiment voor een geheel: één veld per opgenomen deel, met
 * `fieldType` van het profiel (viewer "sub-vak") en de inhoud van het deel als
 * geneste compartimenten. De kopregel draagt de naam van het deel plus de
 * deel-zijde-labels van de relatie (rolnaam, kardinaliteit, constraint) uit
 * de edgeLabels-hook — dezelfde tekst die anders bij de lijn stond.
 *
 * @param {Object} geheel
 * @param {Array<{deel: Object, connector: Object}>} delen
 * @param {Record<string, Object>} elementTypesById
 * @returns {Object|null}  compartiment `{compartmentType, velden}` of null
 */
export function opnameCompartiment(geheel, delen, elementTypesById) {
  if (!delen?.length) return null;
  const geheelType = elementTypesById[geheel?.elementType];
  const eersteOpname = elementTypesById[delen[0].deel.elementType]?.opname || {};
  const compartmentType = eersteOpname.compartiment || OPNAME_COMPARTIMENT;
  const ct = (geheelType?.compartments || []).find((c) => c.id === compartmentType);

  const velden = delen.map(({ deel, connector }) => {
    const deelType = elementTypesById[deel.elementType];
    const connType = elementTypesById[connector.elementType];
    const labels = connType?.hooks?.edgeLabels?.(connector) || {};
    const deelLabels = labels.doel?.length
      ? labels.doel
      : (labels.kaal || []).filter((l) => l.zijde === "doel");
    // Heen/terug-leesrichtingen horen bij de lijn, niet bij de kopregel.
    const kop = deelLabels
      .flatMap((l) => l.delen || [])
      .filter((d) => d.soort !== "naam" && d.tekst);

    // Compartimenten van het deel in descriptor-volgorde (zoals op de node).
    const orde = new Map((deelType?.compartments || []).map((c, i) => [c.id, i]));
    const compartimenten = (deel.compartimenten || [])
      .map((c, i) => ({ c, sleutel: orde.get(c.compartmentType) ?? 1000 + i }))
      .sort((a, b) => a.sleutel - b.sleutel)
      .map((x) => x.c)
      .filter((c) => (c.velden || []).length > 0);

    return {
      naam: deel.naam || "(naamloos)",
      fieldType: ct?.fieldType || null,
      data: {
        elementId: deel.id,
        kop,
        materieel: !!deel.data?.materieel,
        compartimenten,
      },
    };
  });
  return { compartmentType, velden };
}
