// @ts-check
/**
 * createDiagramStore — Zustand-store-factory voor de generieke diagram-motor.
 *
 * Fase 2 (bewerken): mutaties op elementen/connectoren/diagrammen, undo/redo
 * via zundo (zelfde patroon als store/useModelStore.js) en optioneel persist
 * per profiel (persistKey "studio05-<profiel>").
 *
 * Connectoren zijn elementen met `source`/`target` (metamodel §2); de visuele
 * edges op een diagram worden daaruit afgeleid (canvas/materialiseerConnectoren)
 * en zijn dus geen aparte waarheid. `diagram.edges` bevat alleen de
 * "geïmporteerde" presentatie-edges van een adapter (fase 1-spiegel).
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { maakStoreOpslag, heeftIndexedDb, opslagFouten } from "./opslag.js";
import { temporal } from "zundo";
import { nieuwVoorkomenId, voorkomenId, vindVoorkomen } from "./voorkomens.js";

/** @typedef {import("./schema.js").Element} Element */
/** @typedef {import("./schema.js").Diagram} Diagram */

/**
 * Splits binnenkomende diagrammen (adapter-vorm, met viewport erin) in
 * diagrammen-zonder-viewport + een aparte viewports-map. Viewports leven
 * buiten de undo-history én buiten de diagrammen, zodat undo/redo nooit de
 * pan/zoom-stand aantast (dat deed eerder een ongewenste "fit view").
 */
function splitsViewports(diagrams) {
  const kaal = {};
  const viewports = {};
  for (const [id, d] of Object.entries(diagrams || {})) {
    const { viewport, ...rest } = d;
    kaal[id] = rest;
    if (viewport) viewports[id] = viewport;
  }
  return { kaal, viewports };
}

/**
 * Valideer een toevoegende modelimport volledig vóór de storemutatie.
 * @returns {string[]} blokkerende fouten
 */
export function valideerImportModel(state, model, { modus = "toevoegen" } = {}) {
  const fouten = [];
  if (modus !== "toevoegen") fouten.push(`Onbekende importmodus: ${modus}.`);
  const elements = model?.elements;
  const diagrams = model?.diagrams;
  if (!elements || typeof elements !== "object" || Array.isArray(elements)) {
    fouten.push("Importmodel vereist een elements-object.");
  }
  if (!diagrams || typeof diagrams !== "object" || Array.isArray(diagrams)) {
    fouten.push("Importmodel vereist een diagrams-object.");
  }
  if (fouten.length) return fouten;

  const elementIds = new Set(Object.keys(elements));
  const beschikbareIds = new Set([...Object.keys(state.elements || {}), ...elementIds]);
  for (const [id, element] of Object.entries(elements)) {
    if (!element?.id || element.id !== id) fouten.push(`Element ${id} heeft geen overeenkomende id.`);
    if (state.elements?.[id]) fouten.push(`Element-id bestaat al: ${id}.`);
    if (element?.source && !beschikbareIds.has(element.source)) {
      fouten.push(`Connector ${id} verwijst naar ontbrekende bron ${element.source}.`);
    }
    if (element?.target && !beschikbareIds.has(element.target)) {
      fouten.push(`Connector ${id} verwijst naar ontbrekend doel ${element.target}.`);
    }
  }
  for (const [id, diagram] of Object.entries(diagrams)) {
    if (!diagram?.id || diagram.id !== id) fouten.push(`Diagram ${id} heeft geen overeenkomende id.`);
    if (state.diagrams?.[id]) fouten.push(`Diagram-id bestaat al: ${id}.`);
    for (const node of diagram?.nodes || []) {
      if (!node?.elementId || !beschikbareIds.has(node.elementId)) {
        fouten.push(`Diagram ${id} verwijst naar ontbrekend element ${node?.elementId || "(leeg)"}.`);
      }
    }
  }
  return fouten;
}

/**
 * @param {{ persistKey?: string }} [opts]
 */
/**
 * Bewaarplaats van de store (zie opslag.js): IndexedDB — groot, asynchroon,
 * objecten i.p.v. JSON-tekst — met een eenmalige migratie uit localStorage.
 * Zonder IndexedDB (oude browser, node-tests): localStorage als JSON, maar een
 * vol quotum gooit niet (de store werkt dan in het geheugen door).
 * Opslagfouten per persistKey staan in `opslagFouten` (her-export uit opslag.js).
 */
export { opslagFouten };

function veiligeLocalStorage(persistKey) {
  return {
    getItem: (k) => localStorage.getItem(k),
    removeItem: (k) => localStorage.removeItem(k),
    setItem: (k, v) => {
      try {
        localStorage.setItem(k, v);
        opslagFouten.delete(persistKey);
      } catch (e) {
        if (!opslagFouten.has(persistKey)) console.warn(`[diagramcore] "${persistKey}" niet bewaard in localStorage (${e?.name || "fout"}): ${e?.message || e}`);
        opslagFouten.set(persistKey, e);
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("studio:opslag-vol", { detail: { persistKey, fout: e } }));
      }
    },
  };
}

export function createDiagramStore({ persistKey } = {}) {
  const leeg = {
    diagramTypeId: null,
    elements: {},
    diagrams: {},
    /** @type {Record<string, {x:number,y:number,zoom:number}>} pan/zoom per diagram, buiten de undo-history */
    viewports: {},
    /** Niet-diagramgebonden meta van de bron (modelMeta/domains/…), passthrough voor serialisatie. */
    meta: null,
    actiefDiagramId: null,
    isDirty: false,
  };

  const definitie = (set) => ({
    ...leeg,

    /** Vervang het volledige model (vanuit een adapter). Zet isDirty op false. */
    laadModel: ({ diagramTypeId, elements, diagrams, actiefDiagramId, meta }) =>
      set((state) => {
        const { kaal, viewports } = splitsViewports(diagrams);
        // Een werkbestand v3 draagt geen viewports (kijkstand = werkruimte,
        // geen project): houd dan de lokale pan/zoom van diagrammen die blijven.
        const viewportsNieuw = Object.keys(viewports).length
          ? viewports
          : Object.fromEntries(Object.entries(state.viewports || {}).filter(([id]) => kaal[id]));
        return {
          diagramTypeId: diagramTypeId ?? state.diagramTypeId,
          elements: elements || {},
          diagrams: kaal,
          viewports: viewportsNieuw,
          meta: meta ?? state.meta,
          isDirty: false,
          actiefDiagramId:
            actiefDiagramId ??
            (state.actiefDiagramId && kaal?.[state.actiefDiagramId]
              ? state.actiefDiagramId
              : Object.keys(kaal || {})[0] || null),
        };
      }),

    clear: () => set({ ...leeg }),

    /**
     * Vervang de hele elementen-map in één stap (bv. hernoemen mét
     * doorgetrokken verwijzingen, zie model/hernoemen.js). Via `set`, zodat
     * de undo-historie (temporal) en de persist-laag hem gewoon zien.
     */
    zetElementen: (elements) => set({ elements, isDirty: true }),

    /** @param {string} id */
    setActiefDiagram: (id) => set({ actiefDiagramId: id }),

    markeerOpgeslagen: () => set({ isDirty: false }),

    /**
     * Voeg een compleet, vooraf gevalideerd model atomisch toe. Eén `set`
     * betekent één undo-stap; bij een validatiefout blijft de store intact.
     */
    importeerModel: (model, opties = { modus: "toevoegen" }) => {
      const fouten = valideerImportModel(useStoreState(), model, opties);
      if (fouten.length) {
        const fout = new Error(`Modelimport geweigerd:\n- ${fouten.join("\n- ")}`);
        fout.code = "DIAGRAM_IMPORT_INVALID";
        fout.fouten = fouten;
        throw fout;
      }
      set((state) => {
        const { kaal, viewports } = splitsViewports(model.diagrams);
        return {
          diagramTypeId: model.diagramTypeId ?? state.diagramTypeId,
          elements: { ...state.elements, ...model.elements },
          diagrams: { ...state.diagrams, ...kaal },
          viewports: { ...state.viewports, ...viewports },
          meta: model.meta ?? state.meta,
          actiefDiagramId: state.actiefDiagramId || Object.keys(kaal)[0] || null,
          isDirty: true,
        };
      });
    },

    // === Elementen ===

    /** @param {Element} element */
    addElement: (element) =>
      set((state) => {
        if (!element?.id) return state;
        return { isDirty: true, elements: { ...state.elements, [element.id]: element } };
      }),

    /**
     * Update een element. `patch` mag top-level velden bevatten (naam, source,
     * target), een compleet `compartimenten`-array (vervangt) en/of een
     * `data`-object (merged).
     */
    updateElement: (id, patch) =>
      set((state) => {
        const el = state.elements[id];
        if (!el) return state;
        const { data: dataPatch, compartimenten, ...top } = patch;
        return {
          isDirty: true,
          elements: {
            ...state.elements,
            [id]: {
              ...el,
              ...top,
              ...(compartimenten !== undefined ? { compartimenten } : {}),
              data: dataPatch !== undefined ? { ...el.data, ...dataPatch } : el.data,
            },
          },
        };
      }),

    /**
     * Meerdere elementen in één stap bijwerken (zelfde patch-vorm als
     * updateElement): één undo-stap i.p.v. één per element — bv. "kinderen
     * in boomstijl" op acht connectoren gaf acht Ctrl+Z's (gemeld 2026-10-07).
     * @param {Record<string, Object>} patches  element-id → patch
     */
    updateElementen: (patches) =>
      set((state) => {
        let elements = state.elements;
        for (const [id, patch] of Object.entries(patches || {})) {
          const el = elements[id];
          if (!el || !patch) continue;
          const { data: dataPatch, compartimenten, ...top } = patch;
          elements = {
            ...elements,
            [id]: {
              ...el,
              ...top,
              ...(compartimenten !== undefined ? { compartimenten } : {}),
              data: dataPatch !== undefined ? { ...el.data, ...dataPatch } : el.data,
            },
          };
        }
        return elements === state.elements ? state : { isDirty: true, elements };
      }),

    /**
     * Verwijder een element uit het model, inclusief connectoren die eraan
     * hangen, en haal alles van alle diagrammen af.
     */
    deleteElement: (id) =>
      set((state) => {
        if (!state.elements[id]) return state;
        const weg = new Set([id]);
        for (const el of Object.values(state.elements)) {
          if (el.source === id || el.target === id) weg.add(el.id);
        }
        const elements = {};
        for (const [k, v] of Object.entries(state.elements)) {
          if (!weg.has(k)) elements[k] = v;
        }
        const diagrams = {};
        for (const [dId, d] of Object.entries(state.diagrams)) {
          diagrams[dId] = {
            ...d,
            nodes: (d.nodes || []).filter((n) => !weg.has(n.elementId)),
            edges: (d.edges || []).filter((e) => !weg.has(e.source) && !weg.has(e.target)),
          };
          // Lijndata per diagram van verdwenen connectoren mee opruimen.
          if (d.lijnen && [...weg].some((k) => k in d.lijnen)) {
            const lijnen = { ...d.lijnen };
            for (const k of weg) delete lijnen[k];
            if (Object.keys(lijnen).length) diagrams[dId].lijnen = lijnen;
            else delete diagrams[dId].lijnen;
          }
        }
        return { isDirty: true, elements, diagrams };
      }),

    // === Diagrammen ===

    /** @param {Partial<Diagram> & {id: string, naam: string}} diagram */
    addDiagram: (diagram) =>
      set((state) => ({
        isDirty: true,
        diagrams: {
          ...state.diagrams,
          [diagram.id]: { nodes: [], edges: [], ...diagram },
        },
        actiefDiagramId: diagram.id,
      })),

    renameDiagram: (diagramId, naam) =>
      set((state) => {
        const d = state.diagrams[diagramId];
        if (!d) return state;
        return { isDirty: true, diagrams: { ...state.diagrams, [diagramId]: { ...d, naam } } };
      }),

    /**
     * Vervang velden van een bestaand diagram in één stap (naam, nodes,
     * verborgenConnectoren, …) — voor een merge die bestaande ids houdt
     * (EA-import op GUID, 2026-10-09). Viewport blijft buiten het diagram.
     */
    zetDiagram: (diagramId, patch) =>
      set((state) => {
        const d = state.diagrams[diagramId];
        if (!d || !patch) return state;
        const { id: _id, viewport: _vp, ...rest } = patch;
        return { isDirty: true, diagrams: { ...state.diagrams, [diagramId]: { ...d, ...rest } } };
      }),

    /**
     * Lijndata van een connector op dít diagram — de "Position" van een
     * connector in Marks M3 (associatieklasse op Diagram–Element; Connector
     * is een Element): `diagram.lijnen[connectorId] = { knikken, vorm,
     * sourceHandle, targetHandle, labelOffsets }`. Wat hier staat wint van
     * dezelfde sleutels op `element.data` (die blijven als standaard voor
     * elk diagram en voor oude modellen). Per sleutel: `undefined` haalt de
     * override weg (terug naar het element), `null` of `[]` is expliciet
     * leeg op dit diagram (bv. handle automatisch, geen knikken).
     * Reden: EA en elk UML-gereedschap bewaren pad, aanhechting en labels per
     * diagram; op het element kon een lijn op twee diagrammen maar op één
     * goed liggen (Mark, 10-10).
     * `elementPatches` (optioneel, zelfde vorm als updateElementen) gaat in
     * dezelfde stap mee — één Ctrl+Z voor bv. een verhangen lijn.
     * @param {string} diagramId
     * @param {Record<string, Record<string, any>>} patches  connectorId → patch
     * @param {Record<string, Object>|null} [elementPatches]
     */
    zetLijnen: (diagramId, patches, elementPatches = null) =>
      set((state) => {
        const d = state.diagrams[diagramId];
        if (!d || !patches) return state;
        const lijnen = { ...(d.lijnen || {}) };
        for (const [cid, patch] of Object.entries(patches)) {
          if (!patch) continue;
          const lijn = { ...(lijnen[cid] || {}) };
          for (const [k, v] of Object.entries(patch)) {
            if (v === undefined) delete lijn[k];
            else lijn[k] = v;
          }
          if (Object.keys(lijn).length) lijnen[cid] = lijn;
          else delete lijnen[cid];
        }
        const rest = { ...d };
        if (Object.keys(lijnen).length) rest.lijnen = lijnen;
        else delete rest.lijnen;
        let elements = state.elements;
        for (const [id, patch] of Object.entries(elementPatches || {})) {
          const el = elements[id];
          if (!el || !patch) continue;
          const { data: dataPatch, compartimenten, ...top } = patch;
          elements = {
            ...elements,
            [id]: {
              ...el,
              ...top,
              ...(compartimenten !== undefined ? { compartimenten } : {}),
              data: dataPatch !== undefined ? { ...el.data, ...dataPatch } : el.data,
            },
          };
        }
        return { isDirty: true, diagrams: { ...state.diagrams, [diagramId]: rest }, ...(elements !== state.elements ? { elements } : {}) };
      }),

    /** Eén connector: zie zetLijnen. */
    zetLijn: (diagramId, connectorId, patch) => useStoreState().zetLijnen(diagramId, { [connectorId]: patch }),

    /** Verwijder een diagram (niet de elementen). */
    deleteDiagram: (diagramId) =>
      set((state) => {
        const { [diagramId]: _weg, ...rest } = state.diagrams;
        const { [diagramId]: _vpWeg, ...restViewports } = state.viewports;
        return {
          isDirty: true,
          diagrams: rest,
          viewports: restViewports,
          actiefDiagramId:
            state.actiefDiagramId === diagramId
              ? Object.keys(rest)[0] || null
              : state.actiefDiagramId,
        };
      }),

    /**
     * Zet een element op een diagram. Bestaand gedrag weigert duplicaten;
     * met meerdereVoorkomens krijgt een tweede plaatsing een eigen nodeId.
     */
    addElementToDiagram: (diagramId, elementId, position, { meerdereVoorkomens = false, nodeId = null } = {}) =>
      set((state) => {
        const d = state.diagrams[diagramId];
        if (!d) return state;
        const bestaat = d.nodes.some((n) => n.elementId === elementId);
        if (bestaat && !meerdereVoorkomens) return state;
        const effectieveNodeId = nodeId || (bestaat ? nieuwVoorkomenId(elementId) : null);
        if (effectieveNodeId && d.nodes.some((n) => voorkomenId(n) === effectieveNodeId)) return state;
        return {
          isDirty: true,
          diagrams: {
            ...state.diagrams,
            [diagramId]: {
              ...d,
              nodes: [...d.nodes, { ...(effectieveNodeId ? { nodeId: effectieveNodeId } : {}), elementId, position }],
            },
          },
        };
      }),

    /** Haal een element van een diagram af (element blijft in het model). */
    removeElementFromDiagram: (diagramId, voorkomenSleutel) =>
      set((state) => {
        const d = state.diagrams[diagramId];
        if (!d) return state;
        const voorkomen = vindVoorkomen(d.nodes, voorkomenSleutel);
        if (!voorkomen) return state;
        const sleutel = voorkomenId(voorkomen);
        return {
          isDirty: true,
          diagrams: {
            ...state.diagrams,
            [diagramId]: {
              ...d,
              nodes: d.nodes.filter((n) => voorkomenId(n) !== sleutel),
              edges: (d.edges || []).filter((e) => e.source !== sleutel && e.target !== sleutel),
            },
          },
        };
      }),

    updateNodePosition: (diagramId, voorkomenSleutel, position) =>
      set((state) => {
        const d = state.diagrams[diagramId];
        if (!d) return state;
        const voorkomen = vindVoorkomen(d.nodes, voorkomenSleutel);
        if (!voorkomen) return state;
        const sleutel = voorkomenId(voorkomen);
        return {
          isDirty: true,
          diagrams: {
            ...state.diagrams,
            [diagramId]: {
              ...d,
              nodes: d.nodes.map((n) => (voorkomenId(n) === sleutel ? { ...n, position } : n)),
            },
          },
        };
      }),

    /**
     * Bulk-variant: meerdere posities in één mutatie (= één undo-stap).
     * Gebruikt door uitlijnen/verdelen/auto-layout.
     * @param {Record<string, {x:number,y:number}>} posities
     */
    updateNodePositions: (diagramId, posities) =>
      set((state) => {
        const d = state.diagrams[diagramId];
        if (!d || !posities || Object.keys(posities).length === 0) return state;
        return {
          isDirty: true,
          diagrams: {
            ...state.diagrams,
            [diagramId]: {
              ...d,
              nodes: d.nodes.map((n) => {
                const position = posities[voorkomenId(n)] ?? posities[n.elementId];
                return position ? { ...n, position } : n;
              }),
            },
          },
        };
      }),

    /**
     * Anker-positie van een gematerialiseerde connector op één diagram
     * (het kleine rondje op de lijn bron—doel; ASOC-patroon). Maakt het
     * diagram-lidmaatschap aan als dat nog ontbreekt.
     */
    updateAnkerPosition: (diagramId, connectorId, ankerPosition) =>
      set((state) => {
        const d = state.diagrams[diagramId];
        if (!d) return state;
        const bestaat = d.nodes.some((n) => n.elementId === connectorId);
        return {
          isDirty: true,
          diagrams: {
            ...state.diagrams,
            [diagramId]: {
              ...d,
              nodes: bestaat
                ? d.nodes.map((n) => (n.elementId === connectorId ? { ...n, ankerPosition } : n))
                : [
                    ...d.nodes,
                    {
                      elementId: connectorId,
                      position: { x: ankerPosition.x - 93, y: ankerPosition.y + 90 },
                      ankerPosition,
                    },
                  ],
            },
          },
        };
      }),

    /**
     * Normaliseer ASOC-posities: wis de opgeslagen anker-positie(s) zodat het
     * anker terugvalt op het middelpunt bron—doel. `connectorIds` null → alle.
     */
    resetAnkerPositions: (diagramId, connectorIds = null) =>
      set((state) => {
        const d = state.diagrams[diagramId];
        if (!d) return state;
        const doelwit = connectorIds ? new Set(connectorIds) : null;
        return {
          isDirty: true,
          diagrams: {
            ...state.diagrams,
            [diagramId]: {
              ...d,
              nodes: d.nodes.map((n) => {
                if (!n.ankerPosition) return n;
                if (doelwit && !doelwit.has(n.elementId)) return n;
                const { ankerPosition, ...rest } = n;
                return rest;
              }),
            },
          },
        };
      }),

    /**
     * Wis de expliciete handles van de (geïmporteerde) presentatie-edges van
     * een diagram, zodat de canvas de kortste weg kiest (normaliseren).
     */
    resetEdgeHandles: (diagramId) =>
      set((state) => {
        const d = state.diagrams[diagramId];
        if (!d) return state;
        return {
          isDirty: true,
          diagrams: {
            ...state.diagrams,
            [diagramId]: {
              ...d,
              edges: (d.edges || []).map((e) => ({ ...e, sourceHandle: null, targetHandle: null })),
            },
          },
        };
      }),

    /** Grootte van een element op één diagram (metamodel: Position.elementSize). */
    /** Maten van meerdere voorkomens in één stap (zelfde breedte/hoogte/maat): één undo. */
    updateNodeSizes: (diagramId, maten) =>
      set((state) => {
        const d = state.diagrams[diagramId];
        if (!d || !maten || !Object.keys(maten).length) return state;
        return {
          isDirty: true,
          diagrams: {
            ...state.diagrams,
            [diagramId]: {
              ...d,
              nodes: d.nodes.map((n) => {
                const m = maten[voorkomenId(n)];
                return m ? { ...n, size: { ...(n.size || {}), ...m } } : n;
              }),
            },
          },
        };
      }),

    /** Maat (en, bij trekken aan de linker-/bovenrand, de positie) van een voorkomen — één stap. */
    updateNodeSize: (diagramId, voorkomenSleutel, size, position = null) =>
      set((state) => {
        const d = state.diagrams[diagramId];
        if (!d) return state;
        const voorkomen = vindVoorkomen(d.nodes, voorkomenSleutel);
        if (!voorkomen) return state;
        const sleutel = voorkomenId(voorkomen);
        return {
          isDirty: true,
          diagrams: {
            ...state.diagrams,
            [diagramId]: {
              ...d,
              nodes: d.nodes.map((n) =>
                voorkomenId(n) === sleutel ? { ...n, size, ...(position ? { position } : {}) } : n
              ),
            },
          },
        };
      }),

    /**
     * Wis de expliciete maat van één voorkomen (of van álle nodes bij null):
     * de node valt terug op zijn natuurlijke inhoud-maat. Praktisch na een
     * Exchange-import in de figuur-gedaante — de bewaarde Archi-boxmaat is
     * daar veel groter dan het figuur (Mark, 07-09).
     */
    wisNodeMaten: (diagramId, voorkomenSleutel = null) =>
      set((state) => {
        const d = state.diagrams[diagramId];
        if (!d) return state;
        const doelSleutel = voorkomenSleutel == null
          ? null
          : voorkomenId(vindVoorkomen(d.nodes, voorkomenSleutel) || {});
        const nodes = d.nodes.map((n) => {
          if (doelSleutel != null && voorkomenId(n) !== doelSleutel) return n;
          if (!("size" in n)) return n;
          const { size: _weg, ...rest } = n;
          return rest;
        });
        return { isDirty: true, diagrams: { ...state.diagrams, [diagramId]: { ...d, nodes } } };
      }),

    /**
     * Gedaante van één voorkomen (ontwerpprincipe "gedaanten van een
     * samenstel"): bv. "bol" klapt een interface samen tot lollipop-bolletje.
     * `null` wist de keuze → terug naar de volledige gedaante. De gedaante
     * hoort bij het vóórkomen, niet bij het model-element: hetzelfde element
     * kan op een ander diagram (of ander voorkomen) voluit staan.
     */
    zetNodeGedaante: (diagramId, voorkomenSleutel, gedaante = null) =>
      set((state) => {
        const d = state.diagrams[diagramId];
        if (!d) return state;
        const voorkomen = vindVoorkomen(d.nodes, voorkomenSleutel);
        if (!voorkomen) return state;
        const sleutel = voorkomenId(voorkomen);
        const nodes = d.nodes.map((n) => {
          if (voorkomenId(n) !== sleutel) return n;
          if (gedaante == null) {
            const { gedaante: _weg, ...rest } = n;
            return rest;
          }
          return { ...n, gedaante };
        });
        return { isDirty: true, diagrams: { ...state.diagrams, [diagramId]: { ...d, nodes } } };
      }),

    /**
     * Handmatige gedaante-keuze voor een connector op dít diagram:
     * "box" (associatieklasse-patroon) of "lijn" (kaal; attributen worden dan
     * niet getoond). `null` wist de keuze → automatisch (velden → box).
     */
    zetConnectorGedaante: (diagramId, connectorId, gedaante = null) =>
      set((state) => {
        const d = state.diagrams[diagramId];
        if (!d || !connectorId) return state;
        const overrides = { ...(d.gedaanteOverrides || {}) };
        if (gedaante == null) delete overrides[connectorId];
        else overrides[connectorId] = gedaante;
        const rest = { ...d };
        if (Object.keys(overrides).length) rest.gedaanteOverrides = overrides;
        else delete rest.gedaanteOverrides;
        return { isDirty: true, diagrams: { ...state.diagrams, [diagramId]: rest } };
      }),

    verbergConnectorOpDiagram: (diagramId, connectorId) =>
      set((state) => {
        const d = state.diagrams[diagramId];
        if (!d || !connectorId || (d.verborgenConnectoren || []).includes(connectorId)) return state;
        return {
          isDirty: true,
          diagrams: {
            ...state.diagrams,
            [diagramId]: { ...d, verborgenConnectoren: [...(d.verborgenConnectoren || []), connectorId] },
          },
        };
      }),

    toonVerborgenConnectoren: (diagramId) =>
      set((state) => {
        const d = state.diagrams[diagramId];
        if (!d || !(d.verborgenConnectoren || []).length) return state;
        const { verborgenConnectoren: _weg, ...rest } = d;
        return { isDirty: true, diagrams: { ...state.diagrams, [diagramId]: rest } };
      }),

    // === Patch-operaties (projectsync-vangnet, studio/sync/operaties.js) ===
    // Upsert/wis per id, zonder cascade: de afzender heeft de cascade al in
    // zijn diff zitten. Eén set = één undo-stap (maar bij remote toepassen
    // staat de undo gepauzeerd).

    /** @param {{zet?: Record<string, Element>, wis?: string[]}} patch */
    patchElementen: ({ zet = {}, wis = [] } = {}) =>
      set((state) => {
        const elements = { ...state.elements, ...zet };
        for (const id of wis) delete elements[id];
        return { isDirty: true, elements };
      }),

    /** @param {{zet?: Record<string, Diagram>, wis?: string[]}} patch */
    patchDiagrammen: ({ zet = {}, wis = [] } = {}) =>
      set((state) => {
        const { kaal, viewports: nieuweViewports } = splitsViewports(zet);
        const diagrams = { ...state.diagrams, ...kaal };
        const viewports = { ...state.viewports, ...nieuweViewports };
        for (const id of wis) {
          delete diagrams[id];
          delete viewports[id];
        }
        return {
          isDirty: true,
          diagrams,
          viewports,
          actiefDiagramId:
            state.actiefDiagramId && diagrams[state.actiefDiagramId]
              ? state.actiefDiagramId
              : Object.keys(diagrams)[0] || null,
        };
      }),

    /** Viewport: apart van de diagrammen, geen isDirty en geen undo-entry. */
    updateDiagramViewport: (diagramId, viewport) =>
      set((state) => ({ viewports: { ...state.viewports, [diagramId]: viewport } })),

    /**
     * Style-data op diagram-niveau (Style-domein, geen model-elementen):
     * bv. de shape-sets en typering-standaard van een profiel-ontwerp.
     * Merget de patch in het diagram-object.
     */
    updateDiagramStijl: (diagramId, patch) =>
      set((state) => {
        const d = state.diagrams[diagramId];
        if (!d) return state;
        return {
          isDirty: true,
          diagrams: { ...state.diagrams, [diagramId]: { ...d, ...patch } },
        };
      }),
  });

  let storeApi = null;
  const useStoreState = () => storeApi?.getState?.() || leeg;

  const metUndo = temporal(definitie, {
    // Bewust NIET in de history: viewports (pan/zoom is geen modelwijziging)
    // en actiefDiagramId (undo hoort niet van diagram te wisselen — dat
    // veroorzaakte remounts met een ongewenste fit-view).
    partialize: (state) => ({
      elements: state.elements,
      diagrams: state.diagrams,
    }),
    equality: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    limit: 50,
  });

  if (!persistKey) {
    storeApi = create(metUndo);
    return storeApi;
  }

  storeApi = create(
    persist(metUndo, {
      name: persistKey,
      // IndexedDB bewaart het persist-object zelf ({ state, version }); de
      // hydratatie is dan asynchroon — projectsync wacht erop (koppelModelStore),
      // de UI rendert even leeg en vult zich als de store geladen is.
      storage: heeftIndexedDb() ? maakStoreOpslag(persistKey) : createJSONStorage(() => veiligeLocalStorage(persistKey)),
      partialize: (state) => ({
        diagramTypeId: state.diagramTypeId,
        elements: state.elements,
        diagrams: state.diagrams,
        viewports: state.viewports,
        meta: state.meta,
        actiefDiagramId: state.actiefDiagramId,
      }),
    })
  );
  return storeApi;
}
