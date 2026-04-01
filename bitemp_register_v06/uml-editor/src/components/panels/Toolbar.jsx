/**
 * Toolbar — Werkbalk boven de editor.
 *
 * Layout (links → rechts):
 *   Links:  Toevoegen: entiteit / GE / relatie / enumeratie / gegevenstype + Ref.lijsten
 *   Rechts (twee rijen):
 *     Rij 1: Import (XMI / Mermaid / PlantUML) + Export (Mermaid / PlantUML / XMI)
 *     Rij 2: Opslaan / Laden / Publiceer / Haal op / Test invoer
 */
import { maakLeegType, maakLegeEnumeratie, maakLeegGegevenstype, maakReferentielijstSet } from "../../metamodel/types";

export default function Toolbar({ onAddNode, onAddReferentielijstSet, onAddReferentielijstInstantie, onSave, onPublishSchemaModel, onLoad, onLoadSchema, onToggleTestInvoer, showTestInvoer, onExportMermaid, onExportPlantUML, onExportXMI, onImportXMI, onImportMermaid, onImportPlantUML, modelNaam, modelBron, modelOpmerking }) {
  return (
    <div className="toolbar">
      {/* Model-info (titel) — alleen tonen als modelNaam doorgegeven is */}
      {modelNaam && (
        <div className="toolbar-group toolbar-model-info">
          <span style={{ fontWeight: 600, color: "#f8fafc", fontSize: "13px" }}>Editor v2</span>
          <span style={{ color: "#94a3b8" }}>|</span>
          <span
            style={{ color: "#94a3b8", fontSize: "12px", maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            title={modelOpmerking || "Geen opmerking/beschrijving beschikbaar"}
          >
            {modelNaam}
          </span>
          <span
            style={{
              color: modelBron === "demo" ? "#fbbf24" : "#4ade80",
              fontSize: "11px",
            }}
            title="Herkomst van het geladen model"
          >
            [{modelBron}]
          </span>
        </div>
      )}
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

      {/* Referentielijsten — aparte groep (zie Referentielijsten.md §7) */}
      <div className="toolbar-group">
        <span className="toolbar-label">Ref.lijsten:</span>
        <button
          onClick={() => onAddReferentielijstSet && onAddReferentielijstSet()}
          className="btn-toolbar reflijst"
          title="Maak een volledige referentielijst-set: lijst + item + koppelrelatie"
        >
          + Referentielijst
        </button>
        <button
          onClick={() => onAddNode(maakLeegType("entiteit", "referentielijst_item"), "entiteit")}
          className="btn-toolbar refitem"
          title="Voeg een los referentielijst-item type toe"
        >
          + Ref. Item
        </button>
        <button
          onClick={() => onAddNode(maakLeegType("relatie", "referentielijst_items"), "relatie")}
          className="btn-toolbar refitems"
          title="Voeg een referentielijst-items koppelrelatie toe"
        >
          + Ref. Items
        </button>
        <button
          onClick={() => onAddReferentielijstInstantie && onAddReferentielijstInstantie()}
          className="btn-toolbar refinstantie"
          title="Voeg een referentielijst-instantie toe (bijv. Landenlijst)"
        >
          + Ref. Instantie
        </button>
      </div>

      {/* Rechts: twee rijen — import/export bovenaan, bestandsacties daaronder */}
      <div className="toolbar-right">
        <div className="toolbar-right-row">
          <div className="toolbar-group">
            <span className="toolbar-label">Import:</span>
            {onImportXMI && (
              <button onClick={onImportXMI} className="btn-toolbar import-xmi">
                📥 XMI
              </button>
            )}
            {onImportMermaid && (
              <button onClick={onImportMermaid} className="btn-toolbar import-mermaid">
                📥 Mermaid
              </button>
            )}
            {onImportPlantUML && (
              <button onClick={onImportPlantUML} className="btn-toolbar import-plantuml">
                📥 PlantUML
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

        <div className="toolbar-right-row">
          <div className="toolbar-group">
            <button onClick={onSave} className="btn-toolbar save" title="Sla het model lokaal op als JSON-bestand">
              💾 Opslaan
            </button>
            <button onClick={onLoad} className="btn-toolbar load" title="Laad een model vanuit een lokaal JSON-bestand">
              📂 Laden
            </button>
            {onPublishSchemaModel && (
              <button onClick={onPublishSchemaModel} className="btn-toolbar publish" title="Publiceer het model naar de API-database">
                ☁ Publiceer
              </button>
            )}
            {onLoadSchema && (
              <button onClick={onLoadSchema} className="btn-toolbar haal-op" title="Haal het model op vanuit de API-database">
                📡 Haal op
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
        </div>
      </div>
    </div>
  );
}
