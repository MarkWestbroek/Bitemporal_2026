// @ts-check
/**
 * diagramcore/model/schema — typedefs voor het Model-domein (instantie-kant).
 *
 * Dit bestand bevat uitsluitend JSDoc-typedefs: het type-contract voor de data
 * die de gebruiker maakt. Zie docs/STUDIO-05-diagramcore-plan.md §2 voor het
 * metamodel en §4 voor de architectuur. De vorm volgt bewust de bewezen
 * structuur van store/useModelStore.js, veralgemeniseerd.
 */

/** @typedef {{ x: number, y: number }} Coordinaten */

/** @typedef {{ width: number, height: number }} Afmeting */

/**
 * Positie — associatieklasse op Diagram–Element (metamodel §2).
 * Elementpositie en -grootte leven per *diagram-lidmaatschap*, niet op het
 * element zelf, zodat één element op meerdere diagrammen kan staan.
 * Bij connector-uiteinden dragen de handles de aanhechting.
 *
 * @typedef {Object} Positie
 * @property {Coordinaten} [elementPositie]
 * @property {Afmeting}    [elementSize]
 * @property {string|null} [sourceHandle] - alleen bij connectoren
 * @property {string|null} [targetHandle] - alleen bij connectoren
 */

/**
 * Veld (Field) — één regel in een compartiment.
 * De betekenis en weergave komen uit het FieldType (types/schema.js).
 *
 * @typedef {Object} Veld
 * @property {string} naam
 * @property {string} fieldType          - id van het FieldType
 * @property {Record<string, any>} [data] - typespecifieke waarden (bv. type/format/verplicht)
 */

/**
 * Compartiment (Compartment) — geordende sectie binnen een element.
 * Een element heeft er maximaal 9 ({ordered}, metamodel §2).
 *
 * @typedef {Object} Compartiment
 * @property {string} compartmentType    - id van het CompartmentType
 * @property {Veld[]} velden             - volgorde is betekenisvol ({ordered})
 */

/**
 * Element — de kern van het model. Eén element kan op meerdere diagrammen
 * staan; posities leven in het diagram-lidmaatschap (DiagramNode).
 *
 * Een connector is een element waarvan het ElementType `isConnector` heeft:
 * dan zijn `source` en `target` gevuld.
 *
 * @typedef {Object} Element
 * @property {string} id
 * @property {string} naam
 * @property {string} elementType        - id van het ElementType binnen het DiagramType
 * @property {Compartiment[]} [compartimenten] - max 9, {ordered}
 * @property {string} [source]           - alleen connectoren: element-id
 * @property {string} [target]           - alleen connectoren: element-id
 * @property {Record<string, any>} [data] - vrijveld (o.a. plek voor toekomstige tags)
 */

/**
 * DiagramNode — lidmaatschap van een element op een diagram, mét Positie.
 *
 * @typedef {Object} DiagramNode
 * @property {string} elementId
 * @property {Coordinaten} position
 * @property {Afmeting} [size]
 * @property {boolean} [layoutLocked]    - per-diagram: vastgezet voor auto-layout
 */

/**
 * DiagramEdge — puur visuele edge (routing/handles), afgeleid van een
 * connector-element. Geen eigen waarheid: bij herberekening opnieuw
 * gematerialiseerd (canvas/materialiseerConnectoren.js, fase 3).
 *
 * @typedef {Object} DiagramEdge
 * @property {string} id
 * @property {string} source
 * @property {string} target
 * @property {string|null} [sourceHandle]
 * @property {string|null} [targetHandle]
 * @property {boolean} [hidden]
 * @property {Record<string, any>} [data]
 */

/**
 * Diagram — een benoemde weergave over (een deel van) de elementen.
 * `viewport` dekt de metamodel-attributen size/scale ({x, y, zoom}).
 *
 * @typedef {Object} Diagram
 * @property {string} id
 * @property {string} naam
 * @property {string} diagramType        - id van het DiagramType
 * @property {DiagramNode[]} nodes
 * @property {DiagramEdge[]} edges
 * @property {{x: number, y: number, zoom: number}} [viewport]
 */

// Dit bestand exporteert alleen types (JSDoc); geen runtime-code.
export {};
