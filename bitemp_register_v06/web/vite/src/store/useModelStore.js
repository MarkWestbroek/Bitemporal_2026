/**
 * useModelStore — Zustand store voor het domeinmodel.
 *
 * Bevat alle elementen (entiteiten, GE's, relaties, enums, datatypes,
 * referentielijstInstanties) als flat Record<id, element>,
 * plus structurele relaties (edges) en diagramdefinities.
 *
 * De posities zitten NIET in de elementen maar in de diagrammen.
 * Eén element kan op meerdere diagrammen voorkomen.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { temporal } from "zundo";
import { isAsoc, asocAnkerId } from "../shared/asoc.js";

/**
 * @typedef {Object} ModelElement
 * @property {string} id          - Unieke ID (bijv. "A", "A_U", "enum_Geslacht", "dt_BSN")
 * @property {string} naam        - Weergavenaam
 * @property {string} type        - Node-type: "entiteit"|"gegevenselement"|"relatie"|"enumeratie"|"gegevenstype"|"referentielijstInstantie"
 * @property {string} domein      - Domein/package
 * @property {object} data        - Alle type-specifieke data (velden, waarden, etc.)
 */

/**
 * @typedef {Object} DiagramDef
 * @property {string} id
 * @property {string} naam
 * @property {string} domein      - Optioneel: domein-scope van het diagram
 * @property {Array}  nodes       - Visuele nodes: [{ elementId, position: {x,y} }]
 * @property {Array}  edges       - Visuele edges: [{ id, source, target, sourceHandle, targetHandle, data }]
 * @property {object} viewport    - { x, y, zoom }
 */

const DEFAULT_DIAGRAM_ID = "overzicht";

/** Strip viewport uit diagrammen zodat pan/zoom geen undo-entries genereren. */
function stripDiagramViewport(diagrams) {
  if (!diagrams) return diagrams;
  const result = {};
  for (const [id, d] of Object.entries(diagrams)) {
    const { viewport, ...rest } = d;
    result[id] = rest;
  }
  return result;
}

const useModelStore = create(
  persist(
    temporal(
      (set, get) => ({
      // === Model data ===
      /** @type {Record<string, ModelElement>} */
      elements: {},

      /** @type {Array<{id, source, target, data}>} */
      structuralEdges: [],

      /** @type {Record<string, DiagramDef>} */
      diagrams: {},

      /** @type {string[]} Gesorteerde domein-namen */
      domains: [],

      /** @type {Record<string, {versie?: string, beschrijving?: string, kleur?: string, prefix?: string}>} */
      domainMeta: {},

      /** @type {object|null} Bron-metadata (bron, build_versie, id, indiener, etc.) */
      modelMeta: null,

      /** @type {boolean} True als er onopgeslagen wijzigingen zijn sinds laden/opslaan */
      isDirty: false,

      // === Acties: Model ===

      /** Laad een volledig model (vanuit adapter). Vervangt alles. Zet isDirty op false. */
      loadModel: ({ elements, structuralEdges, diagrams, domains, domainMeta, modelMeta }) =>
        set({
          elements: elements || {},
          structuralEdges: structuralEdges || [],
          diagrams: diagrams || {},
          domains: domains || [],
          domainMeta: domainMeta || {},
          modelMeta: modelMeta || null,
          isDirty: false,
        }),

      /** Reset het model */
      clearModel: () =>
        set({
          elements: {},
          structuralEdges: [],
          diagrams: {},
          domains: [],
          domainMeta: {},
          modelMeta: null,
          isDirty: false,
        }),

      /** Markeer het model als opgeslagen (isDirty = false). */
      markSaved: () => set({ isDirty: false }),

      /** Voeg één model-element toe en houd de domeinlijst automatisch bij. */
      addElement: (element) =>
        set((state) => {
          if (!element?.id) return state;
          const volgendeDomeinen = element.domein && !state.domains.includes(element.domein)
            ? [...state.domains, element.domein].sort()
            : state.domains;
          return {
            isDirty: true,
            elements: {
              ...state.elements,
              [element.id]: element,
            },
            domains: volgendeDomeinen,
          };
        }),

      /** Voeg meerdere model-elementen in één mutatie toe. */
      addElements: (items = []) =>
        set((state) => {
          const geldigeItems = (items || []).filter((item) => item?.id);
          if (geldigeItems.length === 0) return state;
          const nieuweElements = { ...state.elements };
          const domeinen = new Set(state.domains);
          for (const item of geldigeItems) {
            nieuweElements[item.id] = item;
            if (item.domein) domeinen.add(item.domein);
          }
          return {
            isDirty: true,
            elements: nieuweElements,
            domains: [...domeinen].sort(),
          };
        }),

      /**
       * Update een element. `patch` kan top-level velden bevatten (naam, domein)
       * en/of een genest `data`-object dat gemerged wordt met bestaande data.
       *
       * Voorbeelden:
       *   updateElement(id, { naam: "NieuweNaam" })              — alleen top-level
       *   updateElement(id, { data: { description: "..." } })    — alleen data
       *   updateElement(id, { naam: "X", data: { kleur: "#f0f" } }) — beide
       */
      updateElement: (id, patch) =>
        set((state) => {
          const el = state.elements[id];
          if (!el) return state;
          const { data: dataPatch, ...topPatch } = patch;
          // Auto-add nieuw domein aan de domeinlijst
          const nieuwDomein = topPatch.domein || null;
          const volgendeDomeinen = nieuwDomein && !state.domains.includes(nieuwDomein)
            ? [...state.domains, nieuwDomein].sort()
            : state.domains;
          return {
            isDirty: true,
            domains: volgendeDomeinen,
            elements: {
              ...state.elements,
              [id]: {
                ...el,
                ...topPatch,
                data: dataPatch !== undefined ? { ...el.data, ...dataPatch } : el.data,
              },
            },
          };
        }),

      // === Acties: Domeinen ===

      /** Voeg een nieuw domein toe */
      addDomain: (naam) =>
        set((state) => {
          if (state.domains.includes(naam)) return state;
          return { isDirty: true, domains: [...state.domains, naam].sort() };
        }),

      /** Verwijder een domein (elementen behouden, domein wordt leeg) */
      removeDomain: (naam) =>
        set((state) => ({
          isDirty: true,
          domains: state.domains.filter((d) => d !== naam),
          domainMeta: (() => { const { [naam]: _, ...rest } = state.domainMeta; return rest; })(),
        })),

      /** Update metadata van een domein (beschrijving, kleur, prefix) */
      updateDomainMeta: (naam, patch) =>
        set((state) => ({
          isDirty: true,
          domainMeta: {
            ...state.domainMeta,
            [naam]: { ...(state.domainMeta[naam] || {}), ...patch },
          },
        })),

      /** Verwijder een element uit het model + uit alle diagrammen */
      deleteElement: (id) =>
        set((state) => {
          const { [id]: _removed, ...restElements } = state.elements;
          const newDiagrams = {};
          for (const [dId, diag] of Object.entries(state.diagrams)) {
            newDiagrams[dId] = {
              ...diag,
              nodes: diag.nodes.filter((n) => n.elementId !== id),
              edges: diag.edges.filter((e) => e.source !== id && e.target !== id),
            };
          }
          return {
            isDirty: true,
            elements: restElements,
            structuralEdges: state.structuralEdges.filter(
              (e) => e.source !== id && e.target !== id
            ),
            diagrams: newDiagrams,
          };
        }),

      // === Acties: Diagrammen ===

      /** Maak nieuw diagram */
      addDiagram: (diagram) =>
        set((state) => ({
          diagrams: { ...state.diagrams, [diagram.id]: diagram },
        })),

      /** Hernoem een diagram */
      renameDiagram: (diagramId, nieuweNaam) =>
        set((state) => {
          const diag = state.diagrams[diagramId];
          if (!diag) return state;
          return {
            isDirty: true,
            diagrams: {
              ...state.diagrams,
              [diagramId]: { ...diag, naam: nieuweNaam },
            },
          };
        }),

      /** Voeg een structurele edge toe aan het model (zonder duplicaten). */
      addStructuralEdge: (edge) =>
        set((state) => {
          const bestaatAl = state.structuralEdges.some(
            (e) =>
              e.source === edge.source &&
              e.target === edge.target &&
              (e.sourceHandle || null) === (edge.sourceHandle || null) &&
              (e.targetHandle || null) === (edge.targetHandle || null)
          );
          if (bestaatAl) return state;
          return {
            isDirty: true,
            structuralEdges: [...state.structuralEdges, edge],
          };
        }),

      /** Verwijder een structurele edge op basis van ID (bijv. scope-edges). */
      removeStructuralEdge: (edgeId) =>
        set((state) => ({
          isDirty: true,
          structuralEdges: state.structuralEdges.filter((e) => e.id !== edgeId),
        })),

      /** Update data van een structurele edge */
      updateStructuralEdge: (edgeId, dataPatch) =>
        set((state) => ({
          isDirty: true,
          structuralEdges: state.structuralEdges.map((e) =>
            e.id === edgeId ? { ...e, data: { ...e.data, ...dataPatch } } : e
          ),
        })),

      /** Update edge data in een specifiek diagram */
      updateDiagramEdge: (diagramId, edgeId, dataPatch) =>
        set((state) => {
          const diag = state.diagrams[diagramId];
          if (!diag) return state;
          return {
            isDirty: true,
            diagrams: {
              ...state.diagrams,
              [diagramId]: {
                ...diag,
                edges: (diag.edges || []).map((e) =>
                  e.id === edgeId ? { ...e, data: { ...e.data, ...dataPatch } } : e
                ),
              },
            },
          };
        }),

      /** Verwijder diagram (niet de elementen!) */
      deleteDiagram: (diagramId) =>
        set((state) => {
          const { [diagramId]: _removed, ...rest } = state.diagrams;
          return { diagrams: rest };
        }),

      /** Update diagram nodes (posities, toevoegingen, verwijderingen) */
      updateDiagramNodes: (diagramId, nodes) =>
        set((state) => ({
          diagrams: {
            ...state.diagrams,
            [diagramId]: { ...state.diagrams[diagramId], nodes },
          },
        })),

      /** Update diagram edges */
      updateDiagramEdges: (diagramId, edges) =>
        set((state) => ({
          diagrams: {
            ...state.diagrams,
            [diagramId]: { ...state.diagrams[diagramId], edges },
          },
        })),

      /** Update diagram viewport */
      updateDiagramViewport: (diagramId, viewport) =>
        set((state) => ({
          diagrams: {
            ...state.diagrams,
            [diagramId]: { ...state.diagrams[diagramId], viewport },
          },
        })),

      /** Voeg element toe aan diagram (als referentie) op een positie */
      addElementToDiagram: (diagramId, elementId, position) =>
        set((state) => {
          const diag = state.diagrams[diagramId];
          if (!diag) return state;
          // Voorkom duplicaten
          if (diag.nodes.some((n) => n.elementId === elementId)) return state;
          return {
            diagrams: {
              ...state.diagrams,
              [diagramId]: {
                ...diag,
                nodes: [...diag.nodes, { elementId, position }],
              },
            },
          };
        }),

      /** Verwijder element van diagram (NIET uit het model) */
      removeElementFromDiagram: (diagramId, elementId) =>
        set((state) => {
          const diag = state.diagrams[diagramId];
          if (!diag) return state;
          return {
            diagrams: {
              ...state.diagrams,
              [diagramId]: {
                ...diag,
                nodes: diag.nodes.filter((n) => n.elementId !== elementId),
                edges: diag.edges.filter(
                  (e) => e.source !== elementId && e.target !== elementId
                ),
              },
            },
          };
        }),

      /**
       * Ververs het ASOC-patroon voor één of meerdere relaties op een diagram.
       *
       * Gebruikt {@link relatieVorm} als single source of truth: een relatie
       * met (afgeleide) velden krijgt het ASOC-patroon (anker + 3 edges),
       * een relatie zonder velden krijgt het collapsed-patroon (label op de
       * edge tussen bron en doel).
       *
       * Bestaande anker-positie blijft behouden; bestaande edge-handles gaan
       * verloren omdat de edges opnieuw gebouwd worden. Dependency-edges
       * (bijv. naar referentielijstInstantie) blijven ongewijzigd.
       */
      verversAsocVoorRelaties: (diagramId, relatieNamen) =>
        set((state) => {
          const diag = state.diagrams[diagramId];
          if (!diag) return state;

          const elements = { ...state.elements };
          let nodes = [...diag.nodes];
          let edges = [...diag.edges];

          for (const relNaam of relatieNamen) {
            const rel = elements[relNaam];
            if (!rel || rel.type !== "relatie") continue;
            const ankerId = asocAnkerId(relNaam);
            const doelEnt = rel.data?.doelEntiteit || "";

            // Bron-entiteit afleiden uit structuralEdges
            const bronEdge = (state.structuralEdges || []).find(
              (e) => e.target === relNaam && elements[e.source]?.type === "entiteit"
            );
            const bronEnt = bronEdge?.source;
            if (!bronEnt) continue;

            // Bewaar bestaande anker-positie of bereken middelpunt
            const oldAnkerNode = nodes.find((n) => n.elementId === ankerId);
            let ankerPos = oldAnkerNode?.position;
            if (!ankerPos) {
              const bronNode = nodes.find((n) => n.elementId === bronEnt);
              const doelNode = nodes.find((n) => n.elementId === doelEnt);
              if (bronNode && doelNode) {
                ankerPos = {
                  x: (bronNode.position.x + doelNode.position.x) / 2,
                  y: (bronNode.position.y + doelNode.position.y) / 2,
                };
              } else {
                ankerPos = { x: 0, y: 0 };
              }
            }

            // Verwijder bestaande anker + bijbehorende structurele edges (NIET dependencies)
            delete elements[ankerId];
            nodes = nodes.filter((n) => n.elementId !== ankerId);
            edges = edges.filter((e) => {
              const isAnkerEdge = e.source === ankerId || e.target === ankerId;
              const isRelStructuralEdge =
                (e.source === relNaam || e.target === relNaam) && !e.data?.isDependency;
              return !isAnkerEdge && !isRelStructuralEdge;
            });

            if (isAsoc(rel)) {
              // ASOC-patroon: A ── o ── B + o╌╌REL
              // UML-kardinaliteit: aan de bron-zijde bron-multiplicity, aan
              // de doel-zijde doel-multiplicity (label tekent bij entity).
              const bronKard = rel.data?.bronKardinaliteit
                || (rel.data?.momentvoorkomen === "meervoudig" ? "0..*" : "0..1");
              const doelKard = rel.data?.doelKardinaliteit || "0..*";
              elements[ankerId] = {
                id: ankerId,
                naam: ankerId,
                type: "associatieAnker",
                domein: rel.domein || "",
                data: { relatieNaam: relNaam },
              };
              nodes.push({ elementId: ankerId, position: ankerPos });
              edges.push({
                id: `${bronEnt}->${ankerId}`,
                source: bronEnt,
                target: ankerId,
                type: "metamodel",
                data: { isAssociation: true, directioneel: false, kardinaliteit: bronKard },
              });
              if (doelEnt) {
                edges.push({
                  id: `${ankerId}->${doelEnt}`,
                  source: ankerId,
                  target: doelEnt,
                  type: "metamodel",
                  data: { isAssociation: true, directioneel: false, kardinaliteit: doelKard },
                });
              }
              edges.push({
                id: `${ankerId}-->${relNaam}`,
                source: ankerId,
                target: relNaam,
                type: "metamodel",
                sourceHandle: "source-bottom",
                targetHandle: "target-top",
                data: { isAssociationClassLink: true },
              });
            } else {
              // Collapsed-patroon: bron → REL → doel met labels op de edges
              edges.push({
                id: `${bronEnt}->${relNaam}`,
                source: bronEnt,
                target: relNaam,
                type: "metamodel",
                data: {
                  rolnaam: relNaam,
                  momentvoorkomen: rel.data?.momentvoorkomen || "meervoudig",
                  kardinaliteit: "0..*",
                },
              });
              if (doelEnt) {
                edges.push({
                  id: `${relNaam}->${doelEnt}`,
                  source: relNaam,
                  target: doelEnt,
                  type: "metamodel",
                  data: { rolnaam: `→ ${doelEnt}`, kardinaliteit: "0..*" },
                });
              }
            }
          }

          return {
            elements,
            diagrams: {
              ...state.diagrams,
              [diagramId]: { ...diag, nodes, edges },
            },
          };
        }),
    }),
    {
      // Undo/redo: track model-mutaties + diagram-layout (nodes/edges), niet viewport of isDirty
      partialize: (state) => ({
        elements: state.elements,
        structuralEdges: state.structuralEdges,
        domains: state.domains,
        domainMeta: state.domainMeta,
        diagrams: stripDiagramViewport(state.diagrams),
      }),
      // Sla geen undo-entry op wanneer de getrackte state niet veranderd is
      // (bijv. bij isDirty-only of viewport-only wijzigingen)
      equality: (pastState, currentState) =>
        JSON.stringify(pastState) === JSON.stringify(currentState),
      limit: 50,
    }),
    {
      name: "ide-model-store",
      storage: createJSONStorage(() => localStorage),
      // Sla alleen model-data op, niet UI-state
      partialize: (state) => ({
        elements: state.elements,
        structuralEdges: state.structuralEdges,
        diagrams: state.diagrams,
        domains: state.domains,
        domainMeta: state.domainMeta,
        modelMeta: state.modelMeta,
      }),
    }
  )
);

// Dev-only: expose store op window voor e2e/Playwright tests + handmatig debuggen.
// In productie-build (import.meta.env.PROD) wordt dit eruit ge-treeshaked.
if (typeof window !== "undefined" && import.meta.env && import.meta.env.DEV) {
  window.__useModelStore = useModelStore;
}

export default useModelStore;
export { DEFAULT_DIAGRAM_ID };
