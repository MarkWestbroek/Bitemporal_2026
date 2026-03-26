/**
 * Toolbar — Werkbalk boven de editor.
 *
 * Knoppen:
 *   - Nieuwe entiteit / GE / relatie / enumeratie toevoegen
 *   - Opslaan / laden (JSON)
 *   - Laden vanuit model/schema-API
 */
import { maakLeegType, maakLegeEnumeratie, maakLeegGegevenstype } from "../../metamodel/types";

export default function Toolbar({ onAddNode, onSave, onPublishSchemaModel, onLoad, onLoadSchema, onToggleTestInvoer, showTestInvoer, onExportMermaid, onExportPlantUML, onExportXMI }) {
  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <span className="toolbar-label">Toevoegen:</span>
        <button
          onClick={() => onAddNode(maakLeegType("entiteit"), "entiteit")}
          className="btn-toolbar entiteit"
        >
          + Entiteit
        </button>
        <button
          onClick={() =>
            onAddNode(maakLeegType("gegevenselement"), "gegevenselement")
          }
          className="btn-toolbar ge"
        >
          + GE
        </button>
        <button
          onClick={() => onAddNode(maakLeegType("relatie"), "relatie")}
          className="btn-toolbar relatie"
        >
          + Relatie
        </button>
        <button
          onClick={() => {
            const e = maakLegeEnumeratie();
            onAddNode({ id: e.id, naam: e.naam, waarden: e.waarden }, "enumeratie");
          }}
          className="btn-toolbar enum"
        >
          + Enumeratie
        </button>
        <button
          onClick={() => {
            const dt = maakLeegGegevenstype();
            onAddNode(
              {
                id: dt.id,
                naam: dt.naam,
                description: dt.description,
                basistype: dt.basistype,
                format: dt.format,
                validatie: dt.validatie,
                normalisatie: dt.normalisatie,
                weergave: dt.weergave,
              },
              "gegevenstype"
            );
          }}
          className="btn-toolbar datatype"
        >
          + Gegevenstype
        </button>
      </div>

      <div className="toolbar-group">
        <button onClick={onSave} className="btn-toolbar save">
          💾 Opslaan (JSON)
        </button>
        {onPublishSchemaModel && (
          <button onClick={onPublishSchemaModel} className="btn-toolbar publish">
            ☁ Publiceer schema-model
          </button>
        )}
        <button onClick={onLoad} className="btn-toolbar load">
          📂 Laden (JSON)
        </button>
        {onLoadSchema && (
          <button onClick={onLoadSchema} className="btn-toolbar schema">
            🔌 Laden van model-API
          </button>
        )}
        {onToggleTestInvoer && (
          <button
            onClick={onToggleTestInvoer}
            className={`btn-toolbar test-invoer ${showTestInvoer ? "active" : ""}`}
          >
            🧪 Test invoer
          </button>
        )}
      </div>

      <div className="toolbar-group">
        <span className="toolbar-label">Export:</span>
        {onExportMermaid && (
          <button onClick={onExportMermaid} className="btn-toolbar export-mermaid">
            🧜 Mermaid
          </button>
        )}
        {onExportPlantUML && (
          <button onClick={onExportPlantUML} className="btn-toolbar export-plantuml">
            🌱 PlantUML
          </button>
        )}
        {onExportXMI && (
          <button onClick={onExportXMI} className="btn-toolbar export-xmi">
            📦 XMI 1.1
          </button>
        )}
      </div>
    </div>
  );
}
