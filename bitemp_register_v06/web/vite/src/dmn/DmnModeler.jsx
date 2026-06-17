/**
 * DmnModeler — dmn-js Modeler wrapper voor DMN 1.3 DRD + Decision Tables.
 *
 * De dmn-js Modeler combineert meerdere views in één instantie:
 *   - **DRD** (Decision Requirements Diagram): het overzicht van beslissingen,
 *     input-data en hun onderlinge afhankelijkheden.
 *   - **Decision Table**: de beslistabel-editor per decision.
 *   - **Literal Expression**: expressie-editor per decision.
 *
 * Deze component:
 *   - mount de Modeler in een container-div;
 *   - importeert DMN XML bij mount (of via `importXML` op de ref);
 *   - meldt view-wisselingen aan de host via `onViewChange`;
 *   - biedt een imperatieve API (ref): importXML, exportXML, getViews, openView.
 *
 * De dmn-js CSS-assets worden hier geïmporteerd zodat Vite ze bundlet.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useCallback, useState } from "react";
import DmnJS from "dmn-js/lib/Modeler";
import { FIELDREF_MIME } from "../modelpicker/ModelPicker";

// dmn-js CSS-assets (Vite verwerkt deze via de bundler)
import "dmn-js/dist/assets/diagram-js.css";
import "dmn-js/dist/assets/dmn-js-shared.css";
import "dmn-js/dist/assets/dmn-js-drd.css";
import "dmn-js/dist/assets/dmn-js-decision-table.css";
import "dmn-js/dist/assets/dmn-js-decision-table-controls.css";
import "dmn-js/dist/assets/dmn-js-literal-expression.css";
import "dmn-js/dist/assets/dmn-js-boxed-expression.css";
import "dmn-js/dist/assets/dmn-js-boxed-expression-controls.css";
import "dmn-js/dist/assets/dmn-font/css/dmn.css";

const DmnModeler = forwardRef(function DmnModeler(
  { xml, onViewChange, onSelectionChange, onError, onDropFieldRef, className = "" },
  ref
) {
  const containerRef = useRef(null);
  const modelerRef = useRef(null);
  const hoveredElementRef = useRef(null);  // bijgehouden tijdens drag-over
  const viewChangeRef = useRef(onViewChange);
  viewChangeRef.current = onViewChange;
  const selectionChangeRef = useRef(onSelectionChange);
  selectionChangeRef.current = onSelectionChange;
  const dropFieldRefRef = useRef(onDropFieldRef);
  dropFieldRefRef.current = onDropFieldRef;
  const [debugMsg, setDebugMsg] = useState(null);
  // highlight-refs voor visuele feedback op het getargete element
  const highlightRef = useRef(null);

  // ─── Drag-and-drop van ModelPicker FieldRef naar DRD-elementen ──────

  const clearHighlight = useCallback(() => {
    if (highlightRef.current) {
      highlightRef.current.style.outline = "";
      highlightRef.current.style.outlineOffset = "";
      highlightRef.current = null;
    }
  }, []);

  /** Zoek het DMN-diagram-element onder de muis via data-element-id attributen
   *  in de container. Gebruikt bounding-box vergelijking (betrouwbaarder dan
   *  elementsFromPoint bij SVG met complexe pointer-events). */
  const findElementUnderPoint = useCallback((clientX, clientY) => {
    const modeler = modelerRef.current;
    const container = containerRef.current;
    if (!modeler || !container) return null;

    const activeViewer = modeler.getActiveViewer();
    const registry = activeViewer?.get?.("elementRegistry");
    if (!registry) return null;

    // Verzamel alle dmn-js elementen via data-element-id attributen
    const nodes = container.querySelectorAll("[data-element-id]");
    let best = null;
    let bestArea = Infinity;

    for (const node of nodes) {
      const id = node.getAttribute("data-element-id");
      if (!id) continue;
      const rect = node.getBoundingClientRect();
      // Check of het punt binnen de bounding box valt
      if (
        clientX >= rect.left && clientX <= rect.right &&
        clientY >= rect.top && clientY <= rect.bottom
      ) {
        const elem = registry.get(id);
        if (!elem) continue;
        const t = elem.$type || elem.type || "";
        // Sla diagram-container elementen over
        if (t === "dmn:Definitions" || t === "dmn:DMNDiagram") continue;
        const area = rect.width * rect.height;
        if (area < bestArea) {
          bestArea = area;
          best = elem;
        }
      }
    }
    return best;
  }, []);

  /** Zoek het DOM-SVG-element van een dmn-js element voor visuele highlight. */
  const findDomElement = useCallback((elementId) => {
    const container = containerRef.current;
    if (!container || !elementId) return null;
    return container.querySelector(`[data-element-id="${elementId}"]`);
  }, []);

  const highlightTarget = useCallback((element) => {
    clearHighlight();
    if (!element) return;
    const domEl = findDomElement(element.id);
    if (domEl) {
      domEl.style.outline = "2px solid #4fc3f7";
      domEl.style.outlineOffset = "2px";
      highlightRef.current = domEl;
    }
  }, [clearHighlight, findDomElement]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    const target = findElementUnderPoint(e.clientX, e.clientY);
    hoveredElementRef.current = target;
    highlightTarget(target);
  }, [findElementUnderPoint, highlightTarget]);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
  }, []);

  const handleDragLeave = useCallback((e) => {
    // Alleen clearen als we de container verlaten (niet een child)
    if (e.currentTarget === e.target) {
      clearHighlight();
    }
  }, [clearHighlight]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    clearHighlight();
    const fieldRefJson = e.dataTransfer.getData(FIELDREF_MIME);
    if (!fieldRefJson) {
      setDebugMsg("Drop: geen FieldRef data — sleep je wel een veld uit het Canoniek model?");
      setTimeout(() => setDebugMsg(null), 4000);
      return;
    }

    let fieldRef;
    try {
      fieldRef = JSON.parse(fieldRefJson);
    } catch (err) {
      setDebugMsg("Drop: fout bij parsen FieldRef JSON");
      setTimeout(() => setDebugMsg(null), 4000);
      return;
    }

    const target = hoveredElementRef.current || findElementUnderPoint(e.clientX, e.clientY);
    if (!target) {
      // Diagnostiek: tel data-element-id nodes
      const nodeCount = containerRef.current?.querySelectorAll?.("[data-element-id]")?.length || 0;
      setDebugMsg(`Drop: geen DMN-element onder cursor (${nodeCount} data-element-id nodes in canvas). Sleep naar een inputData of decision.`);
      setTimeout(() => setDebugMsg(null), 5000);
      return;
    }

    const targetType = target.$type || target.type || "";
    if (targetType !== "dmn:InputData" && targetType !== "dmn:Decision") {
      setDebugMsg(`Drop: element is ${targetType} — alleen inputData en decision ondersteund`);
      setTimeout(() => setDebugMsg(null), 4000);
      return;
    }

    if (dropFieldRefRef.current) {
      dropFieldRefRef.current(target, fieldRef);
      setDebugMsg(`✓ Gekoppeld: "${fieldRef.veldpad}" → ${targetType.replace("dmn:","")} "${target.name || target.id}"`);
      setTimeout(() => setDebugMsg(null), 4000);
    }
    hoveredElementRef.current = null;
  }, [clearHighlight, findElementUnderPoint]);

  const meldView = useCallback((view) => {
    if (viewChangeRef.current) {
      viewChangeRef.current({
        id: view?.id || null,
        type: view?.type || null,
        element: view?.element
          ? {
              id: view.element.id,
              name: view.element.name || view.element.$type || "",
              type: view.element.$type || "",
            }
          : null,
      });
    }
  }, []);

  useEffect(() => {
    const modeler = new DmnJS({
      container: containerRef.current,
    });
    modelerRef.current = modeler;

    // Houd bij welke viewer momenteel de selection-listener heeft.
    let currentViewer = null;
    let selectionHandler = null;
    let hoverHandler = null;

    /** Koppel de selection.changed listener aan de actieve sub-viewer. */
    const bindSelection = (viewer) => {
      // Ontkoppel de oude listener.
      if (currentViewer && selectionHandler) {
        currentViewer.off("selection.changed", selectionHandler);
      }
      currentViewer = viewer;
      if (!viewer) return;

      selectionHandler = (event) => {
        const { newSelection } = event;
        if (selectionChangeRef.current) {
          selectionChangeRef.current(newSelection);
        }
      };
      viewer.on("selection.changed", selectionHandler);
    };

    /** Koppel element.hover listener voor drag-and-drop targeting. */
    const bindHoverTracker = (viewer) => {
      if (currentViewer && hoverHandler) {
        currentViewer.off("element.hover", hoverHandler);
      }
      if (!viewer) {
        hoveredElementRef.current = null;
        return;
      }
      hoverHandler = (event) => {
        // event.element is het dmn-js diagram-element (met id, type, businessObject)
        hoveredElementRef.current = event.element || null;
      };
      viewer.on("element.hover", hoverHandler);
    };

    // Luister naar view-wisselingen (DRD ↔ Decision Table ↔ Literal Expression).
    modeler.on("views.changed", (event) => {
      const { activeView } = event;
      meldView(activeView);
      // Haal de actieve viewer op en koppel selection listener.
      const activeViewer = modeler.getActiveViewer();
      bindSelection(activeViewer);
      // Koppel ook de hover-tracker voor drag-and-drop.
      bindHoverTracker(activeViewer);
    });

    if (xml) {
      modeler
        .importXML(xml)
        .then(({ warnings }) => {
          if (warnings?.length) {
            // eslint-disable-next-line no-console
            console.warn("[DmnModeler] importXML waarschuwingen:", warnings);
          }
          // Meld de initiële view + koppel selection listener.
          const activeView = modeler.getActiveView();
          meldView(activeView);
          const activeViewer = modeler.getActiveViewer();
          bindSelection(activeViewer);
          bindHoverTracker(activeViewer);
        })
        .catch((err) => {
          if (onError) onError(err);
          // eslint-disable-next-line no-console
          console.error("[DmnModeler] importXML faalde:", err);
        });
    }

    return () => {
      if (currentViewer && selectionHandler) {
        currentViewer.off("selection.changed", selectionHandler);
      }
      if (currentViewer && hoverHandler) {
        currentViewer.off("element.hover", hoverHandler);
      }
      modeler.destroy();
      modelerRef.current = null;
    };
    // xml is alleen de initiële bron; wijzigingen lopen via de modeler zelf.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    /** Importeer nieuwe DMN XML. Vervangt de huidige inhoud. */
    async importXML(xmlString) {
      const modeler = modelerRef.current;
      if (!modeler) throw new Error("DmnModeler niet geïnitialiseerd");
      const result = await modeler.importXML(xmlString);
      const activeView = modeler.getActiveView();
      meldView(activeView);
      return result;
    },

    /** Exporteer de huidige DMN als geformatteerde XML. */
    async exportXML() {
      const modeler = modelerRef.current;
      if (!modeler) return "";
      const { xml: out } = await modeler.saveXML({ format: true });
      return out;
    },

    /** Haal alle beschikbare views op (DRD, Decision Tables, etc.). */
    getViews() {
      const modeler = modelerRef.current;
      if (!modeler) return [];
      return modeler.getViews().map((v) => ({
        id: v.id,
        type: v.type,
        element: v.element
          ? {
              id: v.element.id,
              name: v.element.name || "",
              type: v.element.$type || "",
            }
          : null,
      }));
    },

    /** Open een specifieke view by id. */
    openView(viewId) {
      const modeler = modelerRef.current;
      if (!modeler) return false;
      const views = modeler.getViews();
      const view = views.find((v) => v.id === viewId || v.element?.id === viewId);
      if (view) {
        modeler.open(view);
        return true;
      }
      return false;
    },

    /** Haal de actieve view op. */
    getActiveView() {
      const modeler = modelerRef.current;
      if (!modeler) return null;
      const v = modeler.getActiveView();
      return v
        ? { id: v.id, type: v.type, elementId: v.element?.id }
        : null;
    },

    /** Haal de actieve sub-viewer op (voor modeling API, eventBus, etc.). */
    getActiveViewer() {
      const modeler = modelerRef.current;
      if (!modeler) return null;
      return modeler.getActiveViewer();
    },

    /** Toegangs tot de onderliggende dmn-js Modeler-instantie (voor geavanceerd gebruik). */
    getModeler() {
      return modelerRef.current;
    },
  }));

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={containerRef}
        className={`dmn-modeler-canvas ${className}`}
        style={{ width: "100%", height: "100%" }}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      />
      {debugMsg && (
        <div style={{
          position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
          background: debugMsg.startsWith("✓") ? "#1b5e20" : "#b71c1c",
          color: "#fff", padding: "6px 16px", borderRadius: 6, fontSize: 12,
          zIndex: 9999, whiteSpace: "nowrap", pointerEvents: "none",
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}>
          {debugMsg}
        </div>
      )}
    </div>
  );
});

export default DmnModeler;
