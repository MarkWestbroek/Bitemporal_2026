// @ts-check
/**
 * omhangen — een element in een container hangen of eruit halen (M3 `ElementType.containerVoor`).
 *
 * Was een functie in de diagram-activiteit (canvas, elementen-browser); sinds 06-11 (fase 0 van
 * het plan "Linked data als M2", §8) gebruikt ook de projectboom hem: een element onder een
 * ander element slepen of aanmaken legt de echte lidmaatschapsrelatie. Puur op de store-api
 * (`getState()` met `elements`, `addElement`, `deleteElement`), zodat canvas, boom en tests
 * dezelfde regels volgen.
 *
 * Regels:
 *   - alleen échte lidmaatschapslijnen tellen (vanuit een type met dit connectortype in zijn
 *     `containerVoor`); een gewone relatie blijft staan (Mark, 22-10);
 *   - de verbindingsregels van het connectortype gelden (geen notitie in een package);
 *   - geen kring: de container mag niet (indirect) in het element zitten;
 *   - hooguit één container: een bestaand lidmaatschap verhuist (besluit Mark 04-11: één ouder).
 */
import { lidConnectoren, isLidConnector } from "../types/containerVoor.js";
import { verbindingsregelsVan } from "../types/typeRegistry.js";

let _teller = 0;

/**
 * Het connectortype waarmee `container` het element `el` mag bevatten, of null.
 * @param {Record<string, any>} elementTypesById
 * @param {any} container
 * @param {any} el
 */
export function lidConnectorVoor(elementTypesById, container, el) {
  if (!container || !el) return null;
  return (
    lidConnectoren(elementTypesById[container.elementType])
      .map((id) => elementTypesById[id])
      .find((c) => c && verbindingsregelsVan(c).some((r) => r.bron.includes(container.elementType) && r.doel.includes(el.elementType))) || null
  );
}

/**
 * De lidmaatschapsconnectoren die `elementId` nu in een container houden.
 * @param {Record<string, any>} elements
 * @param {Record<string, any>} elementTypesById
 * @param {string} elementId
 */
export function lidmaatschappenVan(elements, elementTypesById, elementId) {
  return Object.values(elements).filter(
    (c) => c?.source && c?.target === elementId && isLidConnector(elementTypesById[elements[c.source]?.elementType], c.elementType)
  );
}

/**
 * Waarom `elementId` niet in `containerId` kan, of null als het kan.
 * @param {Record<string, any>} elements
 * @param {Record<string, any>} elementTypesById
 * @param {string} elementId
 * @param {string} containerId
 * @returns {null|"onbekend"|"zichzelf"|"geen-container"|"kring"}
 */
export function waaromNietInContainer(elements, elementTypesById, elementId, containerId) {
  const el = elements[elementId];
  const container = elements[containerId];
  if (!el || !container) return "onbekend";
  if (elementId === containerId) return "zichzelf";
  if (!lidConnectorVoor(elementTypesById, container, el)) return "geen-container";
  let cursor = containerId;
  for (let i = 0; i < 50 && cursor; i += 1) {
    if (cursor === elementId) return "kring";
    cursor = lidmaatschappenVan(elements, elementTypesById, cursor)[0]?.source || null;
  }
  return null;
}

/**
 * Hang een element in een container, of maak het los (containerId = null).
 * @param {{getState: () => any}} store - profielstore (elements, addElement, deleteElement)
 * @param {Record<string, any>} elementTypesById
 * @param {string} elementId
 * @param {string|null} containerId
 * @returns {{ok: boolean, reden?: string|null, connectorId?: string}}
 */
export function hangOmNaarContainer(store, elementTypesById, elementId, containerId) {
  const s = store.getState();
  const el = s.elements[elementId];
  if (!el) return { ok: false, reden: "onbekend" };
  const bestaande = lidmaatschappenVan(s.elements, elementTypesById, elementId);
  if (!containerId) {
    for (const c of bestaande) s.deleteElement(c.id);
    return { ok: true };
  }
  const reden = waaromNietInContainer(s.elements, elementTypesById, elementId, containerId);
  if (reden) return { ok: false, reden };
  if (bestaande.some((c) => c.source === containerId)) return { ok: true }; // zit er al in
  const ct = lidConnectorVoor(elementTypesById, s.elements[containerId], el);
  for (const c of bestaande) s.deleteElement(c.id);
  _teller += 1;
  const connectorId = `bev_${Date.now()}_${_teller}`;
  s.addElement({ id: connectorId, naam: "", elementType: ct.id, source: containerId, target: elementId, compartimenten: [], data: {} });
  return { ok: true, connectorId };
}

// ── Onder een ouder in de boom (06-11, Mark: "In Entiteit kan dan toch ook een nieuw GE?") ──
// De boom kent twee soorten "erin": een lidmaatschap (`containerVoor`, bv. package ∋ type) en een
// hiërarchie-relatie met M3-aard **insluiting** (compositie, aggregatie, bevat; bv. ENT ◆ GE in
// het canonieke model). Beide zijn exclusief: een deel hoort bij één geheel, dus omhangen
// verhuist de relatie. Een hiërarchie zonder die aard (OAS `ref`, GraphQL `veldtype`) is een
// graaf en doet hier niet mee: daar zou omhangen andere verwijzingen weghalen.

/** Connectortypen van de hiërarchie die van ouder naar kind wijzen (zonder `omgekeerd`). */
function hierarchieTypen(hierarchie) {
  return new Set([].concat(hierarchie || []).map((h) => (typeof h === "string" ? { type: h } : h)).filter((h) => h?.type && !h.omgekeerd).map((h) => h.type));
}

/**
 * Het connectortype waarmee `ouder` een element van `kindTypeId` in de boom onder zich krijgt, of
 * null. Eerst een lidmaatschap dat ook hiërarchie is, dan een hiërarchie-connector met aard
 * "insluiting" waarvan de verbindingsregels ouder → kind toestaan.
 * @param {Record<string, any>} elementTypesById
 * @param {any} hierarchie - DiagramType.hierarchie
 * @param {any} ouder - element
 * @param {string} kindTypeId
 */
export function boomRelatieVoor(elementTypesById, hierarchie, ouder, kindTypeId) {
  if (!ouder || !kindTypeId) return null;
  const hier = hierarchieTypen(hierarchie);
  const lid = lidConnectorVoor(elementTypesById, ouder, { elementType: kindTypeId });
  if (lid && hier.has(lid.id)) return lid;
  for (const id of hier) {
    const ct = elementTypesById[id];
    if (ct?.isConnector && ct.aard === "insluiting" && verbindingsregelsVan(ct).some((r) => r.bron.includes(ouder.elementType) && r.doel.includes(kindTypeId))) return ct;
  }
  return null;
}

/** Is connector `c` een boomrelatie (lidmaatschap of insluitende hiërarchie) naar zijn doel? */
function isBoomRelatie(elements, elementTypesById, hier, c) {
  if (!c?.source || !c?.target) return false;
  if (isLidConnector(elementTypesById[elements[c.source]?.elementType], c.elementType)) return hier.has(c.elementType);
  const ct = elementTypesById[c.elementType];
  return hier.has(c.elementType) && ct?.aard === "insluiting";
}

/** De boomrelaties die `elementId` nu onder een ouder houden. */
export function boomRelatiesVan(elements, elementTypesById, hierarchie, elementId) {
  const hier = hierarchieTypen(hierarchie);
  return Object.values(elements).filter((c) => c?.target === elementId && isBoomRelatie(elements, elementTypesById, hier, c));
}

/**
 * Waarom `elementId` niet onder `ouderId` kan, of null.
 * @returns {null|"onbekend"|"zichzelf"|"geen-container"|"kring"}
 */
export function waaromNietOnder(elements, elementTypesById, hierarchie, elementId, ouderId) {
  const el = elements[elementId];
  const ouder = elements[ouderId];
  if (!el || !ouder) return "onbekend";
  if (elementId === ouderId) return "zichzelf";
  if (!boomRelatieVoor(elementTypesById, hierarchie, ouder, el.elementType)) return "geen-container";
  let cursor = ouderId;
  for (let i = 0; i < 50 && cursor; i += 1) {
    if (cursor === elementId) return "kring";
    cursor = boomRelatiesVan(elements, elementTypesById, hierarchie, cursor)[0]?.source || null;
  }
  return null;
}

/**
 * Hang een element onder een ouder in de boom (lidmaatschap of insluitende relatie), of maak
 * het los (ouderId = null). Exclusief: bestaande boomrelaties naar het element verhuizen.
 * @param {{getState: () => any}} store
 * @param {Record<string, any>} elementTypesById
 * @param {any} hierarchie - DiagramType.hierarchie
 * @param {string} elementId
 * @param {string|null} ouderId
 * @returns {{ok: boolean, reden?: string|null, connectorId?: string}}
 */
export function hangOmOnder(store, elementTypesById, hierarchie, elementId, ouderId) {
  const s = store.getState();
  if (!s.elements[elementId]) return { ok: false, reden: "onbekend" };
  const bestaande = boomRelatiesVan(s.elements, elementTypesById, hierarchie, elementId);
  if (!ouderId) {
    for (const c of bestaande) s.deleteElement(c.id);
    return { ok: true };
  }
  const reden = waaromNietOnder(s.elements, elementTypesById, hierarchie, elementId, ouderId);
  if (reden) return { ok: false, reden };
  const ct = boomRelatieVoor(elementTypesById, hierarchie, s.elements[ouderId], s.elements[elementId].elementType);
  if (bestaande.some((c) => c.source === ouderId && c.elementType === ct.id)) return { ok: true };
  for (const c of bestaande) s.deleteElement(c.id);
  _teller += 1;
  const connectorId = `${ct.id === "compositie" ? "comp" : "bev"}_${Date.now()}_${_teller}`;
  const conn = { id: connectorId, naam: "", elementType: ct.id, source: ouderId, target: elementId, compartimenten: [], data: {} };
  s.addElement(conn);
  // Dezelfde afmaak als bij tekenen op het canvas (M3-hook naVerbinden), bv. de standaard-
  // kardinaliteit 0..* van een GE-compositie (besluit Mark 06-11). Zonder diagram.
  ct.hooks?.naVerbinden?.(conn, { s: store.getState(), diagramId: null });
  return { ok: true, connectorId };
}

/** Leesbare tekst bij een reden (meldingen in boom en canvas). */
export const REDEN_NIET_OMHANGEN = {
  onbekend: "Dat element bestaat niet (meer).",
  zichzelf: "Een element kan niet in zichzelf.",
  "geen-container": "Dit element kan dat element niet bevatten.",
  kring: "Dat zou een kring maken: de container zit zelf al in dit element.",
};
