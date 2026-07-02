# diagramcore — generieke diagram-motor (Studio 0.5)

De configureerbare kern onder de toekomstige diagram-activiteiten: een diagram is
een verzameling elementen; connectoren zijn speciale elementen; elementen hebben
maximaal 9 geordende compartimenten met velden. Wat er mogelijk is, beschrijft een
**DiagramType** (profiel) — deze map bevat géén domeinkennis.

**Plan & metamodel:** [`docs/STUDIO-05-diagramcore-plan.md`](../../../../docs/STUDIO-05-diagramcore-plan.md)

## Stand (fase 1)

- `model/schema.js` — typedefs Model-domein (Diagram, Element, Connector,
  Compartiment, Veld, Positie).
- `model/createDiagramStore.js` — store-factory (fase 1: laden + actief diagram;
  mutaties/undo/persist volgen in fase 2).
- `types/schema.js` — typedefs Definitie-domein (DiagramType t/m FieldType,
  TaskbarType/ActionType, LayoutStrategie).
- `types/typeRegistry.js` — register + contract-validatie (met tests).
- `shapes/` — shape-registry + basis-shapes (class-box, note, rounded, anker).
- `canvas/` — generieke `ElementNode` (shape + 0..9 compartimenten + 8 handles),
  declaratieve `ConnectorEdge` (rendert `data.presentatie`; classificatie is
  profiel-werk), dunne `DiagramCanvas` (read-only, selectie werkt).
- `styles/diagramcore.css` — eigen `dc-*`-klassen, visueel gelijkwaardig aan de
  umleditor-nodes.

Eerste profiel: `src/diagramprofielen/canoniek-uml/` (descriptor + adapter met
tests). Eerste afnemer: studio-activiteit **"Diagrammen (0.5)"**
(`src/studio/activities/diagramActivity.jsx`, lazy canvas).

Alles onder deze map is `// @ts-check` met JSDoc-typedefs: het type-contract is
afdwingbaar zonder TS-buildstap. **Bewaak de scheiding Definitie/Implementatie**:
declaratieve velden moeten JSON-serialiseerbaar blijven (plan §8.5); functies
horen in hooks of aparte registries (shapes, action-hooks).

Volgende stappen (fase 1): `createDiagramStore`, generieke `ElementNode` +
`DiagramCanvas`, shape-registry, en het eerste profiel `canoniek-uml` (read-only
via een adapter op de bestaande model-store).
