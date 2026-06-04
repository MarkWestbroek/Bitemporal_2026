/**
 * Toolbar — Werkbalk boven de editor.
 *
 * Layout (links → rechts):
 *   Links:  Toevoegen: entiteit / GE / relatie / enumeratie / gegevenstype + Ref.lijsten
 *   Rechts (twee rijen):
 *     Rij 1: Import (XMI / Mermaid / PlantUML) + Export (Mermaid / PlantUML / XMI)
 *     Rij 2: Opslaan / Laden / Publiceer / Publiceer+Rebuild / Rebuild / Haal op / Test invoer
 */
import { maakLeegType, maakLegeEnumeratie, maakLeegGegevenstype, maakLegeNotitie, maakLegeConstraint, EDGE_MODES } from "../../metamodel/types";

export default function Toolbar({ onAddNode, onAddReferentielijstSet, onAddReferentielijstInstantie, onSave, onSaveEditorFlow, onPublishSchemaModel, onPublishAndRebuild, onRebuildModel, onLoad, onLoadSchema, onToggleTestInvoer, showTestInvoer, onExportMermaid, onExportPlantUML, onExportXMI, onImportXMI, onImportMermaid, onImportPlantUML, modelNaam, modelBron, modelOpmerking, actiefDomein, beschikbareDomeinen, domeinSelectieActief = false, onSetActiefDomein, onSelecteerDomein, onNormaliseerAlleRelaties, onSnapAlleNaarGrid, onAutoLayout, layoutRichting = "TB", onSetLayoutRichting, activeEdgeMode, onSetActiveEdgeMode, theme = "dark", onToggleTheme }) {
  const domeinen = beschikbareDomeinen || [];
  const domeinSelectieTitel = !actiefDomein
    ? "Kies eerst een actief domein"
    : domeinSelectieActief
      ? `Deselecteer alle elementen van domein \"${actiefDomein}\"`
      : `Selecteer alle elementen van domein \"${actiefDomein}\"`;

  return (
    <div className="toolbar">
      <div className="toolbar-top">
        {modelNaam && (
          <div className="toolbar-group toolbar-model-info">
            <span style={{ fontWeight: 600, color: "#f8fafc", fontSize: "13px" }}>Editor v2</span>
            <span style={{ color: "#94a3b8" }}>|</span>
            <span
              style={{ color: "#94a3b8", fontSize: "12px", maxWidth: "320px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              title={modelOpmerking || "Geen opmerking/beschrijving beschikbaar"}
            >
              {modelNaam}
            </span>
            <span
              style={{ color: modelBron === "demo" ? "#fbbf24" : "#4ade80", fontSize: "11px" }}
              title="Herkomst van het geladen model"
            >
              [{modelBron}]
            </span>
          </div>
        )}
      </div>

      <div className="toolbar-row">
        <div className="toolbar-row-left">
          <div className="toolbar-group">
            <span className="toolbar-label">Toevoegen:</span>
            <button onClick={() => onAddNode(maakLeegType("entiteit"), "entiteit")} className="btn-toolbar entiteit">+ Entiteit</button>
            <button onClick={() => onAddNode(maakLeegType("gegevenselement"), "gegevenselement")} className="btn-toolbar ge">+ GE</button>
            <button onClick={() => onAddNode(maakLeegType("relatie"), "relatie")} className="btn-toolbar relatie">+ Relatie</button>
            <button
              onClick={() => {
                const e = maakLegeEnumeratie();
                onAddNode({ id: e.id, naam: e.naam, domein: e.domein, waarden: e.waarden }, "enumeratie");
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
                    domein: dt.domein,
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
            {/* C8: notities en constraints */}
            <button
              onClick={() => {
                const n = maakLegeNotitie();
                onAddNode({ id: n.id, tekst: n.tekst, kleur: n.kleur, domein: n.domein }, "notitie");
              }}
              className="btn-toolbar"
              style={{ background: "#fffde7", color: "#78350f", border: "1px solid #fbbf24" }}
              title="Nieuwe notitie (annotatie)"
            >
              📝 Notitie
            </button>
            <button
              onClick={() => {
                const c = maakLegeConstraint();
                onAddNode({ id: c.id, naam: c.naam, expressie: c.expressie, taal: c.taal, domein: c.domein }, "constraint");
              }}
              className="btn-toolbar"
              style={{ background: "#e0f2fe", color: "#075985", border: "1px solid #38bdf8" }}
              title="Nieuwe constraint (OCL/CEL/tekst)"
            >
              🔒 Constraint
            </button>
          </div>

          <div className="toolbar-group">
            <span className="toolbar-label">Layout:</span>
            {onAutoLayout && <button onClick={onAutoLayout} className="btn-toolbar" title="Orden alle elementen logisch (ENT centraal, GE's eronder, RELs tussen ENTs, per domein gegroepeerd)">🎯 Auto-layout</button>}
            {onSetLayoutRichting && (
              <select
                className="btn-toolbar"
                value={layoutRichting}
                onChange={(e) => onSetLayoutRichting(e.target.value)}
                title="Richting waarin de auto-layout zijn blokken bouwt"
                style={{ padding: "2px 6px" }}
              >
                <option value="TB">↓ Top→Bottom</option>
                <option value="BT">↑ Bottom→Top</option>
                <option value="LR">→ Left→Right</option>
                <option value="RL">← Right→Left</option>
                <option value="radial">⊙ Radial</option>
                <option value="hierarchisch">🌳 Hiërarchisch</option>
              </select>
            )}
            {onNormaliseerAlleRelaties && <button onClick={onNormaliseerAlleRelaties} className="btn-toolbar" title="Normaliseer alle relaties (kortste weg)">↔ Normaliseer</button>}
            {onSnapAlleNaarGrid && <button onClick={onSnapAlleNaarGrid} className="btn-toolbar" title="Snap alle elementen naar het grid">⊞ Snap grid</button>}
          </div>

          {onSetActiveEdgeMode && (
            <div className="toolbar-group toolbar-edge-modes">
              <span className="toolbar-label">Verbinding:</span>
              {[EDGE_MODES.COMPOSITIE, EDGE_MODES.GENERALISATIE].map((mode) => (
                <button
                  key={mode.key}
                  onClick={() => onSetActiveEdgeMode(activeEdgeMode === mode ? EDGE_MODES.NONE : mode)}
                  className={`btn-toolbar edge-mode ${activeEdgeMode === mode ? "active" : ""}`}
                  title={`${mode.label}-verbinding tekenen (klik, sleep van bron naar doel${activeEdgeMode === mode ? ", of klik om te annuleren" : ""})`}
                  aria-pressed={activeEdgeMode === mode}
                >
                  {mode.icon} {mode.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="toolbar-row-right">
          <div className="toolbar-group">
            <span className="toolbar-label">Import:</span>
            {onImportXMI && <button onClick={onImportXMI} className="btn-toolbar import-xmi">📥 XMI</button>}
            {onImportMermaid && <button onClick={onImportMermaid} className="btn-toolbar import-mermaid">📥 Mermaid</button>}
            {onImportPlantUML && <button onClick={onImportPlantUML} className="btn-toolbar import-plantuml">📥 PlantUML</button>}
          </div>

          <div className="toolbar-group">
            <span className="toolbar-label">Export:</span>
            {onExportMermaid && <button onClick={onExportMermaid} className="btn-toolbar export-mermaid">🧜 Mermaid</button>}
            {onExportPlantUML && <button onClick={onExportPlantUML} className="btn-toolbar export-plantuml">🌱 PlantUML</button>}
            {onExportXMI && <button onClick={onExportXMI} className="btn-toolbar export-xmi">📦 XMI 1.1</button>}
          </div>
        </div>
      </div>

      <div className="toolbar-row">
        <div className="toolbar-row-left">
          <div className="toolbar-group toolbar-domein">
            <span className="toolbar-label">Domein:</span>
            <select
              value={actiefDomein || ""}
              onChange={(e) => onSetActiefDomein && onSetActiefDomein(e.target.value || null)}
              className="toolbar-select"
              title="Filter weergave op domein"
            >
              <option value="">(alle)</option>
              {domeinen.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <button
              onClick={() => onSelecteerDomein && onSelecteerDomein()}
              className={`btn-toolbar domein-select ${domeinSelectieActief ? "active" : ""}`.trim()}
              disabled={!actiefDomein}
              title={domeinSelectieTitel}
              aria-pressed={domeinSelectieActief}
            >
              {domeinSelectieActief ? "☑ Selecteer" : "☐ Selecteer"}
            </button>
          </div>

          <div className="toolbar-group">
            <span className="toolbar-label">Ref.lijsten:</span>
            <button onClick={() => onAddReferentielijstSet && onAddReferentielijstSet()} className="btn-toolbar reflijst" title="Maak een volledige referentielijst-set: lijst + item + koppelrelatie">+ Referentielijst</button>
            <button onClick={() => onAddNode(maakLeegType("entiteit", "referentielijst_item"), "entiteit")} className="btn-toolbar refitem" title="Voeg een los referentielijst-item type toe">+ Ref. Item</button>
            <button onClick={() => onAddNode(maakLeegType("relatie", "referentielijst_items"), "relatie")} className="btn-toolbar refitems" title="Voeg een referentielijst-items koppelrelatie toe">+ Ref. Items</button>
            <button onClick={() => onAddReferentielijstInstantie && onAddReferentielijstInstantie()} className="btn-toolbar refinstantie" title="Voeg een referentielijst-instantie toe (bijv. Landenlijst)">+ Ref. Instantie</button>
          </div>
        </div>

        <div className="toolbar-row-right">
          <div className="toolbar-group">
            <button
              onClick={onToggleTheme}
              className="btn-toolbar theme-toggle"
              title={`Wissel naar ${theme === "dark" ? "licht" : "donker"} thema`}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <button onClick={onSave} className="btn-toolbar save" title="Sla het model lokaal op als JSON-bestand">💾 Opslaan</button>
            {onSaveEditorFlow && (
              <button onClick={onSaveEditorFlow} className="btn-toolbar save" title="Sla de rauwe editor-staat (nodes/edges) op als .editor-flow.json — handig tijdens ontwikkelen om een werkende canvas-staat te bewaren, ook als die nog niet als V3-model geldig is">💾⚡ Ruwe staat</button>
            )}
            <button onClick={onLoad} className="btn-toolbar load" title="Laad een model vanuit een lokaal JSON-bestand">📂 Laden</button>
            {onPublishSchemaModel && <button onClick={onPublishSchemaModel} className="btn-toolbar publish" title="Publiceer het model naar de API-database">☁ Publiceer</button>}
            {onPublishAndRebuild && <button onClick={onPublishAndRebuild} className="btn-toolbar publish" title="Publiceer het model en rebuild daarna exact die opgeslagen schema-versie">☁🔁 Pub+Rebuild</button>}
            {onRebuildModel && <button onClick={onRebuildModel} className="btn-toolbar publish" title="Genereer Go-code en herstart de devloop API">🔁 Rebuild</button>}
            {onLoadSchema && <button onClick={onLoadSchema} className="btn-toolbar haal-op" title="Haal het model op vanuit de API-database">📡 Haal op</button>}
            {onToggleTestInvoer && (
              <button onClick={onToggleTestInvoer} className={`btn-toolbar test-invoer ${showTestInvoer ? "active" : ""}`}>
                🧪 Test invoer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
