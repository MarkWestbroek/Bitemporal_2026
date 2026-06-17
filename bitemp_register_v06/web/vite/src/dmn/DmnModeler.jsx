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
import { forwardRef, useEffect, useImperativeHandle, useRef, useCallback } from "react";
import DmnJS from "dmn-js/lib/Modeler";

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
  { xml, onViewChange, onError, className = "" },
  ref
) {
  const containerRef = useRef(null);
  const modelerRef = useRef(null);
  const viewChangeRef = useRef(onViewChange);
  viewChangeRef.current = onViewChange;

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
      common: {
        keyboard: { bindTo: document },
      },
    });
    modelerRef.current = modeler;

    // Luister naar view-wisselingen (DRD ↔ Decision Table ↔ Literal Expression).
    modeler.on("views.changed", (event) => {
      const { activeView } = event;
      meldView(activeView);
    });

    if (xml) {
      modeler
        .importXML(xml)
        .then(({ warnings }) => {
          if (warnings?.length) {
            // eslint-disable-next-line no-console
            console.warn("[DmnModeler] importXML waarschuwingen:", warnings);
          }
          // Meld de initiële view.
          const activeView = modeler.getActiveView();
          meldView(activeView);
        })
        .catch((err) => {
          if (onError) onError(err);
          // eslint-disable-next-line no-console
          console.error("[DmnModeler] importXML faalde:", err);
        });
    }

    return () => {
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

    /** Toegangs tot de onderliggende dmn-js Modeler-instantie (voor geavanceerd gebruik). */
    getModeler() {
      return modelerRef.current;
    },
  }));

  return (
    <div
      ref={containerRef}
      className={`dmn-modeler-canvas ${className}`}
      style={{ width: "100%", height: "100%" }}
    />
  );
});

export default DmnModeler;
