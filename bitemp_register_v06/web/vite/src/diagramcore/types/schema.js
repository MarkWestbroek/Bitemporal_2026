// @ts-check
/**
 * diagramcore/types/schema — typedefs voor het Definitie-domein.
 *
 * Kern-ontwerpkeuze (plan §4.2): descriptors zijn plain objects met een
 * JSON-serialiseerbare kern plus optionele functie-hooks. De hooks horen bij
 * het Implementatie-domein (ActionHook, ShapeType-componenten) en worden op
 * id gekoppeld; de serialiseerbare kern is de kandidaat voor het
 * configuratie-register (plan §8.5). Bewaak die scheiding: geen functies in
 * nieuwe declaratieve velden.
 */

/**
 * ActionType — declaratieve actie-definitie. De uitvoering (ActionHook) is
 * frontend-code, gekoppeld op `id`. Eén ActionType kan zowel in een menu als
 * op een taakbalk verschijnen (plan §4.6).
 *
 * @typedef {Object} ActionType
 * @property {string} id
 * @property {string} label
 * @property {string} [icoon]      - icoon-id in de shape-/icoonregistry
 * @property {string} [shortcut]   - alleen label; afvangen is een shell-taak
 */

/**
 * TaskbarType — een taakbalk-definitie binnen een DiagramType.
 * `acties` is óf een afleidingsregel (string) óf een expliciete lijst:
 *  - "elementTypes"   → één actie per niet-connector-ElementType (balk "Maken")
 *  - "connectorTypes" → één actie per connector-ElementType (balk "Verbinding")
 *  - "layouts"        → één actie per LayoutStrategie (balk "Auto-layout")
 *
 * @typedef {Object} TaskbarType
 * @property {string} id
 * @property {string} [label]
 * @property {"elementTypes"|"connectorTypes"|"layouts"|ActionType[]} acties
 */

/**
 * Widget-regel voor de gegenereerde inspector (plan §4.2, FieldType.editor).
 *
 * @typedef {Object} EditorRegel
 * @property {string} key
 * @property {"text"|"textarea"|"select"|"checkbox"|"number"|"kleur"} widget
 * @property {boolean} [verplicht]
 * @property {string[]|string} [opties] - array = statisch; string = sleutel in de
 *   `widgetContext` die de activiteit aan de inspector meegeeft (dynamisch,
 *   bv. "veldtypen" → basistypen + gegevenstypen + enums + ref.lijstitems)
 */

/**
 * FieldType — bepaalt hoe een veld rendert en bewerkt wordt.
 *
 * @typedef {Object} FieldType
 * @property {string} id
 * @property {"naam-type"|"tekst"|"waarde"} render - ingebouwde regel-renderers
 * @property {EditorRegel[]} [editor]
 */

/**
 * CompartmentType — een sectie-definitie binnen een ElementType.
 *
 * @typedef {Object} CompartmentType
 * @property {string} id
 * @property {string|null} [label]  - null → geen kopregel
 * @property {string} fieldType     - id van het FieldType voor de regels
 */

/**
 * Verbindingsregel voor een connector-uiteinde.
 *
 * @typedef {Object} ConnectorEindpunt
 * @property {string[]} elementTypes        - toegestane element-typen
 * @property {string[]} [kardinaliteiten]   - bv. ["0..1","1","0..*","1..*"]
 */

/**
 * ElementType — de betekenis-definitie van een soort element.
 * De vorm komt uit het ShapeType (Implementatie-domein), gekoppeld via `shape`.
 *
 * @typedef {Object} ElementType
 * @property {string} id
 * @property {string} label
 * @property {string} shape                 - ShapeType-id (bv. "class-box", "note", "boundary")
 * @property {string} [stereotype]          - headerregel, bv. "«entiteit»"
 * @property {string} [kleur]               - default; instantie kan overriden
 * @property {"standaard"|"onzichtbaar"} [handleStijl] - aansluitpunten tonen of niet
 * @property {boolean} [resizebaar]         - default true; false → geen NodeResizer
 * @property {string} [kort]                - korte knop-tekst voor de "Maken"-taakbalk (bv. "ENT")
 * @property {boolean} [isConnector]
 * @property {ConnectorEindpunt} [bron]     - verplicht als isConnector
 * @property {ConnectorEindpunt} [doel]     - verplicht als isConnector
 * @property {Object} [edgePresentatie]     - declaratieve edge-vorm voor kale
 *   connectoren: { lijn, kleur, markerStart, markerEnd, labels } (zie ConnectorEdge)
 * @property {Array<{key: string, label?: string, widget: string}>} [dataVelden]
 *   - element-data-velden voor de gegenereerde inspector (bv. tekst, expressie)
 * @property {CompartmentType[]} [compartments] - max 9, {ordered}
 * @property {Object} [hooks]               - Implementatie-domein: valideer,
 *   extraSecties, materialiseerAlsNode, … (functies; NIET serialiseren)
 */

/**
 * VerwijzingsKandidaat — één keuzemogelijkheid uit een VerwijzingsBron.
 *
 * @typedef {Object} VerwijzingsKandidaat
 * @property {string} waarde   - wat er in het veld/de data terechtkomt
 * @property {string} label
 * @property {string} [icoon]  - soort-aanduiding, bv. "✦" | "◇" | "▣"
 * @property {string} [groep]  - groepskop in de keuzelijst (optgroup)
 * @property {string[]} [pad]  - boom-pad voor de minibrowser (bv. [domein])
 */

/**
 * VerwijzingsBron — Implementatie-domein (plan §4.5b): levert kandidaten voor
 * keuze-widgets die naar iets anders verwijzen (attribuuttype, $ref, typeRef).
 * Eén bron per soort kandidaat; een profiel registreert er zoveel als nodig.
 * De pluriformiteit zit in de verwijzing, niet in het FieldType.
 *
 * @typedef {Object} VerwijzingsBron
 * @property {string} id       - bv. "gegevenstype", "enumeratie", "oas-schema"
 * @property {string} label
 * @property {string} [icoon]
 * @property {(ctx: {elements: Record<string, Object>, element?: Object, veld?: Object}) => VerwijzingsKandidaat[]} kandidaten
 */

/**
 * LayoutStrategie — plaatsingsstrategie van een DiagramType (plan §4.5).
 * Uitlijnen/verdelen/snap-grid zijn core; plaatsing is profiel-kennis.
 * `run` is Implementatie-domein (code); id/label zijn de declaratieve kern.
 *
 * @typedef {Object} LayoutStrategie
 * @property {string} id
 * @property {string} label
 * @property {(model: Object, diagram: Object, selectie: string[]) => Record<string, {x: number, y: number}>} run
 */

/**
 * DiagramType — één "profiel": de volledige configuratie van een diagramsoort.
 *
 * @typedef {Object} DiagramType
 * @property {string} id                    - bv. "canoniek-uml", "puur-uml", "oas31"
 * @property {string} label
 * @property {string} style                 - StyleType-id (Implementatie-domein)
 * @property {ElementType[]} elementTypes
 * @property {FieldType[]} [fieldTypes]     - de veldtypen waar CompartmentTypes naar verwijzen
 * @property {VerwijzingsBron[]} [verwijzingsBronnen] - kandidaat-leveranciers voor keuze-widgets (§4.5b)
 * @property {TaskbarType[]} [taakbalken]
 * @property {LayoutStrategie[]} [layouts]
 * @property {{exporteer?: Function, importeer?: Function}} [serialisatie]
 * @property {(ctx: Object) => Array<Object>} [menus] - extra menubalk-menu's
 *   (zelfde itemmodel als studio/buildMenus.js)
 */

// Dit bestand exporteert alleen types (JSDoc); geen runtime-code.
export {};
