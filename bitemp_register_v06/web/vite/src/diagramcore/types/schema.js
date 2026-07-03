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
 * PropertyType — één eigenschap van een FieldType of ElementType (metamodel,
 * vierde iteratie). Declaratief: naam/key + datatype (+ evt. referenceTypes).
 * De widget volgt uit de registry datatype → PropertyTypeEditor
 * (inspector/propertyTypeEditors.jsx); profielen kunnen datatypes toevoegen
 * (bv. "cel-expressie"). Heeft de property `referenceTypes`, dan kiest de
 * editor via ReferenceResolvers (VerwijzingsKiezer: keuzelijst + minibrowser).
 *
 * @typedef {Object} PropertyType
 * @property {string} key                  - waar de waarde leeft (veld.naam of data[key])
 * @property {string} [label]
 * @property {string} [datatype]           - "string" (default) | "tekst" | "boolean" | "colour" | profiel-eigen
 * @property {boolean} [verplicht]
 * @property {string[]} [referenceTypes]   - ReferenceType-ids; kandidaten via resolvers
 */

/**
 * FieldType — bepaalt hoe een veld rendert (FieldTypeViewer) en welke
 * eigenschappen het heeft (PropertyTypes).
 *
 * @typedef {Object} FieldType
 * @property {string} id
 * @property {"naam-type"|"tekst"|"waarde"} viewer - FieldTypeViewer-id: de
 *   compacte rij-weergave op de node (componeert de property-weergaven)
 * @property {PropertyType[]} [properties]
 */

/**
 * CompartmentType — een sectie-definitie binnen een ElementType.
 *
 * @typedef {Object} CompartmentType
 * @property {string} id
 * @property {string|null} [label]  - null → geen kopregel
 * @property {string} fieldType     - id van het FieldType voor de regels
 * @property {boolean} [alleenWeergave] - true → gevuld door een hook
 *   (extraCompartimenten), niet handmatig bewerkbaar in de inspector
 * @property {boolean} [verbergInInspector] - true → alleen op de node tonen;
 *   de inspector slaat de sectie over (bv. als dezelfde informatie daar al
 *   via element-properties bewerkbaar is, zoals gegevenstype-validatie)
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
 * @property {boolean} [achtergrond]        - true → rendert onder de andere nodes (boundaries/kaders)
 * @property {string} [kort]                - korte knop-tekst voor de "Maken"-taakbalk (bv. "ENT")
 * @property {boolean} [isConnector]
 * @property {ConnectorEindpunt} [bron]     - verplicht als isConnector
 * @property {ConnectorEindpunt} [doel]     - verplicht als isConnector
 * @property {Object} [edgePresentatie]     - declaratieve edge-vorm voor kale
 *   connectoren: { lijn, kleur, markerStart, markerEnd, labels } (zie ConnectorEdge)
 * @property {PropertyType[]} [properties]  - element-brede eigenschappen voor de
 *   inspector (bv. tekst, expressie, kleur) — PropertyTypes van het ElementType
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
 * ReferenceType — declaratieve soort-aanduiding van verwijzings-kandidaten
 * (plan §4.5b): basistype, gegevenstype, enum, ref.lijstitem, oas-schema, …
 * De bijbehorende **ReferenceResolver** (Implementatie-domein) levert de
 * kandidaten runtime en staat in `DiagramType.referenceResolvers`, gekoppeld
 * op dit id — zelfde koppelvlak-patroon als ActionType → ActionHook.
 *
 * @typedef {Object} ReferenceType
 * @property {string} id       - bv. "gegevenstype", "enumeratie", "oas-schema"
 * @property {string} label
 * @property {string} [icoon]
 */

/**
 * @typedef {(ctx: {elements: Record<string, Object>, element?: Object, veld?: Object}) => VerwijzingsKandidaat[]} ReferenceResolver
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
 * @property {ReferenceType[]} [referenceTypes] - declaratieve soorten verwijzings-kandidaten (§4.5b)
 * @property {Record<string, ReferenceResolver>} [referenceResolvers] - Implementatie:
 *   resolver per ReferenceType-id (kandidaten uit model/runtime)
 * @property {TaskbarType[]} [taakbalken]
 * @property {LayoutStrategie[]} [layouts]
 * @property {{exporteer?: Function, importeer?: Function}} [serialisatie]
 * @property {(ctx: Object) => Array<Object>} [menus] - extra menubalk-menu's
 *   (zelfde itemmodel als studio/buildMenus.js)
 */

// Dit bestand exporteert alleen types (JSDoc); geen runtime-code.
export {};
